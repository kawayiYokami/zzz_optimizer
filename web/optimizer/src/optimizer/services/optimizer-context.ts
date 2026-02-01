/**
 * 优化器上下文
 *
 * 负责将主线程的类实例转换为可序列化的纯数据，供 Worker 使用。
 */

import type { Agent } from '../../model/agent';
import type { WEngine } from '../../model/wengine';
import type { DriveDisk } from '../../model/drive-disk';
import { DriveDiskSetBonus } from '../../model/drive-disk';
import type { Enemy } from '../../model/enemy';
import type { Buff } from '../../model/buff';
import { PropertyType, Rarity, ElementType } from '../../model/base';
import {
    ANOMALY_DEFAULT_DURATION,
    ANOMALY_EXPECT_WINDOW_SEC,
    getAnomalyTotalRatioAtT,
    getDisorderTotalRatioAtTimepoint,
} from '../../utils/anomaly-constants';
import type {
    BuffData,
    SerializedAgent,
    SerializedWEngine,
    SerializedDriveDisk,
    SerializedSetBonus,
    SerializedEnemy,
    SerializedSkill,
    OptimizationConstraints,
} from '../types';
import {
    PROP_IDX,
    PROP_TYPE_TO_IDX,
    createPropArray,
    addToPropArray,
} from '../types/property-index';
import type {
    PrecomputedData,
    DiscData,
    ConversionBuffData,
    FixedMultipliers,
    FastOptimizationRequest,
    PrecomputedSkillParams,
} from '../types/precomputed';

/**
 * 技能参数（用于构建 SerializedSkill）
 */
export interface SkillParams {
    id: string;
    name: string;
    ratio: number;
    element: ElementType;
    tags: string[];
    isPenetration: boolean;
    anomalyBuildup?: number;
}

/**
 * 优化器上下文类
 *
 * 提供序列化方法，将游戏对象转换为 Worker 可用的纯数据格式。
 */
export class OptimizerContext {
    // ============================================================================
    // Buff 序列化
    // ============================================================================

    /**
     * 将 Buff 转换为 BuffData
     */
    static serializeBuff(buff: Buff): BuffData {
        // 将 Map 转换为 Record
        const outOfCombatStats: Partial<Record<PropertyType, number>> = {};
        const inCombatStats: Partial<Record<PropertyType, number>> = {};

        if (buff.out_of_combat_stats) {
            for (const [prop, value] of buff.out_of_combat_stats.entries()) {
                outOfCombatStats[prop] = value;
            }
        }

        if (buff.in_combat_stats) {
            for (const [prop, value] of buff.in_combat_stats.entries()) {
                inCombatStats[prop] = value;
            }
        }

        // 处理转换类属性
        let conversion: BuffData['conversion'] = undefined;
        if (buff.conversion) {
            conversion = {
                fromProperty: buff.conversion.from_property,
                toProperty: buff.conversion.to_property,
                conversionRatio: buff.conversion.conversion_ratio,
                maxValue: buff.conversion.max_value,
                fromPropertyThreshold: buff.conversion.from_property_threshold,
            };
        }

        return {
            id: buff.id,
            name: buff.name,
            outOfCombatStats,
            inCombatStats,
            conversion,
            triggerConditions: buff.trigger_conditions,
        };
    }

    /**
     * 批量序列化 Buff 列表
     */
    static serializeBuffs(buffs: Buff[]): BuffData[] {
        return buffs.map(buff => this.serializeBuff(buff));
    }

    // ============================================================================
    // 角色序列化
    // ============================================================================

    /**
     * 将 Agent 转换为 SerializedAgent
     */
    static serializeAgent(agent: Agent): SerializedAgent {
        // 获取基础属性
        const baseProps = agent.getCharacterBaseStats();
        const baseStats: Partial<Record<PropertyType, number>> = {};

        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            baseStats[prop] = (baseStats[prop] ?? 0) + value;
        }
        // 注意：序列化 Agent 用于调试/展示，不应把局内属性混入“静态口径”。

        // 获取核心技属性
        const coreSkillMap = agent.getCoreSkillStats();
        const coreSkillStats: Partial<Record<PropertyType, number>> = {};
        for (const [prop, value] of coreSkillMap.entries()) {
            coreSkillStats[prop] = value;
        }

        // 获取被动 Buff（使用同步方法，假设已加载）
        // 注意：此处保留默认行为（可能包含武器 buff / 4pc buff），仅用于展示；
        // 优化器调度器构建 precomputed 时会显式排除驱动盘 4pc 注入，避免污染输入。
        const allBuffs = agent.getAllBuffsSync();
        const passiveBuffs: BuffData[] = this.serializeBuffs(allBuffs);

        return {
            id: agent.id,
            name: agent.name_cn || agent.id,
            level: agent.level,
            element: agent.element,
            weaponType: agent.weapon_type,
            baseStats,
            coreSkillStats,
            passiveBuffs,
        };
    }

    // ============================================================================
    // 音擎序列化
    // ============================================================================

    /**
     * 将 WEngine 转换为 SerializedWEngine
     */
    static serializeWEngine(wengine: WEngine): SerializedWEngine {
        // 获取基础属性
        const baseProps = wengine.getBaseStats();
        const stats: Partial<Record<PropertyType, number>> = {};

        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            stats[prop] = (stats[prop] ?? 0) + value;
        }

        // 获取当前精炼等级的 Buff
        const activeBuffs = wengine.getActiveBuffs();
        const buffs = this.serializeBuffs(activeBuffs);

        return {
            id: wengine.id,
            name: wengine.name,
            level: wengine.level,
            refinement: wengine.refinement,
            stats,
            buffs,
        };
    }

    // ============================================================================
    // 驱动盘序列化
    // ============================================================================

    /**
     * 将稀有度枚举转换为字符串
     */
    private static rarityToString(rarity: Rarity): 'S' | 'A' | 'B' {
        switch (rarity) {
            case Rarity.S:
                return 'S';
            case Rarity.A:
                return 'A';
            case Rarity.B:
                return 'B';
            default:
                return 'S';
        }
    }

    /**
     * 将 DriveDisk 转换为 SerializedDriveDisk
     */
    static serializeDriveDisk(disc: DriveDisk): SerializedDriveDisk {
        // 获取属性
        const props = disc.getStats();
        const subStats: Partial<Record<PropertyType, number>> = {};

        // 副词条从属性集合中提取（排除主词条）
        for (const [prop, value] of props.out_of_combat.entries()) {
            if (prop !== disc.main_stat) {
                subStats[prop] = value;
            }
        }

        // 主词条值
        let mainStatValue = props.out_of_combat.get(disc.main_stat) ?? 0;

        return {
            id: disc.id,
            setId: disc.game_id,
            setName: disc.set_name,
            position: disc.position,
            rarity: this.rarityToString(disc.rarity),
            level: disc.level,
            mainStat: {
                type: disc.main_stat,
                value: mainStatValue,
            },
            subStats,
        };
    }

    /**
     * 将驱动盘列表按位置分组
     */
    static groupDiscsByPosition(
        discs: DriveDisk[]
    ): Record<number, SerializedDriveDisk[]> {
        const result: Record<number, SerializedDriveDisk[]> = {
            1: [],
            2: [],
            3: [],
            4: [],
            5: [],
            6: [],
        };

        for (const disc of discs) {
            const serialized = this.serializeDriveDisk(disc);
            if (result[serialized.position]) {
                result[serialized.position].push(serialized);
            }
        }

        return result;
    }

    // ============================================================================
    // 套装加成序列化
    // ============================================================================

    /**
     * 从驱动盘列表提取套装加成数据
     *
     * @param discs 驱动盘列表
     * @returns 套装加成映射 (setId -> SerializedSetBonus)
     */
    static extractSetBonuses(discs: DriveDisk[]): Record<string, SerializedSetBonus> {
        const result: Record<string, SerializedSetBonus> = {};
        const seenSets = new Set<string>();

        for (const disc of discs) {
            const setId = disc.game_id;
            if (seenSets.has(setId)) continue;
            seenSets.add(setId);

            // 获取 2 件套属性
            const twoPieceProps = disc.getSetBuff(DriveDiskSetBonus.TWO_PIECE);
            const twoPieceStats: Partial<Record<PropertyType, number>> = {};
            for (const [prop, value] of twoPieceProps.out_of_combat.entries()) {
                twoPieceStats[prop] = value;
            }
            // 获取 4 件套属性
            const fourPieceProps = disc.getSetBuff(DriveDiskSetBonus.FOUR_PIECE);
            const fourPieceStats: Partial<Record<PropertyType, number>> = {};
            for (const [prop, value] of fourPieceProps.out_of_combat.entries()) {
                fourPieceStats[prop] = value;
            }
            // 注意：set bonus 序列化用于展示/调试；这里不混入 in_combat，避免静态/局内口径混淆

            // 4 件套可能有条件触发的 Buff，暂时设为空
            // TODO: 从 disc.set_buffs 提取
            const fourPieceBuffs: BuffData[] = [];
            if (disc.set_buffs) {
                for (const buff of disc.set_buffs) {
                    fourPieceBuffs.push(this.serializeBuff(buff));
                }
            }

            result[setId] = {
                setId,
                setName: disc.set_name,
                twoPieceStats,
                fourPieceStats,
                fourPieceBuffs,
            };
        }

        return result;
    }

    // ============================================================================
    // 敌人序列化
    // ============================================================================

    /**
     * 将 Enemy 转换为 SerializedEnemy
     *
     * @param enemy 敌人实例
     * @param level 敌人等级（默认 60）
     * @param isStunned 是否处于失衡状态（默认 false）
     */
    static serializeEnemy(
        enemy: Enemy,
        level: number = 60,
        isStunned: boolean = false,
        hasCorruptionShield: boolean = false
    ): SerializedEnemy {
        // 获取各元素抗性
        const resistance: Partial<Record<string, number>> = {
            ice: enemy.ice_dmg_resistance,
            fire: enemy.fire_dmg_resistance,
            electric: enemy.electric_dmg_resistance,
            physical: enemy.physical_dmg_resistance,
            ether: enemy.ether_dmg_resistance,
        };

        return {
            level,
            def: hasCorruptionShield ? enemy.defense * 2 : enemy.defense,
            resistance,
            isStunned,
            stunVulnerability: isStunned ? (1 + enemy.stun_vulnerability_multiplier) : 1.0,
        };
    }

    // ============================================================================
    // 技能序列化
    // ============================================================================



    /**
     * 创建 SerializedSkill
     */
    static createSkill(params: SkillParams): SerializedSkill {
        return {
            id: params.id,
            name: params.name,
            ratio: params.ratio,
            element: params.element,
            tags: params.tags,
            isPenetration: params.isPenetration,
            anomalyBuildup: params.anomalyBuildup ?? 0,
        };
    }

    /**
     * 创建 PrecomputedSkillParams
     */
    private static createSkillParams(params: SkillParams, isPenetration: boolean = false): PrecomputedSkillParams {
        return {
            ratio: params.ratio,
            element: params.element,
            anomalyBuildup: params.anomalyBuildup ?? 0,
            tags: params.tags.map(tag => this.tagToNumber(tag)),
            isPenetration,
            isMingpo: isPenetration,
        };
    }

    // ============================================================================
    // 快速优化（Float64Array 预计算）
    // ============================================================================

    /**
     * 将 Buff 属性填充到 Float64Array
     */
    private static fillArrayFromBuff(
        arr: Float64Array,
        buff: Buff,
        buffStatusMap?: Map<string, { isActive: boolean }>
    ): void {
        // 局外属性
        if (buff.out_of_combat_stats) {
            for (const [prop, value] of buff.out_of_combat_stats.entries()) {
                addToPropArray(arr, prop, value);
            }
        }

        // 局内属性
        if (buff.in_combat_stats) {
            for (const [prop, value] of buff.in_combat_stats.entries()) {
                addToPropArray(arr, prop, value);
            }
        }
    }

    /**
     * 将 BuffData 属性填充到 Float64Array
     */
    private static fillArrayFromBuffData(arr: Float64Array, buff: BuffData): void {
        for (const [propKey, value] of Object.entries(buff.outOfCombatStats)) {
            const propType = Number(propKey) as PropertyType;
            addToPropArray(arr, propType, value as number);
        }

        for (const [propKey, value] of Object.entries(buff.inCombatStats)) {
            const propType = Number(propKey) as PropertyType;
            addToPropArray(arr, propType, value as number);
        }
    }

    /**
     * 将角色属性填充到 Float64Array
     *
     * 注意：只填充角色自身属性和角色被动Buff，
     * 不包含武器Buff（由fillArrayFromWEngine处理）和驱动盘Buff（动态计算）
     */
    private static fillArrayFromAgent(
        arr: Float64Array,
        agent: Agent,
        buffStatusMap?: Map<string, { isActive: boolean }>
    ): void {
        // 基础属性（已包含核心技属性，见 _calculateSelfProperties）
        const baseProps = agent.getCharacterBaseStats();

        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            addToPropArray(arr, prop, value);
        }
        // 注意：静态数组构建仅使用 out_of_combat；in_combat 属于局内，不应进入静态口径

        // 注意：不再单独添加核心技属性，因为 getCharacterBaseStats() 已包含
        // 注意：不使用 getAllBuffsSync()，因为它包含武器Buff和驱动盘Buff

        // 只添加角色自身的被动 Buff（不含武器和驱动盘）
        const agentOnlyBuffs = [
            ...(agent.core_passive_buffs || []),
            ...(agent.talent_buffs || []),
            ...(agent.potential_buffs || []),
            ...(agent.conversion_buffs || []),
        ];
        for (const buff of agentOnlyBuffs) {
            this.fillArrayFromBuff(arr, buff, buffStatusMap);
        }
    }

    /**
     * 将音擎属性填充到 Float64Array
     */
    private static fillArrayFromWEngine(
        arr: Float64Array,
        wengine: WEngine | null,
        buffStatusMap?: Map<string, { isActive: boolean }>
    ): void {
        if (!wengine) {
            return; // 没有武器时跳过
        }

        // 基础属性
        const baseProps = wengine.getBaseStats();

        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            addToPropArray(arr, prop, value);
        }

        // 音擎 Buff
        const activeBuffs = wengine.getActiveBuffs();
        for (const buff of activeBuffs) {
            this.fillArrayFromBuff(arr, buff, buffStatusMap);
        }
    }

    /**
     * 将驱动盘属性填充到 Float64Array
     */
    private static fillArrayFromDisc(arr: Float64Array, disc: DriveDisk): void {
        const props = disc.getStats();

        for (const [prop, value] of props.out_of_combat.entries()) {
            // 无效词条：两种防御（不参与当前优化目标）
            if (prop === PropertyType.DEF || prop === PropertyType.DEF_) continue;
            addToPropArray(arr, prop, value);
        }
    }

    /**
     * 提取转换类 Buff 数据
     */
    private static extractConversionBuff(buff: Buff, isTeammate: boolean): ConversionBuffData | null {
        if (!buff.conversion) return null;

        const fromPropIdx = PROP_TYPE_TO_IDX[buff.conversion.from_property];
        const toPropIdx = PROP_TYPE_TO_IDX[buff.conversion.to_property];

        if (fromPropIdx === undefined || toPropIdx === undefined) return null;

        return {
            fromPropIdx,
            toPropIdx,
            ratio: buff.conversion.conversion_ratio,
            threshold: buff.conversion.from_property_threshold ?? 0,
            maxValue: buff.conversion.max_value ?? null,
            isTeammate,
        };
    }

    /**
     * 计算固定乘区
     */
    private static computeFixedMultipliers(
        agent: Agent,
        wengine: WEngine | null,
        enemy: Enemy,
        skill: SkillParams,
        isStunned: boolean,
        externalBuffs: Buff[]
    ): FixedMultipliers {
        const attackerLevel = agent.level;
        const levelBase = attackerLevel * 10 + 100;

        // 收集基础防御削弱/无视/抗性削减/异常相关（来自角色/音擎/可选Buff，不含驱动盘）
        let baseDefRed = 0;
        let baseDefIgn = 0;
        let resRed = 0;
        let dmgTakenInc = 0;
        let anomalyDmgBonus = 0;

        // 从角色属性收集
        const agentProps = agent.getCharacterBaseStats();
        baseDefRed += agentProps.getTotal(PropertyType.DEF_RED_, 0);
        baseDefIgn += agentProps.getTotal(PropertyType.DEF_IGN_, 0);
        resRed += agentProps.getTotal(PropertyType.ENEMY_RES_RED_, 0);
        dmgTakenInc += agentProps.getTotal(PropertyType.DMG_INC_, 0);
        anomalyDmgBonus += agentProps.getTotal(PropertyType.ANOMALY_DMG_, 0);

        // 从音擎收集
        if (wengine) {
            const wengineProps = wengine.getBaseStats();
            baseDefRed += wengineProps.getTotal(PropertyType.DEF_RED_, 0);
            baseDefIgn += wengineProps.getTotal(PropertyType.DEF_IGN_, 0);
            resRed += wengineProps.getTotal(PropertyType.ENEMY_RES_RED_, 0);
            dmgTakenInc += wengineProps.getTotal(PropertyType.DMG_INC_, 0);
            anomalyDmgBonus += wengineProps.getTotal(PropertyType.ANOMALY_DMG_, 0);
        }

        // 从外部 Buff 收集
        for (const buff of externalBuffs) {
            if (buff.out_of_combat_stats) {
                baseDefRed += buff.out_of_combat_stats.get(PropertyType.DEF_RED_) ?? 0;
                baseDefIgn += buff.out_of_combat_stats.get(PropertyType.DEF_IGN_) ?? 0;
                resRed += buff.out_of_combat_stats.get(PropertyType.ENEMY_RES_RED_) ?? 0;
                dmgTakenInc += buff.out_of_combat_stats.get(PropertyType.DMG_INC_) ?? 0;
                anomalyDmgBonus += buff.out_of_combat_stats.get(PropertyType.ANOMALY_DMG_) ?? 0;
            }
            if (buff.in_combat_stats) {
                baseDefRed += buff.in_combat_stats.get(PropertyType.DEF_RED_) ?? 0;
                baseDefIgn += buff.in_combat_stats.get(PropertyType.DEF_IGN_) ?? 0;
                resRed += buff.in_combat_stats.get(PropertyType.ENEMY_RES_RED_) ?? 0;
                dmgTakenInc += buff.in_combat_stats.get(PropertyType.DMG_INC_) ?? 0;
                anomalyDmgBonus += buff.in_combat_stats.get(PropertyType.ANOMALY_DMG_) ?? 0;
            }
        }

        return {
            baseResRed: resRed,
            baseDmgTakenInc: dmgTakenInc,
            stunVulnerability: enemy.stun_vulnerability_multiplier ?? 0,
            distanceMult: 1.0,
            attackerLevel,
            baseAnomalyCritRate: 0,
            baseAnomalyCritDmg: 0,
            baseAnomalyDmgBonus: anomalyDmgBonus,
            defenseParams: {
                levelBase,
                enemyDef: enemy.defense,
                baseDefRed,
                baseDefIgn,
            },
        };
    }

    /**
     * 元素转 key（支持字符串或枚举）
     */
    private static elementToKey(element: string | number): string {
        if (typeof element === 'number') {
            // 枚举值转字符串
            const enumToKey: Record<number, string> = {
                200: 'physical',
                201: 'fire',
                202: 'ice',
                203: 'electric',
                205: 'ether',
            };
            return enumToKey[element] ?? 'physical';
        }
        return element.toLowerCase();
    }

    /**
     * 获取敌人元素抗性
     */
    private static getEnemyResistance(enemy: Enemy, elementKey: string): number {
        const resistances: Record<string, number> = {
            physical: enemy.physical_dmg_resistance,
            fire: enemy.fire_dmg_resistance,
            ice: enemy.ice_dmg_resistance,
            electric: enemy.electric_dmg_resistance,
            ether: enemy.ether_dmg_resistance,
        };
        return resistances[elementKey] ?? 0;
    }

    /**
     * 元素转枚举值（支持字符串或数字）
     */
    private static elementToEnum(element: string | number): number {
        if (typeof element === 'number') {
            return element;  // 已经是枚举值
        }
        const map: Record<string, number> = {
            physical: 200,
            fire: 201,
            ice: 202,
            electric: 203,
            ether: 205,
        };
        return map[element.toLowerCase()] ?? 200;
    }

    /**
     * 构建快速优化请求（使用 Float64Array 预计算）
     *
     * 新架构：
     * - mergedStats: 合并角色白值 + 武器静态（仅 out_of_combat；不含任何驱动盘/BUFF）
     * - mergedBuff: 合并普通 Buff（in_combat_stats；不含目标 4 件套）
     * - targetSetTwoPiece: 目标套装 2 件套静态属性（out_of_combat）
     * - targetSetFourPieceBuff: 目标套装 4 件套普通 Buff（in_combat_stats，强制启用）
     * - conversionBuffs: 转换类 Buff 规则（运行时在快照3应用）
     * - otherSetTwoPiece: 非目标套装 2 件套静态属性缓存
     */
    static buildFastRequest(options: {
        agent: Agent;
        weapon: WEngine | null;
        skills: SkillParams[];
        enemy: Enemy;
        enemySerialized?: SerializedEnemy;
        enemyLevel?: number;
        isStunned?: boolean;
        hasCorruptionShield?: boolean;
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
        externalBuffs?: Buff[];
        teammateConversionBuffs?: { buff: Buff; teammateStats: Float64Array }[];
        // deprecated: legacy comment kept to preserve line history
        buffStatusMap?: Map<string, { isActive: boolean }>;
        config?: {
            topN?: number;
            workerId?: number;
            totalWorkers?: number;
            progressInterval?: number;
            pruneThreshold?: number;
        };
    }): FastOptimizationRequest {
        // eslint-disable-next-line no-console
        const {
            agent,
            weapon,
            skills,
            enemy,
            enemyLevel = 60,
            isStunned = false,
            hasCorruptionShield = false,
            discs,
            constraints,
            externalBuffs = [],
            teammateConversionBuffs = [],
            buffStatusMap,
            config = {},
        } = options;

        const targetSetId = constraints.targetSetId || '';
        // (debug logs removed)

        // ============================================================================
        // 1. 创建 mergedStats 并合并所有静态属性（仅 out_of_combat）
        // ============================================================================
        const mergedStats = createPropArray();
        const mergedBuff = createPropArray();

        const toSparseDelta = (arr: Float64Array): { idx: Int16Array; val: Float64Array } => {
            const idxTmp: number[] = [];
            const valTmp: number[] = [];
            for (let i = 0; i < arr.length; i++) {
                const v = arr[i];
                if (v !== 0) {
                    idxTmp.push(i);
                    valTmp.push(v);
                }
            }
            return { idx: Int16Array.from(idxTmp), val: Float64Array.from(valTmp) };
        };

        // 1a. 添加角色静态属性（仅 out_of_combat）
        const baseProps = agent.getCharacterBaseStats();
        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            addToPropArray(mergedStats, prop, value);
        }

        // 1b. 添加武器静态属性（仅 out_of_combat）
        if (weapon) {
            const weaponProps = weapon.getBaseStats();
            for (const [prop, value] of weaponProps.out_of_combat.entries()) {
                addToPropArray(mergedStats, prop, value);
            }
        }

        // ============================================================================
        // 2. 收集所有 Buff（来自外部：BattleService.getOptimizerConfigBuffs 的结果）
        // ============================================================================
        //
        // 口径：调度器不再自行从 agent/weapon 拉取 Buff，避免与 UI 口径分叉或重复计入。
        // BattleService 负责产出“优化器要用的最终 Buff 列表”：
        // - externalBuffs 应是“已过滤后的普通 Buff 列表”，包含：前台自身 + 队友（不含目标 4 件套）
        // - 启用/禁用由 buffStatusMap 控制（调度器只做一次开关过滤）
        //
        // 兼容：如果调用方仍旧传 externalBuffs（旧接口），这里会拼进去，但推荐只传 allBuffs。
        const conversionBuffs: ConversionBuffData[] = [];
        const allBuffs: Buff[] = [];
        allBuffs.push(...externalBuffs);
        // (debug logs removed)

        // Debug: 记录“优化器实际使用的 Buff 列表”（已按开关过滤会在下方执行）
        const debugActiveBuffsUsed: { id: string; name: string; source: string; isConversion: boolean }[] = [];

        // ============================================================================
        // 3. 目标套装预处理（交由 Worker 复用）
        // - targetSetTwoPiece: 2 件套静态属性（out_of_combat），Worker 在初始化阶段预合并
        //
        // 注意：目标 4 件套 Buff 由 BattleService/UI 作为普通 Buff 传入 allBuffs，调度器不在此处单独提取。
        // ============================================================================
        const targetSetTwoPiece = createPropArray();
        const targetSetFourPieceBuff = createPropArray();

        const targetSetDisc = discs.find(d => d.game_id === targetSetId);
        if (targetSetDisc && targetSetId) {

            // 3a. 2件套静态属性（仅 out_of_combat）
            const twoPieceProps = targetSetDisc.getSetBuff(DriveDiskSetBonus.TWO_PIECE);
            for (const [prop, value] of twoPieceProps.out_of_combat.entries()) {
                addToPropArray(targetSetTwoPiece, prop, value);
            }

            // 3b. 4件套 Buff（普通 Buff：in_combat_stats）
            // 注意：目标四件套是优化器强制选择项，默认纳入 targetSetFourPieceBuff（由 Worker 统一合并复用）
            for (const buff of targetSetDisc.set_buffs ?? []) {
                if (buff.in_combat_stats) {
                    for (const [prop, value] of buff.in_combat_stats.entries()) {
                        addToPropArray(targetSetFourPieceBuff, prop, value);
                    }
                }
            }
        } else {
            // eslint-disable-next-line no-console
            console.log('[OptimizerContext] targetSet precompute skipped');
        }

        // ============================================================================
        // 4. 处理每个Buff
        // - 转换类：提取规则写入 conversionBuffs（运行时按组合应用）
        // - 普通 Buff：合并为 mergedBuff（只参与快照2；禁止写入 mergedStats）
        // ============================================================================
        let mergedPairs = 0;
        for (const buff of allBuffs) {
            // Buff 开关口径：由 BattleService 在上游产出“计算用 Buff 列表”externalBuffs。
            // OptimizerContext/Worker 无条件信任该列表，不再根据 Buff 自身字段进行二次过滤。

            // 对敌人生效的 debuff 也必须计入（不论来源：自己/队友）
            // - 这些属性会影响抗性区/防御区等乘区，因此不能被“只看自身buff”的口径跳过
            // - 当前构建 mergedBuff 不做 target 过滤；只依赖 isActive/buffStatusMap 开关

            // 转换类Buff单独收集（需要最终属性才能计算）
            if (buff.conversion) {
                const convData = this.extractConversionBuff(buff, false);
                if (convData) conversionBuffs.push(convData);
                continue;
            }

            // 普通 Buff：只把 in_combat_stats 叠加到 mergedBuff
            if (buff.in_combat_stats) {
                for (const [prop, value] of buff.in_combat_stats.entries()) {
                    addToPropArray(mergedBuff, prop, value);
                    mergedPairs++;
                }
            }
        }

        // 4b. 预计算队友转换 Buff（队友属性是固定的，可以直接计算）
        //
        // 注意：这里“可预计算”的前提是 teammateStats 是一个不随本次优化组合变化的快照。
        // 如果未来 teammateStats 也需要受驱动盘组合/局内 Buff 影响，这里就不能直接合并到 mergedStats，
        // 必须改为与 conversionBuffs 一样的“规则预处理”，在 Worker 端按组合应用。
        for (const { buff, teammateStats } of teammateConversionBuffs) {
            if (!buff.conversion) continue;

            const fromPropIdx = PROP_TYPE_TO_IDX[buff.conversion.from_property];
            const toPropIdx = PROP_TYPE_TO_IDX[buff.conversion.to_property];
            if (fromPropIdx === undefined || toPropIdx === undefined) continue;

            const sourceValue = teammateStats[fromPropIdx];
            const threshold = buff.conversion.from_property_threshold ?? 0;
            const effectiveValue = Math.max(0, sourceValue - threshold);

            let convertedValue = effectiveValue * buff.conversion.conversion_ratio;
            if (buff.conversion.max_value !== undefined) {
                convertedValue = Math.min(convertedValue, buff.conversion.max_value);
            }

            // 队友转换结果直接合并到mergedStats
            mergedStats[toPropIdx] += convertedValue;
        }

        // ============================================================================
        // 4c. 预计算异常/紊乱倍率（固定时间点/窗口）
        // ============================================================================
        const skill0 = skills[0];
        const anomalyElement = (() => {
            switch (skill0.element) {
                case ElementType.PHYSICAL: return 'physical';
                case ElementType.FIRE: return 'fire';
                case ElementType.ICE: return 'ice';
                case ElementType.ELECTRIC: return 'electric';
                case ElementType.ETHER: return 'ether';
                default: return 'physical';
            }
        })();

        const durationSec =
            ANOMALY_DEFAULT_DURATION[anomalyElement] ?? 10;

        const anomalyTotalRatioAtT = getAnomalyTotalRatioAtT(
            anomalyElement,
            ANOMALY_EXPECT_WINDOW_SEC
        );

        // 星见雅：技能元素仍为 ICE（碎冰异常），但紊乱应使用“烈霜紊乱”独立公式
        const special = agent.getSpecialAnomalyConfig?.();
        const disorderElement =
            special?.element === 'lieshuang' ? 'lieshuang' : anomalyElement;

        const disorderTotalRatioAtT = getDisorderTotalRatioAtTimepoint(
            disorderElement,
            ANOMALY_EXPECT_WINDOW_SEC,
            durationSec
        );

        // ============================================================================
        // 5. 收集非目标套装的2件套效果
        // ============================================================================
        const otherSetTwoPiece: Record<string, Float64Array> = {};
        const seenSets = new Set<string>();

        for (const disc of discs) {
            const setId = disc.game_id;
            if (setId === targetSetId) continue; // 跳过目标套装
            if (seenSets.has(setId)) continue;
            seenSets.add(setId);

            const twoPiece = createPropArray();
            const twoPieceProps = disc.getSetBuff(DriveDiskSetBonus.TWO_PIECE);
            for (const [prop, value] of twoPieceProps.out_of_combat.entries()) {
                addToPropArray(twoPiece, prop, value);
            }
            otherSetTwoPiece[setId] = twoPiece;
        }

        // ============================================================================
        // 6. 构建驱动盘数据（使用新的 DiscData 结构）
        // ============================================================================
        const discsBySlot: DiscData[][] = [[], [], [], [], [], []];

        // 有效词条配置
        const pruningConfig = constraints.effectiveStatPruning;
        const flatToPercentMap: Partial<Record<PropertyType, PropertyType>> = {
            [PropertyType.ATK]: PropertyType.ATK_,
            [PropertyType.HP]: PropertyType.HP_,
            [PropertyType.DEF]: PropertyType.DEF_,
            [PropertyType.PEN]: PropertyType.PEN_,
        };

        const getStatScore = (statType: PropertyType, isMainStat: boolean): number => {
            if (!pruningConfig?.enabled || !pruningConfig.effectiveStats.length) return 0;

            if (pruningConfig.effectiveStats.includes(statType)) {
                return isMainStat ? pruningConfig.mainStatScore : 1;
            }

            const percentType = flatToPercentMap[statType];
            if (percentType && pruningConfig.effectiveStats.includes(percentType)) {
                return isMainStat ? pruningConfig.mainStatScore / 3 : 1 / 3;
            }

            return 0;
        };

        const setIdToIdx = new Map<string, number>();

        for (const disc of discs) {
            const slotIdx = disc.position - 1;
            if (slotIdx < 0 || slotIdx > 5) continue;

            // 预编码 setId -> setIdx（Worker 热路径使用）
            const setId = disc.game_id;
            let setIdx = setIdToIdx.get(setId);
            if (setIdx === undefined) {
                setIdx = setIdToIdx.size;
                setIdToIdx.set(setId, setIdx);
            }

            // 填充属性数组（主词条+副词条，不含套装效果）
            const stats = createPropArray();
            this.fillArrayFromDisc(stats, disc);

            // 稀疏化 stats（只保留非零项）；Worker 热路径 push/pop 用
            // 注意：fillArrayFromDisc 已过滤无效词条（两种防御）
            const idxTmp: number[] = [];
            const valTmp: number[] = [];
            for (let i = 0; i < stats.length; i++) {
                const v = stats[i];
                if (v !== 0) {
                    idxTmp.push(i);
                    valTmp.push(v);
                }
            }

            // 计算有效词条得分
            let effectiveScore = 0;
            const props = disc.getStats();
            effectiveScore += getStatScore(disc.main_stat, true);
            for (const [prop] of props.out_of_combat.entries()) {
                if (prop !== disc.main_stat) {
                    effectiveScore += getStatScore(prop, false);
                }
            }

            discsBySlot[slotIdx].push({
                id: disc.id,
                stats,
                sparseStatsIdx: Int16Array.from(idxTmp),
                sparseStatsVal: Float64Array.from(valTmp),
                effectiveScore,
                setId,
                setIdx,
                isTargetSet: setId === targetSetId,
            });


        }

        // ============================================================================
        // 6b. 对每个位置的驱动盘进行排序（提升枚举局部性）
        // - 先按套装聚集（setIdx 升序）
        // - 同套装内按有效得分降序（更利于剪枝抬高阈值）
        // ============================================================================
        for (let slot = 0; slot < discsBySlot.length; slot++) {
            discsBySlot[slot].sort((a, b) => {
                if (a.setIdx !== b.setIdx) return a.setIdx - b.setIdx;
                return b.effectiveScore - a.effectiveScore;
            });
        }

        // ============================================================================
        // 7. 计算固定乘区（使用第一个技能作为基准）
        //
        // 注意：这里不再把任何 Buff 预注入 fixedMultipliers（避免与 mergedBuff/targetSetFourPieceBuff 双算）。
        // Buff 对抗性/防御/易伤等的影响统一在 Worker 端，通过 workerMergedBuff 参与 res/def 等乘区计算。
        // ============================================================================
        const fixedMultipliers = (() => {
            const fm = this.computeFixedMultipliers(
            agent,
            weapon,
            enemy,
            skills[0],
            isStunned,
            []
            );

            if (options.enemySerialized) {
                fm.defenseParams.enemyDef = options.enemySerialized.def;
                fm.stunVulnerability = options.enemySerialized.isStunned
                  ? Math.min(1.1, Math.max(0, options.enemySerialized.stunVulnerability - 1))
                  : 0;
            }

            if (hasCorruptionShield) {
                // compatibility: if caller only supplies a shield flag (no enemySerialized),
                // treat it as "enemy defense x2"
                fm.defenseParams.enemyDef *= 2;
            }

            if (isStunned && fm.stunVulnerability === 0) {
                // fallback: maintain old behaviour if no serialized input supplied
                fm.stunVulnerability = enemy.stun_vulnerability_multiplier ?? 0;
            }

            return fm;
        })();

        // ============================================================================
        // 8. 构建预计算数据
        // ============================================================================
        const isPenetration = agent.isPenetrationAgent();
        const precomputed: PrecomputedData = {
            mergedStats,
            mergedBuff,
            conversionBuffs,
            discsBySlot,
            targetSetId,
            targetSetTwoPiece,
            targetSetFourPieceBuff,
            otherSetTwoPiece,
            targetSetTwoPieceSparse: toSparseDelta(targetSetTwoPiece),
            targetSetFourPieceBuffSparse: toSparseDelta(targetSetFourPieceBuff),
            otherSetTwoPieceSparse: Object.fromEntries(
                Object.entries(otherSetTwoPiece).map(([k, v]) => [k, toSparseDelta(v)])
            ),
            fixedMultipliers,
            skillsParams: skills.map(s => this.createSkillParams(s, isPenetration)),
            objective: (() => {
                const o = (constraints as any)?.objective;
                if (o === 'hp') return 'hp';
                if (o === 'atk') return 'atk';
                return 'damage';
            })(),
            agentLevel: agent.level,
            enemyStats: (() => {
                const serializedEnemy = options.enemySerialized;
                if (serializedEnemy) {
                    const stats = enemy.getCombatStats(serializedEnemy.level, serializedEnemy.isStunned);
                    stats.defense = serializedEnemy.def;
                    return stats;
                }
                const stats = enemy.getCombatStats(enemyLevel, isStunned);
                if (hasCorruptionShield) stats.defense *= 2;
                return stats;
            })(),
            specialAnomalyConfig: agent.getSpecialAnomalyConfig(),
            anomalyTotalRatioAtT,
            disorderTotalRatioAtT,
        };

        return {
            precomputed,
            workerId: config.workerId ?? 0,
            totalWorkers: config.totalWorkers ?? 1,
            topN: config.topN ?? 10,
            pruneThreshold: config.pruneThreshold ?? 10,
            progressInterval: config.progressInterval ?? 1000,
        };
    }

    /**
     * 技能标签字符串转数字
     */
    private static tagToNumber(tag: string): number {
        const tagMap: Record<string, number> = {
            normal: 1,
            special: 2,
            chain: 3,
            ultimate: 4,
            dash: 5,
            dodge: 6,
            assist: 7,
            enhanced: 8,
            additional: 9,
        };
        return tagMap[tag.toLowerCase()] ?? 0;
    }

    // ============================================================================
    // 支配关系剪枝
    // ============================================================================

    /**
     * 固定值 -> 百分比的映射表
     */
    private static readonly FLAT_TO_PERCENT_MAP: Partial<Record<PropertyType, PropertyType>> = {
        [PropertyType.ATK]: PropertyType.ATK_,
        [PropertyType.HP]: PropertyType.HP_,
        [PropertyType.DEF]: PropertyType.DEF_,
        [PropertyType.PEN]: PropertyType.PEN_,
    };

    /**
     * 获取驱动盘在有效词条上的数值映射
     *
     * 使用词条数计算：
     * - 主词条 = 10条
     * - 副词条 = 1条（强化次数）
     * - 固定值属性 = 0.33条（1/3折算）
     *
     * @param disc 驱动盘
     * @param effectiveStats 有效词条列表
     * @returns 有效词条 -> 词条数的映射（所有有效词条都有值，包括0）
     */
    private static getEffectiveStatValues(
        disc: DriveDisk,
        effectiveStats: PropertyType[]
    ): Map<PropertyType, number> {
        // 获取详细词条分布（用于维度剪枝）
        return disc.getEffectiveStatDetails(effectiveStats);
    }

    /**
     * 对一组驱动盘进行支配关系剪枝
     *
     * 剪枝流程：
     * 1. 按有效词条总分排序（降序）
     * 2. 得分剪枝：低于最高分5分的抛弃
     * 3. 维度剪枝：所有有效词条都不如的也抛弃
     *
     * @param discs 同组驱动盘（同套装 + 同位置）
     * @param effectiveStats 有效词条列表
     * @returns 过滤后的驱动盘列表
     */
    private static filterDominatedDiscs(
        discs: DriveDisk[],
        effectiveStats: PropertyType[]
    ): DriveDisk[] {
        if (discs.length <= 1 || !effectiveStats.length) {
            return discs;
        }

        // 检查组内是否有包含有效词条的盘
        const hasEffectiveDisc = discs.some(disc => {
            const score = disc.getEffectiveStatCounts(effectiveStats);
            return score > 0;
        });

        // 预计算每个盘的有效词条数值和总分
        const discValues = discs.map(disc => {
            const values = this.getEffectiveStatValues(disc, effectiveStats);
            // 直接使用 getEffectiveStatCounts() 获取总分
            const totalScore = disc.getEffectiveStatCounts(effectiveStats);
            return { disc, values, totalScore };
        });

        // 步骤1：按总分排序（降序）
        discValues.sort((a, b) => b.totalScore - a.totalScore);

        // 获取最高分
        const maxScore = discValues[0].totalScore;

        // 步骤2：得分剪枝（低于最高分5分的抛弃）
        const scorePruned: number[] = [];
        const afterScorePruning: typeof discValues = [];
        for (let i = 0; i < discValues.length; i++) {
            const dv = discValues[i];
            const diff = maxScore - dv.totalScore;
            if (diff >= 5) {
                scorePruned.push(i);
            } else {
                afterScorePruning.push(dv);
            }
        }

        if (afterScorePruning.length <= 1) {
            return afterScorePruning.map(item => item.disc);
        }

        // 步骤3：维度剪枝（所有有效词条都不如的也抛弃）
        const dimensionPruned: Set<number> = new Set();
        for (let i = 0; i < afterScorePruning.length; i++) {
            if (dimensionPruned.has(i)) continue;

            for (let j = 0; j < afterScorePruning.length; j++) {
                if (i === j) continue;
                if (dimensionPruned.has(j)) continue;

                const a = afterScorePruning[i];
                const b = afterScorePruning[j];

                // 检查 a 是否被 b 支配（所有词条都不如）
                if (this.isDominated(a.values, b.values)) {
                    dimensionPruned.add(i);
                    break;
                }
            }
        }

        // 返回未被支配的盘
        return afterScorePruning
            .filter((_, idx) => !dimensionPruned.has(idx))
            .map(item => item.disc);
    }

    /**
     * 检查 discA 是否被 discB 支配
     *
     * 支配条件：B 在每个有效词条上都 >= A，且至少有一个 > A
     *
     * @returns true 表示 A 被 B 支配，A 应该被丢弃
     */
    private static isDominated(
        valuesA: Map<PropertyType, number>,
        valuesB: Map<PropertyType, number>
    ): boolean {
        let allLessOrEqual = true;
        let atLeastOneLess = false;

        for (const [stat, valueA] of valuesA.entries()) {
            const valueB = valuesB.get(stat) ?? 0;

            if (valueA > valueB) {
                // A 在某个维度更好，不被支配
                allLessOrEqual = false;
                break;
            }
            if (valueA < valueB) {
                atLeastOneLess = true;
            }
        }

        return allLessOrEqual && atLeastOneLess;
    }

    /**
     * 按 setId + position + mainStat 分组并剪枝
     *
     * @param discs 驱动盘列表
     * @param effectiveStats 有效词条列表
     * @returns 剪枝后的驱动盘列表
     */
    static applyDominancePruning(
        discs: DriveDisk[],
        effectiveStats: PropertyType[]
    ): DriveDisk[] {
        if (!effectiveStats.length) {
            return discs;
        }

        // 按 setId + position 分组（移除 main_stat，让不同主词条的盘也能互相比较）
        const groups = new Map<string, DriveDisk[]>();

        for (const disc of discs) {
            const key = `${disc.game_id}_${disc.position}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(disc);
        }

        // 对每组进行支配关系剪枝
        const result: DriveDisk[] = [];
        let totalGroups = 0;
        let effectiveGroups = 0;

        for (const group of groups.values()) {
            totalGroups++;

            // 检查组内是否有包含有效词条的盘
            const hasEffectiveDisc = group.some(disc => {
                const score = disc.getEffectiveStatCounts(effectiveStats);
                return score > 0;
            });

            if (hasEffectiveDisc) {
                effectiveGroups++;
            }

            result.push(...this.filterDominatedDiscs(group, effectiveStats));
        }
        return result;
    }

    /**
     * 主词条限定剪枝
     *
     * 只保留主词条在限定列表中的驱动盘（456位置）
     *
     * @param discs 驱动盘列表
     * @param mainStatFilters 主词条限定器 { [position]: PropertyType[] }
     * @returns 剪枝后的驱动盘列表
     */
    static applyMainStatFilterPruning(
        discs: DriveDisk[],
        mainStatFilters: Partial<Record<number, PropertyType[]>>
    ): DriveDisk[] {
        return discs.filter(disc => {
            const position = disc.position;
            const filters = mainStatFilters[position];

            // 如果该位置没有设置限定，保留所有盘
            if (!filters || filters.length === 0) {
                return true;
            }

            // 只保留主词条在限定列表中的盘
            return filters.includes(disc.main_stat);
        });
    }

    /**
     * 装备优先级排除剪枝
     *
     * 排除高优先级队伍身上的驱动盘
     *
     * @param discs 驱动盘列表
     * @param excludedDiscIds 排除的驱动盘ID列表
     * @returns 剪枝后的驱动盘列表
     */
    static applyTeamPriorityPruning(
        discs: DriveDisk[],
        excludedDiscIds: string[]
    ): DriveDisk[] {
        if (excludedDiscIds.length === 0) {
            return discs;
        }

        const excludedSet = new Set(excludedDiscIds);
        return discs.filter(disc => !excludedSet.has(disc.id));
    }
}
