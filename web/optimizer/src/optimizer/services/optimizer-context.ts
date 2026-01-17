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
    OptimizationRequest,
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
    SetBonusData,
    ConversionBuffData,
    FixedMultipliers,
    FastOptimizationRequest,
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

    // ============================================================================
    // 完整请求构建
    // ============================================================================

    /**
     * 构建完整的优化请求
     */
    static buildRequest(options: {
        agent: Agent;
        skill: SkillParams;
        enemy: Enemy;
        enemyLevel?: number;
        isStunned?: boolean;
        weapons: WEngine[];
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
        externalBuffs?: Buff[];
        config?: {
            topN?: number;
            workerId?: number;
            totalWorkers?: number;
            progressInterval?: number;
        };
    }): OptimizationRequest {
        const {
            agent,
            skill,
            enemy,
            enemyLevel = 60,
            isStunned = false,
            weapons,
            discs,
            constraints,
            externalBuffs = [],
            config = {},
        } = options;

        // 使用用户手动选择的武器
        const selectedWeapons = constraints.selectedWeaponIds?.length
            ? weapons.filter(w => constraints.selectedWeaponIds!.includes(w.id))
            : weapons;

        // 有效词条剪枝配置
        const pruningConfig = constraints.effectiveStatPruning;
        const effectiveStats = pruningConfig?.effectiveStats ?? [];

        // 支配关系剪枝（在分组前进行）
        let filteredDiscs = discs;
        if (effectiveStats.length > 0) {
            const beforeCount = discs.length;
            filteredDiscs = this.applyDominancePruning(discs, effectiveStats);
            const afterCount = filteredDiscs.length;
            if (beforeCount !== afterCount) {
                console.log(`[Optimizer] 支配关系剪枝: ${beforeCount} -> ${afterCount} (移除 ${beforeCount - afterCount} 个被支配的盘)`);
            }
        }

        // 按位置分组驱动盘
        const discsByPosition = this.groupDiscsByPosition(filteredDiscs);

        // 预计算有效词条得分
        let maxScorePerSlot: Record<number, number> | undefined = undefined;

        // 固定值 -> 百分比的映射（用于合并计算）
        const flatToPercentMap: Partial<Record<PropertyType, PropertyType>> = {
            [PropertyType.ATK]: PropertyType.ATK_,
            [PropertyType.HP]: PropertyType.HP_,
            [PropertyType.DEF]: PropertyType.DEF_,
            [PropertyType.PEN]: PropertyType.PEN_,
        };

        // 检查主词条是否有效
        const isEffectiveMainStat = (mainStatType: PropertyType): boolean => {
            if (!pruningConfig?.effectiveStats.length) return false;
            if (pruningConfig.effectiveStats.includes(mainStatType)) return true;
            const percentType = flatToPercentMap[mainStatType];
            if (percentType && pruningConfig.effectiveStats.includes(percentType)) return true;
            return false;
        };

        // 4/5/6号位：有效主词条预过滤
        if (pruningConfig?.effectiveStats.length) {
            for (let slot = 4; slot <= 6; slot++) {
                const slotDiscs = discsByPosition[slot] || [];
                // 检查是否有任何盘的主词条是有效词条
                const hasEffectiveMainStat = slotDiscs.some(d => isEffectiveMainStat(d.mainStat.type));
                if (hasEffectiveMainStat) {
                    // 过滤掉无效主词条的盘
                    discsByPosition[slot] = slotDiscs.filter(d => isEffectiveMainStat(d.mainStat.type));
                }
            }
        }

        // 计算词条得分的辅助函数
        const getStatScore = (statType: PropertyType, isMainStat: boolean): number => {
            if (!pruningConfig) return 0;

            // 直接匹配
            if (pruningConfig.effectiveStats.includes(statType)) {
                return isMainStat ? pruningConfig.mainStatScore : 1;
            }

            // 固定值匹配百分比（得分为1/3）
            const percentType = flatToPercentMap[statType];
            if (percentType && pruningConfig.effectiveStats.includes(percentType)) {
                return isMainStat ? pruningConfig.mainStatScore / 3 : 1 / 3;
            }

            return 0;
        };

        if (pruningConfig?.enabled && pruningConfig.effectiveStats.length > 0) {
            maxScorePerSlot = {};

            for (let slot = 1; slot <= 6; slot++) {
                const slotDiscs = discsByPosition[slot] || [];
                let maxScore = 0;

                for (const disc of slotDiscs) {
                    // 计算有效词条得分
                    let score = 0;

                    // 主词条得分
                    score += getStatScore(disc.mainStat.type, true);

                    // 副词条得分（按词条数量）
                    for (const statType of Object.keys(disc.subStats)) {
                        const statTypeNum = Number(statType) as PropertyType;
                        score += getStatScore(statTypeNum, false);
                    }

                    // 设置得分
                    disc.effectiveScore = score;
                    maxScore = Math.max(maxScore, score);
                }

                maxScorePerSlot[slot] = maxScore;
            }
        }

        const request = {
            agent: this.serializeAgent(agent),
            skill: this.createSkill(skill),
            enemy: this.serializeEnemy(enemy, enemyLevel, isStunned),
            weapons: selectedWeapons.map(w => this.serializeWEngine(w)),
            discs: discsByPosition,
            setBonuses: this.extractSetBonuses(discs),
            constraints,
            externalBuffs: this.serializeBuffs(externalBuffs),
            maxScorePerSlot,
            config: {
                topN: config.topN ?? 10,
                workerId: config.workerId ?? 0,
                totalWorkers: config.totalWorkers ?? 1,
                progressInterval: config.progressInterval ?? 1000,
            },
        };

        // 确保数据可序列化（深度克隆移除不可序列化的属性）
        return JSON.parse(JSON.stringify(request));
    }

    // ============================================================================
    // 快速优化（Float64Array 预计算）
    // ============================================================================

    /**
     * 将 Buff 属性填充到 Float64Array
     */
    private static fillArrayFromBuff(arr: Float64Array, buff: Buff): void {
        if (!buff.is_active) return;

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
     */
    private static fillArrayFromAgent(arr: Float64Array, agent: Agent): void {
        // 基础属性
        const baseProps = agent.getCharacterBaseStats();

        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            addToPropArray(arr, prop, value);
        }
        for (const [prop, value] of baseProps.in_combat.entries()) {
            addToPropArray(arr, prop, value);
        }

        // 核心技属性
        const coreSkillStats = agent.getCoreSkillStats();
        for (const [prop, value] of coreSkillStats.entries()) {
            addToPropArray(arr, prop, value);
        }

        // 被动 Buff
        const allBuffs = agent.getAllBuffsSync();
        for (const buff of allBuffs) {
            this.fillArrayFromBuff(arr, buff);
        }
    }

    /**
     * 将音擎属性填充到 Float64Array
     */
    private static fillArrayFromWEngine(arr: Float64Array, wengine: WEngine): void {
        // 基础属性
        const baseProps = wengine.getBaseStats();

        for (const [prop, value] of baseProps.out_of_combat.entries()) {
            addToPropArray(arr, prop, value);
        }

        // 音擎 Buff
        const activeBuffs = wengine.getActiveBuffs();
        for (const buff of activeBuffs) {
            this.fillArrayFromBuff(arr, buff);
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
        wengine: WEngine,
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
        const wengineProps = wengine.getBaseStats();
        baseDefRed += wengineProps.getTotal(PropertyType.DEF_RED_, 0);
        baseDefIgn += wengineProps.getTotal(PropertyType.DEF_IGN_, 0);
        resRed += wengineProps.getTotal(PropertyType.ENEMY_RES_RED_, 0);
        anomalyCritRate += wengineProps.getTotal(PropertyType.ANOM_CRIT_, 0);
        anomalyCritDmg += wengineProps.getTotal(PropertyType.ANOM_CRIT_DMG_, 0);
        anomalyDmgBonus += wengineProps.getTotal(PropertyType.ANOMALY_DMG_, 0);

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
     */
    static buildFastRequest(options: {
        agent: Agent;
        weapon: WEngine;  // 固定音擎
        skill: SkillParams;
        enemy: Enemy;
        enemyLevel?: number;
        isStunned?: boolean;
        discs: DriveDisk[];
        constraints: OptimizationConstraints;
        externalBuffs?: Buff[];
        teammateConversionBuffs?: { buff: Buff; teammateStats: Float64Array }[];
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
            skill,
            enemy,
            enemyLevel = 60,
            isStunned = false,
            discs,
            constraints,
            externalBuffs = [],
            teammateConversionBuffs = [],
            config = {},
        } = options;

        // 1. 预计算角色 + 音擎属性
        const agentStats = createPropArray();
        this.fillArrayFromAgent(agentStats, agent);
        this.fillArrayFromWEngine(agentStats, weapon);

        // 2. 收集自身转换 Buff
        const selfConversionBuffs: ConversionBuffData[] = [];

        // 角色转换 Buff
        const agentBuffs = agent.getAllBuffsSync();
        for (const buff of agentBuffs) {
            const convData = this.extractConversionBuff(buff, false);
            if (convData) {
                selfConversionBuffs.push(convData);
            }
        }

        // 音擎转换 Buff
        const wengineBuffs = weapon.getActiveBuffs();
        for (const buff of wengineBuffs) {
            const convData = this.extractConversionBuff(buff, false);
            if (convData) {
                selfConversionBuffs.push(convData);
            }
        }

        // 3. 预计算队友转换 Buff
        const teammateConversionStats = createPropArray();
        for (const { buff, teammateStats } of teammateConversionBuffs) {
            if (!buff.conversion || !buff.is_active) continue;

            const fromPropIdx = PROP_TYPE_TO_IDX[buff.conversion.from_property];
            const toPropIdx = PROP_TYPE_TO_IDX[buff.conversion.to_property];
            if (fromPropIdx === undefined || toPropIdx === undefined) continue;

            // 队友属性是固定的，直接计算转换值
            const sourceValue = teammateStats[fromPropIdx];
            const threshold = buff.conversion.from_property_threshold ?? 0;
            const effectiveValue = Math.max(0, sourceValue - threshold);

            let convertedValue = effectiveValue * buff.conversion.conversion_ratio;
            if (buff.conversion.max_value !== undefined) {
                convertedValue = Math.min(convertedValue, buff.conversion.max_value);
            }

            teammateConversionStats[toPropIdx] += convertedValue;
        }

        // 4. 预计算外部 Buff
        const externalBuffStats = createPropArray();
        for (const buff of externalBuffs) {
            this.fillArrayFromBuff(externalBuffStats, buff);
        }

        // 5. 预计算驱动盘
        const setIdToIdx: Record<string, number> = {};
        let setIdxCounter = 0;

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

        const isEffectiveMainStat = (mainStatType: PropertyType): boolean => {
            if (!pruningConfig?.effectiveStats.length) return true;
            if (pruningConfig.effectiveStats.includes(mainStatType)) return true;
            const percentType = flatToPercentMap[mainStatType];
            if (percentType && pruningConfig.effectiveStats.includes(percentType)) return true;
            return false;
        };

        // 5.1 支配关系剪枝（在遍历前进行）
        const effectiveStats = pruningConfig?.effectiveStats ?? [];
        let filteredDiscs = discs;
        if (effectiveStats.length > 0) {
            const beforeCount = discs.length;
            filteredDiscs = this.applyDominancePruning(discs, effectiveStats);
            const afterCount = filteredDiscs.length;
            if (beforeCount !== afterCount) {
                console.log(`[Optimizer] 支配关系剪枝: ${beforeCount} -> ${afterCount} (移除 ${beforeCount - afterCount} 个被支配的盘)`);
            }
        }

        for (const disc of filteredDiscs) {
            const slotIdx = disc.position - 1;
            if (slotIdx < 0 || slotIdx > 5) continue;

            // 4/5/6 号位主词条过滤
            if (slotIdx >= 3 && pruningConfig?.enabled) {
                if (!isEffectiveMainStat(disc.main_stat)) continue;
            }

            // 分配套装索引
            if (setIdToIdx[disc.game_id] === undefined) {
                setIdToIdx[disc.game_id] = setIdxCounter++;
            }
            const setIdx = setIdToIdx[disc.game_id];

            // 填充属性数组
            const stats = createPropArray();
            this.fillArrayFromDisc(stats, disc);

            // 计算有效词条得分
            let effectiveScore = 0;
            const props = disc.getStats();
            // 主词条
            effectiveScore += getStatScore(disc.main_stat, true);
            // 副词条
            for (const [prop] of props.out_of_combat.entries()) {
                if (prop !== disc.main_stat) {
                    effectiveScore += getStatScore(prop, false);
                }
            }

            discsBySlot[slotIdx].push({
                id: disc.id,
                setIdx,
                stats,
                effectiveScore,
            });
        }

        // 6. 预计算套装加成
        const setBonuses: SetBonusData[] = [];
        const seenSets = new Set<string>();

        for (const disc of discs) {
            const setId = disc.game_id;
            if (seenSets.has(setId)) continue;
            seenSets.add(setId);

            const setIdx = setIdToIdx[setId];
            if (setIdx === undefined) continue;

            // 2 件套属性
            const twoPiece = createPropArray();
            const twoPieceProps = disc.getSetBuff(DriveDiskSetBonus.TWO_PIECE);
            for (const [prop, value] of twoPieceProps.out_of_combat.entries()) {
                addToPropArray(twoPiece, prop, value);
            }
            for (const [prop, value] of twoPieceProps.in_combat.entries()) {
                addToPropArray(twoPiece, prop, value);
            }

            // 4 件套属性
            const fourPiece = createPropArray();
            const fourPieceProps = disc.getSetBuff(DriveDiskSetBonus.FOUR_PIECE);
            for (const [prop, value] of fourPieceProps.out_of_combat.entries()) {
                addToPropArray(fourPiece, prop, value);
            }
            for (const [prop, value] of fourPieceProps.in_combat.entries()) {
                addToPropArray(fourPiece, prop, value);
            }

            // 4 件套 Buff
            let fourPieceBuff: Float64Array | null = null;
            if (disc.set_buffs && disc.set_buffs.length > 0) {
                fourPieceBuff = createPropArray();
                for (const buff of disc.set_buffs) {
                    this.fillArrayFromBuff(fourPieceBuff, buff);
                }
            }

            setBonuses.push({
                setId,
                setIdx,
                twoPiece,
                fourPiece,
                fourPieceBuff,
            });
        }

        // 7. 计算固定乘区
        const fixedMultipliers = this.computeFixedMultipliers(
            agent,
            weapon,
            enemy,
            skill,
            isStunned,
            externalBuffs
        );

        // 8. 技能参数
        const skillParams = {
            ratio: skill.ratio,
            element: this.elementToEnum(skill.element),
            anomalyBuildup: skill.anomalyBuildup ?? 0,
            tags: skill.tags.map(t => this.tagToNumber(t)),
        };

        // 构建预计算数据
        const precomputed: PrecomputedData = {
            agentStats,
            discsBySlot,
            setBonuses,
            externalBuffStats,
            teammateConversionStats,
            selfConversionBuffs,
            fixedMultipliers,
            skillParams,
            agentLevel: agent.level,
            setIdToIdx,
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
     * @param disc 驱动盘
     * @param effectiveStats 有效词条列表
     * @returns 有效词条 -> 数值的映射
     */
    private static getEffectiveStatValues(
        disc: DriveDisk,
        effectiveStats: PropertyType[]
    ): Map<PropertyType, number> {
        const result = new Map<PropertyType, number>();
        if (!effectiveStats.length) return result;

        // 初始化所有有效词条为 0
        for (const stat of effectiveStats) {
            result.set(stat, 0);
        }

        const props = disc.getStats();

        // 遍历驱动盘的所有属性
        for (const [prop, value] of props.out_of_combat.entries()) {
            // 直接匹配
            if (effectiveStats.includes(prop)) {
                result.set(prop, (result.get(prop) ?? 0) + value);
                continue;
            }

            // 固定值匹配百分比（按 1/3 折算）
            const percentType = this.FLAT_TO_PERCENT_MAP[prop];
            if (percentType && effectiveStats.includes(percentType)) {
                // 固定值转换为等效百分比值（这里用原始值的 1/3 作为权重）
                result.set(percentType, (result.get(percentType) ?? 0) + value / 3);
            }
        }

        return result;
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
     * 对一组驱动盘进行支配关系剪枝
     *
     * 输入：同套装 + 同位置 + 同主词条的驱动盘
     * 输出：移除被支配的盘后的列表
     *
     * @param discs 同组驱动盘
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

        // 预计算每个盘的有效词条数值
        const discValues = discs.map(disc => ({
            disc,
            values: this.getEffectiveStatValues(disc, effectiveStats),
        }));

        // 标记被支配的盘
        const dominated = new Set<number>();

        for (let i = 0; i < discValues.length; i++) {
            if (dominated.has(i)) continue;

            for (let j = i + 1; j < discValues.length; j++) {
                if (dominated.has(j)) continue;

                const a = discValues[i];
                const b = discValues[j];

                // 检查 a 是否被 b 支配
                if (this.isDominated(a.values, b.values)) {
                    dominated.add(i);
                    break;  // a 被支配，跳出内层循环
                }

                // 检查 b 是否被 a 支配
                if (this.isDominated(b.values, a.values)) {
                    dominated.add(j);
                }
            }
        }

        // 返回未被支配的盘
        return discValues
            .filter((_, idx) => !dominated.has(idx))
            .map(item => item.disc);
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

        // 按 setId + position + mainStat 分组
        const groups = new Map<string, DriveDisk[]>();

        for (const disc of discs) {
            const key = `${disc.game_id}_${disc.position}_${disc.main_stat}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(disc);
        }

        // 对每组进行支配关系剪枝
        const result: DriveDisk[] = [];
        for (const group of groups.values()) {
            result.push(...this.filterDominatedDiscs(group, effectiveStats));
        }

        return result;
    }
}
