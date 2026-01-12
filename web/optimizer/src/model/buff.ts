/**
 * Buff增益模型 - 战斗核心数据定义
 */

import { PropertyType, isPercentageProperty, getPropertyCnName } from './base';
import { PropertyCollection } from './property-collection';

/**
 * Buff生效环境
 */
export enum BuffContext {
  OUT_OF_COMBAT = 1, // 局外（面板显示）
  IN_COMBAT = 2,     // 局内（战斗中）
}

/**
 * Buff生效目标
 */
export class BuffTarget {
  target_self: boolean = true;
  target_enemy: boolean = false;
  target_teammate: boolean = false;
  target_bund: boolean = false;
}

/**
 * Buff来源
 */
export enum BuffSource {
  AGENT_PASSIVE = 1,
  AGENT_TALENT = 2,
  TALENT = 11,
  AGENT_CORE = 3,
  WENGINE = 4,
  WENGINE_TALENT = 5,
  DRIVE_DISK_2PC = 6,
  DRIVE_DISK_4PC = 7,
  TEAM_MATE = 8,
  CORE_PASSIVE = 9,
  POTENTIAL = 10,
}

/**
 * 转换类（封装好的）
 */
export class Conversion {
  from_property: PropertyType;
  to_property: PropertyType;
  conversion_ratio: number;
  max_value?: number;

  constructor(fromProperty: PropertyType, toProperty: PropertyType, conversionRatio: number, maxValue?: number) {
    this.from_property = fromProperty;
    this.to_property = toProperty;
    this.conversion_ratio = conversionRatio;
    this.max_value = maxValue;
  }
}

/**
 * Buff
 *
 * 核心原则：
 * - 只持有对战斗有影响的属性
 * - UI相关字段通过getter从外部获取
 */
export class Buff {
  // === 战斗核心数据 ===
  id: string = '';                 // Buff ID
  name: string = '';               // Buff名称
  description: string = '';        // Buff描述
  source: BuffSource;              // 来源
  target: BuffTarget;              // 生效目标

  // 局内属性加成（战斗中生效）
  in_combat_stats: Map<PropertyType, number>;

  // 局外属性加成
  out_of_combat_stats: Map<PropertyType, number>;

  // 转换类（可选）
  conversion?: Conversion;

  // 触发条件
  trigger_conditions: string = '';

  // 叠加机制
  max_stacks: number = 1;
  stack_mode: 'linear' | 'full_only' = 'linear';

  // 生效状态
  is_active: boolean = true;

  constructor(
    source: BuffSource,
    inCombatStats?: Map<PropertyType, number> | Record<PropertyType, number>,
    outOfCombatStats?: Map<PropertyType, number> | Record<PropertyType, number>,
    conversion?: Conversion,
    target?: BuffTarget,
    maxStacks: number = 1,
    stackMode: 'linear' | 'full_only' = 'linear',
    isActive: boolean = true,
    id: string = '',
    name: string = '',
    description: string = '',
    triggerConditions: string = ''
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.source = source;
    this.target = target ?? new BuffTarget();
    this.in_combat_stats = inCombatStats instanceof Map
      ? new Map(inCombatStats)
      : new Map(Object.entries(inCombatStats || {}) as unknown as [PropertyType, number][]);
    this.out_of_combat_stats = outOfCombatStats instanceof Map
      ? new Map(outOfCombatStats)
      : new Map(Object.entries(outOfCombatStats || {}) as unknown as [PropertyType, number][]);
    this.conversion = conversion;
    this.trigger_conditions = triggerConditions;
    this.max_stacks = maxStacks;
    this.stack_mode = stackMode;
    this.is_active = isActive;
  }

  // === 辅助方法 ===

  /** 判断是否是转换类BUFF */
  isConversion(): boolean {
    return this.conversion !== undefined;
  }

  /** 计算转换值 */
  calculateConversion(sourceValue: number): number {
    if (!this.conversion) return 0;

    let value = sourceValue * this.conversion.conversion_ratio;
    if (this.conversion.max_value !== undefined && value > this.conversion.max_value) {
      value = this.conversion.max_value;
    }
    return value;
  }

  /**
   * 转换为 PropertyCollection
   *
   * @returns 属性集合
   */
  toPropertyCollection(): PropertyCollection {
    return new PropertyCollection(
      this.out_of_combat_stats,
      this.in_combat_stats
    );
  }

  /** 计算叠层后的属性值 */
  calculateValue(currentStacks: number = 1): Map<PropertyType, number> {
    if (!this.is_active) return new Map();

    const stats = new Map<PropertyType, number>();
    
    if (this.stack_mode === 'linear') {
      for (const [prop, baseVal] of this.in_combat_stats) {
        stats.set(prop, baseVal * currentStacks);
      }
    } else if (this.stack_mode === 'full_only' && currentStacks === this.max_stacks) {
      for (const [prop, val] of this.in_combat_stats) {
        stats.set(prop, val);
      }
    }
    
    return stats;
  }

  // === 序列化 ===

  static fromDict(data: any): Buff {
    // 解析conversion
    let conversion: Conversion | undefined;
    if (data.conversion) {
      conversion = new Conversion(
        (PropertyType as any)[data.conversion.from_property],
        (PropertyType as any)[data.conversion.to_property],
        data.conversion.conversion_ratio,
        data.conversion.max_value
      );
    }

    // 解析in_combat_stats
    const inCombatStats = new Map<PropertyType, number>();
    if (data.in_combat_stats) {
      for (const [propName, value] of Object.entries(data.in_combat_stats)) {
        const propType = (PropertyType as any)[propName];
        const numValue = value as number;
        // 检查是否为百分比属性，游戏数据是百分比的100倍，需要除以100转换为小数
        const isPercentType = [
          PropertyType.CRIT_,
          PropertyType.CRIT_DMG_,
          PropertyType.ATK_,
          PropertyType.HP_,
          PropertyType.DEF_,
          PropertyType.PEN_,
          PropertyType.SHIELD_,
          PropertyType.IMPACT_,
          PropertyType.ANOM_MAS_,
          PropertyType.PHYSICAL_DMG_,
          PropertyType.FIRE_DMG_,
          PropertyType.ICE_DMG_,
          PropertyType.ELECTRIC_DMG_,
          PropertyType.ETHER_DMG_,
          PropertyType.ENER_REGEN_
        ].includes(propType);
        const finalValue = isPercentType ? numValue / 100 : numValue;
        inCombatStats.set(propType, finalValue);
      }
    }

    // 解析out_of_combat_stats
    const outOfCombatStats = new Map<PropertyType, number>();
    if (data.out_of_combat_stats) {
      for (const [propName, value] of Object.entries(data.out_of_combat_stats)) {
        const propType = (PropertyType as any)[propName];
        const numValue = value as number;
        // 检查是否为百分比属性，游戏数据是百分比的100倍，需要除以100转换为小数
        const isPercentType = [
          PropertyType.CRIT_,
          PropertyType.CRIT_DMG_,
          PropertyType.ATK_,
          PropertyType.HP_,
          PropertyType.DEF_,
          PropertyType.PEN_,
          PropertyType.SHIELD_,
          PropertyType.IMPACT_,
          PropertyType.ANOM_MAS_,
          PropertyType.PHYSICAL_DMG_,
          PropertyType.FIRE_DMG_,
          PropertyType.ICE_DMG_,
          PropertyType.ELECTRIC_DMG_,
          PropertyType.ETHER_DMG_,
          PropertyType.ENER_REGEN_
        ].includes(propType);
        const finalValue = isPercentType ? numValue / 100 : numValue;
        outOfCombatStats.set(propType, finalValue);
      }
    }

    // 解析target
    const targetData = data.target ?? {};
    const target = new BuffTarget();
    target.target_self = targetData.target_self ?? true;
    target.target_enemy = targetData.target_enemy ?? false;
    target.target_teammate = targetData.target_teammate ?? false;
    target.target_bund = targetData.target_bund ?? false;

    return new Buff(
      typeof data.source === 'string' ? (BuffSource as any)[data.source] : data.source,
      inCombatStats,
      outOfCombatStats,
      conversion,
      target,
      data.max_stacks ?? 1,
      data.stack_mode ?? 'linear',
      data.is_active ?? true,
      data.id ?? '',
      data.name ?? '',
      data.description ?? '',
      data.trigger_conditions ?? ''
    );
  }

  /**
   * 从游戏数据创建 Buff（fromDict 的别名）
   */
  static fromBuffData(data: any): Buff {
    return Buff.fromDict(data);
  }

  toDict(): any {
    const inCombatStats: Record<string, number> = {};
    for (const [prop, value] of this.in_combat_stats.entries()) {
      inCombatStats[PropertyType[prop]] = value;
    }

    const outOfCombatStats: Record<string, number> = {};
    for (const [prop, value] of this.out_of_combat_stats.entries()) {
      outOfCombatStats[PropertyType[prop]] = value;
    }

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      source: BuffSource[this.source],
      target: {
        target_self: this.target.target_self,
        target_enemy: this.target.target_enemy,
        target_teammate: this.target.target_teammate,
        target_bund: this.target.target_bund,
      },
      in_combat_stats: inCombatStats,
      out_of_combat_stats: outOfCombatStats,
      conversion: this.conversion ? {
        from_property: PropertyType[this.conversion.from_property],
        to_property: PropertyType[this.conversion.to_property],
        conversion_ratio: this.conversion.conversion_ratio,
        max_value: this.conversion.max_value,
      } : null,
      trigger_conditions: this.trigger_conditions,
      max_stacks: this.max_stacks,
      stack_mode: this.stack_mode,
      is_active: this.is_active,
    };
  }

  /**
   * 格式化输出Buff信息（只输出有意义的值）
   *
   * @param indent 缩进空格数
   * @returns 格式化字符串
   */
  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    // 基本信息
    if (this.name) {
      lines.push(`${prefix}${this.name}`);
    }
    if (this.description) {
      lines.push(`${prefix}  ${this.description}`);
    }

    // 属性加成
    const allStats = new Map<PropertyType, number>();
    for (const [prop, value] of this.in_combat_stats.entries()) {
      allStats.set(prop, value);
    }
    for (const [prop, value] of this.out_of_combat_stats.entries()) {
      allStats.set(prop, (allStats.get(prop) ?? 0) + value);
    }

    if (allStats.size > 0) {
      lines.push(`${prefix}  属性加成:`);
      for (const [prop, value] of allStats.entries()) {
        const cnName = getPropertyCnName(prop);
        if (isPercentageProperty(prop)) {
          lines.push(`${prefix}    ${cnName}: ${(value * 100).toFixed(2)}%`);
        } else {
          lines.push(`${prefix}    ${cnName}: ${value.toFixed(2)}`);
        }
      }
    }

    return lines.join('\n');
  }
}

/**
 * 转换类 Buff - 专门用于属性转换的 Buff
 */
export class ConversionBuff extends Buff {
  // 转换详情
  conversion: Conversion;

  constructor(
    conversion: Conversion,
    source: BuffSource = BuffSource.AGENT_PASSIVE,
    target?: BuffTarget,
    maxStacks: number = 1,
    stackMode: 'linear' | 'full_only' = 'linear',
    isActive: boolean = true,
    id: string = '',
    name: string = '',
    description: string = '',
    triggerConditions: string = ''
  ) {
    super(
      source,
      undefined, // 转换Buff通常不直接提供属性加成
      undefined,
      conversion,
      target,
      maxStacks,
      stackMode,
      isActive,
      id,
      name,
      description,
      triggerConditions
    );
    this.conversion = conversion;
  }

  /**
   * 从 Buff 数据创建 ConversionBuff 实例
   */
  static fromBuffData(data: any): ConversionBuff {
    // 解析 conversion
    if (!data.conversion) {
      console.error(`[DEBUG] ConversionBuff.fromBuffData: 缺少conversion字段`, data);
      throw new Error(`ConversionBuff.fromBuffData: 缺少conversion字段`);
    }
    
    const conversion = new Conversion(
      (PropertyType as any)[data.conversion.from_property],
      (PropertyType as any)[data.conversion.to_property],
      data.conversion.conversion_ratio,
      data.conversion.max_value
    );

    // 解析 target
    const targetData = data.target ?? {};
    const target = new BuffTarget();
    target.target_self = targetData.target_self ?? true;
    target.target_enemy = targetData.target_enemy ?? false;
    target.target_teammate = targetData.target_teammate ?? false;
    target.target_bund = targetData.target_bund ?? false;

    return new ConversionBuff(
      conversion,
      typeof data.source === 'string' ? (BuffSource as any)[data.source] : data.source,
      target,
      data.max_stacks ?? 1,
      data.stack_mode ?? 'linear',
      data.is_active ?? true,
      data.id ?? '',
      data.name ?? '',
      data.description ?? '',
      data.trigger_conditions ?? ''
    );
  }

  /**
   * 计算转换值
   */
  calculateConversion(sourceValue: number): number {
    let value = sourceValue * this.conversion.conversion_ratio;
    if (this.conversion.max_value !== undefined && value > this.conversion.max_value) {
      value = this.conversion.max_value;
    }
    return value;
  }
}