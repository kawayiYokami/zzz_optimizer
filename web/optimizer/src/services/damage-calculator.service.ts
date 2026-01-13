/**
 * 伤害计算服务
 *
 * 基于绝区零伤害机制导论实现的伤害计算系统
 * 参考文档：assets/inventory_data/docs/DAMAGE_GUIDE.MD
 */

import type { EnemyStats } from '../model/enemy';
import type { SkillDamageParams } from './battle.service';
import { RatioSet, SkillType } from '../model/ratio-set';
import { ZoneCollection } from '../model/zone-collection';
import { PropertyCollection } from '../model/property-collection';
import { PropertyType, ElementType } from '../model/base';

/**
 * 异常持续伤害倍率（每tick）
 */
const ANOMALY_DOT_RATIOS: Record<string, { ratio: number; interval: number }> = {
  fire: { ratio: 0.5, interval: 0.5 },      // 灼烧：50%/0.5秒
  electric: { ratio: 1.25, interval: 1 },   // 感电：125%/秒
  ether: { ratio: 0.625, interval: 0.5 },   // 侵蚀：62.5%/0.5秒
  ice: { ratio: 5.0, interval: 0 },         // 碎冰：500%（一次性）
  physical: { ratio: 7.13, interval: 0 },   // 强击：713%（一次性）
};

/**
 * 异常默认持续时间（秒）
 */
const ANOMALY_DEFAULT_DURATION: Record<string, number> = {
  fire: 10,      // 灼烧
  electric: 10,  // 感电
  ether: 10,     // 侵蚀
  ice: 10,       // 霜寒
  physical: 10,  // 畏缩
};

/**
 * 简化伤害结果
 */
export interface DamageResult {
  damage_no_crit: number;
  damage_crit: number;
  damage_expected: number;
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
   * 计算基础伤害区
   * 公式：基础伤害区 = Σ(属性 × 倍率)
   */
  static calculateBaseDamageZone(zones: ZoneCollection, ratios: RatioSet): number {
    const atk = zones.getFinal(PropertyType.ATK_BASE, 0);
    const def = zones.getFinal(PropertyType.DEF_BASE, 0);
    const hp = zones.getFinal(PropertyType.HP_BASE, 0);
    const pen = zones.getFinal(PropertyType.SHEER_FORCE, 0);
    const anomProf = zones.getFinal(PropertyType.ANOM_PROF, 0);
    
    return atk * ratios.atk_ratio
         + def * ratios.def_ratio
         + hp * ratios.hp_ratio
         + pen * ratios.pen_ratio
         + anomProf * ratios.anom_prof_ratio
         + atk * ratios.anom_atk_ratio;
  }

  /**
   * 根据技能标签计算增伤区
   */
  static calculateDmgBonusFromZones(zones: ZoneCollection, ratios: RatioSet): number {
    let bonus = 1.0;
    
    // 通用增伤
    bonus += zones.getFinal(PropertyType.DMG_, 0);
    bonus += zones.getFinal(PropertyType.COMMON_DMG_, 0);
    
    // 元素增伤
    const elementDmgMap: Record<ElementType, PropertyType> = {
      [ElementType.PHYSICAL]: PropertyType.PHYSICAL_DMG_,
      [ElementType.FIRE]: PropertyType.FIRE_DMG_,
      [ElementType.ICE]: PropertyType.ICE_DMG_,
      [ElementType.ELECTRIC]: PropertyType.ELECTRIC_DMG_,
      [ElementType.ETHER]: PropertyType.ETHER_DMG_,
    };
    bonus += zones.getFinal(elementDmgMap[ratios.element], 0);
    
    // 技能类型增伤
    const skillDmgMap: Record<SkillType, PropertyType> = {
      [SkillType.NORMAL_ATK]: PropertyType.NORMAL_ATK_DMG_,
      [SkillType.SPECIAL_ATK]: PropertyType.SPECIAL_ATK_DMG_,
      [SkillType.ENHANCED_SPECIAL]: PropertyType.ENHANCED_SPECIAL_DMG_,
      [SkillType.CHAIN_ATK]: PropertyType.CHAIN_ATK_DMG_,
      [SkillType.ULTIMATE_ATK]: PropertyType.ULTIMATE_ATK_DMG_,
      [SkillType.DASH_ATK]: PropertyType.DASH_ATK_DMG_,
      [SkillType.DODGE_COUNTER]: PropertyType.DODGE_COUNTER_DMG_,
      [SkillType.ASSIST_ATK]: PropertyType.ASSIST_ATK_DMG_,
      [SkillType.ADDL_ATK]: PropertyType.ADDL_ATK_DMG_,
    };
    for (const skillType of ratios.skill_types) {
      bonus += zones.getFinal(skillDmgMap[skillType], 0);
    }
    
    return Math.max(0, Math.min(6, bonus));
  }

  /**
   * 计算暴击区
   *
   * 公式：暴击区 = 1 + 暴击率 × 暴击伤害
   * 有效范围：[1, 6]
   *
   * @param zones 乘区集合
   * @returns 暴击乘区
   */
  static calculateCritZone(zones: ZoneCollection): number {
    const critRate = Math.max(0.0, Math.min(1.0, zones.getFinal(PropertyType.CRIT_, 0)));
    const critDmg = Math.max(0.0, Math.min(5.0, zones.getFinal(PropertyType.CRIT_DMG_, 0)));
    return 1.0 + critRate * critDmg;
  }

  /**
   * 计算防御区
   *
   * 公式：防御区 = 等级基数 / (敌人有效防御 + 等级基数)
   * 等级基数 = 攻击方等级 × 10 + 100
   * 敌人有效防御 = 基础防御 × (1 - 防御降低% - 无视防御%) × (1 - 穿透率%) - 穿透值
   * 有效范围：(0, 1]
   *
   * @param zones 乘区集合
   * @param enemyStats 敌人属性
   * @param attackerLevel 攻击方等级
   * @returns 防御乘区
   */
  static calculateDefenseMultiplier(zones: ZoneCollection, enemyStats: EnemyStats, attackerLevel: number = 60): number {
    const level_coef = attackerLevel * 10 + 100;

    // 敌人有效防御 = 基础防御 × (1 - 防御降低% - 无视防御%) × (1 - 穿透率%) - 穿透值
    const defRed = zones.getFinal(PropertyType.DEF_RED_, 0);
    const defIgn = zones.getFinal(PropertyType.DEF_IGN_, 0);
    const penRate = zones.getFinal(PropertyType.PEN_, 0);
    const penValue = zones.getFinal(PropertyType.PEN, 0);

    let baseDef = enemyStats.defense;
    if (enemyStats.has_corruption_shield) {
      baseDef *= 2;
    }
    const effective_def = Math.max(0, baseDef * (1 - defRed - defIgn) * (1 - penRate) - penValue);
    return level_coef / (effective_def + level_coef);
  }

  /**
   * 计算抗性区
   *
   * 公式：抗性区 = 1 - 敌人抗性 + 通用抗性削弱 + 元素抗性削弱 + 通用抗性无视 + 元素抗性无视
   * 有效范围：[0, 2]
   *
   * @param zones 乘区集合
   * @param enemyStats 敌人属性
   * @param element 元素类型
   * @returns 抗性乘区
   */
  static calculateResistanceMultiplier(zones: ZoneCollection, enemyStats: EnemyStats, element: string): number {
    const enemyRes = enemyStats.getResistance(element);
    const resRed = zones.getFinal(PropertyType.ENEMY_RES_RED_, 0);
    const resIgn = zones.getFinal(PropertyType.RES_IGN_, 0);

    // 元素特定抗性削弱和无视
    const elementResRedMap: Record<string, PropertyType> = {
      physical: PropertyType.PHYSICAL_RES_RED_,
      fire: PropertyType.FIRE_RES_RED_,
      ice: PropertyType.ICE_RES_RED_,
      electric: PropertyType.ELECTRIC_RES_RED_,
      ether: PropertyType.ETHER_RES_RED_,
    };
    const elementResIgnMap: Record<string, PropertyType> = {
      physical: PropertyType.PHYSICAL_RES_IGN_,
      fire: PropertyType.FIRE_RES_IGN_,
      ice: PropertyType.ICE_RES_IGN_,
      electric: PropertyType.ELECTRIC_RES_IGN_,
      ether: PropertyType.ETHER_RES_IGN_,
    };

    const elResRed = zones.getFinal(elementResRedMap[element.toLowerCase()] || PropertyType.PHYSICAL_RES_RED_, 0);
    const elResIgn = zones.getFinal(elementResIgnMap[element.toLowerCase()] || PropertyType.PHYSICAL_RES_IGN_, 0);

    return Math.max(0.0, Math.min(2.0, 1.0 - enemyRes + resRed + elResRed + resIgn + elResIgn));
  }

  /**
   * 计算异常积蓄区
   *
   * 公式：积蓄效率 = (1 + 积蓄效率%) × (1 - 敌人积蓄抗性 - 敌人元素积蓄抗性)
   * 有效范围：[0, +∞)
   *
   * @param zones 乘区集合
   * @param element 元素类型
   * @returns 异常积蓄乘区
   */
  static calculateAnomalyBuildupZone(zones: ZoneCollection, element: string): number {
    const buildupEfficiency = zones.getFinal(PropertyType.ANOM_BUILDUP_, 0) / 100.0;
    
    // 元素特定积蓄效率
    const elementBuildupMap: Record<string, PropertyType> = {
      physical: PropertyType.PHYSICAL_ANOMALY_BUILDUP_,
      fire: PropertyType.FIRE_ANOMALY_BUILDUP_,
      ice: PropertyType.ICE_ANOMALY_BUILDUP_,
      electric: PropertyType.ELECTRIC_ANOMALY_BUILDUP_,
      ether: PropertyType.ETHER_ANOMALY_BUILDUP_,
    };
    const elBuildupEfficiency = zones.getFinal(elementBuildupMap[element.toLowerCase()] || PropertyType.PHYSICAL_ANOMALY_BUILDUP_, 0) / 100.0;

    const buildupRes = zones.getFinal(PropertyType.ANOM_BUILDUP_RES_, 0);
    
    const elementBuildupResMap: Record<string, PropertyType> = {
      physical: PropertyType.PHYSICAL_ANOM_BUILDUP_RES_,
      fire: PropertyType.FIRE_ANOM_BUILDUP_RES_,
      ice: PropertyType.ICE_ANOM_BUILDUP_RES_,
      electric: PropertyType.ELECTRIC_ANOM_BUILDUP_RES_,
      ether: PropertyType.ETHER_ANOM_BUILDUP_RES_,
    };
    const elBuildupRes = zones.getFinal(elementBuildupResMap[element.toLowerCase()] || PropertyType.PHYSICAL_ANOM_BUILDUP_RES_, 0);

    return Math.max(0, (1.0 + buildupEfficiency + elBuildupEfficiency) * (1.0 - buildupRes - elBuildupRes));
  }

  /**
   * 计算异常精通区
   *
   * 公式：异常精通区 = 异常精通 / 100
   * 有效范围：[0, 10]
   *
   * @param zones 乘区集合
   * @returns 异常精通乘区
   */
  static calculateAnomalyProfMultiplier(zones: ZoneCollection): number {
    const anomProf = zones.getFinal(PropertyType.ANOM_PROF, 0);
    return Math.max(0, Math.min(10, anomProf / 100));
  }

  /**
   * 计算异常增伤区
   *
   * 公式：异常增伤区 = 1 + 异常伤害加成
   * 有效范围：[0, 3]
   *
   * @param zones 乘区集合
   * @returns 异常增伤乘区
   */
  static calculateAnomalyDmgMultiplier(zones: ZoneCollection): number {
    return Math.max(0, Math.min(3, 1 + zones.getFinal(PropertyType.ANOMALY_DMG_, 0)));
  }

  /**
   * 计算异常暴击区
   *
   * 公式：异常暴击区 = 1 + 异常暴击率 × 异常暴击伤害
   * 有效范围：[1, 3]
   *
   * @param zones 乘区集合
   * @returns 异常暴击乘区
   */
  static calculateAnomalyCritMultiplier(zones: ZoneCollection): number {
    const anomCritRate = Math.min(1, Math.max(0, zones.getFinal(PropertyType.ANOM_CRIT_, 0)));
    const anomCritDmg = zones.getFinal(PropertyType.ANOM_CRIT_DMG_, 0);
    return Math.max(1, Math.min(3, 1 + anomCritRate * anomCritDmg));
  }

  /**
   * 计算等级区
   *
   * 公式：等级区 = trunc(1 + 1/59 × (等级 - 1), 4)
   * 有效范围：(0, 2]
   *
   * @param level 攻击方等级
   * @returns 等级乘区
   */
  static calculateLevelMultiplier(level: number = 60): number {
    return Math.trunc((1 + (1 / 59) * (level - 1)) * 10000) / 10000;
  }

  /**
   * 常规伤害计算
   */
  static calculateDirectDamageFromRatios(zones: ZoneCollection, ratios: RatioSet): DamageResult {
    const base = this.calculateBaseDamageZone(zones, ratios);
    const dmgBonus = this.calculateDmgBonusFromZones(zones, ratios);
    const mult = dmgBonus * zones.def_mult * zones.res_mult * zones.dmg_taken_mult * zones.stun_vuln_mult * zones.distance_mult;
    
    const critDmg = zones.getFinal(PropertyType.CRIT_DMG_, 0);
    const critRate = Math.min(1, Math.max(0, zones.getFinal(PropertyType.CRIT_, 0)));
    
    return {
      damage_no_crit: Math.ceil(base * mult),
      damage_crit: Math.ceil(base * mult * (1 + critDmg)),
      damage_expected: Math.ceil(base * mult * (1 + critRate * critDmg)),
    };
  }

  /**
   * 贯穿伤害计算（无防御区，有贯穿增伤区）
   */
  static calculatePenetrationDamage(zones: ZoneCollection, ratios: RatioSet): DamageResult {
    const base = this.calculateBaseDamageZone(zones, ratios);
    const dmgBonus = this.calculateDmgBonusFromZones(zones, ratios);
    const penBonus = 1 + zones.getFinal(PropertyType.SHEER_DMG_, 0);
    const mult = dmgBonus * penBonus * zones.res_mult * zones.dmg_taken_mult * zones.stun_vuln_mult * zones.distance_mult;
    
    const critDmg = zones.getFinal(PropertyType.CRIT_DMG_, 0);
    const critRate = Math.min(1, Math.max(0, zones.getFinal(PropertyType.CRIT_, 0)));
    
    return {
      damage_no_crit: Math.ceil(base * mult),
      damage_crit: Math.ceil(base * mult * (1 + critDmg)),
      damage_expected: Math.ceil(base * mult * (1 + critRate * critDmg)),
    };
  }

  /**
   * 异常伤害计算
   */
  static calculateAnomalyDamageFromZones(zones: ZoneCollection, ratios: RatioSet, level: number = 60): DamageResult {
    const base = this.calculateBaseDamageZone(zones, ratios);
    const dmgBonus = this.calculateDmgBonusFromZones(zones, ratios);
    const anomProf = zones.getFinal(PropertyType.ANOM_PROF, 0) / 100;
    const anomDmgBonus = 1 + zones.getFinal(PropertyType.ANOMALY_DMG_, 0);
    const levelMult = 1 + (1 / 59) * (level - 1);
    const mult = dmgBonus * anomProf * zones.def_mult * zones.res_mult * zones.dmg_taken_mult * zones.stun_vuln_mult * levelMult * anomDmgBonus;
    
    const anomCritDmg = zones.getFinal(PropertyType.ANOM_CRIT_DMG_, 0);
    const anomCritRate = Math.min(1, Math.max(0, zones.getFinal(PropertyType.ANOM_CRIT_, 0)));
    
    return {
      damage_no_crit: Math.ceil(base * mult),
      damage_crit: Math.ceil(base * mult * (1 + anomCritDmg)),
      damage_expected: Math.ceil(base * mult * (1 + anomCritRate * anomCritDmg)),
    };
  }

  /**
   * 更新所有通用乘区
   */
  static updateAllZones(props: PropertyCollection, enemyStats: EnemyStats, element: string): ZoneCollection {
    const zones = new ZoneCollection();
    zones.updateFromPropertyCollection(props);
    
    const dmgBonus = zones.getFinal(PropertyType.DMG_, 0);
    const elementDmgMap: Record<string, PropertyType> = {
      physical: PropertyType.PHYSICAL_DMG_,
      fire: PropertyType.FIRE_DMG_,
      ice: PropertyType.ICE_DMG_,
      electric: PropertyType.ELECTRIC_DMG_,
      ether: PropertyType.ETHER_DMG_,
    };
    const elementProp = elementDmgMap[element.toLowerCase()] || PropertyType.PHYSICAL_DMG_;
    const elementDmgBonus = zones.getFinal(elementProp, 0);
    zones.dmg_bonus = 1.0 + dmgBonus + elementDmgBonus;
    zones.dmg_bonus = Math.max(0.0, Math.min(6.0, zones.dmg_bonus));
    
    // 计算暴击区
    zones.crit_zone = this.calculateCritZone(zones);
    
    // 攻击方等级基数（需要传入攻击方等级，暂用60级）
    const attackerLevel = 60;

    // 计算防御区
    zones.def_mult = this.calculateDefenseMultiplier(zones, enemyStats, attackerLevel);

    // 计算抗性区
    zones.res_mult = this.calculateResistanceMultiplier(zones, enemyStats, element);
    zones.dmg_taken_mult = this.calculateDmgTakenMultiplier(enemyStats);
    zones.stun_vuln_mult = this.calculateStunVulnerabilityMultiplier(enemyStats, zones);

    // 计算异常积蓄区
    zones.accumulate_zone = this.calculateAnomalyBuildupZone(zones, element);

    // 计算异常精通区
    zones.anomaly_prof_mult = this.calculateAnomalyProfMultiplier(zones);

    // 计算异常增伤区
    zones.anomaly_dmg_mult = this.calculateAnomalyDmgMultiplier(zones);

    // 计算异常暴击区
    zones.anomaly_crit_mult = this.calculateAnomalyCritMultiplier(zones);

    // 计算等级区
    zones.level_mult = this.calculateLevelMultiplier(attackerLevel);
    
    return zones;
  }

  /**
   * 从乘区计算最终直伤
   */
  static calculateDirectDamageFromZones(zones: ZoneCollection): ZoneCollection {
    const base = zones.base_damage_zone;
    const mult = zones.dmg_bonus * zones.def_mult * zones.res_mult
               * zones.dmg_taken_mult * zones.stun_vuln_mult * zones.distance_mult;
    
    const critDmg = zones.getFinal(PropertyType.CRIT_DMG_, 0);
    
    zones.direct_damage_no_crit = Math.ceil(base * mult);
    zones.direct_damage_crit = Math.ceil(base * mult * (1 + critDmg));
    zones.direct_damage_expected = Math.ceil(base * mult * zones.crit_zone);
    
    return zones;
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
   * - 失衡时：1 + 敌人失衡易伤倍率 + buff失衡易伤
   * - 未失衡时：1 + buff失衡易伤
   *
   * 有效范围：失衡时[0.2, 5]，未失衡时[1, 3]
   *
   * @param enemy 敌人属性
   * @param zones 乘区集合
   * @returns 失衡易伤乘区
   */
  static calculateStunVulnerabilityMultiplier(enemy: EnemyStats, zones: ZoneCollection): number {
    const buffDazeRed = zones.getFinal(PropertyType.DAZE_RED_, 0);
    const buffEnemyDazeVuln = zones.getFinal(PropertyType.ENEMY_DAZE_VULNERABILITY_, 0);
    
    // 合并两种失衡易伤属性
    const totalDazeVuln = buffDazeRed + buffEnemyDazeVuln;
    
    if (enemy.is_stunned) {
      const multiplier = 1.0 + enemy.stun_vulnerability + totalDazeVuln;
      return Math.max(0.2, Math.min(5.0, multiplier));
    }
    return Math.max(1.0, Math.min(3.0, 1.0 + totalDazeVuln));
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
  /**
   * 紊乱伤害倍率公式
   * @param element 元素类型
   * @param remainingTime 剩余持续时间T
   */
  static getDisorderDamageRatio(element: string, remainingTime: number): number {
    const T = remainingTime;
    switch (element.toLowerCase()) {
      case 'fire':
        return 4.5 + Math.floor(T / 0.5) * 0.5;
      case 'electric':
        return 4.5 + Math.floor(T) * 1.25;
      case 'ether':
      case 'xuanmo':
        return 4.5 + Math.floor(T / 0.5) * 0.625;
      case 'ice':
        return 4.5 + Math.floor(T) * 0.075;
      case 'physical':
        return 4.5 + Math.floor(T) * 0.075;
      case 'lieshuang':
        return 6.0 + Math.floor(T) * 0.75;
      default:
        return 4.5;
    }
  }

  /**
   * 获取异常持续伤害参数
   * @param element 元素类型
   * @returns 单次伤害倍率、间隔、持续时间、总伤害倍率
   */
  static getAnomalyDotParams(element: string): {
    ratio: number;
    interval: number;
    duration: number;
    totalRatio: number;
  } {
    const dot = ANOMALY_DOT_RATIOS[element.toLowerCase()] || { ratio: 0, interval: 0 };
    const duration = ANOMALY_DEFAULT_DURATION[element.toLowerCase()] || 10;
    
    // 计算总伤害倍率
    let totalRatio = 0;
    if (dot.interval > 0) {
      // 持续伤害：总倍率 = 单次倍率 × 触发次数
      const ticks = Math.floor(duration / dot.interval);
      totalRatio = dot.ratio * ticks;
    } else {
      // 一次性伤害
      totalRatio = dot.ratio;
    }
    
    return { ratio: dot.ratio, interval: dot.interval, duration, totalRatio };
  }

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