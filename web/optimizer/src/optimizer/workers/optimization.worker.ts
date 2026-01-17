/**
 * 优化器 Web Worker
 *
 * 接收主线程发送的 OptimizationRequest，遍历所有装备组合，
 * 计算伤害并返回最优结果。
 */

import { Evaluator } from './evaluator';
import type {
    OptimizationRequest,
    OptimizationProgress,
    OptimizationResult,
    OptimizationBuild,
    SerializedDriveDisk,
    WorkerMessage,
} from '../types';

// Worker 上下文
const ctx: Worker = self as unknown as Worker;

/**
 * 最小堆，用于维护 TopN 结果
 */
class MinHeap {
    private heap: OptimizationBuild[] = [];
    private maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    get size(): number {
        return this.heap.length;
    }

    get min(): OptimizationBuild | null {
        return this.heap.length > 0 ? this.heap[0] : null;
    }

    getAll(): OptimizationBuild[] {
        // 返回按伤害降序排列的结果
        return [...this.heap].sort((a, b) => b.damage - a.damage);
    }

    push(item: OptimizationBuild): void {
        if (this.heap.length < this.maxSize) {
            this.heap.push(item);
            this.bubbleUp(this.heap.length - 1);
        } else if (item.damage > this.heap[0].damage) {
            // 新元素大于最小值，替换
            this.heap[0] = item;
            this.bubbleDown(0);
        }
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].damage <= this.heap[index].damage) break;
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < this.heap.length && this.heap[leftChild].damage < this.heap[smallest].damage) {
                smallest = leftChild;
            }
            if (rightChild < this.heap.length && this.heap[rightChild].damage < this.heap[smallest].damage) {
                smallest = rightChild;
            }

            if (smallest === index) break;
            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
}

/**
 * 计算总组合数
 */
function calculateTotalCombinations(request: OptimizationRequest): number {
    const { weapons, discs, constraints } = request;

    let total = weapons.length;

    for (let slot = 1; slot <= 6; slot++) {
        // 如果位置被锁定，该位置只有 1 种选择
        if (constraints.pinnedSlots[slot]) {
            // 锁定位置不影响组合数（相当于 × 1）
            continue;
        }

        const slotDiscs = discs[slot] || [];
        if (slotDiscs.length === 0) {
            return 0; // 某个位置没有候选驱动盘
        }

        total *= slotDiscs.length;
    }

    return total;
}

/**
 * 运行优化
 */
function runOptimization(request: OptimizationRequest): void {
    const startTime = performance.now();

    const evaluator = new Evaluator(request);
    const { weapons, discs, constraints, config, maxScorePerSlot } = request;
    const { topN, progressInterval, workerId, totalWorkers } = config;

    // 有效词条剪枝配置
    const pruning = constraints.effectiveStatPruning;
    const pruneEnabled = pruning?.enabled && maxScorePerSlot != null;
    const pruneThreshold = pruning?.pruneThreshold ?? 10;

    // 初始化 TopN 堆
    const topNHeap = new MinHeap(topN);

    // 计算总组合数
    const totalCombinations = calculateTotalCombinations(request);

    let processedCount = 0;
    let prunedCount = 0;
    let lastProgressTime = startTime;

    // TopN 堆的最低有效词条得分（用于剪枝，初始为 0）
    let minTopNEffectiveScore = 0;

    // 获取每个位置的候选列表（考虑锁定位置）
    const slotCandidates: SerializedDriveDisk[][] = [];
    for (let slot = 1; slot <= 6; slot++) {
        const pinnedId = constraints.pinnedSlots[slot];
        if (pinnedId) {
            // 锁定位置：只使用指定的驱动盘
            const pinnedDisc = (discs[slot] || []).find(d => d.id === pinnedId);
            if (pinnedDisc) {
                slotCandidates.push([pinnedDisc]);
            } else {
                // 锁定的驱动盘不在候选列表中，使用空数组
                slotCandidates.push([]);
            }
        } else {
            slotCandidates.push(discs[slot] || []);
        }
    }

    // 检查是否所有位置都有候选
    for (let i = 0; i < 6; i++) {
        if (slotCandidates[i].length === 0) {
            // 发送错误
            const errorMsg: WorkerMessage = {
                type: 'error',
                message: `位置 ${i + 1} 没有可用的驱动盘`,
            };
            ctx.postMessage(errorMsg);
            return;
        }
    }

    // 多 Worker 分片：根据 workerId 和 totalWorkers 分割音擎列表
    const weaponsToProcess = weapons.filter((_, index) => index % totalWorkers === workerId);

    // 主循环：遍历所有组合
    for (const weapon of weaponsToProcess) {
        for (const disc1 of slotCandidates[0]) {
            const score1 = disc1.effectiveScore ?? 0;

            for (const disc2 of slotCandidates[1]) {
                const score2 = score1 + (disc2.effectiveScore ?? 0);

                for (const disc3 of slotCandidates[2]) {
                    const score3 = score2 + (disc3.effectiveScore ?? 0);

                    for (const disc4 of slotCandidates[3]) {
                        const score4 = score3 + (disc4.effectiveScore ?? 0);

                        // 剪枝检查：当前得分 + 剩余最优 < TopN最低得分 - 阈值？
                        if (pruneEnabled && maxScorePerSlot) {
                            const maxRemaining = (maxScorePerSlot[5] ?? 0) + (maxScorePerSlot[6] ?? 0);
                            const potentialMax = score4 + maxRemaining;
                            if (potentialMax < minTopNEffectiveScore - pruneThreshold) {
                                prunedCount += slotCandidates[4].length * slotCandidates[5].length;
                                continue; // 跳过 disc5, disc6 的遍历
                            }
                        }

                        for (const disc5 of slotCandidates[4]) {
                            const score5 = score4 + (disc5.effectiveScore ?? 0);

                            // 再次剪枝
                            if (pruneEnabled && maxScorePerSlot) {
                                const potentialMax = score5 + (maxScorePerSlot[6] ?? 0);
                                if (potentialMax < minTopNEffectiveScore - pruneThreshold) {
                                    prunedCount += slotCandidates[5].length;
                                    continue;
                                }
                            }

                            for (const disc6 of slotCandidates[5]) {
                                const totalScore = score5 + (disc6.effectiveScore ?? 0);

                                // 最终剪枝
                                if (pruneEnabled && totalScore < minTopNEffectiveScore - pruneThreshold) {
                                    prunedCount++;
                                    continue;
                                }

                                const discArray = [disc1, disc2, disc3, disc4, disc5, disc6];

                                // 计算伤害
                                const result = evaluator.calculateDamage(weapon, discArray);

                                // 更新 TopN
                                const build = evaluator.createBuild(weapon, discArray, result);

                                // 记录构建前堆的大小
                                const heapSizeBefore = topNHeap.size;
                                topNHeap.push(build);

                                // 如果堆满了且成功插入，更新最低有效词条得分
                                if (topNHeap.size >= topN && heapSizeBefore < topN) {
                                    // 堆刚满，计算最低得分
                                    minTopNEffectiveScore = totalScore;
                                } else if (topNHeap.size >= topN && result.damage > (topNHeap.min?.damage ?? 0)) {
                                    // 新元素进入堆，可能需要更新最低得分
                                    // 简化处理：使用当前分数作为参考
                                    minTopNEffectiveScore = Math.max(minTopNEffectiveScore, totalScore - pruneThreshold);
                                }

                                processedCount++;

                                // 定期上报进度
                                if (processedCount % progressInterval === 0) {
                                    const currentTime = performance.now();
                                    const elapsedSeconds = (currentTime - startTime) / 1000;
                                    const speed = processedCount / elapsedSeconds;
                                    const remaining = totalCombinations - processedCount - prunedCount;
                                    const estimatedTimeRemaining = remaining / speed;

                                    const progress: OptimizationProgress = {
                                        type: 'progress',
                                        processedCount: processedCount + prunedCount,
                                        totalCombinations,
                                        currentBest: topNHeap.min,
                                        speed,
                                        estimatedTimeRemaining,
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
    }

    // 发送最终结果
    const endTime = performance.now();
    const totalTimeMs = endTime - startTime;

    const result: OptimizationResult = {
        type: 'result',
        builds: topNHeap.getAll(),
        stats: {
            totalProcessed: processedCount + prunedCount,
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
        // TODO: 实现取消逻辑
        return;
    }

    // 假设其他消息都是 OptimizationRequest
    try {
        runOptimization(message as OptimizationRequest);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        const errorMsg: WorkerMessage = {
            type: 'error',
            message: errorMessage,
            stack: errorStack,
        };
        ctx.postMessage(errorMsg);
    }
};
