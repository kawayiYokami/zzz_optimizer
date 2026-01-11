/**
 * 伤害计算服务
 *
 * 基于绝区零伤害机制导论实现的伤害计算系统
 * 参考文档：assets/inventory_data/docs/DAMAGE_GUIDE.MD
 */

import { CombatStats } from '../model/combat-stats';
import type { EnemyStats } from '../model/enemy';
import type { SkillDamageParams } from './battle.service';

/**
 * 倍率集合（用于多属性伤害倍率）
 */
export class RatioSet {
  atk_ratio: number = 0; // 攻击力倍率
  def_ratio: number = 0; // 防御力倍率
  hp_ratio: number = 0; // 生命值倍率
  pen_ratio: number = 0; // 贯穿力倍率
  anom_prof_ratio: number = 0; // 异常精通倍率
  anom_atk_ratio: number = 0; // 异常攻击倍率
}

/**
 * 乘区集合（用于缓存所有伤害乘区）
 */
export class ZoneCollection {
  combat_stats: CombatStats | null = null; // 战斗属性
  ratios: RatioSet = new RatioSet(); // 倍率集合

  // 伤害乘区
  atk_zone: number = 0; // 攻击力区
  dmg_bonus: number = 1.0; // 增伤区
  crit_zone: number = 1.0; // 暴击区
  def_mult: number = 1.0; // 防御区
  res_mult: number = 1.0; // 抗性区
  dmg_taken_mult: number = 1.0; // 承伤区
  stun_vuln_mult: number = 1.0; // 失衡易伤区
  distance_mult: number = 1.0; // 距离衰减区
  penetration_dmg_bonus: number = 0; // 贯穿增伤

  // 伤害结果
  direct_damage_no_crit: number = 0; // 未暴击直伤
  direct_damage_crit: number = 0; // 暴击直伤
  direct_damage_expected: number = 0; // 期望直伤

  // 属性分解伤害（用于显示）
  atk_damage: number = 0; // 攻击力贡献
  def_damage: number = 0; // 防御力贡献
  hp_damage: number = 0; // 生命值贡献
  pen_damage: number = 0; // 贯穿力贡献

  // 总期望伤害
  total_damage_expected: number = 0;
}

/**
 * 直接伤害结果
 */
export interface DirectDamageResult {
  damage_no_crit: number; // 未暴击伤害
  damage_crit: number; // 暴击伤害
  damage_expected: number; // 期望伤害
  base_damage: number; // 基础伤害
  skill_ratio: number; // 技能倍率
  element: string; // 元素类型
  atk_zone: number; // 攻击力/贯穿力
  dmg_bonus: number; // 增伤区
  crit_rate: number; // 暴击率
  crit_dmg: number; // 暴击伤害
  crit_zone: number; // 暴击期望区
  def_mult: number; // 防御区
  res_mult: number; // 抗性区
  dmg_taken_mult: number; // 承伤区
  stun_vuln_mult: number; // 失衡易伤区
  distance_mult: number; // 距离衰减区
  is_penetration: boolean; // 是否贯穿伤害
  penetration_dmg_bonus: number; // 贯穿增伤
}

/**
 * 异常伤害结果
 */
export interface AnomalyDamageResult {
  anomaly_damage_no_crit: number; // 未暴击异常伤害
  anomaly_damage_crit: number; // 暴击异常伤害
  anomaly_damage_expected: number; // 期望异常伤害
  anomaly_ratio: number; // 异常倍率
  anomaly_buildup: number; // 异常积蓄值
  anomaly_threshold: number; // 异常阈值
  trigger_expectation: number; // 触发期望
  atk_zone: number; // 攻击力
  dmg_bonus: number; // 增伤区
  anomaly_prof_mult: number; // 异常精通区
  anomaly_dmg_mult: number; // 异常增伤区
  anomaly_crit_mult: number; // 异常暴击区
  level_mult: number; // 等级区
  def_mult: number; // 防御区
  res_mult: number; // 抗性区
  dmg_taken_mult: number; // 承伤区
  stun_vuln_mult: number; // 失衡易伤区
}

/**
 * 伤害计算服务
 */
export class DamageCalculatorService {
  /**
   * 从技能参数创建倍率集合
   */
  static createRatioSetFromSkill(skill: SkillDamageParams): RatioSet {
    const ratios = new RatioSet();
    ratios.atk_ratio = skill.damage_ratio || 0;
    return ratios;
  }

  /**
   * 计算基础伤害区（向后兼容）
   *
   * 公式：基础伤害区 = Σ(伤害倍率 × 对应属性)
   *
   * @param attacker 攻击方属性
   * @param skill 技能参数
   * @returns 基础伤害
   */
  static calculateBaseDamage(attacker: CombatStats, skill: SkillDamageParams): number {
    if (skill.is_penetration) {
      // 贯穿伤害基于贯穿力
      return skill.damage_ratio * attacker.getFinalPenetration();
    } else {
      // 常规伤害基于攻击力
      return skill.damage_ratio * attacker.getFinalAtk();
    }
  }

  /**
   * 计算增伤区
   *
   * 公式：增伤区 = 1 + Σ增伤
   * 有效范围：[0, 6]
   *
   * @param attacker 攻击方属性
   * @returns 增伤乘区
   */
  static calculateDmgBonusMultiplier(attacker: CombatStats): number {
    const multiplier = 1.0 + attacker.dmg_bonus + attacker.element_dmg_bonus;
    return Math.max(0.0, Math.min(6.0, multiplier));
  }

  /**
   * 计算暴击区
   *
   * 公式：
   * - 暴击时：1 + 暴击伤害
   * - 未暴击时：1
   *
   * 有效范围：[1, 6]
   *
   * @param attacker 攻击方属性
   * @param isCrit 是否暴击
   * @returns 暴击乘区
   */
  static calculateCritMultiplier(attacker: CombatStats, isCrit: boolean = false): number {
    if (isCrit) {
      const multiplier = 1.0 + attacker.crit_dmg;
      return Math.max(1.0, Math.min(6.0, multiplier));
    }
    return 1.0;
  }

  /**
   * 计算暴击期望
   *
   * 公式：暴击期望 = 1 + 暴击率 × 暴击伤害
   *
   * @param attacker 攻击方属性
   * @returns 暴击期望乘区
   */
  static calculateCritExpectation(attacker: CombatStats): number {
    const crit_rate = Math.max(0.0, Math.min(1.0, attacker.crit_rate));
    return 1.0 + crit_rate * attacker.crit_dmg;
  }

  /**
   * 计算防御区
   *
   * 公式：防御区 = 攻击方等级基数 / (受击方有效防御 + 攻击方等级基数)
   *
   * @param attacker 攻击方属性
   * @param enemy 敌人属性
   * @returns 防御乘区
   */
  static calculateDefenseMultiplier(attacker: CombatStats, enemy: EnemyStats): number {
    const level_coef = enemy.level * 10 + 100;
    const effective_def = enemy.defense * (1 - attacker.penetration_rate);
    return level_coef / (effective_def + level_coef);
  }

  /**
   * 计算抗性区
   *
   * 公式：抗性区 = 1 - 受击方抗性 + 受击方抗性降低 + 攻击方无视抗性
   * 有效范围：[0, 2]
   *
   * @param attacker 攻击方属性
   * @param enemy 敌人属性
   * @param element 元素类型（"ice", "fire", "electric", "physical", "ether"）
   * @returns 抗性乘区
   */
  static calculateResistanceMultiplier(
    attacker: CombatStats,
    enemy: EnemyStats,
    element: string
  ): number {
    const resistance = enemy.getResistance(element);
    const multiplier = 1.0 - resistance;
    return Math.max(0.0, Math.min(2.0, multiplier));
  }

  /**
   * 计算减易伤区
   *
   * 公式：减易伤区 = 1 + 受击方易伤 - 受击方减伤
   * 有效范围：[0.2, 2]
   *
   * @param enemy 敌人属性
   * @returns 减易伤乘区
   */
  static calculateDmgTakenMultiplier(enemy: EnemyStats): number {
    // 敌人当前不提供易伤/减伤数据，返回1.0
    return 1.0;
  }

  /**
   * 计算失衡易伤区
   *
   * 公式：
   * - 失衡时：1 + 失衡易伤倍率
   * - 未失衡时：1
   *
   * 有效范围：失衡时[0.2, 5]，未失衡时[1, 3]
   *
   * @param enemy 敌人属性
   * @returns 失衡易伤乘区
   */
  static calculateStunVulnerabilityMultiplier(enemy: EnemyStats): number {
    if (enemy.is_stunned) {
      const multiplier = 1.0 + enemy.stun_vulnerability;
      return Math.max(0.2, Math.min(5.0, multiplier));
    }
    return 1.0;
  }

  /**
   * 计算贯穿增伤区
   *
   * 公式：贯穿增伤区 = 1 + 贯穿增伤
   * 有效范围：[0.2, 9]
   *
   * @param attacker 攻击方属性
   * @returns 贯穿增伤乘区
   */
  static calculatePenetrationDmgMultiplier(attacker: CombatStats): number {
    const multiplier = 1.0 + attacker.penetration_dmg_bonus;
    return Math.max(0.2, Math.min(9.0, multiplier));
  }

  /**
   * 计算距离衰减区
   *
   * @param skill 技能参数
   * @param decay_type 衰减类型（"default"或"grace"）
   * @returns 距离衰减乘区
   */
  static calculateDistanceDecayMultiplier(
    skill: SkillDamageParams,
    decay_type: string = 'default'
  ): number {
    const distance = (skill as any).distance || 0;
    if (distance <= 15.0) {
      return 1.0;
    }

    if (decay_type === 'grace') {
      // 格莉丝型：超过15m时伤害衰减30%
      return 0.7;
    } else {
      // 默认型：超过15m时伤害衰减25%，每继续远离5m继续衰减25%
      const extra_distance = distance - 15.0;
      const decay_count = 1 + Math.floor(extra_distance / 5.0);
      return Math.pow(0.75, decay_count);
    }
  }

  /**
   * 计算异常积蓄值
   *
   * 公式：异常积蓄值 = 基础异常积蓄值 × 异常掌控区 × 异常积蓄效率区 × 异常积蓄抗性区 × 距离衰减区
   *
   * @param attacker 攻击方属性
   * @param enemy 敌人属性
   * @param skill 技能参数
   * @param decay_type 距离衰减类型
   * @returns 异常积蓄值
   */
  static calculateAnomalyBuildup(
    attacker: CombatStats,
    enemy: EnemyStats,
    skill: SkillDamageParams,
    decay_type: string = 'default'
  ): number {
    // 1. 基础异常积蓄值
    const base_buildup = skill.anomaly_buildup;

    // 2. 异常掌控区
    let anomaly_mastery_mult = Math.floor(attacker.base_anomaly_mastery) / 100.0;
    anomaly_mastery_mult = Math.max(0.0, Math.min(3.0, anomaly_mastery_mult));

    // 3. 异常积蓄效率区
    const buildup_eff_mult = 1.0 + attacker.anomaly_buildup_efficiency;

    // 4. 异常积蓄抗性区
    const anomaly_res_mult = 1.0 - enemy.getAnomalyThreshold(skill.element) / 1000.0;

    // 5. 距离衰减区
    const distance_mult = this.calculateDistanceDecayMultiplier(skill, decay_type);

    // 计算最终异常积蓄值
    const final_buildup =
      base_buildup * anomaly_mastery_mult * buildup_eff_mult * anomaly_res_mult * distance_mult;

    return final_buildup;
  }

  /**
   * 计算直接伤害（整合常规伤害和贯穿伤害）
   *
   * 返回一个 DirectDamageResult 对象，包含所有计算细节。
   *
   * @param attacker 攻击方属性
   * @param enemy 敌人属性
   * @param skill 技能参数
   * @param isCrit 是否暴击
   * @param decay_type 距离衰减类型
   * @returns DirectDamageResult 对象
   */
  static calculateDirectDamage(
    attacker: CombatStats,
    enemy: EnemyStats,
    skill: SkillDamageParams,
    isCrit: boolean = false,
    decay_type: string = 'default'
  ): DirectDamageResult {
    // 1. 基础伤害区
    const base_dmg = this.calculateBaseDamage(attacker, skill);

    // 2. 增伤区
    const dmg_bonus = this.calculateDmgBonusMultiplier(attacker);

    // 3. 暴击区
    const crit_rate = Math.max(0.0, Math.min(1.0, attacker.crit_rate));
    const crit_dmg = attacker.crit_dmg;
    const crit_zone = this.calculateCritExpectation(attacker);

    // 4. 防御区
    const def_mult = this.calculateDefenseMultiplier(attacker, enemy);

    // 5. 抗性区
    const res_mult = this.calculateResistanceMultiplier(attacker, enemy, skill.element);

    // 6. 减易伤区
    const dmg_taken_mult = this.calculateDmgTakenMultiplier(enemy);

    // 7. 失衡易伤区
    const stun_vuln_mult = this.calculateStunVulnerabilityMultiplier(enemy);

    // 8. 距离衰减区
    const distance_mult = this.calculateDistanceDecayMultiplier(skill, decay_type);

    let final_dmg_no_crit: number;
    let final_dmg_crit: number;
    let final_dmg_expected: number;
    let pen_dmg_mult = 0;

    // 9. 贯穿伤害特有
    if (skill.is_penetration) {
      pen_dmg_mult = this.calculatePenetrationDmgMultiplier(attacker);
      // 贯穿伤害：基础伤害 × 增伤区 × 暴击区 × 贯穿增伤区 × 抗性区 × 减易伤区 × 失衡易伤区 × 距离衰减区
      final_dmg_no_crit =
        base_dmg *
        dmg_bonus *
        1.0 * // 非暴击
        pen_dmg_mult *
        res_mult *
        dmg_taken_mult *
        stun_vuln_mult *
        distance_mult;

      final_dmg_crit =
        base_dmg *
        dmg_bonus *
        (1.0 + crit_dmg) *
        pen_dmg_mult *
        res_mult *
        dmg_taken_mult *
        stun_vuln_mult *
        distance_mult;

      final_dmg_expected =
        base_dmg *
        dmg_bonus *
        crit_zone *
        pen_dmg_mult *
        res_mult *
        dmg_taken_mult *
        stun_vuln_mult *
        distance_mult;
    } else {
      // 常规伤害：基础伤害 × 增伤区 × 暴击区 × 防御区 × 抗性区 × 减易伤区 × 失衡易伤区 × 距离衰减区
      final_dmg_no_crit =
        base_dmg *
        dmg_bonus *
        1.0 * // 非暴击
        def_mult *
        res_mult *
        dmg_taken_mult *
        stun_vuln_mult *
        distance_mult;

      final_dmg_crit =
        base_dmg *
        dmg_bonus *
        (1.0 + crit_dmg) *
        def_mult *
        res_mult *
        dmg_taken_mult *
        stun_vuln_mult *
        distance_mult;

      final_dmg_expected =
        base_dmg *
        dmg_bonus *
        crit_zone *
        def_mult *
        res_mult *
        dmg_taken_mult *
        stun_vuln_mult *
        distance_mult;
    }

    // 向上取整
    final_dmg_no_crit = Math.ceil(final_dmg_no_crit);
    final_dmg_crit = Math.ceil(final_dmg_crit);
    final_dmg_expected = Math.ceil(final_dmg_expected);

    // 构建结果对象
    const result: DirectDamageResult = {
      damage_no_crit: final_dmg_no_crit,
      damage_crit: final_dmg_crit,
      damage_expected: final_dmg_expected,
      base_damage: base_dmg,
      skill_ratio: skill.damage_ratio,
      element: skill.element,
      atk_zone: skill.is_penetration ? attacker.getFinalPenetration() : attacker.getFinalAtk(),
      dmg_bonus: dmg_bonus,
      crit_rate: crit_rate,
      crit_dmg: crit_dmg,
      crit_zone: crit_zone,
      def_mult: def_mult,
      res_mult: res_mult,
      dmg_taken_mult: dmg_taken_mult,
      stun_vuln_mult: stun_vuln_mult,
      distance_mult: distance_mult,
      is_penetration: skill.is_penetration,
      penetration_dmg_bonus: pen_dmg_mult,
    };

    return result;
  }

  /**
   * 计算异常伤害
   *
   * 公式：异常伤害 = 基础伤害区 × 增伤区 × 异常精通区 × 防御区 × 抗性区 ×
   *                减易伤区 × 失衡易伤区 × 伤害等级区 × 异常增伤区 × 异常暴击区
   *
   * @param attacker 攻击方属性
   * @param enemy 敌人属性
   * @param anomaly_ratio 异常伤害倍率
   * @param anomaly_buildup 异常积蓄值
   * @param anomaly_type 异常类型
   * @param is_anomaly_crit 是否异常暴击
   * @returns AnomalyDamageResult 对象
   */
  static calculateAnomalyDamage(
    attacker: CombatStats,
    enemy: EnemyStats,
    anomaly_ratio: number,
    anomaly_buildup: number = 0.0,
    anomaly_type: string = 'ice',
    is_anomaly_crit: boolean = false
  ): AnomalyDamageResult {
    // 1. 攻击力
    const atk_zone = attacker.getFinalAtk();

    // 2. 增伤区
    const dmg_bonus = this.calculateDmgBonusMultiplier(attacker);

    // 3. 异常精通区
    let anomaly_prof_mult = attacker.base_anomaly_proficiency / 100.0;
    anomaly_prof_mult = Math.max(0.0, Math.min(10.0, anomaly_prof_mult));

    // 4. 异常增伤区
    const anomaly_dmg_bonus = attacker.anomaly_dmg_bonus;
    let anomaly_dmg_mult = 1.0 + anomaly_dmg_bonus;
    anomaly_dmg_mult = Math.max(0.0, Math.min(3.0, anomaly_dmg_mult));

    // 5. 异常暴击区
    const anomaly_crit_rate = 0.0; // TODO: 从attacker获取
    const anomaly_crit_dmg = attacker.anomaly_crit_dmg;
    let anomaly_crit_mult = 1.0;
    if (is_anomaly_crit) {
      anomaly_crit_mult = 1.0 + anomaly_crit_dmg;
      anomaly_crit_mult = Math.max(1.0, Math.min(3.0, anomaly_crit_mult));
    }

    // 6. 等级区
    let level_mult = 1.0 + (1.0 / 59.0) * (attacker.level - 1);
    level_mult = Math.floor(level_mult * 10000) / 10000;

    // 7. 积蓄区（触发期望）
    const anomaly_threshold = enemy.getAnomalyThreshold(anomaly_type);
    const accumulate_zone =
      anomaly_threshold > 0 ? Math.min(1.0, anomaly_buildup / anomaly_threshold) : 0;
    const trigger_expect = accumulate_zone;

    // 8. 通用乘区
    const def_mult = this.calculateDefenseMultiplier(attacker, enemy);
    const res_mult = this.calculateResistanceMultiplier(attacker, enemy, anomaly_type);
    const dmg_taken_mult = this.calculateDmgTakenMultiplier(enemy);
    const stun_vuln_mult = this.calculateStunVulnerabilityMultiplier(enemy);

    // 9. 计算基础异常伤害（不含暴击）
    const base_anomaly_damage =
      atk_zone *
      anomaly_ratio *
      dmg_bonus *
      anomaly_prof_mult *
      anomaly_dmg_mult *
      level_mult *
      def_mult *
      res_mult *
      dmg_taken_mult *
      stun_vuln_mult;

    // 10. 非暴击异常伤害
    const anomaly_dmg_no_crit = base_anomaly_damage;

    // 11. 暴击异常伤害
    const anomaly_dmg_crit = base_anomaly_damage * anomaly_crit_mult;

    // 12. 期望异常伤害（考虑触发期望）
    const anomaly_dmg_expected = base_anomaly_damage * trigger_expect;

    // 向上取整
    const result: AnomalyDamageResult = {
      anomaly_damage_no_crit: Math.ceil(anomaly_dmg_no_crit),
      anomaly_damage_crit: Math.ceil(anomaly_dmg_crit),
      anomaly_damage_expected: Math.ceil(anomaly_dmg_expected),
      anomaly_ratio: anomaly_ratio,
      anomaly_buildup: anomaly_buildup,
      anomaly_threshold: anomaly_threshold,
      trigger_expectation: trigger_expect,
      atk_zone: atk_zone,
      dmg_bonus: dmg_bonus,
      anomaly_prof_mult: anomaly_prof_mult,
      anomaly_dmg_mult: anomaly_dmg_mult,
      anomaly_crit_mult: anomaly_crit_mult,
      level_mult: level_mult,
      def_mult: def_mult,
      res_mult: res_mult,
      dmg_taken_mult: dmg_taken_mult,
      stun_vuln_mult: stun_vuln_mult,
    };

    return result;
  }

  /**
   * 格式化直接伤害结果
   *
   * @param result 直接伤害计算结果
   * @returns 格式化字符串
   */
  static formatDirectDamageResult(result: DirectDamageResult): string {
    const lines: string[] = [];

    lines.push('=== 伤害计算结果 ===');
    lines.push(`未暴击伤害: ${result.damage_no_crit.toFixed(0)}`);
    lines.push(`暴击伤害: ${result.damage_crit.toFixed(0)}`);
    lines.push(`期望伤害: ${result.damage_expected.toFixed(0)}`);
    lines.push('');
    lines.push('=== 乘区详情 ===');
    lines.push(`基础伤害区: ${result.base_damage.toFixed(2)}`);
    lines.push(`增伤区: ${result.dmg_bonus.toFixed(2)}`);
    lines.push(`暴击区: ${result.crit_zone.toFixed(2)}`);
    lines.push(`防御区: ${result.def_mult.toFixed(2)}`);
    lines.push(`抗性区: ${result.res_mult.toFixed(2)}`);
    lines.push(`承伤区: ${result.dmg_taken_mult.toFixed(2)}`);
    lines.push(`失衡易伤区: ${result.stun_vuln_mult.toFixed(2)}`);
    lines.push(`距离衰减区: ${result.distance_mult.toFixed(2)}`);
    if (result.is_penetration) {
      lines.push(`贯穿增伤: ${result.penetration_dmg_bonus.toFixed(2)}`);
    }

    return lines.join('\n');
  }

  /**
   * 格式化异常伤害结果
   *
   * @param result 异常伤害计算结果
   * @returns 格式化字符串
   */
  static formatAnomalyDamageResult(result: AnomalyDamageResult): string {
    const lines: string[] = [];

    lines.push('=== 异常伤害结果 ===');
    lines.push(`未暴击异常伤害: ${result.anomaly_damage_no_crit.toFixed(0)}`);
    lines.push(`暴击异常伤害: ${result.anomaly_damage_crit.toFixed(0)}`);
    lines.push(`期望异常伤害: ${result.anomaly_damage_expected.toFixed(0)}`);
    lines.push(`触发期望: ${(result.trigger_expectation * 100).toFixed(2)}%`);
    lines.push('');
    lines.push('=== 乘区详情 ===');
    lines.push(`攻击力: ${result.atk_zone.toFixed(0)}`);
    lines.push(`异常倍率: ${(result.anomaly_ratio * 100).toFixed(0)}%`);
    lines.push(`增伤区: ${result.dmg_bonus.toFixed(2)}`);
    lines.push(`异常精通区: ${result.anomaly_prof_mult.toFixed(2)}`);
    lines.push(`异常增伤区: ${result.anomaly_dmg_mult.toFixed(2)}`);
    lines.push(`异常暴击区: ${result.anomaly_crit_mult.toFixed(2)}`);
    lines.push(`等级区: ${result.level_mult.toFixed(4)}`);
    lines.push(`防御区: ${result.def_mult.toFixed(2)}`);
    lines.push(`抗性区: ${result.res_mult.toFixed(2)}`);
    lines.push(`承伤区: ${result.dmg_taken_mult.toFixed(2)}`);
    lines.push(`失衡易伤区: ${result.stun_vuln_mult.toFixed(2)}`);

    return lines.join('\n');
  }
}
