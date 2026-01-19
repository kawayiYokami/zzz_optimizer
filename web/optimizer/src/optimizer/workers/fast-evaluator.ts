/**
 * 快速评估器
 *
 * 使用 Float64Array 和预计算数据实现零对象创建的伤害计算。
 * 性能优化的核心组件。
 */

import {
  PROP_IDX,
  ELEMENT_TO_DMG_IDX,
  ELEMENT_TO_BUILDUP_IDX,
} from '../types/property-index';
import type {
  PrecomputedData,
  DiscData,
  ConversionBuffData,
  OptimizationBuildResult,
} from '../types/precomputed';

/**
 * 快速评估结果（简化版，避免对象创建）
 */
export interface FastEvaluationResult {
  /** 总期望伤害 */
  damage: number;
  /** 直伤 */
  direct: number;
  /** 异常伤害 */
  anomaly: number;
  /** 紊乱伤害 */
  disorder: number;
}

/**
 * 快速评估器
 *
 * 特点：
 * - 复用 Float64Array，避免 GC 压力
 * - 使用数组索引替代 Map 查找
 * - 预计算固定乘区
 */
export class FastEvaluator {
  private precomputed: PrecomputedData;

  /** 复用的累加器数组 */
  private accumulator: Float64Array;

  /** 套装计数数组（索引 = setIdx，值 = 数量） */
  private setCounts: Uint8Array;

  /** 最大套装数量 */
  private static readonly MAX_SETS = 32;

  /** 标准异常积蓄阈值 */
  private static readonly STANDARD_BUILDUP_THRESHOLD = 100;

  constructor(precomputed: PrecomputedData) {
    this.precomputed = precomputed;
    this.accumulator = new Float64Array(PROP_IDX.TOTAL_PROPS);
    this.setCounts = new Uint8Array(FastEvaluator.MAX_SETS);
  }

  /**
   * 计算单个装备组合的伤害
   *
   * @param discs 6 个驱动盘数据（按位置 1-6）
   * @returns 伤害值
   */
  calculateDamage(discs: DiscData[]): number {
    const {
      agentStats,
      setBonuses,
      externalBuffStats,
      teammateConversionStats,
      selfConversionBuffs,
      fixedMultipliers,
      skillParams,
    } = this.precomputed;

    // 1. 重置累加器为角色基础属性（已包含音擎）
    this.accumulator.set(agentStats);

    // 2. 加上驱动盘属性 + 统计套装
    this.setCounts.fill(0);
    for (let i = 0; i < 6; i++) {
      const disc = discs[i];
      const dStats = disc.stats;
      // 累加属性
      for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
        this.accumulator[j] += dStats[j];
      }
      // 统计套装
      this.setCounts[disc.setIdx]++;
    }

    // 3. 加上套装加成
    for (const setBonus of setBonuses) {
      const count = this.setCounts[setBonus.setIdx];
      if (count >= 2) {
        const twoPiece = setBonus.twoPiece;
        for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
          this.accumulator[j] += twoPiece[j];
        }
      }
      if (count >= 4) {
        // 检查套装是否在激活列表中
        const isActive = this.precomputed.activeDiskSets.includes(setBonus.setId);

        // 只有激活的套装才提供4件套效果
        if (isActive) {
          const fourPiece = setBonus.fourPiece;
          for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
            this.accumulator[j] += fourPiece[j];
          }
          // 4 件套 Buff
          if (setBonus.fourPieceBuff) {
            for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
              this.accumulator[j] += setBonus.fourPieceBuff[j];
            }
          }
        }
      }
    }

    // 4. 加上外部 Buff
    for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
      this.accumulator[j] += externalBuffStats[j];
    }

    // 5. 加上队友转换 Buff（预计算的固定值）
    for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
      this.accumulator[j] += teammateConversionStats[j];
    }

    // 6. 计算最终属性（三层转换：局外 → 局内 → 最终）
    // 这里简化为一步：BASE * (1 + %) + FLAT
    const finalAtk =
      this.accumulator[PROP_IDX.ATK_BASE] *
        (1 + this.accumulator[PROP_IDX.ATK_]) +
      this.accumulator[PROP_IDX.ATK];
    const finalHp =
      this.accumulator[PROP_IDX.HP_BASE] *
        (1 + this.accumulator[PROP_IDX.HP_]) +
      this.accumulator[PROP_IDX.HP];
    const finalDef =
      this.accumulator[PROP_IDX.DEF_BASE] *
        (1 + this.accumulator[PROP_IDX.DEF_]) +
      this.accumulator[PROP_IDX.DEF];
    const finalImpact =
      this.accumulator[PROP_IDX.IMPACT] *
      (1 + this.accumulator[PROP_IDX.IMPACT_]);

    // 7. 应用自身转换 Buff（在最终属性计算后）
    for (const conv of selfConversionBuffs) {
      const sourceValue = this.getFinalProp(conv.fromPropIdx, finalAtk, finalHp, finalDef, finalImpact);
      const effectiveValue = Math.max(0, sourceValue - conv.threshold);

      let convertedValue = effectiveValue * conv.ratio;
      if (conv.maxValue !== null) {
        convertedValue = Math.min(convertedValue, conv.maxValue);
      }

      // 累加到目标属性
      this.accumulator[conv.toPropIdx] += convertedValue;
    }

    // 8. 重新计算可能受转换影响的最终攻击力
    const finalAtkAfterConv =
      this.accumulator[PROP_IDX.ATK_BASE] *
        (1 + this.accumulator[PROP_IDX.ATK_]) +
      this.accumulator[PROP_IDX.ATK];

    // 9. 获取暴击属性
    const critRate = Math.min(1, Math.max(0, this.accumulator[PROP_IDX.CRIT_]));
    const critDmg = this.accumulator[PROP_IDX.CRIT_DMG_];

    // 10. 计算增伤区
    let dmgBonus = 1 + this.accumulator[PROP_IDX.DMG_];
    // 元素增伤
    const elementDmgIdx = ELEMENT_TO_DMG_IDX[skillParams.element];
    if (elementDmgIdx !== undefined) {
      dmgBonus += this.accumulator[elementDmgIdx];
    }
    // 技能类型增伤（根据 tags）
    for (const tag of skillParams.tags) {
      const tagDmgIdx = this.getSkillTagDmgIdx(tag);
      if (tagDmgIdx !== undefined) {
        dmgBonus += this.accumulator[tagDmgIdx];
      }
    }

    // 11. 计算防御区（含驱动盘穿透）
    const { defenseParams, resMult, dmgTakenMult, stunVulnMult, distanceMult } =
      fixedMultipliers;
    const discPenRate = this.accumulator[PROP_IDX.PEN_];
    const discDefIgn = this.accumulator[PROP_IDX.DEF_IGN_];
    const totalDefRed =
      defenseParams.baseDefRed + defenseParams.baseDefIgn + discPenRate + discDefIgn;
    const effectiveDef = defenseParams.enemyDef * Math.max(0, 1 - totalDefRed);
    const defMult = defenseParams.levelBase / (effectiveDef + defenseParams.levelBase);

    // 12. 计算直伤
    const baseDamage = finalAtkAfterConv * skillParams.ratio;
    const critZone = 1 + critRate * critDmg;
    const directDamage =
      baseDamage * dmgBonus * critZone * defMult * resMult * dmgTakenMult * stunVulnMult * distanceMult;

    // 13. 计算异常伤害（如果有异常积蓄）
    let anomalyDamage = 0;
    let disorderDamage = 0;

    if (skillParams.anomalyBuildup > 0) {
      const anomalyResult = this.calculateAnomalyDamage(
        finalAtkAfterConv,
        dmgBonus,
        defMult
      );
      anomalyDamage = anomalyResult.anomaly;
      disorderDamage = anomalyResult.disorder;
    }

    // 14. 总期望伤害
    return directDamage + anomalyDamage + disorderDamage;
  }

  /**
   * 计算异常伤害
   */
  private calculateAnomalyDamage(
    finalAtk: number,
    dmgBonus: number,
    defMult: number
  ): { anomaly: number; disorder: number } {
    const { fixedMultipliers, skillParams, agentLevel } = this.precomputed;
    const {
      levelMult,
      anomalyCritMult,
      anomalyDmgMult,
      resMult,
      dmgTakenMult,
      stunVulnMult,
    } = fixedMultipliers;

    // 异常精通区（6 号位可能有异常精通主词条）
    const anomalyProf = this.accumulator[PROP_IDX.ANOM_PROF];
    const anomalyProfMult = anomalyProf / 100;

    // 异常积蓄区
    let buildupMult = 1 + this.accumulator[PROP_IDX.ANOM_BUILDUP_];
    const elementBuildupIdx = ELEMENT_TO_BUILDUP_IDX[skillParams.element];
    if (elementBuildupIdx !== undefined) {
      buildupMult += this.accumulator[elementBuildupIdx];
    }

    // 计算每次技能触发的异常次数
    const buildupPerSkill = skillParams.anomalyBuildup * buildupMult;
    const procsPerSkill = buildupPerSkill / FastEvaluator.STANDARD_BUILDUP_THRESHOLD;

    if (procsPerSkill <= 0) {
      return { anomaly: 0, disorder: 0 };
    }

    // 异常基础伤害（简化：使用 ATK * 倍率）
    // 实际的异常倍率应该从 DamageCalculatorService.getAnomalyDotParams 获取
    const anomalyRatio = this.getAnomalyRatio(skillParams.element);
    const anomalyBaseDamage = finalAtk * anomalyRatio;

    // 异常伤害公式
    const anomalyDamage =
      anomalyBaseDamage *
      dmgBonus *
      anomalyProfMult *
      anomalyDmgMult *
      anomalyCritMult *
      levelMult *
      defMult *
      resMult *
      dmgTakenMult *
      stunVulnMult;

    // 单次异常总伤害（乘以持续时间系数）
    const totalAnomalyDamagePerProc = anomalyDamage * this.getAnomalyDurationMult(skillParams.element);
    const anomalyEarning = totalAnomalyDamagePerProc * procsPerSkill;

    // 紊乱伤害
    const disorderRatio = this.getDisorderRatio(skillParams.element);
    const disorderDamage =
      finalAtk *
      disorderRatio *
      dmgBonus *
      anomalyProfMult *
      anomalyDmgMult *
      anomalyCritMult *
      levelMult *
      defMult *
      resMult *
      dmgTakenMult *
      stunVulnMult;
    const disorderEarning = disorderDamage * procsPerSkill;

    return {
      anomaly: anomalyEarning,
      disorder: disorderEarning,
    };
  }

  /**
   * 获取最终属性值（用于转换计算）
   */
  private getFinalProp(
    propIdx: number,
    finalAtk: number,
    finalHp: number,
    finalDef: number,
    finalImpact: number
  ): number {
    // 对于基础属性，返回已计算的最终值
    if (propIdx === PROP_IDX.ATK_BASE) return finalAtk;
    if (propIdx === PROP_IDX.HP_BASE) return finalHp;
    if (propIdx === PROP_IDX.DEF_BASE) return finalDef;
    if (propIdx === PROP_IDX.IMPACT) return finalImpact;

    // 其他属性直接从累加器获取
    return this.accumulator[propIdx];
  }

  /**
   * 获取技能标签对应的增伤索引
   */
  private getSkillTagDmgIdx(tag: number): number | undefined {
    // 技能类型标签到增伤索引的映射
    const tagToIdx: Record<number, number> = {
      1: PROP_IDX.NORMAL_ATK_DMG_,       // 普通攻击
      2: PROP_IDX.SPECIAL_ATK_DMG_,      // 特殊技
      3: PROP_IDX.CHAIN_ATK_DMG_,        // 连携技
      4: PROP_IDX.ULTIMATE_ATK_DMG_,     // 终结技
      5: PROP_IDX.DASH_ATK_DMG_,         // 冲刺攻击
      6: PROP_IDX.DODGE_COUNTER_DMG_,    // 闪避反击
      7: PROP_IDX.ASSIST_ATK_DMG_,       // 支援攻击
      8: PROP_IDX.ENHANCED_SPECIAL_DMG_, // 强化特殊技
      9: PROP_IDX.ADDL_ATK_DMG_,         // 追加攻击
    };
    return tagToIdx[tag];
  }

  /**
   * 获取异常伤害倍率（简化版）
   */
  private getAnomalyRatio(element: number): number {
    // 不同元素的异常伤害倍率（简化值）
    const ratios: Record<number, number> = {
      200: 0.5,  // 物理 - 强击
      201: 0.5,  // 火 - 灼烧
      202: 1.0,  // 冰 - 碎冰
      203: 1.25, // 电 - 感电
      205: 0.625, // 以太 - 侵蚀
    };
    return ratios[element] ?? 0.5;
  }

  /**
   * 获取异常持续时间乘数
   */
  private getAnomalyDurationMult(element: number): number {
    // 异常总伤害 = 单次 tick × 次数
    const mults: Record<number, number> = {
      200: 1,    // 物理 - 单次
      201: 10,   // 火 - 10 次 tick
      202: 1,    // 冰 - 单次
      203: 10,   // 电 - 10 次 tick
      205: 10,   // 以太 - 10 次 tick
    };
    return mults[element] ?? 1;
  }

  /**
   * 获取紊乱伤害倍率
   */
  private getDisorderRatio(element: number): number {
    // 紊乱倍率（简化值）
    return 1.5;
  }

  /**
   * 获取当前累加器的快照（用于调试）
   */
  getAccumulatorSnapshot(): Float64Array {
    return new Float64Array(this.accumulator);
  }

  /**
   * 创建完整的评估结果（用于最终输出）
   */
  createFullResult(
    discs: DiscData[],
    damage: number
  ): OptimizationBuildResult {
    // 计算详细伤害构成
    const { skillParams, fixedMultipliers } = this.precomputed;

    // 重新计算以获取详细数据
    const finalAtk =
      this.accumulator[PROP_IDX.ATK_BASE] *
        (1 + this.accumulator[PROP_IDX.ATK_]) +
      this.accumulator[PROP_IDX.ATK];
    const critRate = Math.min(1, Math.max(0, this.accumulator[PROP_IDX.CRIT_]));
    const critDmg = this.accumulator[PROP_IDX.CRIT_DMG_];

    let dmgBonus = 1 + this.accumulator[PROP_IDX.DMG_];
    const elementDmgIdx = ELEMENT_TO_DMG_IDX[skillParams.element];
    if (elementDmgIdx !== undefined) {
      dmgBonus += this.accumulator[elementDmgIdx];
    }

    const { defenseParams, resMult, dmgTakenMult, stunVulnMult, distanceMult } =
      fixedMultipliers;
    const discPenRate = this.accumulator[PROP_IDX.PEN_];
    const discDefIgn = this.accumulator[PROP_IDX.DEF_IGN_];
    const totalDefRed =
      defenseParams.baseDefRed + defenseParams.baseDefIgn + discPenRate + discDefIgn;
    const effectiveDef = defenseParams.enemyDef * Math.max(0, 1 - totalDefRed);
    const defMult = defenseParams.levelBase / (effectiveDef + defenseParams.levelBase);

    const baseDamage = finalAtk * skillParams.ratio;
    const critZone = 1 + critRate * critDmg;
    const directDamage =
      baseDamage * dmgBonus * critZone * defMult * resMult * dmgTakenMult * stunVulnMult * distanceMult;

    const anomalyResult = skillParams.anomalyBuildup > 0
      ? this.calculateAnomalyDamage(finalAtk, dmgBonus, defMult)
      : { anomaly: 0, disorder: 0 };

    // 统计套装
    const twoPieceSets: string[] = [];
    let fourPieceSet: string | null = null;

    for (const setBonus of this.precomputed.setBonuses) {
      const count = this.setCounts[setBonus.setIdx];
      if (count >= 4) {
        fourPieceSet = setBonus.setId;
      } else if (count >= 2) {
        twoPieceSets.push(setBonus.setId);
      }
    }

    return {
      damage,
      discIds: [
        discs[0].id,
        discs[1].id,
        discs[2].id,
        discs[3].id,
        discs[4].id,
        discs[5].id,
      ],
      finalStats: this.getAccumulatorSnapshot(),
      breakdown: {
        direct: directDamage,
        anomaly: anomalyResult.anomaly,
        disorder: anomalyResult.disorder,
      },
      setInfo: {
        twoPieceSets,
        fourPieceSet,
      },
    };
  }
}
