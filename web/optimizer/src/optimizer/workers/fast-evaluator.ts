/**
 * 快速评估器
 *
 * 使用 Float64Array 和预计算数据实现零对象创建的伤害计算。
 * 性能优化的核心组件。
 *
 * 新架构（注意：这里的“静态/局内”口径必须与 docs/damage_system.md 一致）：
 * - mergedStats：作为“可复用底座”，应仅包含不会随驱动盘组合变化的那部分属性（例如角色+武器+与盘无关的静态项）
 * - Worker 端：在每个组合上叠加盘词条、套装2件套（静态属性）、并应用转换类 buff 后计算伤害
 *
 * 警告：如果把“会随盘组合变化/触发条件变化的局内 Buff（例如4件套触发态）”混入 mergedStats，
 * 将导致预计算输入与实际规则不一致，从而出现“输入总是有问题”的症状。
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
  /** 烈霜伤害（星见雅等特殊机制） */
  lieshuang?: number;
}

/**
 * 预计算的异常参数（避免热路径上的字符串转换）
 */
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

  /** 复用的累加器数组（仅存储盘增量+2pc，不含 buff） */
  private accumulator: Float64Array;

  /**
   * 叶子评估用临时缓冲区（accumulator + workerMergedBuff + conversion）
   * 用于 calculateDamageWithMultipliers 中的计算，避免污染 accumulator
   */
  private evalBuffer: Float64Array;

  /** Worker 复用的底座（mergedStats + target 2pc） */
  private workerBaseStats: Float64Array;

  /** Worker 复用的普通 buff 合并（mergedBuff + target 4pc buff） */
  private workerMergedBuff: Float64Array;

  /** 非目标套装计数（用于2件套判断；Worker 热路径避免 Map/string） */
  private otherSetCounts: Int8Array;
  /** 本组合中实际出现过的 setIdx（最多 6 个，避免扫描 entire counts） */
  private otherSetUsed: Int16Array;
  private otherSetUsedCount: number = 0;
  /** otherSetTwoPiece(setId->arr) 映射为 setIdx->arr，避免每次组合 string key 查找 */
  private otherSetTwoPieceByIdx: Array<Float64Array | null>;

  /** 固定乘区（每个 worker 初始化一次） */
  private fixed: {
    resMult: number;
    dmgTakenMult: number;
    stunVulnMult: number;
    distanceMult: number;
    levelMult: number;
    anomalyCritMult: number;
    anomalyDmgMult: number;
    resElementKey: string;
    enemyResUsed: number;
    totalResRedUsed: number;
  };

  constructor(precomputed: PrecomputedData) {
    this.precomputed = precomputed;
    this.accumulator = new Float64Array(PROP_IDX.TOTAL_PROPS);
    this.evalBuffer = new Float64Array(PROP_IDX.TOTAL_PROPS);
    this.workerBaseStats = new Float64Array(PROP_IDX.TOTAL_PROPS);
    this.workerMergedBuff = new Float64Array(PROP_IDX.TOTAL_PROPS);
    const maxSetIdx = this.getMaxSetIdx(precomputed.discsBySlot);
    this.otherSetCounts = new Int8Array(maxSetIdx + 1);
    this.otherSetUsed = new Int16Array(6);
    this.otherSetTwoPieceByIdx = new Array(maxSetIdx + 1).fill(null);

    // Worker 初始化阶段预合并目标套装（同一 worker 复用）
    const { mergedStats, targetSetTwoPiece, mergedBuff, targetSetFourPieceBuff } = precomputed;
    for (let i = 0; i < PROP_IDX.TOTAL_PROPS; i++) {
      this.workerBaseStats[i] = mergedStats[i] + (targetSetTwoPiece?.[i] ?? 0);
      this.workerMergedBuff[i] = mergedBuff[i] + (targetSetFourPieceBuff?.[i] ?? 0);
    }

    // 预构建 otherSetTwoPieceByIdx：只在 worker 初始化做一次字符串查找
    const { otherSetTwoPiece } = precomputed;
    if (otherSetTwoPiece) {
      for (const [setId, twoPiece] of Object.entries(otherSetTwoPiece)) {
        const setIdx = this.findSetIdxById(precomputed.discsBySlot, setId);
        if (setIdx !== null) this.otherSetTwoPieceByIdx[setIdx] = twoPiece;
      }
    }

    this.fixed = this.computeFixedMultipliers();
  }

  /**
   * 初始化一次枚举搜索的状态（用于增量枚举/回滚）
   * - accumulator 置为 workerBaseStats（角色/武器/静态项 + 目标2pc）
   * - 清空非目标套装计数（只清已用过的 setIdx）
   */
  beginIncrementalSearch(): void {
    this.accumulator.set(this.workerBaseStats);
    for (let i = 0; i < this.otherSetUsedCount; i++) {
      this.otherSetCounts[this.otherSetUsed[i]] = 0;
    }
    this.otherSetUsedCount = 0;
  }

  /**
   * 增量加入一张盘（用于增量枚举/回滚）
   * - accumulator += disc.stats
   * - 非目标套装计数 + 2pc crossing(1->2) 时立即应用 2pc
   *
   * 返回：是否触发了 2pc（方便上层调试；逻辑不依赖返回值）
   */
  pushDiscIncremental(disc: DiscData): boolean {
    const dStats = disc.stats;
    for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) this.accumulator[j] += dStats[j];

    if (disc.isTargetSet) return false;

    const setIdx = disc.setIdx;
    const prev = this.otherSetCounts[setIdx];
    const next = (prev + 1) as any;
    this.otherSetCounts[setIdx] = next;
    if (prev === 0) this.otherSetUsed[this.otherSetUsedCount++] = setIdx;

    if (prev === 1) {
      const twoPiece = this.otherSetTwoPieceByIdx[setIdx];
      if (twoPiece) {
        for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) this.accumulator[j] += twoPiece[j];
      }
      return true;
    }
    return false;
  }

  /**
   * 回滚移除一张盘（用于增量枚举/回滚）
   * - accumulator -= disc.stats
   * - 非目标套装计数 crossing(2->1) 时立即撤销 2pc
   *
   * 返回：是否撤销了 2pc（方便上层调试；逻辑不依赖返回值）
   */
  popDiscIncremental(disc: DiscData): boolean {
    // 先处理 2pc 撤销（必须在减 stats 之前还是之后都可以；保持一致即可）
    let reverted2pc = false;
    if (!disc.isTargetSet) {
      const setIdx = disc.setIdx;
      const prev = this.otherSetCounts[setIdx];
      const next = (prev - 1) as any;
      this.otherSetCounts[setIdx] = next;

      if (prev === 2) {
        const twoPiece = this.otherSetTwoPieceByIdx[setIdx];
        if (twoPiece) {
          for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) this.accumulator[j] -= twoPiece[j];
        }
        reverted2pc = true;
      }
    }

    const dStats = disc.stats;
    for (let j = 0; j < PROP_IDX.TOTAL_PROPS; j++) this.accumulator[j] -= dStats[j];
    return reverted2pc;
  }

  private getMaxSetIdx(discsBySlot: DiscData[][]): number {
    let max = 0;
    for (let s = 0; s < discsBySlot.length; s++) {
      const slot = discsBySlot[s];
      for (let i = 0; i < slot.length; i++) {
        const v = slot[i].setIdx;
        if (v > max) max = v;
      }
    }
    return max;
  }

  private findSetIdxById(discsBySlot: DiscData[][], setId: string): number | null {
    for (let s = 0; s < discsBySlot.length; s++) {
      const slot = discsBySlot[s];
      for (let i = 0; i < slot.length; i++) {
        const d = slot[i];
        if (d.setId === setId) return d.setIdx;
      }
    }
    return null;
  }

  private findSetIdByIdx(discsBySlot: DiscData[][], setIdx: number): string | null {
    for (let s = 0; s < discsBySlot.length; s++) {
      const slot = discsBySlot[s];
      for (let i = 0; i < slot.length; i++) {
        const d = slot[i];
        if (d.setIdx === setIdx) return d.setId;
      }
    }
    return null;
  }

  private computeFixedMultipliers(): FastEvaluator['fixed'] {
    const { fixedMultipliers, skillsParams, enemyStats } = this.precomputed;

    const distanceMult = fixedMultipliers.distanceMult ?? 1.0;
    const dmgTakenMult = 1 + (fixedMultipliers.baseDmgTakenInc ?? 0);
    const stunVulnMult = 1 + (fixedMultipliers.stunVulnerability ?? 0);
    const levelMult = 1 + ((fixedMultipliers.attackerLevel ?? 1) - 1) / 59;

    // 异常暴击：来自“普通 Buff 合并结果”（workerMergedBuff），一次优化过程固定，Worker 初始化时预计算一次
    const anomCritRate = Math.min(1, Math.max(0, this.workerMergedBuff[PROP_IDX.ANOM_CRIT_] ?? 0));
    const anomCritDmg = this.workerMergedBuff[PROP_IDX.ANOM_CRIT_DMG_] ?? 0;
    const anomalyCritMult = 1 + anomCritRate * anomCritDmg;
    const anomalyDmgMult = 1 + (fixedMultipliers.baseAnomalyDmgBonus ?? 0);

    const elementKey = this.getElementString(skillsParams[0]?.element ?? 200);
    const elementRes = enemyStats?.element_resistances?.[elementKey] ?? 0;

    // 对齐 damage-calculator.ts:
    // resMult = 1 - enemyRes + resRed + elResRed + resIgn + elResIgn （clamp 0..2）
    const resRedCommon =
      (this.workerMergedBuff[PROP_IDX.ENEMY_RES_RED_] ?? 0);
    const resIgnCommon =
      this.workerMergedBuff[PROP_IDX.RES_IGN_] ?? 0;

    const elementResRedIdxMap: Record<string, number> = {
      physical: PROP_IDX.PHYSICAL_RES_RED_,
      fire: PROP_IDX.FIRE_RES_RED_,
      ice: PROP_IDX.ICE_RES_RED_,
      electric: PROP_IDX.ELECTRIC_RES_RED_,
      ether: PROP_IDX.ETHER_RES_RED_,
    };
    const elementResIgnIdxMap: Record<string, number> = {
      physical: PROP_IDX.PHYSICAL_RES_IGN_,
      fire: PROP_IDX.FIRE_RES_IGN_,
      ice: PROP_IDX.ICE_RES_IGN_,
      electric: PROP_IDX.ELECTRIC_RES_IGN_,
      ether: PROP_IDX.ETHER_RES_IGN_,
    };

    const elResRed = this.workerMergedBuff[elementResRedIdxMap[elementKey] ?? PROP_IDX.PHYSICAL_RES_RED_] ?? 0;
    const elResIgn = this.workerMergedBuff[elementResIgnIdxMap[elementKey] ?? PROP_IDX.PHYSICAL_RES_IGN_] ?? 0;

    const totalResRedUsed = resRedCommon + elResRed + resIgnCommon + elResIgn;
    const resMult = Math.max(0, Math.min(2, 1 - elementRes + totalResRedUsed));

    // 对齐 damage-calculator.ts: effective_def = max(0, baseDef*(1-defRed-defIgn)*(1-penRate)-penValue)
    const defRed = this.workerMergedBuff[PROP_IDX.DEF_RED_] ?? 0;
    const defIgn = this.workerMergedBuff[PROP_IDX.DEF_IGN_] ?? 0;
    const penRate = this.workerMergedBuff[PROP_IDX.PEN_] ?? 0;
    const penValue = this.workerMergedBuff[PROP_IDX.PEN] ?? 0;
    let baseDef = enemyStats?.defense ?? 0;
    if (enemyStats?.has_corruption_shield) baseDef *= 2;
    const effectiveDef = Math.max(0, baseDef * (1 - defRed - defIgn) * (1 - penRate) - penValue);
    const attackerLevel = fixedMultipliers.attackerLevel ?? 60;
    const levelCoef = 794;
    const defMult = levelCoef / (effectiveDef + levelCoef);

    return {
      resMult,
      dmgTakenMult,
      stunVulnMult,
      distanceMult,
      levelMult,
      anomalyCritMult,
      anomalyDmgMult,
      resElementKey: elementKey,
      enemyResUsed: elementRes,
      totalResRedUsed,
    };
  }

  // 调试：返回 Worker 初始化阶段预计算的固定乘区
  getFixedMultipliersSnapshot(): FastEvaluator['fixed'] {
    return { ...this.fixed };
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
    snapshots?: {
      snapshot1: { atk: number; hp: number; def: number; impact: number };
      snapshot2: { atk: number; hp: number; def: number; impact: number };
      snapshot3: { atk: number; hp: number; def: number; impact: number };
    };
  } | null {
    const {
      conversionBuffs,
      targetSetId,
      fixedMultipliers,
      skillsParams,
    } = this.precomputed;

    // ========================================================================
    // 1. 检查目标盘数>=4（不满足则跳过此组合）
    // ========================================================================
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
    // 2-4. 累加器/套装2pc 已在增量枚举阶段维护完毕：
    // - beginIncrementalSearch(): accumulator = workerBaseStats
    // - pushDiscIncremental/popDiscIncremental(): 叠加/回滚盘属性，并在 1->2 / 2->1 时即时应用/撤销非目标2pc
    //
    // 因此这里不再做 workerBaseStats 重置、不再重复累加 6 张盘、不再重复应用非目标2pc。
    // ========================================================================

    // ========================================================================
    // 2.5 初始化评估缓冲区（accumulator + workerMergedBuff）
    // - evalBuffer 用于本次叶子评估的所有计算，不污染 accumulator
    // - 这样 popDiscIncremental 不需要撤销 buff，保持增量枚举的正确性
    // ========================================================================
    for (let i = 0; i < PROP_IDX.TOTAL_PROPS; i++) {
      this.evalBuffer[i] = this.accumulator[i] + this.workerMergedBuff[i];
    }

    // ========================================================================
    // 5. 生成快照1（局外 → 局内基础属性；不含 Buff）
    // - 生成面板 ATK/HP/DEF/IMPACT（基于 accumulator 而非 evalBuffer，因为快照1不含 buff）
    // ========================================================================
    const snapshot1Atk =
      this.accumulator[PROP_IDX.ATK_BASE] *
        (1 + this.accumulator[PROP_IDX.ATK_]) +
      this.accumulator[PROP_IDX.ATK];
    const snapshot1Hp =
      this.accumulator[PROP_IDX.HP_BASE] *
        (1 + this.accumulator[PROP_IDX.HP_]) +
      this.accumulator[PROP_IDX.HP];
    const snapshot1Def =
      this.accumulator[PROP_IDX.DEF_BASE] *
        (1 + this.accumulator[PROP_IDX.DEF_]) +
      this.accumulator[PROP_IDX.DEF];
    const snapshot1Impact =
      this.accumulator[PROP_IDX.IMPACT] *
        (1 + this.accumulator[PROP_IDX.IMPACT_]);

    // 注意：快照1/2/3 的面板值计算使用局外三元组（*_BASE/*_/*）作为输入，
    // 但不要把 accumulator 的三元组维度“污染”成面板值，否则 finalStats 会同时出现
    // ATK(面板) + ATK_(局外百分比) 的混合口径，导致展示和语义都混乱。
    //
    // 因此这里不再把 snapshot1 写回 accumulator，后续快照全部使用局部变量推进。

    // ========================================================================
    // 6. 生成快照2（应用普通 Buff：mergedBuff + 目标4件套 Buff）
    // - 严格按文档口径：snapshot2 = snapshot1 × (1 + buffPercent) + buffFlat
    // - 这里只对四大基础属性做快照应用；其它属性已在 evalBuffer 初始化时合并
    // ========================================================================

    // 对 ATK/HP/DEF/IMPACT 应用快照2公式
    const snapshot2Atk =
      snapshot1Atk * (1 + this.workerMergedBuff[PROP_IDX.ATK_]) +
      this.workerMergedBuff[PROP_IDX.ATK];
    const snapshot2Hp =
      snapshot1Hp * (1 + this.workerMergedBuff[PROP_IDX.HP_]) +
      this.workerMergedBuff[PROP_IDX.HP];
    const snapshot2Def =
      snapshot1Def * (1 + this.workerMergedBuff[PROP_IDX.DEF_]) +
      this.workerMergedBuff[PROP_IDX.DEF];
    const snapshot2Impact =
      snapshot1Impact * (1 + this.workerMergedBuff[PROP_IDX.IMPACT_]) +
      this.workerMergedBuff[PROP_IDX.IMPACT];

    // 不写回 accumulator（保持局外三元组维度不变），后续用局部变量推进快照3。

    // ========================================================================
    // 7. 应用转换类 Buff（快照3；源取快照2，不链式）
    // ========================================================================

    // ========================================================================
    // 7. 应用转换类 Buff（快照3；源取快照2，不链式）
    // ========================================================================
    let snapshot3Atk = snapshot2Atk;
    let snapshot3Hp = snapshot2Hp;
    let snapshot3Def = snapshot2Def;
    let snapshot3Impact = snapshot2Impact;

    for (const conv of conversionBuffs) {
      const sourceValue = this.getFinalProp(
        conv.fromPropIdx,
        snapshot2Atk,
        snapshot2Hp,
        snapshot2Def,
        snapshot2Impact
      );
      const effectiveValue = Math.max(0, sourceValue - conv.threshold);

      let convertedValue = effectiveValue * conv.ratio;
      if (conv.maxValue !== null) {
        convertedValue = Math.min(convertedValue, conv.maxValue);
      }

      // 转换产物写入快照3面板四维或 evalBuffer 的其它属性槽位
      if (conv.toPropIdx === PROP_IDX.ATK) snapshot3Atk += convertedValue;
      else if (conv.toPropIdx === PROP_IDX.HP) snapshot3Hp += convertedValue;
      else if (conv.toPropIdx === PROP_IDX.DEF) snapshot3Def += convertedValue;
      else if (conv.toPropIdx === PROP_IDX.IMPACT) snapshot3Impact += convertedValue;
      else this.evalBuffer[conv.toPropIdx] += convertedValue;
    }

    // ========================================================================
    // 8. 重新计算快照3（转换后最终战斗属性）中可能受影响的基础属性
    // ========================================================================
    // 直伤基数取快照3面板 ATK
    const finalAtkAfterConv = snapshot3Atk;

    // ========================================================================
    // 8.5 命破角色：强制覆盖贯穿值（在所有转换类 Buff 应用完之后）
    // - 游戏内存在“到处显示虚假贯穿值”的问题，这里采用强制口径：
    //   SHEER_FORCE = snapshot3Hp * 0.1 + snapshot3Atk * 0.3
    // - 同时清空穿透/穿透率（避免继续影响防御区与展示）
    // ========================================================================
    // 说明：isPenetration 在 buildFastRequest 时由 agent.isPenetrationAgent() 决定，属于角色机制。
    const isMingpo = skillsParams?.[0]?.isMingpo === true || skillsParams?.[0]?.isPenetration === true;
    if (isMingpo) {
      this.evalBuffer[PROP_IDX.PEN] = 0;
      this.evalBuffer[PROP_IDX.PEN_] = 0;
      // 注意：口径对齐“转换类 Buff”：源取快照2（不链式），产物写入快照3
      this.evalBuffer[PROP_IDX.SHEER_FORCE] += snapshot2Hp * 0.1 + snapshot2Atk * 0.3;
    }

    // ========================================================================
    // 8. 计算防御区
    // ========================================================================
    const { defenseParams } = fixedMultipliers;
    // 对齐 damage-calculator.ts:
    // effective_def = max(0, baseDef * (1 - defRed - defIgn) * (1 - penRate) - penValue)
    // 注意：evalBuffer 已包含 accumulator + workerMergedBuff
    const defRed = defenseParams.baseDefRed + this.evalBuffer[PROP_IDX.DEF_RED_];
    const defIgn = defenseParams.baseDefIgn + this.evalBuffer[PROP_IDX.DEF_IGN_];
    const penRate = this.evalBuffer[PROP_IDX.PEN_];
    const penValue = this.evalBuffer[PROP_IDX.PEN];

    const baseDef = defenseParams.enemyDef * (this.precomputed.enemyStats?.has_corruption_shield ? 2 : 1);
    const effectiveDef = Math.max(0, baseDef * (1 - defRed - defIgn) * (1 - penRate) - penValue);
    const defMult = defenseParams.levelBase / (effectiveDef + defenseParams.levelBase);
    // (debug logs removed)

    // ========================================================================
    // 9. 计算公共乘区
    // ========================================================================
    // 将"最终战斗面板（参与乘区计算）"写回 evalBuffer 的最终值维度，方便后续计算：
    // - ATK/HP/DEF/IMPACT：写入快照3面板值
    // - 注意：不修改 accumulator，保持增量枚举的正确性
    this.evalBuffer[PROP_IDX.ATK] = snapshot3Atk;
    this.evalBuffer[PROP_IDX.HP] = snapshot3Hp;
    this.evalBuffer[PROP_IDX.DEF] = snapshot3Def;
    this.evalBuffer[PROP_IDX.IMPACT] = snapshot3Impact;

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
        const sheerForce = this.evalBuffer[PROP_IDX.SHEER_FORCE];
        const pierceBonus = 1 + this.evalBuffer[PROP_IDX.SHEER_DMG_];
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
    let variableLieshuangDamage = 0;
    if (this.precomputed.specialAnomalyConfig?.element === 'lieshuang') {
      variableLieshuangDamage = this.calculateLieshuangDamage(
        finalAtkAfterConv,
        defMult,
        critRate,
        critDmg
      );
      totalVariableDamage += variableLieshuangDamage;
    }

    // ========================================================================
    // 12. 返回结果
    // ========================================================================
    const firstSkillElement = skillsParams[0].element;

    const anomalyProfMult = this.evalBuffer[PROP_IDX.ANOM_PROF] / 100;

    // 异常积蓄区（复用 calculateAnomalyDamage 内同口径逻辑，避免 IIFE 分配/闭包）
    const anomalyMastery = this.evalBuffer[PROP_IDX.ANOM_MAS];
    const masteryZone = anomalyMastery > 0 ? anomalyMastery / 100 : 1;

    let efficiencyZone = 1 + this.evalBuffer[PROP_IDX.ANOM_BUILDUP_];
    const elementBuildupIdx = ELEMENT_TO_BUILDUP_IDX[firstSkillElement];
    if (elementBuildupIdx !== undefined) efficiencyZone += this.evalBuffer[elementBuildupIdx];

    const resZoneCommon = this.evalBuffer[PROP_IDX.ANOM_BUILDUP_RES_];
    const elementResIdx =
      firstSkillElement === 200 ? PROP_IDX.PHYSICAL_ANOM_BUILDUP_RES_
      : firstSkillElement === 201 ? PROP_IDX.FIRE_ANOM_BUILDUP_RES_
      : firstSkillElement === 202 ? PROP_IDX.ICE_ANOM_BUILDUP_RES_
      : firstSkillElement === 203 ? PROP_IDX.ELECTRIC_ANOM_BUILDUP_RES_
      : firstSkillElement === 205 ? PROP_IDX.ETHER_ANOM_BUILDUP_RES_
      : PROP_IDX.PHYSICAL_ANOM_BUILDUP_RES_;
    const resZoneElement = this.evalBuffer[elementResIdx];
    const resistanceZone = 1 - resZoneCommon - resZoneElement;

    const accumulationZone = Math.max(0, masteryZone * efficiencyZone * resistanceZone * this.fixed.distanceMult);

    const critZone = 1 + Math.min(1, Math.max(0, this.evalBuffer[PROP_IDX.CRIT_])) * this.evalBuffer[PROP_IDX.CRIT_DMG_];

    const elementDmgIdx0 = ELEMENT_TO_DMG_IDX[firstSkillElement];
    const dmgBonus = 1 + this.evalBuffer[PROP_IDX.DMG_] + (elementDmgIdx0 !== undefined ? this.evalBuffer[elementDmgIdx0] : 0);

    const multipliers: number[] = [
      finalAtkAfterConv,
      0,
      anomalyProfMult,
      accumulationZone,
      critZone,
      dmgBonus,
    ];

    return {
      damage: totalVariableDamage,
      multipliers,
      snapshots: {
        snapshot1: { atk: snapshot1Atk, hp: snapshot1Hp, def: snapshot1Def, impact: snapshot1Impact },
        snapshot2: { atk: snapshot2Atk, hp: snapshot2Hp, def: snapshot2Def, impact: snapshot2Impact },
        snapshot3: { atk: snapshot3Atk, hp: snapshot3Hp, def: snapshot3Def, impact: snapshot3Impact },
      },
    };
  }

  /**
   * 计算公共乘区
   */
  private calculateCommonMultipliers(): {
    critRate: number;
    critDmg: number;
  } {
    const critRate = Math.min(1, Math.max(0, this.evalBuffer[PROP_IDX.CRIT_]));
    const critDmg = this.evalBuffer[PROP_IDX.CRIT_DMG_];
    return { critRate, critDmg };
  }

  /**
   * 计算增伤区
   */
  private calculateDamageBonus(skillParams: any): number {
    let dmgBonus = 1 + this.evalBuffer[PROP_IDX.DMG_];
    const elementDmgIdx = ELEMENT_TO_DMG_IDX[skillParams.element];
    if (elementDmgIdx !== undefined) {
      dmgBonus += this.evalBuffer[elementDmgIdx];
    }
    for (const tag of skillParams.tags) {
      const tagDmgIdx = this.getSkillTagDmgIdx(tag);
      if (tagDmgIdx !== undefined) {
        dmgBonus += this.evalBuffer[tagDmgIdx];
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
    const {
      levelMult,
      anomalyCritMult,
      anomalyDmgMult,
    } = this.fixed;

    const anomalyProf = this.evalBuffer[PROP_IDX.ANOM_PROF];
    const anomalyProfMult = Math.max(0, Math.min(10, anomalyProf / 100));

    // 异常积蓄区（与 DamageCalculator.calculateAnomalyBuildupZone 对齐）
    // buildupZone = (ANOM_MAS/100) * (1 + ANOM_BUILDUP_ + elementBuildup) * (1 - ANOM_BUILDUP_RES_ - elementRes) * distanceMult
    const anomalyMastery = this.evalBuffer[PROP_IDX.ANOM_MAS];
    const masteryZone = anomalyMastery > 0 ? anomalyMastery / 100 : 1;

    let efficiencyZone = 1 + this.evalBuffer[PROP_IDX.ANOM_BUILDUP_];
    const elementBuildupIdx = ELEMENT_TO_BUILDUP_IDX[element];
    if (elementBuildupIdx !== undefined) {
      efficiencyZone += this.evalBuffer[elementBuildupIdx];
    }

    const resZoneCommon = this.evalBuffer[PROP_IDX.ANOM_BUILDUP_RES_];
    // 元素积蓄抗性 idx 规则：buildUpIdx(31~) 对应 buildUpResIdx(84~) 在 property-index.ts 已定义
    const elementResIdx =
      element === 200 ? PROP_IDX.PHYSICAL_ANOM_BUILDUP_RES_
      : element === 201 ? PROP_IDX.FIRE_ANOM_BUILDUP_RES_
      : element === 202 ? PROP_IDX.ICE_ANOM_BUILDUP_RES_
      : element === 203 ? PROP_IDX.ELECTRIC_ANOM_BUILDUP_RES_
      : element === 205 ? PROP_IDX.ETHER_ANOM_BUILDUP_RES_
      : PROP_IDX.PHYSICAL_ANOM_BUILDUP_RES_;
    const resZoneElement = this.evalBuffer[elementResIdx];
    const resistanceZone = 1 - resZoneCommon - resZoneElement;

    const buildupZone = Math.max(0, masteryZone * efficiencyZone * resistanceZone * this.fixed.distanceMult);

    const buildupPerSkill = anomalyBuildup * buildupZone;
    const elementStr = this.getElementString(element);
    const threshold =
      this.precomputed.enemyStats?.anomaly_thresholds?.[elementStr]
      ?? STANDARD_BUILDUP_THRESHOLD;
    const procsPerSkill = Math.max(0, Math.min(1, buildupPerSkill / threshold));

    if (procsPerSkill <= 0) {
      return { anomaly: 0, disorder: 0 };
    }

    const anomalyBaseDamage = finalAtk * this.precomputed.anomalyTotalRatioAtT;

    const anomalyDamage =
      anomalyBaseDamage *
      dmgBonus *
      anomalyProfMult *
      anomalyDmgMult *
      anomalyCritMult *
      levelMult *
      defMult;

    const anomalyEarning = anomalyDamage * procsPerSkill;

    const disorderDamage =
      finalAtk *
      this.precomputed.disorderTotalRatioAtT *
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

    let dmgBonus = 1 + this.evalBuffer[PROP_IDX.DMG_];
    const iceDmgIdx = ELEMENT_TO_DMG_IDX[202];
    if (iceDmgIdx !== undefined) {
      dmgBonus += this.evalBuffer[iceDmgIdx];
    }

    const critZone = 1 + critRate * critDmg;

    let buildupMult = 1 + this.evalBuffer[PROP_IDX.ANOM_BUILDUP_];
    const iceBuildupIdx = ELEMENT_TO_BUILDUP_IDX[202];
    if (iceBuildupIdx !== undefined) {
      buildupMult += this.evalBuffer[iceBuildupIdx];
    }

    const anomalyBuildup = skillsParams[0]?.anomalyBuildup ?? 0;
    const threshold =
      this.precomputed.enemyStats?.anomaly_thresholds?.ice
      ?? 600;
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

  private getElementString(element: number): string {
    switch (element) {
      case 200: return 'physical';
      case 201: return 'fire';
      case 202: return 'ice';
      case 203: return 'electric';
      case 205: return 'ether';
      default: return 'physical';
    }
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
   * 获取评估缓冲区的快照（用于最终输出 finalStats）
   * evalBuffer 包含完整的计算结果（accumulator + buff + conversion）
   */
  getEvalBufferSnapshot(): Float64Array {
    return new Float64Array(this.evalBuffer);
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
    // 重新设置状态：因为此方法可能在优化循环结束后被调用，
    // 此时 accumulator 可能包含其他组合的状态
    this.beginIncrementalSearch();
    for (const disc of discs) {
      this.pushDiscIncremental(disc);
    }

    const result = this.calculateDamageWithMultipliers(discs);
    if (!result) {
      throw new Error('Failed to calculate damage for createFullResult');
    }

    const { damage: variableDamage, multipliers, snapshots } = result;
    const { skillsParams, fixedMultipliers, targetSetId } = this.precomputed;

    if (!skillsParams || skillsParams.length === 0) {
      throw new Error('skillsParams is empty');
    }

    // 通用乘区（Worker 初始化阶段已预计算）
    const { distanceMult } = this.fixed;
    const { defenseParams } = fixedMultipliers;
    const universalMult = this.fixed.resMult * this.fixed.dmgTakenMult * this.fixed.stunVulnMult;

    const totalDamage = variableDamage * universalMult;

    const finalAtkAfterConv = multipliers[0];
    const anomalyProfMult = multipliers[2];
    const accumulationZone = multipliers[3];
    const critZone = multipliers[4];
    const dmgBonus = multipliers[5];

    const defRed = defenseParams.baseDefRed + this.evalBuffer[PROP_IDX.DEF_RED_];
    const defIgn = defenseParams.baseDefIgn + this.evalBuffer[PROP_IDX.DEF_IGN_];
    const penRate = this.evalBuffer[PROP_IDX.PEN_];
    const penValue = this.evalBuffer[PROP_IDX.PEN];

    const baseDef = defenseParams.enemyDef * (this.precomputed.enemyStats?.has_corruption_shield ? 2 : 1);
    const effectiveDef = Math.max(0, baseDef * (1 - defRed - defIgn) * (1 - penRate) - penValue);
    const defMult = defenseParams.levelBase / (effectiveDef + defenseParams.levelBase);

    const skillParams = skillsParams[0];

    // 直伤 breakdown
    let directDamage: number;
    if (skillParams.isPenetration) {
      const sheerForce = this.evalBuffer[PROP_IDX.SHEER_FORCE];
      const pierceBonus = 1 + this.evalBuffer[PROP_IDX.SHEER_DMG_];
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

    // 烈霜伤害 breakdown（星见雅等特殊机制）
    let variableLieshuangDamage = 0;
    if (this.precomputed.specialAnomalyConfig?.element === 'lieshuang') {
      // 需要从 evalBuffer 获取 critRate 和 critDmg，因为 calculateLieshuangDamage 内部会计算 critZone
      const critRate = Math.min(1, Math.max(0, this.evalBuffer[PROP_IDX.CRIT_]));
      const critDmg = this.evalBuffer[PROP_IDX.CRIT_DMG_];
      variableLieshuangDamage = this.calculateLieshuangDamage(
        finalAtkAfterConv,
        defMult,
        critRate,
        critDmg
      );
    }
    const finalLieshuang = variableLieshuangDamage * universalMult;

    // 统计套装信息（新逻辑：目标套装是4件套，非目标套装可能有2件套）
    const twoPieceSets: string[] = [];
    let fourPieceSet: string | null = null;

    // 目标套装是4件套（已在检查中确认>=4）
    if (targetSetId) {
      fourPieceSet = targetSetId;
    }

    // 非目标套装可能有2件套
    // 注意：otherSetCounts 是每个组合的复用计数数组；这里只能用 “本组合命中过的 setIdx 列表” 来枚举
    // （否则会扫完整 counts）。
    for (let i = 0; i < this.otherSetUsedCount; i++) {
      const setIdx = this.otherSetUsed[i];
      if (this.otherSetCounts[setIdx] < 2) continue;
      // 这里仅用于展示 setId，所以做一次受控的 O(6) 查找即可（非热路径：TopN 才调用）
      const setId = this.findSetIdByIdx(this.precomputed.discsBySlot, setIdx);
      if (setId) twoPieceSets.push(setId);
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
      finalStats: this.getEvalBufferSnapshot(),
      snapshots,
      breakdown: {
        direct: directDamage,
        anomaly: finalAnomaly,
        disorder: finalDisorder,
        lieshuang: finalLieshuang > 0 ? finalLieshuang : undefined,
      },
      multipliers: {
        baseDirectDamage: finalAtkAfterConv * skillParams.ratio,
        baseAnomalyDamage: finalAtkAfterConv * (this.precomputed.anomalyTotalRatioAtT ?? 0),
        baseDisorderDamage: finalAtkAfterConv * (this.precomputed.disorderTotalRatioAtT ?? 0),
        baseLieshuangDamage:
          this.precomputed.specialAnomalyConfig?.element === 'lieshuang'
            ? finalAtkAfterConv * (this.precomputed.specialAnomalyConfig.ratio ?? 0)
            : undefined,
        anomalyProfMult,
        accumulationZone,
        critZone,
        dmgBonus,
      },
      defMult,
      setInfo: {
        twoPieceSets,
        fourPieceSet,
      },
    };
  }
}
