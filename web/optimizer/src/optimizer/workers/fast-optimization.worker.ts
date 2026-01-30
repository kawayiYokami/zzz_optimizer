/**
 * 快速优化器 Web Worker
 *
 * 使用 Float64Array 预计算数据实现高性能优化搜索。
 * 与原有 Worker 相比：
 * - 无音擎循环（音擎固定）
 * - 零对象创建的伤害计算
 * - 更高效的属性累加
 */

import { FastEvaluator } from './fast-evaluator';
import type {
  FastOptimizationRequest,
  DiscData,
  OptimizationBuildResult,
} from '../types/precomputed';

// Worker 上下文
const ctx: Worker = self as unknown as Worker;

/**
 * 快速优化进度消息
 */
interface FastOptimizationProgress {
  type: 'progress';
  processedCount: number;
  totalCombinations: number;
  currentBest: OptimizationBuildResult | null;
  speed: number;
  estimatedTimeRemaining: number;
  prunedCount: number;
}

/**
 * 快速优化结果消息
 */
interface FastOptimizationResult {
  type: 'result';
  builds: OptimizationBuildResult[];
  stats: {
    totalProcessed: number;
    prunedCount: number;
    timeMs: number;
    averageSpeed: number;
  };
}

/**
 * 错误消息
 */
interface FastWorkerError {
  type: 'error';
  message: string;
  stack?: string;
}

type FastWorkerMessage = FastOptimizationProgress | FastOptimizationResult | FastWorkerError;

/**
 * 最小堆，用于维护 TopN 结果
 * 使用简化的数据结构避免对象创建
 */
class FastMinHeap {
  private damages: Float64Array;
  private discIndices: Int32Array;  // 每个结果存储 6 个索引
  private multipliers: Float64Array;  // 每个结果存储 6 个乘区（基础直伤、基础异常伤、精通区、积蓄区、暴击区、增伤区）
  private size: number = 0;
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.damages = new Float64Array(maxSize);
    this.discIndices = new Int32Array(maxSize * 6);
    this.multipliers = new Float64Array(maxSize * 6);  // 6 个乘区
  }

  get length(): number {
    return this.size;
  }

  get minDamage(): number {
    return this.size > 0 ? this.damages[0] : 0;
  }

  /**
   * 尝试插入新结果
   * 返回是否成功插入
   */
  tryPush(damage: number, indices: number[], multipliers: number[]): boolean {
    if (this.size < this.maxSize) {
      // 堆未满，直接插入
      this.damages[this.size] = damage;
      const base = this.size * 6;
      for (let i = 0; i < 6; i++) {
        this.discIndices[base + i] = indices[i];
        this.multipliers[base + i] = multipliers[i];
      }
      this.size++;
      this.bubbleUp(this.size - 1);
      return true;
    } else if (damage > this.damages[0]) {
      // 新元素大于最小值，替换
      this.damages[0] = damage;
      for (let i = 0; i < 6; i++) {
        this.discIndices[i] = indices[i];
        this.multipliers[i] = multipliers[i];
      }
      this.bubbleDown(0);
      return true;
    }
    return false;
  }

  /**
   * 获取所有结果（按伤害降序）
   */
  getResults(
    evaluator: FastEvaluator,
    discsBySlot: DiscData[][]
  ): OptimizationBuildResult[] {
    // 创建排序索引
    const indices = new Int32Array(this.size);
    for (let i = 0; i < this.size; i++) {
      indices[i] = i;
    }

    // 使用快速排序算法
    indices.sort((a, b) => this.damages[b] - this.damages[a]);

    const results: OptimizationBuildResult[] = [];

    for (let i = 0; i < this.size; i++) {
      const heapIdx = indices[i];
      const base = heapIdx * 6;
      const discs: DiscData[] = [];

      for (let slot = 0; slot < 6; slot++) {
        const discIdx = this.discIndices[base + slot];
        discs.push(discsBySlot[slot][discIdx]);
      }

      // 使用 FastEvaluator 创建完整结果
      const damage = this.damages[heapIdx];
      const multipliersArray: number[] = [];
      for (let j = 0; j < 6; j++) {
        multipliersArray.push(this.multipliers[base + j]);
      }
      const fullResult = evaluator.createFullResult(discs, damage, multipliersArray);
      results.push(fullResult);
    }

    return results;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.damages[parentIndex] <= this.damages[index]) break;
      this.swap(parentIndex, index);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.size && this.damages[leftChild] < this.damages[smallest]) {
        smallest = leftChild;
      }
      if (rightChild < this.size && this.damages[rightChild] < this.damages[smallest]) {
        smallest = rightChild;
      }

      if (smallest === index) break;
      this.swap(smallest, index);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    // 使用临时变量代替解构交换，避免创建临时数组
    const tmpDamage = this.damages[i];
    this.damages[i] = this.damages[j];
    this.damages[j] = tmpDamage;

    // 交换盘索引
    const baseI = i * 6;
    const baseJ = j * 6;
    for (let k = 0; k < 6; k++) {
      const tmpIdx = this.discIndices[baseI + k];
      this.discIndices[baseI + k] = this.discIndices[baseJ + k];
      this.discIndices[baseJ + k] = tmpIdx;
    }

    // 交换乘区
    for (let k = 0; k < 6; k++) {
      const tmpMult = this.multipliers[baseI + k];
      this.multipliers[baseI + k] = this.multipliers[baseJ + k];
      this.multipliers[baseJ + k] = tmpMult;
    }
  }
}

/**
 * 计算总组合数
 */
function calculateTotalCombinations(discsBySlot: DiscData[][]): number {
  let total = 1;
  for (let slot = 0; slot < 6; slot++) {
    const count = discsBySlot[slot].length;
    if (count === 0) return 0;
    total *= count;
  }
  return total;
}

/**
 * 运行快速优化
 */
let shouldCancel = false;

function runFastOptimization(request: FastOptimizationRequest): void {
  const startTime = performance.now();

  const {
    precomputed,
    topN,
    pruneThreshold,
    progressInterval,
    workerId,
    totalWorkers,
    estimatedTotal,
  } = request;

  const { discsBySlot } = precomputed;

  // 重置取消标志
  shouldCancel = false;

  // 创建快速评估器
  const evaluator = new FastEvaluator(precomputed);

  // 初始化 TopN 堆
  const topNHeap = new FastMinHeap(topN);

  // 总组合数：进度计算使用全量组合数（Worker实际遍历的）
  const rawTotalCombinations = calculateTotalCombinations(discsBySlot);
  const totalCombinations = rawTotalCombinations;

  if (totalCombinations === 0) {
    const errorMsg: FastWorkerError = {
      type: 'error',
      message: '没有可用的驱动盘组合',
    };
    ctx.postMessage(errorMsg);
    return;
  }

  let processedCount = 0;
  let prunedCount = 0;
  let lastProgressTime = startTime;

  // 用于剪枝的最低有效词条得分
  let minTopNEffectiveScore = 0;

  // 获取每个位置的最大得分
  const maxScorePerSlot: number[] = [];
  for (let slot = 0; slot < 6; slot++) {
    let maxScore = 0;
    for (const disc of discsBySlot[slot]) {
      maxScore = Math.max(maxScore, disc.effectiveScore);
    }
    maxScorePerSlot.push(maxScore);
  }

  // 复用的盘索引数组
  const discIndices = [0, 0, 0, 0, 0, 0];
  // 复用的盘数据数组
  const discArray: DiscData[] = new Array(6);

  // 获取每个位置的盘数量
  const slot0Count = discsBySlot[0].length;
  const slot1Count = discsBySlot[1].length;
  const slot2Count = discsBySlot[2].length;
  const slot3Count = discsBySlot[3].length;
  const slot4Count = discsBySlot[4].length;
  const slot5Count = discsBySlot[5].length;

  // 多 Worker 分片：根据第一层循环分片
  const startIdx = Math.floor(slot0Count * workerId / totalWorkers);
  const endIdx = Math.floor(slot0Count * (workerId + 1) / totalWorkers);

  // 主循环：遍历所有组合（无音擎循环）
  for (let i0 = startIdx; i0 < endIdx && !shouldCancel; i0++) {
    const disc0 = discsBySlot[0][i0];
    const score0 = disc0.effectiveScore;
    discIndices[0] = i0;

    for (let i1 = 0; i1 < slot1Count && !shouldCancel; i1++) {
      const disc1 = discsBySlot[1][i1];
      const score1 = score0 + disc1.effectiveScore;
      discIndices[1] = i1;

      for (let i2 = 0; i2 < slot2Count && !shouldCancel; i2++) {
        const disc2 = discsBySlot[2][i2];
        const score2 = score1 + disc2.effectiveScore;
        discIndices[2] = i2;

        for (let i3 = 0; i3 < slot3Count && !shouldCancel; i3++) {
          const disc3 = discsBySlot[3][i3];
          const score3 = score2 + disc3.effectiveScore;
          discIndices[3] = i3;

          // 剪枝检查：当前得分 + 剩余最优 < TopN最低得分 - 阈值
          const maxRemaining45 = maxScorePerSlot[4] + maxScorePerSlot[5];
          if (score3 + maxRemaining45 < minTopNEffectiveScore - pruneThreshold) {
            prunedCount += slot4Count * slot5Count;
            continue;
          }

          for (let i4 = 0; i4 < slot4Count && !shouldCancel; i4++) {
            const disc4 = discsBySlot[4][i4];
            const score4 = score3 + disc4.effectiveScore;
            discIndices[4] = i4;

            // 再次剪枝
            if (score4 + maxScorePerSlot[5] < minTopNEffectiveScore - pruneThreshold) {
              prunedCount += slot5Count;
              continue;
            }

            for (let i5 = 0; i5 < slot5Count && !shouldCancel; i5++) {
              const disc5 = discsBySlot[5][i5];
              const totalScore = score4 + disc5.effectiveScore;
              discIndices[5] = i5;

              // 最终剪枝
              if (totalScore < minTopNEffectiveScore - pruneThreshold) {
                prunedCount++;
                continue;
              }

              // 填充盘数组
              discArray[0] = disc0;
              discArray[1] = disc1;
              discArray[2] = disc2;
              discArray[3] = disc3;
              discArray[4] = disc4;
              discArray[5] = disc5;

              // 计算伤害和乘区
              const result = evaluator.calculateDamageWithMultipliers(discArray);

              // 目标盘数不足4，跳过此组合
              if (result === null) {
                // 只计入 processedCount，不计入 prunedCount
                // prunedCount 用于早期剪枝（分数剪枝），这里是完整遍历后的过滤
                processedCount++;

                // 定期上报进度
                if (processedCount % progressInterval === 0) {
                  const currentTime = performance.now();
                  const elapsedSeconds = (currentTime - startTime) / 1000;
                  const speed = processedCount / elapsedSeconds;
                  const remaining = totalCombinations - processedCount - prunedCount;
                  const estimatedTimeRemaining = remaining / speed;

                  const progress: FastOptimizationProgress = {
                    type: 'progress',
                    processedCount: processedCount + prunedCount,
                    totalCombinations,
                    currentBest: null,
                    speed,
                    estimatedTimeRemaining,
                    prunedCount,
                  };
                  ctx.postMessage(progress);
                  lastProgressTime = currentTime;
                }
                continue;
              }

              // 更新 TopN
              const inserted = topNHeap.tryPush(result.damage, discIndices, result.multipliers);

              // 更新剪枝阈值：当堆已满且有新结果插入时，
              // 使用当前组合得分减去容差作为新的下限
              if (inserted && topNHeap.length >= topN) {
                minTopNEffectiveScore = Math.max(
                  minTopNEffectiveScore,
                  totalScore - pruneThreshold
                );
              }

              processedCount++;

              // 定期上报进度
              if (processedCount % progressInterval === 0) {
                const currentTime = performance.now();
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const speed = processedCount / elapsedSeconds;
                const remaining = totalCombinations - processedCount - prunedCount;
                const estimatedTimeRemaining = remaining / speed;

                const progress: FastOptimizationProgress = {
                  type: 'progress',
                  processedCount: processedCount + prunedCount,
                  totalCombinations,
                  currentBest: null,  // 省略详细结果以减少序列化开销
                  speed,
                  estimatedTimeRemaining,
                  prunedCount,
                };
                ctx.postMessage(progress);
                lastProgressTime = currentTime;
              }
            }
          }
        }
      }
    }
  }

  // 获取最终结果
  const builds = topNHeap.getResults(evaluator, discsBySlot);

  // 发送最终结果
  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  // 发送最终进度，使用真实的 totalCombinations
  // 注意：processedCount + prunedCount 应该等于该 worker 负责的组合数
  const finalProgress: FastOptimizationProgress = {
    type: 'progress',
    processedCount: processedCount + prunedCount,
    totalCombinations,  // 使用真实的总组合数
    currentBest: null,
    speed: (processedCount + prunedCount) / (totalTimeMs / 1000),
    estimatedTimeRemaining: 0,
    prunedCount,
  };
  ctx.postMessage(finalProgress);

  const result: FastOptimizationResult = {
    type: 'result',
    builds,
    stats: {
      totalProcessed: processedCount,
      prunedCount,
      timeMs: totalTimeMs,
      averageSpeed: (processedCount + prunedCount) / (totalTimeMs / 1000),
    },
  };
  ctx.postMessage(result);
}

// 消息处理器
ctx.onmessage = (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'cancel') {
    shouldCancel = true;
    return;
  }

  // 假设其他消息都是 FastOptimizationRequest
  try {
    runFastOptimization(message as FastOptimizationRequest);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const errorMsg: FastWorkerError = {
      type: 'error',
      message: errorMessage,
      stack: errorStack,
    };
    ctx.postMessage(errorMsg);
  }
};
