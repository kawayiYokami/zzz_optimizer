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
  conversion: Map<PropertyType, number>; // 转换类属性（由转换类buff生成）
  final: Map<PropertyType, number>; // 最终面板（局外+局内+转换计算后的结果）

  constructor(
    outOfCombat?: Map<PropertyType, number> | Record<PropertyType, number>,
    inCombat?: Map<PropertyType, number> | Record<PropertyType, number>
  ) {
    this.out_of_combat = outOfCombat instanceof Map ? new Map(outOfCombat) : new Map(Object.entries(outOfCombat || {}) as unknown as [PropertyType, number][]);
    this.in_combat = inCombat instanceof Map ? new Map(inCombat) : new Map(Object.entries(inCombat || {}) as unknown as [PropertyType, number][]);
    this.conversion = new Map();
    this.final = new Map();
  }

  /**
   * 从优化器 Float64Array 属性快照创建 PropertyCollection
   *
   * 说明：
   * - FastEvaluator/Worker 使用 Float64Array 表示属性快照（索引定义见 optimizer/types/property-index.ts）
   * - 该快照为“最终结果数值”，无法还原 out_of_combat / in_combat / conversion 的来源拆分
   * - 因此统一写入 final，供 PropertySetCard 直接展示
   */
  static fromOptimizerFinalStatsArray(
    arr: Float64Array,
    idxToPropType: Record<number, PropertyType>
  ): PropertyCollection {
    const pc = new PropertyCollection();
    for (let i = 0; i < arr.length; i++) {
      const prop = idxToPropType[i];
      if (prop === undefined) continue;
      const v = arr[i];
      if (!v) continue;
      pc.final.set(prop, v);
    }
    return pc;
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
   * 添加转换类属性值
   *
   * @param prop 属性类型
   * @param value 属性值
   * @returns self (方便链式调用)
   */
  addConversion(prop: PropertyType, value: number): PropertyCollection {
    const currentValue = this.conversion.get(prop) || 0;
    this.conversion.set(prop, currentValue + value);
    return this;
  }

  /**
   * 获取转换类属性值
   *
   * @param prop 属性类型
   * @param defaultValue 默认值
   * @returns 属性值
   */
  getConversion(prop: PropertyType, defaultValue: number = 0.0): number {
    return this.conversion.get(prop) ?? defaultValue;
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
    for (const [prop, value] of other.conversion.entries()) {
      const currentValue = this.conversion.get(prop) || 0;
      this.conversion.set(prop, currentValue + value);
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
   * 局外属性 → 战斗属性（三层属性转换：1 → 2）
   *
   * 严格遵循三层属性转换流程：
   * 局外属性(1) → 局内属性(2) → 最终属性(3)
   * 
   * 算法：
   * - 基础属性 = 基础属性 × (1 + 百分比属性) + 固定值属性
   * - 其他属性直接复制
   * 
   * 注意：
   * 1. 只处理局外属性，不访问任何局内属性
   * 2. 不应该生成任何最终属性
   * 3. 算法与 toFinalStats 完全一致，只是处理的数据源不同
   * 4. 转换后局内属性不应该再有任何的ATK%、ATK（固定值）等原始属性
   *
   * @returns 战斗属性PropertyCollection，只包含局内面板
   */
  toCombatStats(): PropertyCollection {
    const combatStats = new PropertyCollection();
    
    // 只处理局外属性，将其转换为局内属性
    // 算法：基础属性 × (1 + 百分比属性) + 固定值属性
    
    // 1. 处理四大基础属性（ATK/HP/DEF/IMPACT）
    const fourBasicProps = [
      { base: PropertyType.ATK_BASE, percent: PropertyType.ATK_, flat: PropertyType.ATK },
      { base: PropertyType.HP_BASE, percent: PropertyType.HP_, flat: PropertyType.HP },
      { base: PropertyType.DEF_BASE, percent: PropertyType.DEF_, flat: PropertyType.DEF },
      { base: PropertyType.IMPACT, percent: PropertyType.IMPACT_, flat: null }
    ];

    for (const { base, percent, flat } of fourBasicProps) {
      // 从局外属性获取值
      const baseValue = this.getOutOfCombat(base, 0);
      const percentValue = this.getOutOfCombat(percent, 0);
      const flatValue = flat ? this.getOutOfCombat(flat, 0) : 0;
      
      // 计算最终值
      const finalValue = baseValue * (1 + percentValue) + flatValue;
      combatStats.in_combat.set(base, finalValue);
    }

    // 2. 处理其他所有属性（直接复制，不进行计算）
    for (const [prop, value] of this.out_of_combat.entries()) {
      // 跳过已经处理的四大基础属性的 base/percent/flat
      if ([
        PropertyType.ATK_BASE, PropertyType.HP_BASE, PropertyType.DEF_BASE, PropertyType.IMPACT,
        PropertyType.ATK_, PropertyType.HP_, PropertyType.DEF_, PropertyType.IMPACT_,
        PropertyType.ATK, PropertyType.HP, PropertyType.DEF
      ].includes(prop)) {
        continue;
      }
      
      combatStats.in_combat.set(prop, value);
    }
    
    return combatStats;
  }

  /**
   * 局内属性 → 最终属性（三层属性转换：2 → 3）
   *
   * 严格遵循三层属性转换流程：
   * 局外属性(1) → 局内属性(2) → 最终属性(3)
   *
   * 算法：
   * - 基础属性 = 基础属性 × (1 + 百分比属性) + 固定值属性
   * - 其他属性直接复制
   * - 最后加上转换类属性
   *
   * 注意：
   * 1. 只处理局内属性，不访问任何局外属性
   * 2. 不应该涉及任何局外属性
   * 3. 算法与 toCombatStats 完全一致，只是处理的数据源不同
   * 4. 局外属性不直接影响最终属性，必须通过局内属性间接影响
   * 5. 转换类属性在最后累加到最终属性中
   *
   * @returns 最终属性Map
   */
  toFinalStats(): Map<PropertyType, number> {
    const finalStats = new Map<PropertyType, number>();
    
    // 只处理局内属性，将其转换为最终属性
    // 算法与toCombatStats完全一致，只是数据源不同
    
    // 0. 先将转换类属性合并到局内属性的临时副本中
    const mergedInCombat = new Map<PropertyType, number>(this.in_combat);
    for (const [prop, value] of this.conversion.entries()) {
      const currentValue = mergedInCombat.get(prop) || 0;
      mergedInCombat.set(prop, currentValue + value);
    }
    
    // 1. 处理四大基础属性（ATK/HP/DEF/IMPACT）
    const fourBasicProps = [
      { base: PropertyType.ATK_BASE, percent: PropertyType.ATK_, flat: PropertyType.ATK },
      { base: PropertyType.HP_BASE, percent: PropertyType.HP_, flat: PropertyType.HP },
      { base: PropertyType.DEF_BASE, percent: PropertyType.DEF_, flat: PropertyType.DEF },
      { base: PropertyType.IMPACT, percent: PropertyType.IMPACT_, flat: null }
    ];

    for (const { base, percent, flat } of fourBasicProps) {
      // 从合并后的局内属性获取值
      const baseValue = mergedInCombat.get(base) || 0;
      const percentValue = mergedInCombat.get(percent) || 0;
      const flatValue = flat ? (mergedInCombat.get(flat) || 0) : 0;
      
      // 计算最终值
      const finalValue = baseValue * (1 + percentValue) + flatValue;
      finalStats.set(base, finalValue);
    }

    // 2. 处理其他所有属性（直接复制，不进行计算）
    for (const [prop, value] of mergedInCombat.entries()) {
      // 跳过已经处理的四大基础属性的 base/percent/flat
      if ([
        PropertyType.ATK_BASE, PropertyType.HP_BASE, PropertyType.DEF_BASE, PropertyType.IMPACT,
        PropertyType.ATK_, PropertyType.HP_, PropertyType.DEF_, PropertyType.IMPACT_,
        PropertyType.ATK, PropertyType.HP, PropertyType.DEF
      ].includes(prop)) {
        continue;
      }
      
      finalStats.set(prop, value);
    }
    
    return finalStats;
  }



  /**
   * 检查是否为空
   *
   * @returns 是否为空
   */
  isEmpty(): boolean {
    return this.out_of_combat.size === 0 && this.in_combat.size === 0 && this.conversion.size === 0;
  }

  /**
   * 格式化输出（只输出不为0的属性）
   *
   * @param indent 缩进空格数
   * @param formatType 输出类型：
   *   - 'separate'（分开显示局外/局内）
   *   - 'final'（只显示最终面板）
   *   - 'out_of_combat'（只显示局外属性）
   *   - 'in_combat'（只显示局内属性）
   * @returns 格式化字符串
   */
  format(indent: number = 0, formatType: 'separate' | 'final' | 'out_of_combat' | 'in_combat' = 'separate'): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    if (formatType === 'final') {
      // 显示最终面板属性
      // 确保已计算最终面板
      if (this.final.size === 0) {
        // 直接计算最终面板，不调用updateFinalStats方法
        this.final = this.toFinalStats();
      }

      if (this.final.size > 0) {
        const finalItems: [PropertyType, number][] = [];
        for (const [prop, value] of this.final.entries()) {
          if (value !== 0) {
            finalItems.push([prop, value]);
          }
        }

        if (finalItems.length > 0) {
          finalItems.sort((a, b) => getPropertyCnName(a[0]).localeCompare(getPropertyCnName(b[0])));
          lines.push(`${prefix}最终面板 (${finalItems.length}个属性):`);
          for (const [prop, value] of finalItems) {
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
    } else if (formatType === 'out_of_combat') {
      // 只显示局外属性
      if (this.out_of_combat.size > 0) {
        const outItems: [PropertyType, number][] = [];
        for (const [prop, value] of this.out_of_combat.entries()) {
          if (value !== 0) {
            outItems.push([prop, value]);
          }
        }

        if (outItems.length > 0) {
          outItems.sort((a, b) => getPropertyCnName(a[0]).localeCompare(getPropertyCnName(b[0])));
          lines.push(`${prefix}局外属性 (${outItems.length}个属性):`);
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
    } else if (formatType === 'in_combat') {
      // 只显示局内属性
      if (this.in_combat.size > 0) {
        const inItems: [PropertyType, number][] = [];
        for (const [prop, value] of this.in_combat.entries()) {
          if (value !== 0) {
            inItems.push([prop, value]);
          }
        }

        if (inItems.length > 0) {
          inItems.sort((a, b) => getPropertyCnName(a[0]).localeCompare(getPropertyCnName(b[0])));
          lines.push(`${prefix}局内属性 (${inItems.length}个属性):`);
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
    } else {
      // 分开显示局外和局内属性（原有逻辑）
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
    }

    return lines.join('\n');
  }

  /**
   * 格式化Map<PropertyType, number>为字符串（静态方法）
   *
   * @param statsMap 要格式化的属性Map
   * @param indent 缩进空格数
   * @returns 格式化字符串
   */
  static formatMap(statsMap: Map<PropertyType, number>, indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    const items: [PropertyType, number][] = [];
    for (const [prop, value] of statsMap.entries()) {
      if (value !== 0) {
        items.push([prop, value]);
      }
    }

    if (items.length > 0) {
      items.sort((a, b) => getPropertyCnName(a[0]).localeCompare(getPropertyCnName(b[0])));
      lines.push(`${prefix}属性 (${items.length}个属性):`);
      for (const [prop, value] of items) {
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
