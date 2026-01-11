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
 * 只持有 PropertyCollection 引用，所有属性访问都从最终面板读取。
 * 提供便捷的访问方法来获取战斗中的最终属性值。
 */
export class CombatStats {
  private properties: PropertyCollection; // 属性集引用
  level: number; // 角色等级

  constructor(properties: PropertyCollection, level: number = 60) {
    this.properties = properties;
    this.level = level;
    // 自动计算最终面板
    this.properties.calculateFinal();
  }

  /**
   * 从属性集列表生成 CombatStats
   *
   * @param collections 属性集列表（角色+装备+BUFF）
   * @param level 等级
   * @returns CombatStats 对象
   */
  static fromPropertyCollections(
    collections: (PropertyCollection | null | undefined)[],
    level: number = 60
  ): CombatStats {
    // 合并所有属性集
    const merged = PropertyCollection.mergeAll(collections);
    return new CombatStats(merged, level);
  }

  /**
   * 获取最终攻击力
   */
  getFinalAtk(): number {
    return this.properties.getFinal(PropertyType.ATK_BASE, 0);
  }

  /**
   * 获取最终生命值
   */
  getFinalHp(): number {
    return this.properties.getFinal(PropertyType.HP_BASE, 0);
  }

  /**
   * 获取最终防御力
   */
  getFinalDef(): number {
    return this.properties.getFinal(PropertyType.DEF_BASE, 0);
  }

  /**
   * 获取最终冲击力
   */
  getFinalImpact(): number {
    return this.properties.getFinal(PropertyType.IMPACT, 0);
  }

  /**
   * 获取最终贯穿力（仪玄专用）
   *
   * 仪玄贯穿力 = 攻击力 × 0.3 + 生命值上限 × 0.1
   * 注意：转化比例每个命破代理人单独设置
   */
  getFinalPenetration(): number {
    return this.getFinalAtk() * 0.3 + this.getFinalHp() * 0.1;
  }

  /**
   * 获取暴击率
   */
  get crit_rate(): number {
    return this.properties.getFinal(PropertyType.CRIT_, 0.05);
  }

  /**
   * 获取暴击伤害
   */
  get crit_dmg(): number {
    return this.properties.getFinal(PropertyType.CRIT_DMG_, 0.5);
  }

  /**
   * 获取穿透率
   */
  get penetration_rate(): number {
    return this.properties.getFinal(PropertyType.PEN_, 0) / 100.0;
  }

  /**
   * 获取穿透值
   */
  get penetration_value(): number {
    return this.properties.getFinal(PropertyType.PEN, 0);
  }

  /**
   * 获取伤害加成
   */
  get dmg_bonus(): number {
    return this.properties.getFinal(PropertyType.DMG_, 0) / 100.0;
  }

  /**
   * 获取元素伤害加成（需要根据元素类型动态获取）
   */
  get element_dmg_bonus(): number {
    // TODO: 根据角色元素类型获取对应的元素伤害加成
    return 0;
  }

  /**
   * 获取贯穿伤害加成
   */
  get penetration_dmg_bonus(): number {
    return this.properties.getFinal(PropertyType.PENETRATION_DMG_, 0) / 100.0;
  }

  /**
   * 获取异常掌控
   */
  get base_anomaly_mastery(): number {
    return this.properties.getFinal(PropertyType.ANOM_MAS, 0);
  }

  /**
   * 获取异常精通
   */
  get base_anomaly_proficiency(): number {
    return this.properties.getFinal(PropertyType.ANOM_PROF, 0);
  }

  /**
   * 获取异常积蓄效率
   */
  get anomaly_buildup_efficiency(): number {
    return this.properties.getFinal(PropertyType.ANOM_BUILDUP_, 0) / 100.0;
  }

  /**
   * 获取异常伤害加成
   */
  get anomaly_dmg_bonus(): number {
    return this.properties.getFinal(PropertyType.ANOM_MV_MULT_, 0) / 100.0;
  }

  /**
   * 获取异常暴击率
   */
  get anomaly_crit_rate(): number {
    return this.properties.getFinal(PropertyType.ANOM_CRIT_, 0);
  }

  /**
   * 获取异常暴击伤害
   */
  get anomaly_crit_dmg(): number {
    return this.properties.getFinal(PropertyType.ANOM_CRIT_DMG_, 0);
  }

  /**
   * 获取失衡值提升
   */
  get stun_value_bonus(): number {
    return this.properties.getFinal(PropertyType.DAZE_INC_, 0) / 100.0;
  }

  /**
   * 获取能量自动回复
   */
  get energy_regen(): number {
    return this.properties.getFinal(PropertyType.ENER_REGEN, 0);
  }

  /**
   * 格式化输出战斗属性（最终面板）
   *
   * @param indent 缩进空格数
   * @returns 格式化字符串
   */
  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    // 收集所有非零属性
    const stats: [string, number, boolean][] = [];

    // 四大基础属性（最终值）
    const finalAtk = this.getFinalAtk();
    const finalHp = this.getFinalHp();
    const finalDef = this.getFinalDef();
    const finalImpact = this.getFinalImpact();

    if (finalAtk > 0) {
      stats.push(['攻击力', finalAtk, false]);
    }
    if (finalHp > 0) {
      stats.push(['生命值', finalHp, false]);
    }
    if (finalDef > 0) {
      stats.push(['防御力', finalDef, false]);
    }
    if (finalImpact > 0) {
      stats.push(['冲击力', finalImpact, false]);
    }

    // 其他属性
    if (this.penetration_value > 0) {
      stats.push(['穿透值', this.penetration_value, false]);
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
      lines.push(`${prefix}最终面板 (${stats.length}个属性):`);
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
