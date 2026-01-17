/**
 * 优化器服务
 *
 * 管理 Web Worker 实例，处理优化请求的分发和结果聚合。
 */

import type { Agent } from '../../model/agent';
import type { WEngine } from '../../model/wengine';
import type { DriveDisk } from '../../model/drive-disk';
import type { Enemy } from '../../model/enemy';
import type { Buff } from '../../model/buff';
import { OptimizerContext, type SkillParams } from './optimizer-context';
import type {
    OptimizationRequest,
    OptimizationConstraints,
    OptimizationProgress,
    OptimizationResult,
    OptimizationBuild,
    WorkerMessage,
    EffectiveStatPruningConfig,
    OptimizationPreset,
} from '../types';
import type {
    FastOptimizationRequest,
    OptimizationBuildResult,
} from '../types/precomputed';
import { IDX_TO_PROP_TYPE } from '../types/property-index';
import { PRESETS_STORAGE_KEY, PRESETS_STORAGE_VERSION, type PresetStorage } from '../types/presets';
import { PropertyType } from '../../model/base';
import { Team } from '../../model/team';
// Actually, let's redefine the mapping or move it to a shared place. 
// For now, I will define a local mapping to avoid dependency on View.
const SKILL_TYPE_TO_KEY: Record<string, string> = {
    '普通攻击': 'normal',
    '闪避': 'dodge',
    '特殊技': 'special',
    '强化特殊技': 'special',
    '连携技': 'chain',
    '终结技': 'chain',
    '核心被动': 'core',
    '额外的能力': 'core'
};

export interface AgentSkillOption {
    key: string;
    name: string;
    type: string;
    defaultRatio: number;
    defaultAnomaly: number;
}

/**
 * 优化器状态
 */
export type OptimizerStatus = 'idle' | 'running' | 'cancelled' | 'completed' | 'error';

/**
 * 优化进度回调
 */
export interface OptimizationCallbacks {
    onProgress?: (progress: AggregatedProgress) => void;
    onComplete?: (result: AggregatedResult) => void;
    onError?: (error: Error) => void;
}

/**
 * 聚合进度
 */
export interface AggregatedProgress {
    /** 所有 Worker 的总处理数 */
    totalProcessed: number;
    /** 总组合数 */
    totalCombinations: number;
    /** 完成百分比 */
    percentage: number;
    /** 平均速度（组合/秒） */
    speed: number;
    /** 预估剩余时间（秒） */
    estimatedTimeRemaining: number;
    /** 当前最优结果 */
    currentBest: OptimizationBuild | null;
}

/**
 * 聚合结果
 */
export interface AggregatedResult {
    /** 最终结果列表（按伤害降序） */
    builds: OptimizationBuild[];
    /** 总处理组合数 */
    totalProcessed: number;
    /** 总耗时（毫秒） */
    totalTimeMs: number;
    /** 平均速度（组合/秒） */
    averageSpeed: number;
}

/**
 * 优化器服务类
 */
export class OptimizerService {
    private workers: Worker[] = [];
    private fastWorkers: Worker[] = [];
    private status: OptimizerStatus = 'idle';
    private callbacks: OptimizationCallbacks = {};
    private useFastMode = false;

    // 进度跟踪
    private workerProgress: Map<number, OptimizationProgress> = new Map();
    private workerResults: Map<number, OptimizationResult> = new Map();
    private fastWorkerResults: Map<number, OptimizationBuildResult[]> = new Map();
    private fastWorkerStats: Map<number, { processed: number; pruned: number; timeMs: number }> = new Map();
    private fastWorkerProgress: Map<number, number> = new Map();  // workerId -> processedCount
    private completedWorkers = 0;
    private startTime = 0;

    // 会话状态
    private currentTeam: Team | null = null;
    private targetAgentId: string | null = null;
    private teammateBuffs: Buff[] = [];

    // 配置
    private topN = 10;
    private totalCombinations = 0;

    /**
     * 获取当前状态
     */
    getStatus(): OptimizerStatus {
        return this.status;
    }

    /**
     * 初始化 Worker
     *
     * @param count Worker 数量，默认使用 CPU 核心数
     */
    initializeWorkers(count?: number): void {
        // 清理现有 Worker
        this.terminateWorkers();

        const workerCount = count ?? Math.max(1, navigator.hardwareConcurrency - 1);

        for (let i = 0; i < workerCount; i++) {
            // 使用 Vite 的 Worker 导入语法
            const worker = new Worker(
                new URL('../workers/optimization.worker.ts', import.meta.url),
                { type: 'module' }
            );

            const workerId = i;

            worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                this.handleWorkerMessage(workerId, event.data);
            };

            worker.onerror = (error) => {
                console.error(`Worker ${workerId} error:`, error);
                this.handleWorkerError(workerId, new Error(error.message));
            };

            this.workers.push(worker);
        }
    }

    /**
     * 终止所有 Worker
     */
    terminateWorkers(): void {
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];

        for (const worker of this.fastWorkers) {
            worker.terminate();
        }
        this.fastWorkers = [];
    }

    /**
     * 初始化快速优化 Worker
     */
    initializeFastWorkers(count?: number): void {
        // 清理现有 Worker
        for (const worker of this.fastWorkers) {
            worker.terminate();
        }
        this.fastWorkers = [];

        const workerCount = count ?? Math.max(1, navigator.hardwareConcurrency - 1);

        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(
                new URL('../workers/fast-optimization.worker.ts', import.meta.url),
                { type: 'module' }
            );

            const workerId = i;

            worker.onmessage = (event: MessageEvent) => {
                this.handleFastWorkerMessage(workerId, event.data);
            };

            worker.onerror = (error) => {
                console.error(`Fast Worker ${workerId} error:`, error);
                this.handleWorkerError(workerId, new Error(error.message));
            };

            this.fastWorkers.push(worker);
        }
    }

    // ============================================================================
    // 会话状态管理
    // ============================================================================

    /**
     * 设置目标队伍
     */
    async setTargetTeam(team: Team): Promise<void> {
        this.currentTeam = team;
        // 默认选中前台角色
        if (team.frontAgent) {
            this.setTargetAgent(team.frontAgent.id);
        }
        // 更新队友 Buff
        this.updateTeammateBuffs();
    }

    /**
     * 设置目标角色 (必须在队伍中)
     */
    setTargetAgent(agentId: string): void {
        if (!this.currentTeam) return;

        if (!this.currentTeam.hasAgent(agentId)) {
            console.warn(`Agent ${agentId} not in team`);
            return;
        }

        this.targetAgentId = agentId;
        this.updateTeammateBuffs();
    }

    /**
     * 获取当前目标角色
     */
    getTargetAgent(): Agent | null {
        if (!this.currentTeam || !this.targetAgentId) return null;
        return this.currentTeam.allAgents.find(a => a.id === this.targetAgentId) || null;
    }

    /**
     * 更新队友提供的 Buff (后台 + 对全队/队友生效)
     */
    private updateTeammateBuffs(): void {
        this.teammateBuffs = [];
        if (!this.currentTeam || !this.targetAgentId) return;

        // 收集所有非目标角色的 Buff
        for (const agent of this.currentTeam.allAgents) {
            if (agent.id === this.targetAgentId) continue;

            const agentBuffs = agent.getAllBuffsSync();
            for (const buff of agentBuffs) {
                // 筛选逻辑：对队友生效
                // 如果是 target_self=true, target_teammate=true，则对全队生效（包括自己）
                // 这里我们关心的是“该 Buff 是否能给目标角色提供加成”
                // 因为我们在遍历“队友”的 Buff，所以只要 target_teammate 为 true 即可
                if (buff.target.target_teammate) {
                    this.teammateBuffs.push(buff);
                }
            }
        }

        // 收集邦布 Buff
        if (this.currentTeam.bond && typeof this.currentTeam.bond.getAllBuffsSync === 'function') {
            const bondBuffs = this.currentTeam.bond.getAllBuffsSync();
            for (const buff of bondBuffs) {
                // 邦布 Buff 通常对全队生效 (target_teammate 或 target_self?)
                // 假设邦布 Buff 的 target_teammate 为 true
                if (buff.target.target_teammate || buff.target.target_self) {
                    this.teammateBuffs.push(buff);
                }
            }
        }
    }

    /**
     * 获取当前队友 Buff
     */
    getTeammateBuffs(): Buff[] {
        return this.teammateBuffs;
    }

    /**
     * 获取目标角色的可用技能列表
     */
    getAvailableSkills(): AgentSkillOption[] {
        const agent = this.getTargetAgent();
        if (!agent || !agent.agentSkills) return [];

        const options: AgentSkillOption[] = [];

        // 遍历所有技能
        for (const [key, skill] of agent.agentSkills.skills) {
            // 推断类型
            let type = 'normal';
            for (const [namePart, typeKey] of Object.entries(SKILL_TYPE_TO_KEY)) {
                if (key.includes(namePart)) {
                    type = typeKey;
                    break;
                }
            }

            // 计算默认倍率（0级，全段）
            let ratio = 0;
            let anomaly = 0;
            const level = agent.getSkillLevel(type);

            for (const segment of skill.segments) {
                ratio += segment.damageRatio + (level - 1) * segment.damageRatioGrowth;
                anomaly += segment.anomalyBuildup || 0;
            }

            options.push({
                key,
                name: key,
                type: type,
                defaultRatio: ratio,
                defaultAnomaly: anomaly
            });
        }

        return options;
    }

    /**
     * 计算特定技能段的具体数据
     */
    calculateSkillStats(skillKey: string, segmentIndex: number): { ratio: number; anomaly: number } {
        const agent = this.getTargetAgent();
        if (!agent || !agent.agentSkills) return { ratio: 0, anomaly: 0 };

        const skill = agent.agentSkills.skills.get(skillKey);
        if (!skill) return { ratio: 0, anomaly: 0 };

        // 推断类型
        let type = 'normal';
        for (const [namePart, typeKey] of Object.entries(SKILL_TYPE_TO_KEY)) {
            if (skillKey.includes(namePart)) {
                type = typeKey;
                break;
            }
        }
        const level = agent.getSkillLevel(type);

        // 如果是 -1，计算全套
        if (segmentIndex === -1) {
            let totalRatio = 0;
            let totalAnomaly = 0;
            for (const segment of skill.segments) {
                totalRatio += segment.damageRatio + (level - 1) * segment.damageRatioGrowth;
                totalAnomaly += segment.anomalyBuildup || 0;
            }
            return { ratio: totalRatio, anomaly: totalAnomaly };
        } else {
            // 单段
            const segment = skill.segments[segmentIndex];
            if (!segment) return { ratio: 0, anomaly: 0 };

            const ratio = segment.damageRatio + (level - 1) * segment.damageRatioGrowth;
            const anomaly = segment.anomalyBuildup || 0;
            return { ratio, anomaly };
        }
    }

    /**
     * 开始优化
     */
    startOptimization(options: {
        agent: Agent;
        skill: SkillParams;
        enemy: Enemy;
        enemyLevel?: number;
        isStunned?: boolean;
        weapons: WEngine[];
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
        externalBuffs?: Buff[];
        topN?: number;
        callbacks?: OptimizationCallbacks;
    }): void {
        if (this.status === 'running') {
            throw new Error('优化器正在运行中');
        }

        if (this.workers.length === 0) {
            this.initializeWorkers();
        }

        // 重置状态
        this.status = 'running';
        this.workerProgress.clear();
        this.workerResults.clear();
        this.completedWorkers = 0;
        this.startTime = performance.now();
        this.topN = options.topN ?? 10;
        this.callbacks = options.callbacks ?? {};

        // 构建请求
        const baseRequest = OptimizerContext.buildRequest({
            agent: options.agent,
            skill: options.skill,
            enemy: options.enemy,
            enemyLevel: options.enemyLevel,
            isStunned: options.isStunned,
            weapons: options.weapons,
            discs: options.discs,
            constraints: options.constraints,
            externalBuffs: options.externalBuffs,
            config: {
                topN: this.topN,
                progressInterval: 1000,
            },
        });

        // 计算总组合数
        this.totalCombinations = this.calculateTotalCombinations(baseRequest);

        // 向每个 Worker 发送请求（包含 workerId 和 totalWorkers）
        for (let i = 0; i < this.workers.length; i++) {
            const workerRequest: OptimizationRequest = {
                ...baseRequest,
                config: {
                    ...baseRequest.config,
                    workerId: i,
                    totalWorkers: this.workers.length,
                },
            };

            this.workers[i].postMessage(workerRequest);
        }
    }

    /**
     * 取消优化
     */
    cancelOptimization(): void {
        if (this.status !== 'running') return;

        this.status = 'cancelled';

        for (const worker of this.workers) {
            worker.postMessage({ type: 'cancel' });
        }
        for (const worker of this.fastWorkers) {
            worker.postMessage({ type: 'cancel' });
        }

        // 终止并重新初始化 Worker
        this.terminateWorkers();
    }

    /**
     * 开始快速优化（使用 Float64Array 预计算）
     *
     * 与 startOptimization 的区别：
     * - 固定音擎（不参与搜索）
     * - 使用预计算数据结构
     * - 更高的计算性能
     */
    startFastOptimization(options: {
        agent: Agent;
        weapon: WEngine;  // 固定音擎
        skill: SkillParams;
        enemy: Enemy;
        enemyLevel?: number;
        isStunned?: boolean;
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
        externalBuffs?: Buff[];
        topN?: number;
        callbacks?: OptimizationCallbacks;
    }): void {
        if (this.status === 'running') {
            throw new Error('优化器正在运行中');
        }

        if (this.fastWorkers.length === 0) {
            this.initializeFastWorkers();
        }

        // 重置状态
        this.status = 'running';
        this.useFastMode = true;
        this.workerProgress.clear();
        this.workerResults.clear();
        this.fastWorkerResults.clear();
        this.fastWorkerStats.clear();
        this.fastWorkerProgress.clear();
        this.completedWorkers = 0;
        this.startTime = performance.now();
        this.topN = options.topN ?? 10;
        this.callbacks = options.callbacks ?? {};

        // 构建快速优化请求
        const baseRequest = OptimizerContext.buildFastRequest({
            agent: options.agent,
            weapon: options.weapon,
            skill: options.skill,
            enemy: options.enemy,
            enemyLevel: options.enemyLevel,
            isStunned: options.isStunned,
            discs: options.discs,
            constraints: options.constraints,
            externalBuffs: options.externalBuffs,
            config: {
                topN: this.topN,
                progressInterval: 10000,
                pruneThreshold: options.constraints.effectiveStatPruning?.pruneThreshold ?? 10,
            },
        });

        // 计算总组合数
        this.totalCombinations = this.calculateFastTotalCombinations(baseRequest);

        // 向每个 Worker 发送请求
        for (let i = 0; i < this.fastWorkers.length; i++) {
            const workerRequest: FastOptimizationRequest = {
                ...baseRequest,
                workerId: i,
                totalWorkers: this.fastWorkers.length,
            };

            this.fastWorkers[i].postMessage(workerRequest);
        }
    }

    /**
     * 计算快速优化的总组合数
     */
    private calculateFastTotalCombinations(request: FastOptimizationRequest): number {
        let total = 1;
        for (const slotDiscs of request.precomputed.discsBySlot) {
            if (slotDiscs.length === 0) return 0;
            total *= slotDiscs.length;
        }
        return total;
    }

    /**
     * 处理快速 Worker 消息
     */
    private handleFastWorkerMessage(workerId: number, message: any): void {
        switch (message.type) {
            case 'progress':
                this.handleFastProgress(workerId, message);
                break;
            case 'result':
                this.handleFastResult(workerId, message);
                break;
            case 'error':
                this.handleWorkerError(workerId, new Error(message.message));
                break;
        }
    }

    /**
     * 处理快速优化进度
     */
    private handleFastProgress(workerId: number, progress: any): void {
        // 保存该 Worker 的进度
        this.fastWorkerProgress.set(workerId, progress.processedCount);

        // 聚合所有 Worker 的进度
        let totalProcessed = 0;
        for (const count of this.fastWorkerProgress.values()) {
            totalProcessed += count;
        }

        const elapsedMs = performance.now() - this.startTime;
        const speed = totalProcessed / (elapsedMs / 1000);

        const aggregated: AggregatedProgress = {
            totalProcessed,
            totalCombinations: this.totalCombinations,
            percentage: (totalProcessed / this.totalCombinations) * 100,
            speed,
            estimatedTimeRemaining: (this.totalCombinations - totalProcessed) / speed,
            currentBest: null,
        };

        if (this.callbacks.onProgress) {
            this.callbacks.onProgress(aggregated);
        }
    }

    /**
     * 处理快速优化结果
     */
    private handleFastResult(workerId: number, result: any): void {
        this.fastWorkerResults.set(workerId, result.builds);
        this.fastWorkerStats.set(workerId, {
            processed: result.stats.totalProcessed,
            pruned: result.stats.prunedCount,
            timeMs: result.stats.timeMs,
        });
        this.completedWorkers++;

        // 检查是否所有 Worker 都完成了
        if (this.completedWorkers >= this.fastWorkers.length) {
            this.finalizeFastOptimization();
        }
    }

    /**
     * 完成快速优化
     */
    private finalizeFastOptimization(): void {
        this.status = 'completed';

        // 聚合所有 Worker 的结果
        const allBuilds: OptimizationBuildResult[] = [];
        let totalProcessed = 0;
        let totalPruned = 0;

        for (const builds of this.fastWorkerResults.values()) {
            allBuilds.push(...builds);
        }
        for (const stats of this.fastWorkerStats.values()) {
            totalProcessed += stats.processed;
            totalPruned += stats.pruned;
        }

        // 排序并取前 N 个
        allBuilds.sort((a, b) => b.damage - a.damage);
        const topBuilds = allBuilds.slice(0, this.topN);

        const endTime = performance.now();
        const totalTimeMs = endTime - this.startTime;

        // 转换为 OptimizationBuild 格式（兼容现有 UI）
        const compatibleBuilds: OptimizationBuild[] = topBuilds.map(build => ({
            damage: build.damage,
            discIds: build.discIds,
            weaponId: '',  // 快速模式不返回武器 ID
            finalStats: this.convertFinalStatsToRecord(build.finalStats),
            setBonusInfo: {
                twoPieceSets: build.setInfo.twoPieceSets,
                fourPieceSet: build.setInfo.fourPieceSet,
            },
            damageBreakdown: build.breakdown,
        }));

        const aggregatedResult: AggregatedResult = {
            builds: compatibleBuilds,
            totalProcessed: totalProcessed + totalPruned,
            totalTimeMs,
            averageSpeed: (totalProcessed + totalPruned) / (totalTimeMs / 1000),
        };

        if (this.callbacks.onComplete) {
            this.callbacks.onComplete(aggregatedResult);
        }
    }

    /**
     * 将 Float64Array 转换为 Record
     */
    private convertFinalStatsToRecord(stats: Float64Array): Partial<Record<PropertyType, number>> {
        const result: Partial<Record<PropertyType, number>> = {};

        for (let i = 0; i < stats.length; i++) {
            if (stats[i] !== 0) {
                const propType = IDX_TO_PROP_TYPE[i];
                if (propType !== undefined) {
                    result[propType] = stats[i];
                }
            }
        }

        return result;
    }

    /**
     * 计算总组合数
     */
    private calculateTotalCombinations(request: OptimizationRequest): number {
        const { weapons, discs, constraints } = request;

        let total = weapons.length;

        for (let slot = 1; slot <= 6; slot++) {
            if (constraints.pinnedSlots[slot]) {
                continue;
            }

            const slotDiscs = discs[slot] || [];
            if (slotDiscs.length === 0) {
                return 0;
            }

            total *= slotDiscs.length;
        }

        return total;
    }

    /**
     * 处理 Worker 消息
     */
    private handleWorkerMessage(workerId: number, message: WorkerMessage): void {
        switch (message.type) {
            case 'progress':
                this.handleProgress(workerId, message);
                break;
            case 'result':
                this.handleResult(workerId, message);
                break;
            case 'error':
                this.handleWorkerError(workerId, new Error(message.message));
                break;
        }
    }

    /**
     * 处理进度更新
     */
    private handleProgress(workerId: number, progress: OptimizationProgress): void {
        this.workerProgress.set(workerId, progress);

        // 聚合所有 Worker 的进度
        const aggregated = this.aggregateProgress();

        if (this.callbacks.onProgress) {
            this.callbacks.onProgress(aggregated);
        }
    }

    /**
     * 聚合进度
     */
    private aggregateProgress(): AggregatedProgress {
        let totalProcessed = 0;
        let currentBest: OptimizationBuild | null = null;

        for (const progress of this.workerProgress.values()) {
            totalProcessed += progress.processedCount;

            if (progress.currentBest) {
                if (!currentBest || progress.currentBest.damage > currentBest.damage) {
                    currentBest = progress.currentBest;
                }
            }
        }

        const elapsedMs = performance.now() - this.startTime;
        const speed = totalProcessed / (elapsedMs / 1000);
        const remaining = this.totalCombinations - totalProcessed;
        const estimatedTimeRemaining = remaining / speed;

        return {
            totalProcessed,
            totalCombinations: this.totalCombinations,
            percentage: (totalProcessed / this.totalCombinations) * 100,
            speed,
            estimatedTimeRemaining,
            currentBest,
        };
    }

    /**
     * 处理 Worker 结果
     */
    private handleResult(workerId: number, result: OptimizationResult): void {
        this.workerResults.set(workerId, result);
        this.completedWorkers++;

        // 检查是否所有 Worker 都完成了
        if (this.completedWorkers >= this.workers.length) {
            this.finalizeOptimization();
        }
    }

    /**
     * 完成优化
     */
    private finalizeOptimization(): void {
        this.status = 'completed';

        // 聚合所有 Worker 的结果
        const allBuilds: OptimizationBuild[] = [];
        let totalProcessed = 0;

        for (const result of this.workerResults.values()) {
            allBuilds.push(...result.builds);
            totalProcessed += result.stats.totalProcessed;
        }

        // 排序并取前 N 个
        allBuilds.sort((a, b) => b.damage - a.damage);
        const topBuilds = allBuilds.slice(0, this.topN);

        const endTime = performance.now();
        const totalTimeMs = endTime - this.startTime;

        const aggregatedResult: AggregatedResult = {
            builds: topBuilds,
            totalProcessed,
            totalTimeMs,
            averageSpeed: totalProcessed / (totalTimeMs / 1000),
        };

        if (this.callbacks.onComplete) {
            this.callbacks.onComplete(aggregatedResult);
        }
    }

    /**
     * 处理 Worker 错误
     */
    private handleWorkerError(workerId: number, error: Error): void {
        console.error(`Worker ${workerId} error:`, error);

        this.status = 'error';

        if (this.callbacks.onError) {
            this.callbacks.onError(error);
        }

        // 取消其他 Worker
        this.cancelOptimization();
    }

    // ============================================================================
    // 剪枝配置
    // ============================================================================

    /**
     * 获取角色可用的武器列表（按武器类型过滤，用于 UI 展示勾选框）
     */
    getAvailableWeapons(allWeapons: WEngine[]): WEngine[] {
        const agent = this.getTargetAgent();
        if (!agent) return allWeapons;
        return allWeapons.filter(w => w.weapon_type === agent.weapon_type);
    }

    /**
     * 根据主词条筛选驱动盘
     */
    filterDiscsByMainStat(
        discs: DriveDisk[],
        slot: number,
        allowedMainStats?: PropertyType[]
    ): DriveDisk[] {
        if (slot <= 3 || !allowedMainStats?.length) return discs;
        return discs.filter(d => allowedMainStats.includes(d.main_stat));
    }

    /**
     * 按位置分组驱动盘
     */
    groupDiscsBySlot(discs: DriveDisk[]): Record<number, DriveDisk[]> {
        const result: Record<number, DriveDisk[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        for (const disc of discs) {
            result[disc.position]?.push(disc);
        }
        return result;
    }

    /**
     * 计算驱动盘的有效词条得分
     */
    calculateDiscEffectiveScore(
        disc: DriveDisk,
        config: EffectiveStatPruningConfig
    ): number {
        let score = 0;

        // 主词条得分
        if (config.effectiveStats.includes(disc.main_stat)) {
            score += config.mainStatScore;
        }

        // 副词条得分（按词条数量，每个有效副词条 +1）
        for (const [statType] of disc.sub_stats) {
            if (config.effectiveStats.includes(statType as PropertyType)) {
                score += 1;
            }
        }

        return score;
    }

    /**
     * 预估剪枝后的组合数量（实时更新）
     */
    estimateCombinations(config: {
        weapons: WEngine[];
        selectedWeaponIds: string[];
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
    }): {
        total: number;
        breakdown: Record<string, number>;
        dominancePruned?: number;  // 被支配关系剪枝移除的数量
    } {
        // 手动选择的武器
        const selectedWeapons = config.selectedWeaponIds.length > 0
            ? config.weapons.filter(w => config.selectedWeaponIds.includes(w.id))
            : config.weapons;

        // 有效词条配置
        const pruning = config.constraints.effectiveStatPruning;
        const effectiveStats = pruning?.effectiveStats || [];

        // 支配关系剪枝（在分组前进行）
        let filteredDiscs = config.discs;
        let dominancePruned = 0;
        if (effectiveStats.length > 0) {
            filteredDiscs = OptimizerContext.applyDominancePruning(config.discs, effectiveStats);
            dominancePruned = config.discs.length - filteredDiscs.length;
        }

        // 按位置分组驱动盘（使用剪枝后的列表）
        const discsBySlot = this.groupDiscsBySlot(filteredDiscs);

        // 固定值 -> 百分比的映射
        const flatToPercentMap: Partial<Record<PropertyType, PropertyType>> = {
            [PropertyType.ATK]: PropertyType.ATK_,
            [PropertyType.HP]: PropertyType.HP_,
            [PropertyType.DEF]: PropertyType.DEF_,
            [PropertyType.PEN]: PropertyType.PEN_,
        };

        // 检查主词条是否有效
        const isEffectiveMainStat = (mainStat: PropertyType): boolean => {
            if (effectiveStats.includes(mainStat)) return true;
            const percentType = flatToPercentMap[mainStat];
            if (percentType && effectiveStats.includes(percentType)) return true;
            return false;
        };

        // 计算各位置数量
        const breakdown: Record<string, number> = {
            weapons: selectedWeapons.length
        };

        let total = selectedWeapons.length || 1;
        for (let slot = 1; slot <= 6; slot++) {
            const slotKey = `slot${slot}`;
            if (config.constraints.pinnedSlots[slot]) {
                breakdown[slotKey] = 1;
                continue;
            }

            let slotDiscs = discsBySlot[slot] || [];

            // 4/5/6号位：有效主词条过滤
            if (slot >= 4 && effectiveStats.length > 0) {
                // 检查是否有任何盘的主词条是有效词条
                const hasEffectiveMainStat = slotDiscs.some(d => isEffectiveMainStat(d.main_stat));
                if (hasEffectiveMainStat) {
                    // 过滤掉无效主词条的盘
                    slotDiscs = slotDiscs.filter(d => isEffectiveMainStat(d.main_stat));
                }
            }

            breakdown[slotKey] = slotDiscs.length;
            total *= slotDiscs.length;
        }

        // 添加支配关系剪枝信息
        if (dominancePruned > 0) {
            breakdown['dominancePruned'] = dominancePruned;
        }

        return { total, breakdown, dominancePruned };
    }

    /**
     * 创建默认约束配置
     */
    createDefaultConstraints(): OptimizationConstraints {
        return {
            mainStatFilters: {},
            requiredSets: [],
            pinnedSlots: {},
            setMode: 'any',
            selectedWeaponIds: [],
            effectiveStatPruning: {
                enabled: false,
                effectiveStats: [],
                mainStatScore: 10,
                pruneThreshold: 10,
            },
        };
    }

    // ============================================================================
    // 预设管理
    // ============================================================================

    /**
     * 加载所有预设
     */
    loadPresets(): OptimizationPreset[] {
        try {
            const data = localStorage.getItem(PRESETS_STORAGE_KEY);
            if (!data) return [];

            const storage: PresetStorage = JSON.parse(data);
            if (storage.version !== PRESETS_STORAGE_VERSION) {
                // 版本不匹配，返回空数组（未来可以添加迁移逻辑）
                console.warn('预设存储版本不匹配，已忽略旧数据');
                return [];
            }

            return storage.presets;
        } catch (e) {
            console.error('加载预设失败:', e);
            return [];
        }
    }

    /**
     * 保存预设
     */
    savePreset(preset: OptimizationPreset): void {
        const presets = this.loadPresets();
        const existingIndex = presets.findIndex(p => p.id === preset.id);

        if (existingIndex >= 0) {
            presets[existingIndex] = { ...preset, updatedAt: new Date().toISOString() };
        } else {
            presets.push(preset);
        }

        const storage: PresetStorage = {
            version: PRESETS_STORAGE_VERSION,
            presets,
        };
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(storage));
    }

    /**
     * 删除预设
     */
    deletePreset(presetId: string): void {
        const presets = this.loadPresets().filter(p => p.id !== presetId);
        const storage: PresetStorage = {
            version: PRESETS_STORAGE_VERSION,
            presets,
        };
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(storage));
    }

    /**
     * 应用预设到当前约束
     */
    applyPreset(preset: OptimizationPreset): OptimizationConstraints {
        return {
            ...this.createDefaultConstraints(),
            ...preset.constraints,
        };
    }

    /**
     * 从当前约束创建预设
     */
    createPresetFromConstraints(
        name: string,
        constraints: OptimizationConstraints,
        agentId?: string
    ): OptimizationPreset {
        return {
            id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            agentId,
            constraints,
            createdAt: new Date().toISOString(),
        };
    }
}

// 导出单例
export const optimizerService = new OptimizerService();
