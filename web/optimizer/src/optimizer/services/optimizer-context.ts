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
            isActive: buff.is_active,
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

        // 合并局外和局内属性
        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            baseStats[prop] = (baseStats[prop] ?? 0) + value;
        }
        for (const [prop, value] of baseProps.in_combat.entries()) {
            baseStats[prop] = (baseStats[prop] ?? 0) + value;
        }

        // 获取核心技属性
        const coreSkillMap = agent.getCoreSkillStats();
        const coreSkillStats: Partial<Record<PropertyType, number>> = {};
        for (const [prop, value] of coreSkillMap.entries()) {
            coreSkillStats[prop] = value;
        }

        // 获取被动 Buff（使用同步方法，假设已加载）
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
            for (const [prop, value] of twoPieceProps.in_combat.entries()) {
                twoPieceStats[prop] = (twoPieceStats[prop] ?? 0) + value;
            }

            // 获取 4 件套属性
            const fourPieceProps = disc.getSetBuff(DriveDiskSetBonus.FOUR_PIECE);
            const fourPieceStats: Partial<Record<PropertyType, number>> = {};
            for (const [prop, value] of fourPieceProps.out_of_combat.entries()) {
                fourPieceStats[prop] = value;
            }
            for (const [prop, value] of fourPieceProps.in_combat.entries()) {
                fourPieceStats[prop] = (fourPieceStats[prop] ?? 0) + value;
            }

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
    static serializeEnemy(enemy: Enemy, level: number = 60, isStunned: boolean = false): SerializedEnemy {
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
            def: enemy.defense,
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
        // 检查 buff 的激活状态
        let isActive = buff.is_active;
        if (buffStatusMap) {
            const status = buffStatusMap.get(buff.id);
            if (status) {
                isActive = status.isActive;
            }
        }
        if (!isActive) return;

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
        if (!buff.isActive) return;

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
        for (const [prop, value] of baseProps.in_combat.entries()) {
            addToPropArray(arr, prop, value);
        }

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
            addToPropArray(arr, prop, value);
        }
    }

    /**
     * 提取转换类 Buff 数据
     */
    private static extractConversionBuff(buff: Buff, isTeammate: boolean): ConversionBuffData | null {
        if (!buff.conversion || !buff.is_active) return null;

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

        // 收集基础防御削弱/无视（来自角色/音擎/Buff，不含驱动盘）
        let baseDefRed = 0;
        let baseDefIgn = 0;
        let resRed = 0;
        let anomalyCritRate = 0;
        let anomalyCritDmg = 0;
        let anomalyDmgBonus = 0;

        // 从角色属性收集
        const agentProps = agent.getCharacterBaseStats();
        baseDefRed += agentProps.getTotal(PropertyType.DEF_RED_, 0);
        baseDefIgn += agentProps.getTotal(PropertyType.DEF_IGN_, 0);
        resRed += agentProps.getTotal(PropertyType.ENEMY_RES_RED_, 0);
        anomalyCritRate += agentProps.getTotal(PropertyType.ANOM_CRIT_, 0);
        anomalyCritDmg += agentProps.getTotal(PropertyType.ANOM_CRIT_DMG_, 0);
        anomalyDmgBonus += agentProps.getTotal(PropertyType.ANOMALY_DMG_, 0);

        // 从音擎收集
        if (wengine) {
            const wengineProps = wengine.getBaseStats();
            baseDefRed += wengineProps.getTotal(PropertyType.DEF_RED_, 0);
            baseDefIgn += wengineProps.getTotal(PropertyType.DEF_IGN_, 0);
            resRed += wengineProps.getTotal(PropertyType.ENEMY_RES_RED_, 0);
            anomalyCritRate += wengineProps.getTotal(PropertyType.ANOM_CRIT_, 0);
            anomalyCritDmg += wengineProps.getTotal(PropertyType.ANOM_CRIT_DMG_, 0);
            anomalyDmgBonus += wengineProps.getTotal(PropertyType.ANOMALY_DMG_, 0);
        }

        // 从外部 Buff 收集
        for (const buff of externalBuffs) {
            if (!buff.is_active) continue;
            if (buff.out_of_combat_stats) {
                baseDefRed += buff.out_of_combat_stats.get(PropertyType.DEF_RED_) ?? 0;
                baseDefIgn += buff.out_of_combat_stats.get(PropertyType.DEF_IGN_) ?? 0;
                resRed += buff.out_of_combat_stats.get(PropertyType.ENEMY_RES_RED_) ?? 0;
                anomalyCritRate += buff.out_of_combat_stats.get(PropertyType.ANOM_CRIT_) ?? 0;
                anomalyCritDmg += buff.out_of_combat_stats.get(PropertyType.ANOM_CRIT_DMG_) ?? 0;
                anomalyDmgBonus += buff.out_of_combat_stats.get(PropertyType.ANOMALY_DMG_) ?? 0;
            }
            if (buff.in_combat_stats) {
                baseDefRed += buff.in_combat_stats.get(PropertyType.DEF_RED_) ?? 0;
                baseDefIgn += buff.in_combat_stats.get(PropertyType.DEF_IGN_) ?? 0;
                resRed += buff.in_combat_stats.get(PropertyType.ENEMY_RES_RED_) ?? 0;
                anomalyCritRate += buff.in_combat_stats.get(PropertyType.ANOM_CRIT_) ?? 0;
                anomalyCritDmg += buff.in_combat_stats.get(PropertyType.ANOM_CRIT_DMG_) ?? 0;
                anomalyDmgBonus += buff.in_combat_stats.get(PropertyType.ANOMALY_DMG_) ?? 0;
            }
        }

        // 抗性区
        const elementKey = this.elementToKey(skill.element);
        const elementRes = this.getEnemyResistance(enemy, elementKey);
        const resMult = Math.max(0, Math.min(2, 1 - elementRes + resRed));

        // 承伤区
        const dmgTakenMult = 1.0;

        // 失衡易伤区
        const stunVulnMult = isStunned ? (1 + enemy.stun_vulnerability_multiplier) : 1.0;

        // 距离衰减区
        const distanceMult = 1.0;

        // 等级区（异常用）
        const levelMult = 1 + (attackerLevel - 1) / 59;

        // 异常暴击区
        const anomalyCritMult = 1 + anomalyCritRate * anomalyCritDmg;

        // 异常增伤区
        const anomalyDmgMult = 1 + anomalyDmgBonus;

        return {
            resMult,
            dmgTakenMult,
            stunVulnMult,
            distanceMult,
            levelMult,
            anomalyCritMult,
            anomalyDmgMult,
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
     * - mergedStats: 合并角色+武器+所有非转换buff+目标4件套2+4效果
     * - conversionBuffs: 仅转换类buff（需要最终属性才能计算）
     * - targetSetId: 目标四件套ID（单选）
     * - otherSetTwoPiece: 非目标套装的2件套效果缓存
     */
    static buildFastRequest(options: {
        agent: Agent;
        weapon: WEngine | null;
        skills: SkillParams[];
        enemy: Enemy;
        enemyLevel?: number;
        isStunned?: boolean;
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
        externalBuffs?: Buff[];
        teammateConversionBuffs?: { buff: Buff; teammateStats: Float64Array }[];
        buffStatusMap?: Map<string, { isActive: boolean }>;
        config?: {
            topN?: number;
            workerId?: number;
            totalWorkers?: number;
            progressInterval?: number;
            pruneThreshold?: number;
        };
    }): FastOptimizationRequest {
        const {
            agent,
            weapon,
            skills,
            enemy,
            enemyLevel = 60,
            isStunned = false,
            discs,
            constraints,
            externalBuffs = [],
            teammateConversionBuffs = [],
            buffStatusMap,
            config = {},
        } = options;

        const targetSetId = constraints.targetSetId || '';

        // ============================================================================
        // 1. 创建 mergedStats 并合并所有静态属性
        // ============================================================================
        const mergedStats = createPropArray();

        // 1a. 添加角色裸属性（基础属性）
        const baseProps = agent.getCharacterBaseStats();
        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            addToPropArray(mergedStats, prop, value);
        }
        for (const [prop, value] of baseProps.in_combat.entries()) {
            addToPropArray(mergedStats, prop, value);
        }

        // 1b. 添加武器属性
        if (weapon) {
            const weaponProps = weapon.getBaseStats();
            for (const [prop, value] of weaponProps.out_of_combat.entries()) {
                addToPropArray(mergedStats, prop, value);
            }
        }

        // ============================================================================
        // 2. 收集所有Buff（明确来源，避免重复）
        // ============================================================================
        const conversionBuffs: ConversionBuffData[] = [];
        const allBuffs: Buff[] = [];

        // 2a. 角色自身Buff（不含武器和驱动盘）
        if (agent.core_passive_buffs) allBuffs.push(...agent.core_passive_buffs);
        if (agent.talent_buffs) allBuffs.push(...agent.talent_buffs);
        if (agent.potential_buffs) allBuffs.push(...agent.potential_buffs);
        // 注意：角色的 conversion_buffs 会在下面统一处理

        // 2b. 武器Buff
        if (weapon) {
            allBuffs.push(...weapon.getActiveBuffs());
        }

        // 2c. 外部Buff（队友等）
        if (externalBuffs) {
            allBuffs.push(...externalBuffs);
        }

        // ============================================================================
        // 3. 目标4件套效果预合并
        // ============================================================================
        const targetSetDisc = discs.find(d => d.game_id === targetSetId);
        if (targetSetDisc && targetSetId) {
            // 3a. 2件套静态属性
            const twoPieceProps = targetSetDisc.getSetBuff(DriveDiskSetBonus.TWO_PIECE);
            for (const [prop, value] of twoPieceProps.out_of_combat.entries()) {
                addToPropArray(mergedStats, prop, value);
            }
            for (const [prop, value] of twoPieceProps.in_combat.entries()) {
                addToPropArray(mergedStats, prop, value);
            }

            // 3b. 4件套静态属性
            const fourPieceProps = targetSetDisc.getSetBuff(DriveDiskSetBonus.FOUR_PIECE);
            for (const [prop, value] of fourPieceProps.out_of_combat.entries()) {
                addToPropArray(mergedStats, prop, value);
            }
            for (const [prop, value] of fourPieceProps.in_combat.entries()) {
                addToPropArray(mergedStats, prop, value);
            }

            // 3c. 4件套Buff（某些套装有条件触发的效果）
            if (targetSetDisc.set_buffs) {
                allBuffs.push(...targetSetDisc.set_buffs);
            }
        }

        // ============================================================================
        // 4. 处理每个Buff（转换类单独收集，非转换类合并到mergedStats）
        // ============================================================================
        for (const buff of allBuffs) {
            // 检查激活状态
            let isActive = buff.is_active;
            if (buffStatusMap) {
                const status = buffStatusMap.get(buff.id);
                if (status) isActive = status.isActive;
            }
            if (!isActive) continue;

            // 转换类Buff单独收集（需要最终属性才能计算）
            if (buff.conversion) {
                const convData = this.extractConversionBuff(buff, false);
                if (convData) conversionBuffs.push(convData);
                continue;
            }

            // 非转换类Buff合并到mergedStats
            if (buff.out_of_combat_stats) {
                for (const [prop, value] of buff.out_of_combat_stats.entries()) {
                    addToPropArray(mergedStats, prop, value);
                }
            }
            if (buff.in_combat_stats) {
                for (const [prop, value] of buff.in_combat_stats.entries()) {
                    addToPropArray(mergedStats, prop, value);
                }
            }
        }

        // 4b. 预计算队友转换Buff（队友属性是固定的，可以直接计算）
        for (const { buff, teammateStats } of teammateConversionBuffs) {
            if (!buff.conversion || !buff.is_active) continue;

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
            for (const [prop, value] of twoPieceProps.in_combat.entries()) {
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

        for (const disc of discs) {
            const slotIdx = disc.position - 1;
            if (slotIdx < 0 || slotIdx > 5) continue;

            // 填充属性数组（主词条+副词条，不含套装效果）
            const stats = createPropArray();
            this.fillArrayFromDisc(stats, disc);

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
                effectiveScore,
                setId: disc.game_id,
                isTargetSet: disc.game_id === targetSetId,
            });
        }

        // ============================================================================
        // 7. 计算固定乘区（使用第一个技能作为基准）
        // ============================================================================
        const fixedMultipliers = this.computeFixedMultipliers(
            agent,
            weapon,
            enemy,
            skills[0],
            isStunned,
            externalBuffs
        );

        // ============================================================================
        // 8. 构建预计算数据
        // ============================================================================
        const isPenetration = agent.isPenetrationAgent();
        const precomputed: PrecomputedData = {
            mergedStats,
            conversionBuffs,
            discsBySlot,
            targetSetId,
            otherSetTwoPiece,
            fixedMultipliers,
            skillsParams: skills.map(s => this.createSkillParams(s, isPenetration)),
            agentLevel: agent.level,
            enemyStats: enemy.getCombatStats(enemyLevel, isStunned),
            specialAnomalyConfig: agent.getSpecialAnomalyConfig(),
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
