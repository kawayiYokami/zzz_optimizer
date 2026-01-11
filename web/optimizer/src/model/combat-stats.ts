/**
 * 局内战斗属性模型
 */

import { PropertyCollection } from './property-collection';
import { PropertyType } from './base';

/**
 * 异常类型
 */
export enum AnomalyType {
  ICE = 'ice', // 冰
  FIRE = 'fire', // 火
  ELECTRIC = 'electric', // 电
  PHYSICAL = 'physical', // 物理
  ETHER = 'ether', // 以太
}

/**
 * 异常效果数据
 */
export class AnomalyEffect {
  anomaly_type: AnomalyType;
  base_ratio: number; // 基础伤害倍率（一次性或每次）
  duration: number = 10.0; // 持续时间（秒）
  tick_interval: number = 0.0; // 触发间隔（0表示一次性）

  constructor(
    anomalyType: AnomalyType,
    baseRatio: number,
    duration: number = 10.0,
    tickInterval: number = 0.0
  ) {
    this.anomaly_type = anomalyType;
    this.base_ratio = baseRatio;
    this.duration = duration;
    this.tick_interval = tickInterval;
  }

  /**
   * 获取总伤害倍率
   *
   * @returns 总伤害倍率
   */
  getTotalRatio(): number {
    if (this.tick_interval === 0) {
      // 一次性伤害
      return this.base_ratio;
    } else {
      // 持续伤害
      const ticks = Math.floor(this.duration / this.tick_interval);
      return this.base_ratio * ticks;
    }
  }
}

// 预定义的异常效果
export const ICE_SHATTER = new AnomalyEffect(
  AnomalyType.ICE,
  5.0, // 500%
  10.0,
  0.0 // 一次性
);

export const SHOCK = new AnomalyEffect(
  AnomalyType.ELECTRIC,
  1.25, // 125%每秒
  10.0,
  1.0
);

export const BURN = new AnomalyEffect(
  AnomalyType.FIRE,
  0.5, // 50%每0.5秒
  10.0,
  0.5
);

export const CORRUPTION = new AnomalyEffect(
  AnomalyType.ETHER,
  0.625, // 62.5%每0.5秒
  10.0,
  0.5
);

export const ASSAULT = new AnomalyEffect(
  AnomalyType.PHYSICAL,
  7.13, // 713%
  0.0,
  0.0 // 一次性
);

export const DISORDER = new AnomalyEffect(
  AnomalyType.PHYSICAL, // 紊乱可以是任意元素触发
  4.5, // 450%
  0.0,
  0.0 // 一次性
);

/**
 * 局内战斗属性
 *
 * 绝区零的特殊机制：
 * - 攻击力、生命值、防御力、冲击力：局外的最终属性会变成局内的基础属性
 *   例如：局外基础100攻击+30%=130，到局内130变成基础攻击，30%buff基于130计算
 * - 其他属性（暴击、穿透、增伤、异常等）：依然是百分比，不会转换
 */
export class CombatStats {
  // 基础属性（局内基础，即局外的最终属性）
  // 注意：只有这四个属性会经历"局外最终→局内基础"的转换
  base_atk: number = 0.0; // 基础攻击力（局内基础 = 局外最终）
  base_hp: number = 0.0; // 基础生命值（局内基础 = 局外最终）
  base_def: number = 0.0; // 基础防御力（局内基础 = 局外最终）
  base_impact: number = 0.0; // 基础冲击力（局内基础 = 局外最终）

  // 其他基础属性（不会转换）
  base_penetration: number = 0.0; // 基础贯穿力
  base_anomaly_mastery: number = 0.0; // 基础异常掌控
  base_anomaly_proficiency: number = 0.0; // 基础异常精通

  // 百分比加成（局内buff，只对四大基础属性有效）
  atk_percent: number = 0.0; // 攻击力加成%
  hp_percent: number = 0.0; // 生命值加成%
  def_percent: number = 0.0; // 防御力加成%
  impact_percent: number = 0.0; // 冲击力加成%

  // 固定值加成（局内buff）
  atk_flat: number = 0.0; // 攻击力固定值
  hp_flat: number = 0.0; // 生命值固定值
  def_flat: number = 0.0; // 防御力固定值
  anomaly_mastery_flat: number = 0.0; // 异常掌控固定值
  anomaly_proficiency_flat: number = 0.0; // 异常精通固定值

  // 暴击属性（百分比，局内局外都是百分比）
  crit_rate: number = 0.05; // 暴击率（默认5%）
  crit_dmg: number = 0.5; // 暴击伤害（默认50%）

  // 穿透属性（百分比和固定值）
  penetration_rate: number = 0.0; // 穿透率
  penetration_value: number = 0.0; // 穿透值

  // 增伤属性（百分比）
  dmg_bonus: number = 0.0; // 伤害加成
  element_dmg_bonus: number = 0.0; // 元素伤害加成
  penetration_dmg_bonus: number = 0.0; // 贯穿伤害加成

  // 异常属性（百分比）
  anomaly_buildup_efficiency: number = 0.0; // 异常积蓄效率
  anomaly_dmg_bonus: number = 0.0; // 异常伤害加成
  anomaly_crit_rate: number = 0.0; // 异常暴击率
  anomaly_crit_dmg: number = 0.0; // 异常暴击伤害

  // 异常倍率（用于异常伤害计算）
  anomaly_atk_ratio_mult: number = 0.0; // 异常攻击倍率（吃攻击力，如星见雅1500%）
  // 注意：异常精通倍率直接使用 AnomalyEffect.getTotalRatio()，不需要单独字段

  // 失衡属性（百分比）
  stun_value_bonus: number = 0.0; // 失衡值提升

  // 能量属性
  energy_regen: number = 0.0; // 能量自动回复

  // 等级
  level: number = 60; // 角色等级

  /**
   * 从属性集列表生成 CombatStats
   *
   * 处理流程：
   * 1. 合并所有 PropertyCollection
   * 2. 计算局外最终面板（四大基础属性）
   * 3. 转换为局内基础面板
   * 4. 填充 CombatStats 对象
   *
   * @param collections 属性集列表（角色+装备+BUFF）
   * @param level 等级
   * @returns CombatStats 对象
   */
  static fromPropertyCollections(
    collections: (PropertyCollection | null | undefined)[],
    level: number = 60
  ): CombatStats {
    // 1. 合并所有属性集
    const merged = PropertyCollection.mergeAll(collections);

    // 2. 计算局外最终面板（四大基础属性）
    // 攻击力：局外最终 = base × (1 + percent) + flat
    const out_base_atk = merged.getOutOfCombat(PropertyType.ATK_BASE, 0);
    const out_atk_percent = merged.getOutOfCombat(PropertyType.ATK_, 0) / 100.0;
    const out_atk_flat = merged.getOutOfCombat(PropertyType.ATK, 0);
    const out_final_atk = out_base_atk * (1 + out_atk_percent) + out_atk_flat;

    // 生命值
    const out_base_hp = merged.getOutOfCombat(PropertyType.HP_BASE, 0);
    const out_hp_percent = merged.getOutOfCombat(PropertyType.HP_, 0) / 100.0;
    const out_hp_flat = merged.getOutOfCombat(PropertyType.HP, 0);
    const out_final_hp = out_base_hp * (1 + out_hp_percent) + out_hp_flat;

    // 防御力
    const out_base_def = merged.getOutOfCombat(PropertyType.DEF_BASE, 0);
    const out_def_percent = merged.getOutOfCombat(PropertyType.DEF_, 0) / 100.0;
    const out_def_flat = merged.getOutOfCombat(PropertyType.DEF, 0);
    const out_final_def = out_base_def * (1 + out_def_percent) + out_def_flat;

    // 冲击力
    const out_base_impact = merged.getOutOfCombat(PropertyType.IMPACT, 0);
    const out_impact_percent = merged.getOutOfCombat(PropertyType.IMPACT_, 0) / 100.0;
    const out_final_impact = out_base_impact * (1 + out_impact_percent);

    // 3. 创建 CombatStats 对象
    const combat = new CombatStats();

    // 四大基础属性：局外最终 → 局内基础
    combat.base_atk = out_final_atk;
    combat.base_hp = out_final_hp;
    combat.base_def = out_final_def;
    combat.base_impact = out_final_impact;

    // 其他基础属性（不转换）
    combat.base_penetration = merged.getOutOfCombat(PropertyType.PEN, 0);
    combat.base_anomaly_mastery = merged.getOutOfCombat(PropertyType.ANOM_MAS, 0);
    combat.base_anomaly_proficiency = merged.getOutOfCombat(PropertyType.ANOM_PROF, 0);

    // 局内 buff（百分比和固定值）
    combat.atk_percent = merged.getInCombat(PropertyType.ATK_, 0) / 100.0;
    combat.hp_percent = merged.getInCombat(PropertyType.HP_, 0) / 100.0;
    combat.def_percent = merged.getInCombat(PropertyType.DEF_, 0) / 100.0;
    combat.impact_percent = merged.getInCombat(PropertyType.IMPACT_, 0) / 100.0;

    combat.atk_flat = merged.getInCombat(PropertyType.ATK, 0);
    combat.hp_flat = merged.getInCombat(PropertyType.HP, 0);
    combat.def_flat = merged.getInCombat(PropertyType.DEF, 0);
    combat.anomaly_mastery_flat = merged.getInCombat(PropertyType.ANOM_MAS, 0);
    combat.anomaly_proficiency_flat = merged.getInCombat(PropertyType.ANOM_PROF, 0);

    // 暴击属性（局外+局内累加）
    const out_crit_rate = merged.getOutOfCombat(PropertyType.CRIT_, 0.05);
    const in_crit_rate = merged.getInCombat(PropertyType.CRIT_, 0);
    combat.crit_rate = out_crit_rate + in_crit_rate;

    const out_crit_dmg = merged.getOutOfCombat(PropertyType.CRIT_DMG_, 0.5);
    const in_crit_dmg = merged.getInCombat(PropertyType.CRIT_DMG_, 0);
    combat.crit_dmg = out_crit_dmg + in_crit_dmg;

    // 穿透属性
    const out_pen_rate = merged.getOutOfCombat(PropertyType.PEN_, 0) / 100.0;
    const in_pen_rate = merged.getInCombat(PropertyType.PEN_, 0) / 100.0;
    combat.penetration_rate = out_pen_rate + in_pen_rate;

    combat.penetration_value =
      merged.getOutOfCombat(PropertyType.PEN, 0) + merged.getInCombat(PropertyType.PEN, 0);

    // 增伤属性（局外+局内累加，需要转换为小数）
    const out_dmg = merged.getOutOfCombat(PropertyType.DMG_, 0) / 100.0;
    const in_dmg = merged.getInCombat(PropertyType.DMG_, 0) / 100.0;
    combat.dmg_bonus = out_dmg + in_dmg;

    // 元素伤害加成（需要根据元素类型获取，这里暂时留空，由调用方设置）
    combat.element_dmg_bonus = 0.0;

    // 异常属性
    const out_anom_buildup = merged.getOutOfCombat(PropertyType.ANOM_BUILDUP_, 0) / 100.0;
    const in_anom_buildup = merged.getInCombat(PropertyType.ANOM_BUILDUP_, 0) / 100.0;
    combat.anomaly_buildup_efficiency = out_anom_buildup + in_anom_buildup;

    const out_anom_dmg = merged.getOutOfCombat(PropertyType.ANOM_MV_MULT_, 0) / 100.0;
    const in_anom_dmg = merged.getInCombat(PropertyType.ANOM_MV_MULT_, 0) / 100.0;
    combat.anomaly_dmg_bonus = out_anom_dmg + in_anom_dmg;

    const out_anom_crit_rate = merged.getOutOfCombat(PropertyType.ANOM_CRIT_, 0);
    const in_anom_crit_rate = merged.getInCombat(PropertyType.ANOM_CRIT_, 0);
    combat.anomaly_crit_rate = out_anom_crit_rate + in_anom_crit_rate;

    const out_anom_crit_dmg = merged.getOutOfCombat(PropertyType.ANOM_CRIT_DMG_, 0);
    const in_anom_crit_dmg = merged.getInCombat(PropertyType.ANOM_CRIT_DMG_, 0);
    combat.anomaly_crit_dmg = out_anom_crit_dmg + in_anom_crit_dmg;

    // 失衡属性
    const out_stun = merged.getOutOfCombat(PropertyType.DAZE_INC_, 0) / 100.0;
    const in_stun = merged.getInCombat(PropertyType.DAZE_INC_, 0) / 100.0;
    combat.stun_value_bonus = out_stun + in_stun;

    // 能量回复
    combat.energy_regen =
      merged.getOutOfCombat(PropertyType.ENER_REGEN, 0) + merged.getInCombat(PropertyType.ENER_REGEN, 0);

    // 等级
    combat.level = level;

    return combat;
  }

  /**
   * 获取最终攻击力
   *
   * 公式：最终属性 = 初始属性 × (1 + 百分比加成) + 固定值加成
   * 初始属性 = 基础属性（局内基础，即局外最终属性）
   *
   * 注意：攻击力是四大基础属性之一，会经历"局外最终→局内基础"的转换
   *
   * @returns 最终攻击力
   */
  getFinalAtk(): number {
    return this.base_atk * (1 + this.atk_percent) + this.atk_flat;
  }

  /**
   * 获取最终生命值
   *
   * 注意：生命值是四大基础属性之一，会经历"局外最终→局内基础"的转换
   *
   * @returns 最终生命值
   */
  getFinalHp(): number {
    return this.base_hp * (1 + this.hp_percent) + this.hp_flat;
  }

  /**
   * 获取最终防御力
   *
   * 注意：防御力是四大基础属性之一，会经历"局外最终→局内基础"的转换
   *
   * @returns 最终防御力
   */
  getFinalDef(): number {
    return this.base_def * (1 + this.def_percent) + this.def_flat;
  }

  /**
   * 获取最终冲击力
   *
   * 注意：冲击力是四大基础属性之一，会经历"局外最终→局内基础"的转换
   *
   * @returns 最终冲击力
   */
  getFinalImpact(): number {
    return this.base_impact * (1 + this.impact_percent);
  }

  /**
   * 获取最终贯穿力（仪玄专用）
   *
   * 仪玄贯穿力 = 攻击力 × 0.3 + 生命值上限 × 0.1
   * 注意：转化比例每个命破代理人单独设置
   *
   * @returns 最终贯穿力
   */
  getFinalPenetration(): number {
    return this.getFinalAtk() * 0.3 + this.getFinalHp() * 0.1;
  }

  /**
   * 格式化输出战斗属性（局内基础面板）
   *
   * @param indent 缩进空格数
   * @returns 格式化字符串
   */
  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    // 收集所有非零属性
    const stats: [string, number, boolean][] = [];

    // 四大基础属性（局外最终 = 局内基础）
    if (this.base_atk > 0) {
      stats.push(['基础攻击力', this.base_atk, false]);
    }
    if (this.base_hp > 0) {
      stats.push(['基础生命值', this.base_hp, false]);
    }
    if (this.base_def > 0) {
      stats.push(['基础防御力', this.base_def, false]);
    }
    if (this.base_impact > 0) {
      stats.push(['基础冲击力', this.base_impact, false]);
    }

    // 其他基础属性
    if (this.base_penetration > 0) {
      stats.push(['穿透值', this.base_penetration, false]);
    }
    if (this.base_anomaly_mastery > 0) {
      stats.push(['异常掌控', this.base_anomaly_mastery, false]);
    }
    if (this.base_anomaly_proficiency > 0) {
      stats.push(['异常精通', this.base_anomaly_proficiency, false]);
    }

    // 暴击属性
    if (this.crit_rate > 0) {
      stats.push(['暴击率', this.crit_rate, true]);
    }
    if (this.crit_dmg > 0) {
      stats.push(['暴击伤害', this.crit_dmg, true]);
    }

    // 穿透属性
    if (this.penetration_rate > 0) {
      stats.push(['穿透率', this.penetration_rate, true]);
    }
    if (this.penetration_value > 0) {
      stats.push(['穿透值', this.penetration_value, false]);
    }

    // 增伤属性
    if (this.dmg_bonus > 0) {
      stats.push(['伤害加成', this.dmg_bonus, true]);
    }
    if (this.element_dmg_bonus > 0) {
      stats.push(['元素伤害加成', this.element_dmg_bonus, true]);
    }

    // 异常属性
    if (this.anomaly_buildup_efficiency > 0) {
      stats.push(['异常积蓄效率', this.anomaly_buildup_efficiency, true]);
    }
    if (this.anomaly_dmg_bonus > 0) {
      stats.push(['异常伤害加成', this.anomaly_dmg_bonus, true]);
    }
    if (this.anomaly_crit_rate > 0) {
      stats.push(['异常暴击率', this.anomaly_crit_rate, true]);
    }
    if (this.anomaly_crit_dmg > 0) {
      stats.push(['异常暴击伤害', this.anomaly_crit_dmg, true]);
    }

    // 能量属性
    if (this.energy_regen > 0) {
      stats.push(['能量自动回复', this.energy_regen, false]);
    }

    // 输出
    if (stats.length > 0) {
      lines.push(`${prefix}局内基础面板 (${stats.length}个属性):`);
      for (const [name, value, is_percent] of stats) {
        if (is_percent) {
          lines.push(`  ${prefix}${name}: ${(value * 100).toFixed(2)}%`);
        } else {
          if (Math.abs(value) >= 10) {
            lines.push(`  ${prefix}${name}: ${value.toFixed(1)}`);
          } else {
            lines.push(`  ${prefix}${name}: ${value.toFixed(3)}`);
          }
        }
      }
    }

    return lines.join('\n');
  }
}
