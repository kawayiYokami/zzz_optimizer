/**
 * 属性集合模板
 *
 * 统一的数据格式，所有属性来源都返回这个结构：
 * - out_of_combat: 局外属性（进入战斗前就生效）
 * - in_combat: 局内属性（进入战斗后生效）
 *
 * 所有数据源都返回 PropertyCollection：
 * - Agent.get_bare_stats() - 基础属性
 * - Agent.get_self_buff() - 角色Buff
 * - WEngine.get_stats_at_level() - 武器属性
 * - DriveDisk.get_stats() - 驱动盘属性
 * - Buff - Buff本身
 */

import { PropertyType, isPercentageProperty, getPropertyCnName, getPropertyTypeByCnName } from './base';

/**
 * 属性集合
 *
 * 统一的数据格式，包含局外、局内和最终三部分属性。
 * 相同 PropertyType 的值会累加。
 */
export class PropertyCollection {
  out_of_combat: Map<PropertyType, number>;
  in_combat: Map<PropertyType, number>;
  final: Map<PropertyType, number>; // 最终面板（局外+局内计算后的结果）

  constructor(
    outOfCombat?: Map<PropertyType, number> | Record<PropertyType, number>,
    inCombat?: Map<PropertyType, number> | Record<PropertyType, number>
  ) {
    this.out_of_combat = outOfCombat instanceof Map ? new Map(outOfCombat) : new Map(Object.entries(outOfCombat || {}) as unknown as [PropertyType, number][]);
    this.in_combat = inCombat instanceof Map ? new Map(inCombat) : new Map(Object.entries(inCombat || {}) as unknown as [PropertyType, number][]);
    this.final = new Map();
  }

  /**
   * 添加单个属性值（局外属性）
   *
   * @param prop 属性类型（可以是 PropertyType 或字符串）
   * @param value 属性值
   * @returns self (方便链式调用)
   */
  addProperty(prop: PropertyType | string, value: number): PropertyCollection {
    let propType: PropertyType;
    if (typeof prop === 'string') {
      // 优先通过中文名称映射查找
      propType = getPropertyTypeByCnName(prop) || (PropertyType as any)[prop];
    } else {
      propType = prop;
    }
    const currentValue = this.out_of_combat.get(propType) || 0;
    this.out_of_combat.set(propType, currentValue + value);
    return this;
  }

  /**
   * 累加另一个 PropertyCollection
   *
   * @param other 另一个属性集合
   * @returns self (方便链式调用)
   */
  add(other: PropertyCollection): PropertyCollection {
    for (const [prop, value] of other.out_of_combat.entries()) {
      const currentValue = this.out_of_combat.get(prop) || 0;
      this.out_of_combat.set(prop, currentValue + value);
    }
    for (const [prop, value] of other.in_combat.entries()) {
      const currentValue = this.in_combat.get(prop) || 0;
      this.in_combat.set(prop, currentValue + value);
    }
    return this;
  }

  /**
   * 合并多个 PropertyCollection
   *
   * @param collections 属性集合列表
   * @returns 合并后的属性集合
   */
  static mergeAll(collections: (PropertyCollection | null | undefined)[]): PropertyCollection {
    const result = new PropertyCollection();
    for (const collection of collections) {
      if (collection !== null && collection !== undefined) {
        result.add(collection);
      }
    }
    return result;
  }

  /**
   * 获取局外属性值
   *
   * @param prop 属性类型
   * @param defaultValue 默认值
   * @returns 属性值
   */
  getOutOfCombat(prop: PropertyType, defaultValue: number = 0.0): number {
    return this.out_of_combat.get(prop) ?? defaultValue;
  }

  /**
   * 获取局内属性值
   *
   * @param prop 属性类型
   * @param defaultValue 默认值
   * @returns 属性值
   */
  getInCombat(prop: PropertyType, defaultValue: number = 0.0): number {
    return this.in_combat.get(prop) ?? defaultValue;
  }

  /**
   * 获取属性总值（局外 + 局内）
   *
   * @param prop 属性类型
   * @param defaultValue 默认值
   * @returns 属性总值
   */
  getTotal(prop: PropertyType, defaultValue: number = 0.0): number {
    return this.getOutOfCombat(prop, 0) + this.getInCombat(prop, defaultValue);
  }

  /**
   * 获取属性值（支持字符串参数，兼容旧代码）
   *
   * @param prop 属性类型（可以是 PropertyType 或字符串）
   * @param defaultValue 默认值
   * @returns 属性总值
   */
  getValue(prop: PropertyType | string, defaultValue: number = 0.0): number {
    let propType: PropertyType;
    if (typeof prop === 'string') {
      // 优先通过中文名称映射查找
      propType = getPropertyTypeByCnName(prop) || (PropertyType as any)[prop];
    } else {
      propType = prop;
    }
    return this.getTotal(propType, defaultValue);
  }

  /**
   * 获取最终面板属性值
   *
   * @param prop 属性类型
   * @param defaultValue 默认值
   * @returns 最终属性值
   */
  getFinal(prop: PropertyType, defaultValue: number = 0.0): number {
    return this.final.get(prop) ?? defaultValue;
  }

  /**
   * 计算最终面板
   *
   * 将 out_of_combat 和 in_combat 合并计算成 final
   *
   * 计算规则：
   * 1. 四大基础属性（ATK/HP/DEF/IMPACT）：
   *    - 局外最终 = base × (1 + percent) + flat
   *    - 局内最终 = 局外最终 × (1 + 局内percent) + 局内flat
   * 2. 其他属性：直接累加 out_of_combat + in_combat
   */
  calculateFinal(): void {
    this.final.clear();

    // 1. 处理四大基础属性（ATK/HP/DEF/IMPACT）
    const fourBasicProps = [
      { base: PropertyType.ATK_BASE, percent: PropertyType.ATK_, flat: PropertyType.ATK },
      { base: PropertyType.HP_BASE, percent: PropertyType.HP_, flat: PropertyType.HP },
      { base: PropertyType.DEF_BASE, percent: PropertyType.DEF_, flat: PropertyType.DEF },
      { base: PropertyType.IMPACT, percent: PropertyType.IMPACT_, flat: null }, // IMPACT 没有 flat
    ];

    for (const { base, percent, flat } of fourBasicProps) {
      // 计算局外最终值
      const out_base = this.getOutOfCombat(base, 0);
      const out_percent = this.getOutOfCombat(percent, 0) / 100.0;
      const out_flat = flat ? this.getOutOfCombat(flat, 0) : 0;
      const out_final = out_base * (1 + out_percent) + out_flat;

      // 计算局内最终值（局外最终作为局内基础）
      const in_percent = this.getInCombat(percent, 0) / 100.0;
      const in_flat = flat ? this.getInCombat(flat, 0) : 0;
      const final_value = out_final * (1 + in_percent) + in_flat;

      this.final.set(base, final_value);
    }

    // 2. 处理其他所有属性（直接累加）
    const allProps = new Set<PropertyType>();

    // 收集所有属性类型
    for (const prop of this.out_of_combat.keys()) {
      allProps.add(prop);
    }
    for (const prop of this.in_combat.keys()) {
      allProps.add(prop);
    }

    // 对于非四大基础属性，直接累加
    for (const prop of allProps) {
      // 跳过四大基础属性的 base/percent/flat（已经处理过）
      if (
        prop === PropertyType.ATK_BASE ||
        prop === PropertyType.HP_BASE ||
        prop === PropertyType.DEF_BASE ||
        prop === PropertyType.IMPACT ||
        prop === PropertyType.ATK_ ||
        prop === PropertyType.HP_ ||
        prop === PropertyType.DEF_ ||
        prop === PropertyType.IMPACT_ ||
        prop === PropertyType.ATK ||
        prop === PropertyType.HP ||
        prop === PropertyType.DEF
      ) {
        continue;
      }

      // 直接累加
      const total = this.getOutOfCombat(prop, 0) + this.getInCombat(prop, 0);
      if (total !== 0) {
        this.final.set(prop, total);
      }
    }
  }

  /**
   * 检查是否为空
   *
   * @returns 是否为空
   */
  isEmpty(): boolean {
    return this.out_of_combat.size === 0 && this.in_combat.size === 0;
  }

  /**
   * 格式化输出（只输出不为0的属性）
   *
   * @param indent 缩进空格数
   * @returns 格式化字符串
   */
  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    // 局外属性
    if (this.out_of_combat.size > 0) {
      const outItems: [PropertyType, number][] = [];
      for (const [prop, value] of this.out_of_combat.entries()) {
        if (value !== 0) {
          outItems.push([prop, value]);
        }
      }

      if (outItems.length > 0) {
        outItems.sort((a, b) => getPropertyCnName(a[0]).localeCompare(getPropertyCnName(b[0])));
        lines.push(`${prefix}局外 (${outItems.length}个属性):`);
        for (const [prop, value] of outItems) {
          const cnName = getPropertyCnName(prop);
          if (isPercentageProperty(prop)) {
            // 百分比属性（存储为小数形式，如 0.05 表示 5%，显示时需要乘以100）
            lines.push(`  ${prefix}${cnName}: ${(value * 100).toFixed(2)}%`);
          } else {
            // 固定值属性
            if (Math.abs(value) >= 10) {
              lines.push(`  ${prefix}${cnName}: ${value.toFixed(1)}`);
            } else {
              lines.push(`  ${prefix}${cnName}: ${value.toFixed(3)}`);
            }
          }
        }
      }
    }

    // 局内属性
    if (this.in_combat.size > 0) {
      const inItems: [PropertyType, number][] = [];
      for (const [prop, value] of this.in_combat.entries()) {
        if (value !== 0) {
          inItems.push([prop, value]);
        }
      }

      if (inItems.length > 0) {
        inItems.sort((a, b) => getPropertyCnName(a[0]).localeCompare(getPropertyCnName(b[0])));
        lines.push(`${prefix}局内 (${inItems.length}个属性):`);
        for (const [prop, value] of inItems) {
          const cnName = getPropertyCnName(prop);
          if (isPercentageProperty(prop)) {
            // 百分比属性（存储为小数形式，如 0.05 表示 5%，显示时需要乘以100）
            lines.push(`  ${prefix}${cnName}: ${(value * 100).toFixed(2)}%`);
          } else {
            // 固定值属性
            if (Math.abs(value) >= 10) {
              lines.push(`  ${prefix}${cnName}: ${value.toFixed(1)}`);
            } else {
              lines.push(`  ${prefix}${cnName}: ${value.toFixed(3)}`);
            }
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 转换为JSON对象
   *
   * @returns JSON对象
   */
  toJSON(): {
    out_of_combat: Record<string, number>;
    in_combat: Record<string, number>;
  } {
    const outOfCombat: Record<string, number> = {};
    const inCombat: Record<string, number> = {};

    for (const [prop, value] of this.out_of_combat.entries()) {
      outOfCombat[PropertyType[prop]] = value;
    }
    for (const [prop, value] of this.in_combat.entries()) {
      inCombat[PropertyType[prop]] = value;
    }

    return {
      out_of_combat: outOfCombat,
      in_combat: inCombat,
    };
  }

  /**
   * 从JSON对象创建PropertyCollection
   *
   * @param data JSON对象
   * @returns PropertyCollection实例
   */
  static fromJSON(data: {
    out_of_combat?: Record<string, number>;
    in_combat?: Record<string, number>;
  }): PropertyCollection {
    const outOfCombat = new Map<PropertyType, number>();
    const inCombat = new Map<PropertyType, number>();

    if (data.out_of_combat) {
      for (const [key, value] of Object.entries(data.out_of_combat)) {
        const prop = PropertyType[key as keyof typeof PropertyType];
        if (prop !== undefined) {
          outOfCombat.set(prop, value);
        }
      }
    }

    if (data.in_combat) {
      for (const [key, value] of Object.entries(data.in_combat)) {
        const prop = PropertyType[key as keyof typeof PropertyType];
        if (prop !== undefined) {
          inCombat.set(prop, value);
        }
      }
    }

    return new PropertyCollection(outOfCombat, inCombat);
  }
}

/**
 * 合并属性集合的便捷函数
 *
 * @param collections 属性集合列表
 * @returns 合并后的属性集合
 */
export function mergePropertyCollections(
  collections: (PropertyCollection | null | undefined)[]
): PropertyCollection {
  return PropertyCollection.mergeAll(collections);
}
