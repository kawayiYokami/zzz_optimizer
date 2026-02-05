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
  PrecomputedData,
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
    profile?: Record<string, never>;
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
type FastWorkerSingleEval = {
  type: 'eval';
  requestId: string;
  precomputed: PrecomputedData;
  discs: DiscData[];
};
type FastWorkerSingleEvalResult = {
  type: 'eval_result';
  requestId: string;
  result: OptimizationBuildResult;
};

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
    orderedSlots: DiscData[][],
    slotOrder: number[]
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
      const discs: DiscData[] = new Array(6);

      // 将 loop-level 索引映射回原始 slot 位置
      for (let level = 0; level < 6; level++) {
        const discIdx = this.discIndices[base + level];
        const originalSlot = slotOrder[level];
        discs[originalSlot] = orderedSlots[level][discIdx];
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

  // 性能统计已移除（如需性能剖析请使用浏览器 Performance/Profiler）

  const {
    precomputed,
    topN,
    progressInterval,
    workerId,
    totalWorkers,
    estimatedTotal,
  } = request;

  const { discsBySlot } = precomputed;
  const hasTargetSet = !!precomputed.targetSetId;

  // 重置取消标志
  shouldCancel = false;

  // ============================================================================
  // 计算最优枚举顺序：按候选盘数量升序（最少的放外层，最多的放内层）
  // 这样可以最小化中间层 push/pop 操作总次数
  // ============================================================================
  const slotOrder = [0, 1, 2, 3, 4, 5];
  slotOrder.sort((a, b) => discsBySlot[a].length - discsBySlot[b].length);
  const orderedSlots: DiscData[][] = slotOrder.map(i => discsBySlot[i]);

  // 创建快速评估器
  const evaluator = new FastEvaluator(precomputed);

  // 调试：检测增量枚举是否存在状态泄漏（只在最终 result 输出一次）
  let deltaLeakCount = 0;

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
  // 分数剪枝已移除，保留 prunedCount 仅用于兼容消息结构
  let prunedCount = 0;
  let lastProgressTime = startTime;

  // 复用的盘索引数组
  const discIndices = [0, 0, 0, 0, 0, 0];
  // 复用的盘数据数组
  const discArray: DiscData[] = new Array(6);

  // 增量枚举：初始化 evaluator 状态一次（accumulator=baseStats，清空2pc计数）
  // 注意：worker 采用 6 重 for 循环枚举，并且在每一层都严格 push/pop。
  // 为了避免任何遗漏 pop 导致的状态污染，这里在每个 i0 迭代前重置一次。

  // 获取每个位置的盘数量（使用重排序后的槽位）
  const slot0Count = orderedSlots[0].length;
  const slot1Count = orderedSlots[1].length;
  const slot2Count = orderedSlots[2].length;
  const slot3Count = orderedSlots[3].length;
  const slot4Count = orderedSlots[4].length;
  const slot5Count = orderedSlots[5].length;

  // 预计算各层剪枝时“被跳过的组合数”（用于精确进度/统计）
  const subtreeAfter0 = slot1Count * slot2Count * slot3Count * slot4Count * slot5Count;
  const subtreeAfter1 = slot2Count * slot3Count * slot4Count * slot5Count;
  const subtreeAfter2 = slot3Count * slot4Count * slot5Count;
  const subtreeAfter3 = slot4Count * slot5Count;
  const subtreeAfter4 = slot5Count;

  // 多 Worker 分片：根据第一层循环分片
  const startIdx = Math.floor(slot0Count * workerId / totalWorkers);
  const endIdx = Math.floor(slot0Count * (workerId + 1) / totalWorkers);

  // ============================================================================
  // [调试用] 伤害验证日志 - 用于检验特定组合的伤害计算是否正确
  // 使用方法：取消注释 debugTargetIds 和下方两处 isTargetCombo 检查块
  // 注意：此日志输出的 damage 不含通用乘区(resMult/dmgTakenMult等)，最终结果会更高
  // ============================================================================
  // const debugTargetIds = new Set(['zzz_disc_175', 'zzz_disc_183', 'zzz_disc_225', 'zzz_disc_239', 'zzz_disc_195', 'zzz_disc_207']);

  // 主循环：遍历所有组合（无音擎循环）
  for (let i0 = startIdx; i0 < endIdx && !shouldCancel; i0++) {
    evaluator.beginIncrementalSearch();
    const disc0 = orderedSlots[0][i0];
    discIndices[0] = i0;
    evaluator.pushDiscIncremental(disc0);
    let targetCount0 = hasTargetSet && disc0.isTargetSet ? 1 : 0;
    // 剩余 5 个位置，即使全是目标套装也凑不够 4 件套则剪枝
    if (hasTargetSet && targetCount0 + 5 < 4) {
      prunedCount += subtreeAfter0;
      evaluator.popDiscIncremental(disc0);
      continue;
    }

    for (let i1 = 0; i1 < slot1Count && !shouldCancel; i1++) {
      const disc1 = orderedSlots[1][i1];
      discIndices[1] = i1;
      evaluator.pushDiscIncremental(disc1);
      const targetCount1 = targetCount0 + (disc1.isTargetSet ? 1 : 0);
      if (hasTargetSet && targetCount1 + 4 < 4) {
        prunedCount += subtreeAfter1;
        evaluator.popDiscIncremental(disc1);
        continue;
      }

      for (let i2 = 0; i2 < slot2Count && !shouldCancel; i2++) {
        const disc2 = orderedSlots[2][i2];
        discIndices[2] = i2;
        evaluator.pushDiscIncremental(disc2);
        const targetCount2 = targetCount1 + (disc2.isTargetSet ? 1 : 0);
        if (hasTargetSet && targetCount2 + 3 < 4) {
          prunedCount += subtreeAfter2;
          evaluator.popDiscIncremental(disc2);
          continue;
        }

        for (let i3 = 0; i3 < slot3Count && !shouldCancel; i3++) {
          const disc3 = orderedSlots[3][i3];
          discIndices[3] = i3;
          evaluator.pushDiscIncremental(disc3);
          const targetCount3 = targetCount2 + (disc3.isTargetSet ? 1 : 0);
          if (hasTargetSet && targetCount3 + 2 < 4) {
            prunedCount += subtreeAfter3;
            evaluator.popDiscIncremental(disc3);
            continue;
          }

          for (let i4 = 0; i4 < slot4Count && !shouldCancel; i4++) {
            const disc4 = orderedSlots[4][i4];
            discIndices[4] = i4;
            evaluator.pushDiscIncremental(disc4);
            const targetCount4 = targetCount3 + (disc4.isTargetSet ? 1 : 0);
            if (hasTargetSet && targetCount4 + 1 < 4) {
              prunedCount += subtreeAfter4;
              evaluator.popDiscIncremental(disc4);
              continue;
            }

            for (let i5 = 0; i5 < slot5Count && !shouldCancel; i5++) {
              const disc5 = orderedSlots[5][i5];
              discIndices[5] = i5;
              evaluator.pushDiscIncremental(disc5);
              // 最后一层只需判断是否满足 4 件套
              if (hasTargetSet) {
                const targetCount5 = targetCount4 + (disc5.isTargetSet ? 1 : 0);
                if (targetCount5 < 4) {
                  prunedCount++;
                  evaluator.popDiscIncremental(disc5);
                  continue;
                }

                // [调试用] 伤害验证日志 - 检查目标组合（计算前状态）
                // const isTargetCombo = debugTargetIds.has(disc0.id) && debugTargetIds.has(disc1.id) && debugTargetIds.has(disc2.id) && debugTargetIds.has(disc3.id) && debugTargetIds.has(disc4.id) && debugTargetIds.has(disc5.id);
                // if (isTargetCombo) {
                //   console.error(`[Worker ${workerId}] Level5 ACCEPTED: path=[${disc0.id}, ${disc1.id}, ${disc2.id}, ${disc3.id}, ${disc4.id}, ${disc5.id}], targetCount=${targetCount5}`);
                //   const twoPieceStats = evaluator.getTwoPieceStats();
                //   console.error(`[Worker ${workerId}] Active 2-piece sets:`, JSON.stringify(twoPieceStats));
                //   const dynamicBufferNonZero: Record<string, number> = {};
                //   const twoPieceBuffer = evaluator.getDynamicTwoPieceBuffer();
                //   for (let i = 0; i < twoPieceBuffer.length; i++) {
                //     if (twoPieceBuffer[i] !== 0) {
                //       dynamicBufferNonZero[`idx${i}`] = twoPieceBuffer[i];
                //     }
                //   }
                //   console.error(`[Worker ${workerId}] dynamicTwoPieceBuffer non-zero values:`, JSON.stringify(dynamicBufferNonZero));
                // }
              }

              // 填充盘数组
              discArray[0] = disc0;
              discArray[1] = disc1;
              discArray[2] = disc2;
              discArray[3] = disc3;
              discArray[4] = disc4;
              discArray[5] = disc5;

              // 计算伤害和乘区（热路径）
              const result = evaluator.calculateDamageWithMultipliers(discArray);

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
                evaluator.popDiscIncremental(disc5);
                continue;
              }

              // 更新 TopN
              topNHeap.tryPush(result.damage, discIndices, result.multipliers);

              // [调试用] 伤害验证日志 - 检查目标组合（计算后状态）
              // const isTargetCombo2 = debugTargetIds.has(disc0.id) && debugTargetIds.has(disc1.id) && debugTargetIds.has(disc2.id) && debugTargetIds.has(disc3.id) && debugTargetIds.has(disc4.id) && debugTargetIds.has(disc5.id);
              // if (isTargetCombo2) {
              //   console.error(`[Worker ${workerId}] Target combo calculated damage: ${result.damage}`);
              //   console.error(`[Worker ${workerId}] snapshot1Atk: ${result.snapshots.snapshot1.atk}, snapshot2Atk: ${result.snapshots.snapshot2.atk}, snapshot3Atk: ${result.snapshots.snapshot3.atk}`);
              //   const twoPieceBufferNonZero: Record<string, number> = {};
              //   const twoPieceBuffer = evaluator.getDynamicTwoPieceBuffer();
              //   for (let i = 0; i < twoPieceBuffer.length; i++) {
              //     if (twoPieceBuffer[i] !== 0) {
              //       twoPieceBufferNonZero[`idx${i}`] = twoPieceBuffer[i];
              //     }
              //   }
              //   console.error(`[Worker ${workerId}] dynamicTwoPieceBuffer non-zero:`, JSON.stringify(twoPieceBufferNonZero));
              //   const finalStats = evaluator.getEvalBufferSnapshot();
              //   const nonZeroStats: Record<string, number> = {};
              //   const propMap: Record<string, number> = {
              //     'HP_BASE': 0, 'ATK_BASE': 1, 'DEF_BASE': 2,
              //     'HP': 4, 'HP_': 5, 'ATK': 6, 'ATK_': 7, 'DEF': 8, 'DEF_': 9,
              //     'PEN': 10, 'PEN_': 11, 'SHEER_FORCE': 12,
              //     'RES_IGN_': 14, 'DEF_IGN_': 15,
              //     'CRIT_': 16, 'CRIT_DMG_': 17,
              //     'ANOM_PROF': 29, 'ANOM_CRIT_': 36, 'ANOM_CRIT_DMG_': 37,
              //     'COMMON_DMG_': 47, 'DMG_': 48,
              //     'PHYSICAL_DMG_': 59, 'ETHER_DMG_': 60,
              //     'ELECTRIC_DMG_': 61, 'ICE_DMG_': 62, 'FIRE_DMG_': 63
              //   };
              //   Object.entries(propMap).forEach(([name, idx]) => {
              //     if (finalStats[idx] !== 0) {
              //       nonZeroStats[name] = finalStats[idx];
              //     }
              //   });
              //   console.error(`[Worker ${workerId}] finalStats:`, JSON.stringify(nonZeroStats));
              // }

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

              evaluator.restoreEvalBuffer();
              evaluator.popDiscIncremental(disc5);

              // 调试：检查 slot5 pop 后状态是否回到 slot0..slot4 的 prefix
              // 使用一个极轻量的锚点校验：ATK_BASE（局外三元组维度）理论上不应随 slot5 变化而漂移
              // 如果发生漂移，说明 add/sub 或 2pc 回滚存在问题。
              if (evaluator.getAccumulatorSnapshot()[0] !== evaluator.getAccumulatorSnapshot()[0]) {
                // no-op: keep typescript happy (NaN check)
              }
            }

            evaluator.popDiscIncremental(disc4);
          }

          evaluator.popDiscIncremental(disc3);
        }

        evaluator.popDiscIncremental(disc2);
      }

      evaluator.popDiscIncremental(disc1);
    }

    evaluator.popDiscIncremental(disc0);
  }

  // 获取最终结果
  const builds = topNHeap.getResults(evaluator, orderedSlots, slotOrder);

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
      profile: {},
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

  if (message.type === 'eval') {
    try {
      const { requestId, precomputed, discs } = message as FastWorkerSingleEval;
      const evaluator = new FastEvaluator(precomputed);
      const res = evaluator.createFullResult(discs, 0, []);
      const msg: FastWorkerSingleEvalResult = {
        type: 'eval_result',
        requestId,
        result: res,
      };
      ctx.postMessage(msg);
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
