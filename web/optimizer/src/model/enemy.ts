/**
 * 敌人模型
 *
 * 对应游戏数据中的敌人信息
 */

import type { EnemyInfo } from '../services/data-loader.service';

/**
 * 敌人模型
 */
export class Enemy {
  // 基础信息
  id: string;
  full_name: string;
  code_name: string;
  index_id: string;
  tags: string;

  // 基础属性
  hp: number;
  atk: number;
  defense: number;

  // 失衡相关
  stun_max: number;
  can_stun: boolean;
  stun_vulnerability_multiplier: number;

  // 伤害抗性
  ice_dmg_resistance: number;
  fire_dmg_resistance: number;
  electric_dmg_resistance: number;
  physical_dmg_resistance: number;
  ether_dmg_resistance: number;

  // 异常抗性
  ice_anomaly_resistance: number = 0;
  fire_anomaly_resistance: number = 0;
  electric_anomaly_resistance: number = 0;
  physical_anomaly_resistance: number = 0;
  ether_anomaly_resistance: number = 0;

  // 失衡抗性
  ice_stun_resistance: number = 0;
  fire_stun_resistance: number = 0;
  electric_stun_resistance: number = 0;
  physical_stun_resistance: number = 0;
  ether_stun_resistance: number = 0;

  // 异常条ID
  ice_anomaly_bar: string = '';
  fire_anomaly_bar: string = '';
  electric_anomaly_bar: string = '';
  physical_anomaly_bar: string = '';
  ether_anomaly_bar: string = '';

  // 其他属性
  crit_dmg: number = 0;
  chain_attack_count: number = 0;
  base_poise_level: number = 0;
  freeze_time_resistance: number = 0;
  base_buildup_coefficient: number = 0;

  constructor(
    id: string,
    fullName: string,
    codeName: string,
    hp: number,
    atk: number,
    defense: number,
    stunMax: number,
    canStun: boolean
  ) {
    this.id = id;
    this.full_name = fullName;
    this.code_name = codeName;
    this.index_id = '';
    this.tags = '';
    this.hp = hp;
    this.atk = atk;
    this.defense = defense;
    this.stun_max = stunMax;
    this.can_stun = canStun;
    this.stun_vulnerability_multiplier = 0;
    this.ice_dmg_resistance = 0;
    this.fire_dmg_resistance = 0;
    this.electric_dmg_resistance = 0;
    this.physical_dmg_resistance = 0;
    this.ether_dmg_resistance = 0;
  }

  /**
   * 从游戏数据创建Enemy实例
   *
   * @param enemyData 游戏数据中的敌人信息
   * @returns Enemy实例
   */
  static fromGameData(enemyData: EnemyInfo): Enemy {
    const enemy = new Enemy(
      enemyData.id,
      enemyData.CHS || enemyData.EN,
      enemyData.code_name,
      enemyData.hp,
      enemyData.atk,
      enemyData.defense,
      enemyData.stun_max,
      enemyData.can_stun
    );

    // 设置其他属性
    enemy.index_id = enemyData.index_id || '';
    enemy.tags = enemyData.tags || '';
    // 默认失衡易伤倍率为 50%
    enemy.stun_vulnerability_multiplier = enemyData.stun_vulnerability_multiplier !== undefined
      ? enemyData.stun_vulnerability_multiplier
      : 0.5;

    // 伤害抗性
    enemy.ice_dmg_resistance = enemyData.ice_dmg_resistance || 0;
    enemy.fire_dmg_resistance = enemyData.fire_dmg_resistance || 0;
    enemy.electric_dmg_resistance = enemyData.electric_dmg_resistance || 0;
    enemy.physical_dmg_resistance = enemyData.physical_dmg_resistance || 0;
    enemy.ether_dmg_resistance = enemyData.ether_dmg_resistance || 0;

    // 异常抗性
    enemy.ice_anomaly_resistance = enemyData.ice_anomaly_resistance || 0;
    enemy.fire_anomaly_resistance = enemyData.fire_anomaly_resistance || 0;
    enemy.electric_anomaly_resistance = enemyData.electric_anomaly_resistance || 0;
    enemy.physical_anomaly_resistance = enemyData.physical_anomaly_resistance || 0;
    enemy.ether_anomaly_resistance = enemyData.ether_anomaly_resistance || 0;

    // 失衡抗性
    enemy.ice_stun_resistance = enemyData.ice_stun_resistance || 0;
    enemy.fire_stun_resistance = enemyData.fire_stun_resistance || 0;
    enemy.electric_stun_resistance = enemyData.electric_stun_resistance || 0;
    enemy.physical_stun_resistance = enemyData.physical_stun_resistance || 0;
    enemy.ether_stun_resistance = enemyData.ether_stun_resistance || 0;

    // 异常条ID
    enemy.ice_anomaly_bar = enemyData.ice_anomaly_bar || '';
    enemy.fire_anomaly_bar = enemyData.fire_anomaly_bar || '';
    enemy.electric_anomaly_bar = enemyData.electric_anomaly_bar || '';
    enemy.physical_anomaly_bar = enemyData.physical_anomaly_bar || '';
    enemy.ether_anomaly_bar = enemyData.ether_anomaly_bar || '';

    // 其他属性
    enemy.crit_dmg = enemyData.crit_dmg || 0;
    enemy.chain_attack_count = enemyData.chain_attack_count || 0;
    enemy.base_poise_level = enemyData.base_poise_level || 0;
    enemy.freeze_time_resistance = enemyData.freeze_time_resistance || 0;
    enemy.base_buildup_coefficient = enemyData.base_buildup_coefficient || 0;

    return enemy;
  }

  /**
   * 获取指定元素的伤害抗性
   *
   * @param element 元素类型（"ice", "fire", "electric", "physical", "ether"）
   * @returns 伤害抗性值
   */
  getDmgResistance(element: string): number {
    const resistanceMap: Record<string, number> = {
      ice: this.ice_dmg_resistance,
      fire: this.fire_dmg_resistance,
      electric: this.electric_dmg_resistance,
      physical: this.physical_dmg_resistance,
      ether: this.ether_dmg_resistance,
    };
    return resistanceMap[element.toLowerCase()] || 0;
  }

  /**
   * 获取指定元素的异常抗性
   */
  getAnomalyResistance(element: string): number {
    const resistanceMap: Record<string, number> = {
      ice: this.ice_anomaly_resistance,
      fire: this.fire_anomaly_resistance,
      electric: this.electric_anomaly_resistance,
      physical: this.physical_anomaly_resistance,
      ether: this.ether_anomaly_resistance,
    };
    return resistanceMap[element.toLowerCase()] || 0;
  }

  /**
   * 获取指定元素的失衡抗性
   */
  getStunResistance(element: string): number {
    const resistanceMap: Record<string, number> = {
      ice: this.ice_stun_resistance,
      fire: this.fire_stun_resistance,
      electric: this.electric_stun_resistance,
      physical: this.physical_stun_resistance,
      ether: this.ether_stun_resistance,
    };
    return resistanceMap[element.toLowerCase()] || 0;
  }

  /**
   * 是否为首领
   */
  get isBoss(): boolean {
    return this.tags.includes('首领') || this.tags.toLowerCase().includes('boss');
  }

  /**
   * 是否为精英
   */
  get isElite(): boolean {
    return this.tags.includes('精英') || this.tags.toLowerCase().includes('elite');
  }

  /**
   * 获取敌人战斗属性
   *
   * @param level 等级（默认60）
   * @param isStunned 是否已失衡
   * @returns EnemyStats对象
   */
  getCombatStats(level: number = 60, isStunned: boolean = false): EnemyStats {
    return new EnemyStats(
      this.hp,
      this.defense,
      level,
      this.stun_max,
      this.can_stun,
      this.stun_vulnerability_multiplier,
      isStunned,
      {
        ice: this.ice_dmg_resistance,
        fire: this.fire_dmg_resistance,
        electric: this.electric_dmg_resistance,
        physical: this.physical_dmg_resistance,
        ether: this.ether_dmg_resistance,
      },
      {
        ice: 600.0,
        fire: 600.0,
        electric: 600.0,
        physical: 720.0,
        ether: 600.0,
      }
    );
  }

  /**
   * 格式化输出敌人信息
   */
  format(level: number = 60, indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    lines.push(`${prefix}【敌人信息】`);
    lines.push(`  ${prefix}名称: ${this.full_name}`);
    if (this.code_name) {
      lines.push(`  ${prefix}代号: ${this.code_name}`);
    }
    lines.push(`  ${prefix}等级: Lv.${level}`);

    // 标签信息
    if (this.tags) {
      const tagList: string[] = [];
      if (this.isBoss) {
        tagList.push('首领');
      } else if (this.isElite) {
        tagList.push('精英');
      }
      if (tagList.length > 0) {
        lines.push(`  ${prefix}标签: ${tagList.join(', ')}`);
      }
    }

    // 基础属性
    lines.push(`${prefix}【基础属性】`);
    lines.push(`  ${prefix}生命值: ${this.hp.toFixed(0)}`);
    lines.push(`  ${prefix}攻击力: ${this.atk.toFixed(0)}`);
    lines.push(`  ${prefix}防御力: ${this.defense.toFixed(0)}`);

    // 失衡属性
    if (this.can_stun) {
      lines.push(`${prefix}【失衡属性】`);
      lines.push(`  ${prefix}失衡值上限: ${this.stun_max.toFixed(0)}`);
      lines.push(
        `  ${prefix}失衡易伤倍率: ${(this.stun_vulnerability_multiplier * 100).toFixed(1)}%`
      );
    } else {
      lines.push(`${prefix}【失衡属性】`);
      lines.push(`  ${prefix}无法失衡`);
    }

    // 伤害抗性
    const dmgResistances: Array<[string, number]> = [];
    if (this.ice_dmg_resistance !== 0) {
      dmgResistances.push(['冰', this.ice_dmg_resistance]);
    }
    if (this.fire_dmg_resistance !== 0) {
      dmgResistances.push(['火', this.fire_dmg_resistance]);
    }
    if (this.electric_dmg_resistance !== 0) {
      dmgResistances.push(['电', this.electric_dmg_resistance]);
    }
    if (this.physical_dmg_resistance !== 0) {
      dmgResistances.push(['物理', this.physical_dmg_resistance]);
    }
    if (this.ether_dmg_resistance !== 0) {
      dmgResistances.push(['以太', this.ether_dmg_resistance]);
    }

    if (dmgResistances.length > 0) {
      lines.push(`${prefix}【伤害抗性】`);
      for (const [element, resistance] of dmgResistances) {
        const sign = resistance >= 0 ? '+' : '';
        lines.push(`  ${prefix}${element}: ${sign}${(resistance * 100).toFixed(1)}%`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * 敌人战斗属性
 */
export class EnemyStats {
  hp: number;
  defense: number;
  level: number;
  stun_max: number;
  can_stun: boolean;
  stun_vulnerability: number;
  is_stunned: boolean;
  has_corruption_shield: boolean;
  element_resistances: Record<string, number>;
  anomaly_thresholds: Record<string, number>;

  constructor(
    hp: number,
    defense: number,
    level: number,
    stunMax: number,
    canStun: boolean,
    stunVulnerability: number,
    isStunned: boolean,
    elementResistances: Record<string, number>,
    anomalyThresholds: Record<string, number>,
    hasCorruptionShield: boolean = false
  ) {
    this.hp = hp;
    this.defense = defense;
    this.level = level;
    this.stun_max = stunMax;
    this.can_stun = canStun;
    this.stun_vulnerability = stunVulnerability;
    this.is_stunned = isStunned;
    this.has_corruption_shield = hasCorruptionShield;
    this.element_resistances = elementResistances;
    this.anomaly_thresholds = anomalyThresholds;
  }

  /**
   * 获取指定元素的伤害抗性
   */
  getResistance(element: string): number {
    return this.element_resistances[element.toLowerCase()] || 0;
  }

  /**
   * 获取指定元素的异常阈值
   */
  getAnomalyThreshold(element: string): number {
    return this.anomaly_thresholds[element.toLowerCase()] || 600;
  }
}
