/**
 * 快速评估器
 *
 * 使用 Float64Array 和预计算数据实现零对象创建的伤害计算。
 * 性能优化的核心组件。
 *
 * 新架构：
 * - mergedStats 已包含：角色+武器+所有非转换buff+目标4件套2+4效果
 * - Worker 只需：累加盘属性 + 检查目标盘数 + 非目标2件套 + 转换buff
 */

import {
  PROP_IDX,
  ELEMENT_TO_DMG_IDX,
  ELEMENT_TO_BUILDUP_IDX,
} from '../types/property-index';
import type {
  PrecomputedData,
  DiscData,
  OptimizationBuildResult,
} from '../types/precomputed';
import {
  getAnomalyDotParams,
  getAnomalyDurationMult,
  getDisorderRatio,
  STANDARD_BUILDUP_THRESHOLD,
} from '../../utils/anomaly-constants';

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
 * 预计算的异常参数（避免热路径上的字符串转换）
 */
interface PrecomputedAnomalyParams {
  ratio: number;
  durationMult: number;
  disorderRatio: number;
  threshold: number;
}

/**
 * 快速评估器
 *
 * 特点：
 * - 复用 Float64Array，避免 GC 压力
 * - 使用数组索引替代 Map 查找
 * - 预计算固定乘区
 * - 简化套装判定逻辑（目标套装预合并）
 */
export class FastEvaluator {
  private precomputed: PrecomputedData;

  /** 复用的累加器数组 */
  private accumulator: Float64Array;

  /** 非目标套装计数（用于2件套判断） */
  private otherSetCounts: Map<string, number>;

  /** 预计算的异常参数表（以元素数字为键） */
  private anomalyParamsCache: Map<number, PrecomputedAnomalyParams>;

  constructor(precomputed: PrecomputedData) {
    this.precomputed = precomputed;
    this.accumulator = new Float64Array(PROP_IDX.TOTAL_PROPS);
    this.otherSetCounts = new Map();
    // 预计算异常参数表
    this.anomalyParamsCache = this.buildAnomalyParamsCache();
  }

  /**
   * 构建预计算的异常参数缓存
   */
  private buildAnomalyParamsCache(): Map<number, PrecomputedAnomalyParams> {
    const cache = new Map<number, PrecomputedAnomalyParams>();
    const elements = [
      { num: 200, str: 'physical' },
      { num: 201, str: 'fire' },
      { num: 202, str: 'ice' },
      { num: 203, str: 'electric' },
      { num: 205, str: 'ether' },
    ];

    for (const { num, str } of elements) {
      const anomParams = getAnomalyDotParams(str);
      const durationMult = getAnomalyDurationMult(str);
      const disorderRatio = getDisorderRatio(str);
      const threshold = this.precomputed.enemyStats?.anomaly_thresholds?.[str]
        ?? STANDARD_BUILDUP_THRESHOLD;

      cache.set(num, {
        ratio: anomParams.ratio,
        durationMult,
        disorderRatio,
        threshold,
      });
    }

    return cache;
  }

  /**
   * 计算单个装备组合的伤害
   *
   * @param discs 6 个驱动盘数据（按位置 1-6）
   * @returns 伤害值，如果目标盘数不足4则返回 null
   */
  calculateDamage(discs: DiscData[]): number | null {
    const result = this.calculateDamageWithMultipliers(discs);
    return result ? result.damage : null;
  }

  /**
   * 计算单个装备组合的伤害和乘区
   *
   * 新架构逻辑：
   * 1. 检查目标盘数>=4（不满足则跳过）
   * 2. 复制预合并的属性（含目标套装2+4效果）
   * 3. 累加6个盘属性 + 统计非目标套装
   * 4. 应用非目标套装的2件套效果（>=2则触发）
   * 5. 应用转换类buff
   * 6. 计算伤害
   *
   * @param discs 6 个驱动盘数据（按位置 1-6）
   * @returns 伤害值和可变乘区，如果目标盘数不足4则返回 null
   */
  calculateDamageWithMultipliers(discs: DiscData[]): {
    damage: number;
    multipliers: number[];
  } | null {
    const {
      mergedStats,
      conversionBuffs,
      targetSetId,
      otherSetTwoPiece,
      fixedMultipliers,
      skillsParams,
    } = this.precomputed;

    // ========================================================================
    // 1. 检查目标盘数>=4（不满足则跳过此组合）
    // ========================================================================
    if (targetSetId) {
      let targetCount = 0;
      for (let i = 0; i < 6; i++) {
        if (discs[i].isTargetSet) targetCount++;
      }
      if (targetCount < 4) return null;
    }

    // ========================================================================
    // 2. 复制预合并的属性（已包含目标套装2+4效果）
    // ========================================================================
    this.accumulator.set(mergedStats);

    // ========================================================================
    // 3. 累加6个驱动盘属性 + 统计非目标套装
    // ========================================================================
    this.otherSetCounts.clear();
    for (let i = 0; i < 6; i++) {
      const disc = discs[i];
      const dStats = disc.stats;

      // 累加属性
      for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
        this.accumulator[j] += dStats[j];
      }

      // 统计非目标套装
      if (!disc.isTargetSet) {
        const count = this.otherSetCounts.get(disc.setId) || 0;
        this.otherSetCounts.set(disc.setId, count + 1);
      }
    }

    // ========================================================================
    // 4. 应用非目标套装的2件套效果（>=2则触发）
    // ========================================================================
    for (const [setId, count] of this.otherSetCounts.entries()) {
      if (count >= 2) {
        const twoPiece = otherSetTwoPiece[setId];
        if (twoPiece) {
          for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) {
            this.accumulator[j] += twoPiece[j];
          }
        }
      }
    }

    // ========================================================================
    // 5. 计算最终属性（三层转换：局外 → 局内 → 最终）
    // ========================================================================
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

    // ========================================================================
    // 6. 应用转换类Buff（需要最终属性才能计算）
    // ========================================================================
    for (const conv of conversionBuffs) {
      const sourceValue = this.getFinalProp(conv.fromPropIdx, finalAtk, finalHp, finalDef, finalImpact);
      const effectiveValue = Math.max(0, sourceValue - conv.threshold);

      let convertedValue = effectiveValue * conv.ratio;
      if (conv.maxValue !== null) {
        convertedValue = Math.min(convertedValue, conv.maxValue);
      }

      this.accumulator[conv.toPropIdx] += convertedValue;
    }

    // ========================================================================
    // 7. 重新计算可能受转换影响的最终攻击力
    // ========================================================================
    const finalAtkAfterConv =
      this.accumulator[PROP_IDX.ATK_BASE] *
        (1 + this.accumulator[PROP_IDX.ATK_]) +
      this.accumulator[PROP_IDX.ATK];

    // ========================================================================
    // 8. 计算防御区
    // ========================================================================
    const { defenseParams } = fixedMultipliers;
    const discPenRate = this.accumulator[PROP_IDX.PEN_];
    const discDefIgn = this.accumulator[PROP_IDX.DEF_IGN_];
    const totalDefRed = defenseParams.baseDefRed + defenseParams.baseDefIgn + discPenRate + discDefIgn;
    const effectiveDef = defenseParams.enemyDef * Math.max(0, 1 - totalDefRed);
    const defMult = defenseParams.levelBase / (effectiveDef + defenseParams.levelBase);

    // ========================================================================
    // 9. 计算公共乘区
    // ========================================================================
    const { critRate, critDmg } = this.calculateCommonMultipliers();

    // ========================================================================
    // 10. 对每个技能计算伤害
    // ========================================================================
    let totalVariableDamage = 0;

    for (const skillParams of skillsParams) {
      const dmgBonus = this.calculateDamageBonus(skillParams);
      const critZone = 1 + critRate * critDmg;

      // 直伤（区分贯穿和常规）
      let variableDirectDamage: number;

      if (skillParams.isPenetration) {
        const sheerForce = this.accumulator[PROP_IDX.SHEER_FORCE];
        const pierceBonus = 1 + this.accumulator[PROP_IDX.SHEER_DMG_];
        variableDirectDamage = sheerForce * skillParams.ratio * dmgBonus * critZone * pierceBonus;
      } else {
        const baseDamage = finalAtkAfterConv * skillParams.ratio;
        variableDirectDamage = baseDamage * dmgBonus * critZone * defMult;
      }

      // 异常伤害
      let variableAnomalyDamage = 0;
      let variableDisorderDamage = 0;

      if (skillParams.anomalyBuildup > 0) {
        const anomalyResult = this.calculateAnomalyDamage(
          finalAtkAfterConv,
          dmgBonus,
          defMult,
          skillParams.element,
          skillParams.anomalyBuildup
        );
        variableAnomalyDamage = anomalyResult.anomaly;
        variableDisorderDamage = anomalyResult.disorder;
      }

      totalVariableDamage += variableDirectDamage + variableAnomalyDamage + variableDisorderDamage;
    }

    // ========================================================================
    // 11. 烈霜特殊处理（星见雅）
    // ========================================================================
    if (this.precomputed.specialAnomalyConfig?.element === 'lieshuang') {
      const lieshuangDamage = this.calculateLieshuangDamage(
        finalAtkAfterConv,
        defMult,
        critRate,
        critDmg
      );
      totalVariableDamage += lieshuangDamage;
    }

    // ========================================================================
    // 12. 返回结果
    // ========================================================================
    const multipliers: number[] = [
      finalAtkAfterConv,
      0,
      this.accumulator[PROP_IDX.ANOM_PROF] / 100,
      1 + this.accumulator[PROP_IDX.ANOM_BUILDUP_] + (ELEMENT_TO_BUILDUP_IDX[skillsParams[0].element] !== undefined ? this.accumulator[ELEMENT_TO_BUILDUP_IDX[skillsParams[0].element]] : 0),
      1 + Math.min(1, Math.max(0, this.accumulator[PROP_IDX.CRIT_])) * this.accumulator[PROP_IDX.CRIT_DMG_],
      1 + this.accumulator[PROP_IDX.DMG_] + (ELEMENT_TO_DMG_IDX[skillsParams[0].element] !== undefined ? this.accumulator[ELEMENT_TO_DMG_IDX[skillsParams[0].element]] : 0),
    ];

    return { damage: totalVariableDamage, multipliers };
  }

  /**
   * 计算公共乘区
   */
  private calculateCommonMultipliers(): {
    critRate: number;
    critDmg: number;
  } {
    const critRate = Math.min(1, Math.max(0, this.accumulator[PROP_IDX.CRIT_]));
    const critDmg = this.accumulator[PROP_IDX.CRIT_DMG_];
    return { critRate, critDmg };
  }

  /**
   * 计算增伤区
   */
  private calculateDamageBonus(skillParams: any): number {
    let dmgBonus = 1 + this.accumulator[PROP_IDX.DMG_];
    const elementDmgIdx = ELEMENT_TO_DMG_IDX[skillParams.element];
    if (elementDmgIdx !== undefined) {
      dmgBonus += this.accumulator[elementDmgIdx];
    }
    for (const tag of skillParams.tags) {
      const tagDmgIdx = this.getSkillTagDmgIdx(tag);
      if (tagDmgIdx !== undefined) {
        dmgBonus += this.accumulator[tagDmgIdx];
      }
    }
    return dmgBonus;
  }

  /**
   * 计算异常伤害（不含通用乘区）
   */
  private calculateAnomalyDamage(
    finalAtk: number,
    dmgBonus: number,
    defMult: number,
    element: number,
    anomalyBuildup: number
  ): { anomaly: number; disorder: number } {
    const { fixedMultipliers } = this.precomputed;
    const {
      levelMult,
      anomalyCritMult,
      anomalyDmgMult,
    } = fixedMultipliers;

    const anomalyProf = this.accumulator[PROP_IDX.ANOM_PROF];
    const anomalyProfMult = anomalyProf / 100;

    let buildupMult = 1 + this.accumulator[PROP_IDX.ANOM_BUILDUP_];
    const elementBuildupIdx = ELEMENT_TO_BUILDUP_IDX[element];
    if (elementBuildupIdx !== undefined) {
      buildupMult += this.accumulator[elementBuildupIdx];
    }

    const cachedParams = this.anomalyParamsCache.get(element);
    if (!cachedParams) {
      return { anomaly: 0, disorder: 0 };
    }

    const buildupPerSkill = anomalyBuildup * buildupMult;
    const procsPerSkill = buildupPerSkill / cachedParams.threshold;

    if (procsPerSkill <= 0) {
      return { anomaly: 0, disorder: 0 };
    }

    const anomalyBaseDamage = finalAtk * cachedParams.ratio;

    const anomalyDamage =
      anomalyBaseDamage *
      dmgBonus *
      anomalyProfMult *
      anomalyDmgMult *
      anomalyCritMult *
      levelMult *
      defMult;

    const totalAnomalyDamagePerProc = anomalyDamage * cachedParams.durationMult;
    const anomalyEarning = totalAnomalyDamagePerProc * procsPerSkill;

    const disorderDamage =
      finalAtk *
      cachedParams.disorderRatio *
      dmgBonus *
      anomalyProfMult *
      anomalyDmgMult *
      anomalyCritMult *
      levelMult *
      defMult;

    return {
      anomaly: anomalyEarning,
      disorder: disorderDamage * Math.min(procsPerSkill, 5),
    };
  }

  /**
   * 计算烈霜伤害（星见雅专属）
   */
  private calculateLieshuangDamage(
    finalAtk: number,
    defMult: number,
    critRate: number,
    critDmg: number
  ): number {
    const { specialAnomalyConfig, skillsParams } = this.precomputed;
    if (!specialAnomalyConfig || specialAnomalyConfig.element !== 'lieshuang') {
      return 0;
    }

    const ratio = specialAnomalyConfig.ratio;
    const baseDamage = finalAtk * ratio;

    let dmgBonus = 1 + this.accumulator[PROP_IDX.DMG_];
    const iceDmgIdx = ELEMENT_TO_DMG_IDX[202];
    if (iceDmgIdx !== undefined) {
      dmgBonus += this.accumulator[iceDmgIdx];
    }

    const critZone = 1 + critRate * critDmg;

    let buildupMult = 1 + this.accumulator[PROP_IDX.ANOM_BUILDUP_];
    const iceBuildupIdx = ELEMENT_TO_BUILDUP_IDX[202];
    if (iceBuildupIdx !== undefined) {
      buildupMult += this.accumulator[iceBuildupIdx];
    }

    const anomalyBuildup = skillsParams[0]?.anomalyBuildup ?? 0;
    const threshold = this.anomalyParamsCache.get(202)?.threshold ?? 600;
    const buildupPerSkill = anomalyBuildup * buildupMult;
    const procsPerSkill = buildupPerSkill / threshold;

    return baseDamage * dmgBonus * critZone * defMult * procsPerSkill;
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
    if (propIdx === PROP_IDX.ATK_BASE) return finalAtk;
    if (propIdx === PROP_IDX.HP_BASE) return finalHp;
    if (propIdx === PROP_IDX.DEF_BASE) return finalDef;
    if (propIdx === PROP_IDX.IMPACT) return finalImpact;
    return this.accumulator[propIdx];
  }

  /**
   * 获取技能标签对应的增伤索引
   */
  private getSkillTagDmgIdx(tag: number): number | undefined {
    switch (tag) {
      case 1: return PROP_IDX.NORMAL_ATK_DMG_;
      case 2: return PROP_IDX.SPECIAL_ATK_DMG_;
      case 3: return PROP_IDX.CHAIN_ATK_DMG_;
      case 4: return PROP_IDX.ULTIMATE_ATK_DMG_;
      case 5: return PROP_IDX.DASH_ATK_DMG_;
      case 6: return PROP_IDX.DODGE_COUNTER_DMG_;
      case 7: return PROP_IDX.ASSIST_ATK_DMG_;
      case 8: return PROP_IDX.ENHANCED_SPECIAL_DMG_;
      case 9: return PROP_IDX.ADDL_ATK_DMG_;
      default: return undefined;
    }
  }

  /**
   * 获取当前累加器的快照（用于调试）
   */
  getAccumulatorSnapshot(): Float64Array {
    return new Float64Array(this.accumulator);
  }

  /**
   * 创建完整的评估结果（用于最终输出）
   * 重新计算组合以正确设置累加器，并统一应用通用乘区
   */
  createFullResult(
    discs: DiscData[],
    _heapDamage: number,
    _heapMultipliers: number[]
  ): OptimizationBuildResult {
    const result = this.calculateDamageWithMultipliers(discs);
    if (!result) {
      throw new Error('Failed to calculate damage for createFullResult');
    }

    const { damage: variableDamage, multipliers } = result;
    const { skillsParams, fixedMultipliers, targetSetId } = this.precomputed;

    if (!skillsParams || skillsParams.length === 0) {
      throw new Error('skillsParams is empty');
    }

    // 通用乘区
    const { resMult, dmgTakenMult, stunVulnMult, distanceMult, defenseParams } = fixedMultipliers;
    const universalMult = resMult * dmgTakenMult * stunVulnMult;

    const totalDamage = variableDamage * universalMult;

    const finalAtkAfterConv = multipliers[0];
    const anomalyProfMult = multipliers[2];
    const accumulationZone = multipliers[3];
    const critZone = multipliers[4];
    const dmgBonus = multipliers[5];

    const discPenRate = this.accumulator[PROP_IDX.PEN_];
    const discDefIgn = this.accumulator[PROP_IDX.DEF_IGN_];
    const totalDefRed = defenseParams.baseDefRed + defenseParams.baseDefIgn + discPenRate + discDefIgn;
    const effectiveDef = defenseParams.enemyDef * Math.max(0, 1 - totalDefRed);
    const defMult = defenseParams.levelBase / (effectiveDef + defenseParams.levelBase);

    const skillParams = skillsParams[0];

    // 直伤 breakdown
    let directDamage: number;
    if (skillParams.isPenetration) {
      const sheerForce = this.accumulator[PROP_IDX.SHEER_FORCE];
      const pierceBonus = 1 + this.accumulator[PROP_IDX.SHEER_DMG_];
      directDamage = sheerForce * skillParams.ratio * dmgBonus * critZone * pierceBonus * universalMult * distanceMult;
    } else {
      const baseDamage = finalAtkAfterConv * skillParams.ratio;
      directDamage = baseDamage * dmgBonus * critZone * defMult * universalMult * distanceMult;
    }

    // 异常伤害 breakdown
    const anomalyResult = skillParams.anomalyBuildup > 0
      ? this.calculateAnomalyDamage(finalAtkAfterConv, dmgBonus, defMult, skillParams.element, skillParams.anomalyBuildup)
      : { anomaly: 0, disorder: 0 };
    const finalAnomaly = anomalyResult.anomaly * universalMult;
    const finalDisorder = anomalyResult.disorder * universalMult;

    // 统计套装信息（新逻辑：目标套装是4件套，非目标套装可能有2件套）
    const twoPieceSets: string[] = [];
    let fourPieceSet: string | null = null;

    // 目标套装是4件套（已在检查中确认>=4）
    if (targetSetId) {
      fourPieceSet = targetSetId;
    }

    // 非目标套装可能有2件套
    for (const [setId, count] of this.otherSetCounts.entries()) {
      if (count >= 2) {
        twoPieceSets.push(setId);
      }
    }

    return {
      damage: totalDamage,
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
        anomaly: finalAnomaly,
        disorder: finalDisorder,
      },
      multipliers: {
        baseDirectDamage: finalAtkAfterConv,
        baseAnomalyDamage: 0,
        anomalyProfMult,
        accumulationZone,
        critZone,
        dmgBonus,
      },
      setInfo: {
        twoPieceSets,
        fourPieceSet,
      },
    };
  }
}
