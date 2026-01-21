/**
 * 优化器评估器
 *
 * 在 Worker 内部运行，负责计算装备组合的伤害值。
 * 复用主线程的 DamageCalculator 和 PropertyCollection 确保计算一致性。
 */

import { PropertyCollection } from '../../model/property-collection';
import { PropertyType, ElementType } from '../../model/base';
import { ZoneCollection } from '../../model/zone-collection';
import { RatioSet } from '../../model/ratio-set';
import { DamageCalculator } from '../../utils/damage-calculator';
import type {
    OptimizationRequest,
    OptimizationBuild,
    SerializedWEngine,
    SerializedDriveDisk,
    SerializedSetBonus,
    BuffData,
} from '../types';

/**
 * 评估结果
 */
export interface EvaluationResult {
    /** 期望伤害 */
    damage: number;
    /** 最终属性快照 */
    finalStats: Partial<Record<PropertyType, number>>;
    /** 伤害构成详情 */
    breakdown: {
        direct: number;
        anomaly: number;
        disorder: number;
    };
}

/**
 * 评估器类
 *
 * 接收序列化的优化请求，计算各种装备组合的伤害。
 */
export class Evaluator {
    private request: OptimizationRequest;

    /** 预计算的角色基础属性 */
    private agentBaseProps: PropertyCollection;

    /** 套装加成查找表 */
    private setBonusMap: Map<string, SerializedSetBonus>;

    constructor(request: OptimizationRequest) {
        this.request = request;

        // 预处理：将角色基础属性转换为 PropertyCollection
        this.agentBaseProps = this.buildAgentBaseProps();

        // 预处理：构建套装加成查找表
        this.setBonusMap = new Map();
        for (const [setId, bonus] of Object.entries(request.setBonuses)) {
            this.setBonusMap.set(setId, bonus);
        }
    }

    /**
     * 将 ElementType 转换为英文 Key
     */
    private getElementKey(element: ElementType | string): string {
        const map: Record<number, string> = {
            [200]: 'physical',
            [201]: 'fire',
            [202]: 'ice',
            [203]: 'electric',
            [204]: 'ether',
        };
        // 尝试转换数字枚举
        if (typeof element === 'number' || !isNaN(Number(element))) {
            return map[Number(element)] || 'physical';
        }
        return String(element).toLowerCase();
    }

    /**
     * 构建角色基础属性 PropertyCollection
     */
    private buildAgentBaseProps(): PropertyCollection {
        const props = new PropertyCollection();
        const { agent } = this.request;

        // 添加基础属性
        for (const [propKey, value] of Object.entries(agent.baseStats)) {
            const propType = Number(propKey) as PropertyType;
            if (value !== undefined && value !== 0) {
                props.out_of_combat.set(propType, value);
            }
        }

        // 添加核心技属性
        for (const [propKey, value] of Object.entries(agent.coreSkillStats)) {
            const propType = Number(propKey) as PropertyType;
            if (value !== undefined && value !== 0) {
                const current = props.out_of_combat.get(propType) ?? 0;
                props.out_of_combat.set(propType, current + value);
            }
        }

        return props;
    }

    /**
     * 将 BuffData 的属性应用到 PropertyCollection
     */
    private applyBuffData(props: PropertyCollection, buff: BuffData): void {
        if (!buff.isActive) return;

        // 应用局外属性
        for (const [propKey, value] of Object.entries(buff.outOfCombatStats)) {
            const propType = Number(propKey) as PropertyType;
            if (value !== undefined && value !== 0) {
                const current = props.out_of_combat.get(propType) ?? 0;
                props.out_of_combat.set(propType, current + value);
            }
        }

        // 应用局内属性
        for (const [propKey, value] of Object.entries(buff.inCombatStats)) {
            const propType = Number(propKey) as PropertyType;
            if (value !== undefined && value !== 0) {
                const current = props.in_combat.get(propType) ?? 0;
                props.in_combat.set(propType, current + value);
            }
        }

        // TODO: 处理转换类属性
    }

    /**
     * 将驱动盘属性应用到 PropertyCollection
     */
    private applyDiscStats(props: PropertyCollection, disc: SerializedDriveDisk): void {
        // 主词条
        const mainPropType = disc.mainStat.type;
        const mainValue = disc.mainStat.value;
        if (mainValue !== 0) {
            const current = props.out_of_combat.get(mainPropType) ?? 0;
            props.out_of_combat.set(mainPropType, current + mainValue);
        }

        // 副词条
        for (const [propKey, value] of Object.entries(disc.subStats)) {
            const propType = Number(propKey) as PropertyType;
            if (value !== undefined && value !== 0) {
                const current = props.out_of_combat.get(propType) ?? 0;
                props.out_of_combat.set(propType, current + value);
            }
        }
    }

    /**
     * 计算套装加成
     *
     * @param discs 6 个驱动盘
     * @returns 套装加成 PropertyCollection
     */
    private calculateSetBonuses(discs: SerializedDriveDisk[]): PropertyCollection {
        const props = new PropertyCollection();

        // 统计各套装数量
        const setCounts = new Map<string, number>();
        for (const disc of discs) {
            const count = setCounts.get(disc.setId) ?? 0;
            setCounts.set(disc.setId, count + 1);
        }

        // 应用套装加成
        for (const [setId, count] of setCounts.entries()) {
            const setBonus = this.setBonusMap.get(setId);
            if (!setBonus) continue;

            // 2 件套加成（始终生效）
            if (count >= 2) {
                for (const [propKey, value] of Object.entries(setBonus.twoPieceStats)) {
                    const propType = Number(propKey) as PropertyType;
                    if (value !== undefined && value !== 0) {
                        const current = props.out_of_combat.get(propType) ?? 0;
                        props.out_of_combat.set(propType, current + value);
                    }
                }
            }

            // 4 件套加成（需要检查是否激活）
            if (count >= 4) {
                // 检查套装是否在激活列表中
                const isActive = this.request.constraints.activeDiskSets.includes(setId);

                // 只有激活的套装才提供4件套效果
                if (isActive) {
                    for (const [propKey, value] of Object.entries(setBonus.fourPieceStats)) {
                        const propType = Number(propKey) as PropertyType;
                        if (value !== undefined && value !== 0) {
                            const current = props.out_of_combat.get(propType) ?? 0;
                            props.out_of_combat.set(propType, current + value);
                        }
                    }

                    // 4 件套 Buff
                    for (const buff of setBonus.fourPieceBuffs) {
                        this.applyBuffData(props, buff);
                    }
                }
            }
        }

        return props;
    }

    /**
     * 计算单个装备组合的伤害
     *
     * @param weapon 音擎
     * @param discs 6 个驱动盘（按位置 1-6 排列）
     * @returns 评估结果
     */
    calculateDamage(weapon: SerializedWEngine, discs: SerializedDriveDisk[]): EvaluationResult {
        // 1. 从角色基础属性开始（复制一份）
        const props = new PropertyCollection();
        for (const [prop, value] of this.agentBaseProps.out_of_combat.entries()) {
            props.out_of_combat.set(prop, value);
        }
        for (const [prop, value] of this.agentBaseProps.in_combat.entries()) {
            props.in_combat.set(prop, value);
        }

        // 2. 添加角色被动 Buff
        for (const buff of this.request.agent.passiveBuffs) {
            this.applyBuffData(props, buff);
        }

        // 3. 添加音擎属性
        for (const [propKey, value] of Object.entries(weapon.stats)) {
            const propType = Number(propKey) as PropertyType;
            if (value !== undefined && value !== 0) {
                const current = props.out_of_combat.get(propType) ?? 0;
                props.out_of_combat.set(propType, current + value);
            }
        }

        // 4. 添加音擎 Buff
        for (const buff of weapon.buffs) {
            this.applyBuffData(props, buff);
        }

        // 5. 添加驱动盘属性
        for (const disc of discs) {
            this.applyDiscStats(props, disc);
        }

        // 6. 计算套装加成
        const setBonusProps = this.calculateSetBonuses(discs);
        props.add(setBonusProps);

        // 7. 添加外部 Buff
        for (const buff of this.request.externalBuffs) {
            this.applyBuffData(props, buff);
        }

        // 8. 转换为最终属性
        const combatProps = props.toCombatStats();
        const finalStats = combatProps.toFinalStats();

        // 9. 构建 ZoneCollection
        const zones = new ZoneCollection();
        zones.final = finalStats;

        // 从敌人数据计算乘区
        const { enemy, skill } = this.request;

        // 防御区计算
        const attackerLevel = this.request.agent.level;
        const levelBase = attackerLevel * 10 + 100;
        const enemyDef = enemy.def;
        const defRed = finalStats.get(PropertyType.DEF_RED_) ?? 0;
        const defIgn = finalStats.get(PropertyType.DEF_IGN_) ?? 0;
        const effectiveDef = enemyDef * Math.max(0, 1 - defRed - defIgn);
        zones.def_mult = levelBase / (effectiveDef + levelBase);

        // 抗性区计算
        const elementResistance = (enemy.resistance[skill.element] ?? 0);
        const resRed = finalStats.get(PropertyType.ENEMY_RES_RED_) ?? 0;
        zones.res_mult = Math.max(0, Math.min(2, 1 - elementResistance + resRed));

        // 减易伤区
        const dmgInc = finalStats.get(PropertyType.DMG_INC_) ?? 0;
        zones.dmg_taken_mult = 1 + dmgInc;

        // 失衡易伤区
        zones.stun_vuln_mult = enemy.isStunned ? enemy.stunVulnerability : 1.0;

        // 距离衰减（默认不衰减）
        zones.distance_mult = 1.0;

        // 10. 构建 RatioSet
        const ratios = new RatioSet();
        ratios.atk_ratio = skill.ratio;
        ratios.element = Number(skill.element) || 200; // 默认物理
        // 转换 tags 到 SkillType 枚举
        // 简化处理：假设已有 tags

        // 10.5 补充计算其他乘区 (异常积蓄、异常增伤等)
        const elementKey = this.getElementKey(skill.element);
        zones.accumulate_zone = DamageCalculator.calculateAnomalyBuildupZone(zones, elementKey);
        zones.anomaly_prof_mult = DamageCalculator.calculateAnomalyProfMultiplier(zones);
        zones.anomaly_dmg_mult = DamageCalculator.calculateAnomalyDmgMultiplier(zones);
        zones.anomaly_crit_mult = DamageCalculator.calculateAnomalyCritMultiplier(zones);
        zones.level_mult = DamageCalculator.calculateLevelMultiplier(attackerLevel);

        // 11. 直伤计算
        // 必须显式设置 dmg_bonus 等乘区，因为 calculateDirectDamageFromRatios 会重新计算部分
        // 但 updateAllZones 其实已经算好了，可以直接用 calculateDirectDamageFromZones
        // 不过为了保险，还是用 FromRatios，它会重新 fetch DMG_ bonus
        const directResult = DamageCalculator.calculateDirectDamageFromRatios(zones, ratios);

        // 12. 异常伤害计算
        const dotParams = DamageCalculator.getAnomalyDotParams(elementKey);
        const anomalyRatios = new RatioSet();
        anomalyRatios.atk_ratio = dotParams.ratio;

        const anomalyResult = DamageCalculator.calculateAnomalyDamageFromZones(zones, anomalyRatios, attackerLevel);

        // 13. 计算异常带来的收益
        // 假设 skill.anomalyBuildup 是该次技能造成的积蓄值
        // 归一化积蓄阈值：100 (假设100积蓄触发一次异常)
        const STANDARD_BUILDUP_THRESHOLD = 100;
        const buildupPerSkill = (skill.anomalyBuildup || 0) * zones.accumulate_zone;
        const procsPerSkill = buildupPerSkill / STANDARD_BUILDUP_THRESHOLD;

        let anomalyEarning = 0;
        if (procsPerSkill > 0) {
            // 单次异常的总伤害 = 单次tick期望 * (总倍率 / 单tick倍率)
            const totalAnomalyDamagePerProc = anomalyResult.damage_expected * (dotParams.ratio > 0 ? (dotParams.totalRatio / dotParams.ratio) : 0);
            anomalyEarning = totalAnomalyDamagePerProc * procsPerSkill;
        }

        // 14. 计算紊乱收益
            let disorderEarning = 0;
            if (procsPerSkill > 0) {
                // 异常T1=3 + 紊乱T2=7 = 10，所以紊乱剩余时间为7
                let disorderRatio = DamageCalculator.getDisorderDamageRatio(elementKey, 7);

                // 检查是否是星见雅（烈霜）
                if (this.request.agent.id === '1091') {
                    // 星见雅专属：烈霜紊乱伤害公式
                    const T = 7;
                    disorderRatio = 6.0 + Math.floor(T) * 0.75;
                }
                
                const disorderRatios = new RatioSet();
                disorderRatios.atk_ratio = disorderRatio;
                // 紊乱也是一种异常伤害，复用 calculateAnomalyDamageFromZones
                const disorderResult = DamageCalculator.calculateAnomalyDamageFromZones(zones, disorderRatios, attackerLevel);
                disorderEarning = disorderResult.damage_expected * procsPerSkill;
            }

        // 总期望 = 直伤 + 异常 + 紊乱
        const totalExpected = directResult.damage_expected + anomalyEarning + disorderEarning;

        // 15. 构建最终属性快照
        const statsSnapshot: Partial<Record<PropertyType, number>> = {};
        for (const [prop, value] of finalStats.entries()) {
            statsSnapshot[prop] = value;
        }

        return {
            damage: totalExpected,
            finalStats: statsSnapshot,
            breakdown: {
                direct: directResult.damage_expected,
                anomaly: anomalyEarning,
                disorder: disorderEarning
            }
        };
    }

    /**
     * 构建 OptimizationBuild 结果
     */
    createBuild(
        weapon: SerializedWEngine,
        discs: SerializedDriveDisk[],
        result: EvaluationResult
    ): OptimizationBuild {
        // 统计套装信息
        const setCounts = new Map<string, number>();
        for (const disc of discs) {
            const count = setCounts.get(disc.setId) ?? 0;
            setCounts.set(disc.setId, count + 1);
        }

        const twoPieceSets: string[] = [];
        let fourPieceSet: string | null = null;

        for (const [setId, count] of setCounts.entries()) {
            if (count >= 4) {
                fourPieceSet = setId;
            } else if (count >= 2) {
                twoPieceSets.push(setId);
            }
        }

        return {
            weaponId: weapon.id,
            discIds: [
                discs[0].id,
                discs[1].id,
                discs[2].id,
                discs[3].id,
                discs[4].id,
                discs[5].id,
            ],
            damage: result.damage,
            finalStats: result.finalStats,
            damageBreakdown: result.breakdown,
            setBonusInfo: {
                twoPieceSets,
                fourPieceSet,
            },
        };
    }
}
