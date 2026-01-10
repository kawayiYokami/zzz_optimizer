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
    OptimizationConstraints,
    OptimizationBuild,
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
    private fastWorkers: Worker[] = [];
    private status: OptimizerStatus = 'idle';
    private callbacks: OptimizationCallbacks = {};
    private useFastMode = false;

    // 进度跟踪
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
     * 终止所有 Worker
     */
    terminateWorkers(): void {
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
        if (!agent || !agent.skillSet) return [];

        const options: AgentSkillOption[] = [];

        // 遍历所有技能分类
        const skillCategories = [
            { skills: agent.skillSet.basic, type: 'normal' },
            { skills: agent.skillSet.dodge, type: 'dodge' },
            { skills: agent.skillSet.special, type: 'special' },
            { skills: agent.skillSet.chain, type: 'chain' },
            { skills: agent.skillSet.assist, type: 'assist' },
        ];

        for (const { skills, type } of skillCategories) {
            for (const skill of skills) {
                // 计算默认倍率（已计算，直接累加）
                let ratio = 0;
                let anomaly = 0;

                for (const segment of skill.segments) {
                    ratio += segment.damageRatio;
                    anomaly += segment.anomalyBuildup || 0;
                }

                options.push({
                    key: skill.name,
                    name: skill.name,
                    type: type,
                    defaultRatio: ratio,
                    defaultAnomaly: anomaly
                });
            }
        }

        return options;
    }

    /**
     * 计算特定技能段的具体数据
     */
    calculateSkillStats(skillKey: string, segmentIndex: number): { ratio: number; anomaly: number } {
        const agent = this.getTargetAgent();
        if (!agent || !agent.skillSet) return { ratio: 0, anomaly: 0 };

        // 查找技能
        let skill: any = null;
        const skillCategories = [
            agent.skillSet.basic,
            agent.skillSet.dodge,
            agent.skillSet.special,
            agent.skillSet.chain,
            agent.skillSet.assist,
        ];

        for (const skills of skillCategories) {
            const found = skills.find(s => s.name === skillKey);
            if (found) {
                skill = found;
                break;
            }
        }

        if (!skill) return { ratio: 0, anomaly: 0 };

        // 如果是 -1，计算全套
        if (segmentIndex === -1) {
            let totalRatio = 0;
            let totalAnomaly = 0;
            for (const segment of skill.segments) {
                totalRatio += segment.damageRatio;
                totalAnomaly += segment.anomalyBuildup || 0;
            }
            return { ratio: totalRatio, anomaly: totalAnomaly };
        } else {
            // 单段
            const segment = skill.segments[segmentIndex];
            if (!segment) return { ratio: 0, anomaly: 0 };

            const ratio = segment.damageRatio;
            const anomaly = segment.anomalyBuildup || 0;
            return { ratio, anomaly };
        }
    }

    /**
     * 取消优化
     */
    cancelOptimization(): void {
        if (this.status !== 'running') return;

        this.status = 'cancelled';

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
        weapon: WEngine | null;  // 固定音擎（可选）
        skills: SkillParams[];  // 支持多个技能
        enemy: Enemy;
        enemyLevel?: number;
        isStunned?: boolean;
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
        externalBuffs?: Buff[];
        buffStatusMap?: Map<string, { isActive: boolean }>;
        topN?: number;
        estimatedTotal?: number;  // UI计算的有效组合数
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
            skills: options.skills,
            enemy: options.enemy,
            enemyLevel: options.enemyLevel,
            isStunned: options.isStunned,
            discs: options.discs,
            constraints: options.constraints,
            externalBuffs: options.externalBuffs,
            buffStatusMap: options.buffStatusMap,
            config: {
                topN: this.topN,
                progressInterval: 10000,
                pruneThreshold: options.constraints.effectiveStatPruning?.pruneThreshold ?? 10,
            },
        });

        // 进度分母始终使用全量组合数（目标套装过滤在 Worker 内部进行）
        this.totalCombinations = this.calculateFastTotalCombinations(baseRequest);

        // 向每个 Worker 发送请求
        for (let i = 0; i < this.fastWorkers.length; i++) {
            const workerRequest: FastOptimizationRequest = {
                ...baseRequest,
                workerId: i,
                totalWorkers: this.fastWorkers.length,
                estimatedTotal: options.estimatedTotal,  // 传递给Worker
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
            damageMultipliers: build.multipliers,
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
     *
     * 当选择了目标套装时，会考虑只有包含>=4个目标套装盘的组合才有效
     */
    estimateCombinations(config: {
        weapons: WEngine[];
        selectedWeaponIds: string[];
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
    }): {
        total: number;
        breakdown: Record<string, number>;
    } {
        // 手动选择的武器
        const selectedWeapons = config.selectedWeaponIds.length > 0
            ? config.weapons.filter(w => config.selectedWeaponIds.includes(w.id))
            : config.weapons;

        // 驱动盘已在 OptimizerView 中完成所有过滤，直接按位置分组
        const discsBySlot = this.groupDiscsBySlot(config.discs);

        // 计算各位置数量
        const breakdown: Record<string, number> = {
            weapons: selectedWeapons.length
        };

        // 统一计算全量组合数（目标套装过滤在 Worker 内部进行）
        let total = selectedWeapons.length || 1;
        for (let slot = 1; slot <= 6; slot++) {
            const slotKey = `slot${slot}`;
            if (config.constraints.pinnedSlots[slot]) {
                breakdown[slotKey] = 1;
                continue;
            }

            const slotDiscs = discsBySlot[slot] || [];
            breakdown[slotKey] = slotDiscs.length;
            total *= slotDiscs.length;
        }

        return { total, breakdown };
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
            targetSetId: '',
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
