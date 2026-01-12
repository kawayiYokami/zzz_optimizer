/**
 * 战场服务
 *
 * 管理战斗场景，计算技能伤害
 */

import type { Agent } from '../model/agent';
import type { Enemy } from '../model/enemy';
import type { Buff } from '../model/buff';
import { DamageCalculatorService } from './damage-calculator.service';
import { PropertyCollection } from '../model/property-collection';
import { PropertyType } from '../model/base';

/**
 * 技能伤害参数
 */
export interface SkillDamageParams {
  damage_ratio: number; // 技能倍率
  element: string; // 元素类型
  is_penetration: boolean; // 是否贯穿伤害
  anomaly_buildup: number; // 异常积蓄值
}

/**
 * 伤害计算结果
 */
export interface DamageResult {
  normal_damage_no_crit: number; // 未暴击伤害
  normal_damage_crit: number; // 暴击伤害
  normal_damage_expected: number; // 期望伤害
  anomaly_damage_no_crit: number; // 异常未暴击伤害
  anomaly_damage_crit: number; // 异常暴击伤害
  anomaly_damage_expected: number; // 异常期望伤害
  total_damage_expected: number; // 总期望伤害
}

/**
 * Buff状态管理
 */
export interface BuffStatus {
  buffId: string;
  isActive: boolean;
}

/**
 * 战场服务
 *
 * 管理战斗场景，支持增量伤害计算
 */
export class BattleService {
  // 战斗实体
  private frontAgent: Agent | null = null;
  private backAgents: Agent[] = [];
  private enemy: Enemy | null = null;
  private buffs: Buff[] = [];
  private buffStatusMap: Map<string, boolean> = new Map();

  // 状态标记
  private isBattleStarted: boolean = false;
  private isBattlePaused: boolean = false;

  // 属性缓存
  private mergedInCombatProperties: PropertyCollection | null = null;
  private finalStats: Map<PropertyType, number> | null = null;

  constructor() {
    // 初始化
  }

  // ==================== 设置/变更方法 ====================

  /**
   * 设置前台角色
   */
  setFrontAgent(agent: Agent): void {
    this.frontAgent = agent;
    this.loadBuffsFromAgent(agent, true);
    // 清除属性缓存
    this.clearPropertyCache();
  }

  /**
   * 设置后台角色列表
   */
  setBackAgents(agents: Agent[]): void {
    this.backAgents = agents;
    this.backAgents.forEach(agent => {
      this.loadBuffsFromAgent(agent, false);
    });
    // 清除属性缓存
    this.clearPropertyCache();
  }

  /**
   * 设置敌人
   */
  setEnemy(enemy: Enemy): void {
    this.enemy = enemy;
  }

  /**
   * 从角色实例加载Buff（异步版本）
   * @param agent 角色实例
   * @param isOnField 是否在前台
   */
  async loadBuffsFromAgentAsync(agent: Agent, isOnField: boolean): Promise<void> {
    // 确保buff已经加载
    await agent.getAllBuffs();
    
    // 获取角色所有Buff
    const allBuffs = agent.getAllBuffsSync();
    
    // 根据角色位置筛选Buff
    for (const buff of allBuffs) {
      // 前台：只选择对自己生效的
      // 后台：只选择对队友或全体生效的
      const targetSelf = buff.target.target_self || false;
      const targetTeammate = buff.target.target_teammate || false;
      
      if (isOnField && targetSelf) {
        this.addBuff(buff);
      } else if (!isOnField && targetTeammate) {
        this.addBuff(buff);
      }
    }
  }

  /**
   * 从角色实例加载Buff（同步版本，仅用于已确认buff已加载的情况）
   * @param agent 角色实例
   * @param isOnField 是否在前台
   */
  loadBuffsFromAgent(agent: Agent, isOnField: boolean): void {
    // 获取角色所有Buff
    const allBuffs = agent.getAllBuffsSync();
    
    // 根据角色位置筛选Buff
    for (const buff of allBuffs) {
      // 前台：只选择对自己生效的
      // 后台：只选择对队友或全体生效的
      const targetSelf = buff.target.target_self || false;
      const targetTeammate = buff.target.target_teammate || false;
      
      if (isOnField && targetSelf) {
        this.addBuff(buff);
      } else if (!isOnField && targetTeammate) {
        this.addBuff(buff);
      }
    }
  }

  /**
   * 从所有角色加载Buff（异步版本）
   */
  async loadBuffsFromAllAgentsAsync(): Promise<void> {
    this.clearBuffs();
    
    if (this.frontAgent) {
      await this.loadBuffsFromAgentAsync(this.frontAgent, true);
    }
    
    for (const agent of this.backAgents) {
      await this.loadBuffsFromAgentAsync(agent, false);
    }
    
    // 清除属性缓存
    this.clearPropertyCache();
  }

  /**
   * 从所有角色加载Buff（同步版本，仅用于已确认buff已加载的情况）
   */
  loadBuffsFromAllAgents(): void {
    this.clearBuffs();
    
    if (this.frontAgent) {
      this.loadBuffsFromAgent(this.frontAgent, true);
    }
    
    this.backAgents.forEach(agent => {
      this.loadBuffsFromAgent(agent, false);
    });
    
    // 清除属性缓存
    this.clearPropertyCache();
  }

  /**
   * 添加Buff
   */
  addBuff(buff: Buff): void {
    // 检查Buff是否已存在
    const existingIndex = this.buffs.findIndex(b => b.id === buff.id);
    if (existingIndex === -1) {
      this.buffs.push(buff);
      // 默认激活所有新Buff
      if (!this.buffStatusMap.has(buff.id)) {
        this.buffStatusMap.set(buff.id, true);
      }
    }
  }

  /**
   * 删除指定ID的Buff
   */
  removeBuff(buffId: string): void {
    this.buffs = this.buffs.filter((b) => b.id !== buffId);
    this.buffStatusMap.delete(buffId);
  }

  /**
   * 清空所有Buff
   */
  clearBuffs(): void {
    this.buffs = [];
    this.buffStatusMap.clear();
  }

  /**
   * 更新Buff激活状态
   */
  updateBuffStatus(buffId: string, isActive: boolean): void {
    this.buffStatusMap.set(buffId, isActive);
    // 清除属性缓存
    this.clearPropertyCache();
  }

  /**
   * 获取当前激活的Buff列表
   */
  getActiveBuffs(): Buff[] {
    return this.buffs.filter(buff => this.buffStatusMap.get(buff.id) === true);
  }

  /**
   * 获取Buff状态
   */
  getBuffStatus(buffId: string): boolean {
    return this.buffStatusMap.get(buffId) || false;
  }

  // ==================== 生命周期控制 ====================

  /**
   * 开始战斗
   */
  startBattle(): void {
    if (this.isBattleStarted) {
      return; // 已经开始了
    }

    if (!this.frontAgent) {
      throw new Error('请先设置前台角色');
    }
    if (!this.enemy) {
      throw new Error('请先设置敌人');
    }

    this.isBattleStarted = true;
    this.isBattlePaused = false;
  }

  /**
   * 暂停战斗（停止计算，保留状态）
   */
  pauseBattle(): void {
    if (this.isBattleStarted) {
      this.isBattlePaused = true;
    }
  }

  /**
   * 继续战斗
   */
  resumeBattle(): void {
    if (this.isBattleStarted && this.isBattlePaused) {
      this.isBattlePaused = false;
    }
  }

  /**
   * 查询战斗是否进行中
   */
  isBattleActive(): boolean {
    return this.isBattleStarted && !this.isBattlePaused;
  }

  /**
   * 重置战斗状态（重新开始）
   */
  resetBattle(): void {
    this.isBattleStarted = false;
    this.isBattlePaused = false;
  }

  // ==================== 伤害计算 ====================

  /**
   * 计算技能伤害（直伤 + 异常伤害）
   *
   * @param skillDamageRatio 技能倍率
   * @param skillElement 技能元素类型
   * @param skillAnomalyBuildup 技能异常积蓄值
   * @param isPenetration 是否为贯穿伤害
   * @returns 伤害结果
   */
  calculateSkillDamage(
    skillDamageRatio: number,
    skillElement: string = 'physical',
    skillAnomalyBuildup: number = 0,
    isPenetration: boolean = false
  ): DamageResult {
    if (!this.isBattleStarted) {
      throw new Error('请先调用 startBattle()');
    }
    if (this.isBattlePaused) {
      throw new Error('战斗已暂停，请调用 resumeBattle()');
    }

    // 1. 获取角色战斗属性，考虑当前激活的Buff
    const activeBuffs = this.getActiveBuffs();
    const attacker = this.frontAgent!.getCombatStats(activeBuffs);

    // 2. 获取敌人战斗属性
    const enemy = this.enemy!.getCombatStats();

    // 3. 构建技能参数
    const skillParams: SkillDamageParams = {
      damage_ratio: skillDamageRatio,
      element: skillElement,
      is_penetration: isPenetration,
      anomaly_buildup: skillAnomalyBuildup,
    };

    // 4. 计算直接伤害（常规伤害）
    const directResult = DamageCalculatorService.calculateDirectDamage(
      attacker,
      enemy,
      skillParams,
      false // 计算期望值
    );

    // 5. 初始化异常伤害为0
    let anomaly_damage_no_crit = 0;
    let anomaly_damage_crit = 0;
    let anomaly_damage_expected = 0;

    // 6. 如果有异常积蓄值，计算异常伤害
    if (skillAnomalyBuildup > 0) {
      // 计算异常积蓄值
      const calculatedAnomalyBuildup = DamageCalculatorService.calculateAnomalyBuildup(
        attacker,
        enemy,
        skillParams
      );

      // 计算异常伤害（使用标准异常倍率，例如200%）
      const anomalyRatio = 2.0; // TODO: 从技能数据中获取具体的异常倍率
      const anomalyResult = DamageCalculatorService.calculateAnomalyDamage(
        attacker,
        enemy,
        anomalyRatio,
        calculatedAnomalyBuildup,
        skillElement,
        false
      );

      anomaly_damage_no_crit = anomalyResult.anomaly_damage_no_crit;
      anomaly_damage_crit = anomalyResult.anomaly_damage_crit;
      anomaly_damage_expected = anomalyResult.anomaly_damage_expected;
    }

    // 7. 组合结果
    const result: DamageResult = {
      normal_damage_no_crit: directResult.damage_no_crit,
      normal_damage_crit: directResult.damage_crit,
      normal_damage_expected: directResult.damage_expected,
      anomaly_damage_no_crit: anomaly_damage_no_crit,
      anomaly_damage_crit: anomaly_damage_crit,
      anomaly_damage_expected: anomaly_damage_expected,
      total_damage_expected: directResult.damage_expected + anomaly_damage_expected,
    };

    return result;
  }

  /**
   * 合并前台角色和所有激活buff的属性，生成合并后的局内属性集
   * 
   * @returns 合并后的局内属性集
   */
  mergeCombatProperties(): PropertyCollection {
    // 检查缓存是否有效
    if (this.mergedInCombatProperties) {
      return this.mergedInCombatProperties;
    }

    if (!this.frontAgent) {
      throw new Error('请先设置前台角色');
    }

    // 1. 获取角色+装备的战斗属性
    const combatStats = this.frontAgent.getCharacterCombatStats();

    // 2. 获取激活的buff列表
    const activeBuffs = this.getActiveBuffs();

    // 3. 合并buff属性到战斗属性中
    const mergedProperties = new PropertyCollection();
    mergedProperties.add(combatStats);

    // 4. 添加所有激活buff的属性
    for (const buff of activeBuffs) {
      const buffProps = buff.toPropertyCollection();
      mergedProperties.add(buffProps);
    }

    // 5. 缓存结果
    this.mergedInCombatProperties = mergedProperties;

    return mergedProperties;
  }

  /**
   * 将合并后的局内属性集转换为最终属性集
   * 
   * @returns 转换后的最终属性集
   */
  convertToFinalStats(): Map<PropertyType, number> {
    // 检查缓存是否有效
    if (this.finalStats) {
      return this.finalStats;
    }

    // 1. 获取合并后的局内属性
    const mergedProperties = this.mergeCombatProperties();

    // 2. 转换为最终属性
    const finalStats = mergedProperties.toFinalStats();

    // 3. 缓存结果
    this.finalStats = finalStats;

    return finalStats;
  }

  /**
   * 获取合并后的局内属性集（使用缓存）
   * 
   * @returns 合并后的局内属性集
   */
  getMergedInCombatProperties(): PropertyCollection {
    return this.mergedInCombatProperties || this.mergeCombatProperties();
  }

  /**
   * 获取最终属性集（使用缓存）
   * 
   * @returns 最终属性集
   */
  getFinalStats(): Map<PropertyType, number> {
    return this.finalStats || this.convertToFinalStats();
  }

  /**
   * 清除属性缓存
   */
  clearPropertyCache(): void {
    this.mergedInCombatProperties = null;
    this.finalStats = null;
  }

  /**
   * 获取当前战斗状态
   */
  getStatus(): {
    is_battle_started: boolean;
    is_battle_paused: boolean;
    has_agent: boolean;
    has_enemy: boolean;
    buff_count: number;
    active_buff_count: number;
    back_agent_count: number;
  } {
    return {
      is_battle_started: this.isBattleStarted,
      is_battle_paused: this.isBattlePaused,
      has_agent: this.frontAgent !== null,
      has_enemy: this.enemy !== null,
      buff_count: this.buffs.length,
      active_buff_count: this.getActiveBuffs().length,
      back_agent_count: this.backAgents.length,
    };
  }

  /**
   * 格式化输出战场服务信息
   */
  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    // 战斗状态
    lines.push(`${prefix}【战场服务】`);
    let status: string;
    if (this.isBattleStarted) {
      status = this.isBattlePaused ? '已暂停' : '进行中';
    } else {
      status = '未开始';
    }
    lines.push(`  ${prefix}状态: ${status}`);

    // 前台角色
    if (this.frontAgent) {
      lines.push(`${prefix}【前台角色】`);
      lines.push(
        `  ${prefix}${this.frontAgent.name_cn} Lv.${this.frontAgent.level} (M${this.frontAgent.cinema})`
      );
    }

    // 后台角色
    if (this.backAgents.length > 0) {
      lines.push(`${prefix}【后台角色】(${this.backAgents.length}个)`);
      this.backAgents.forEach((agent, i) => {
        lines.push(`  ${prefix}${i + 1}. ${agent.name_cn} Lv.${agent.level}`);
      });
    }

    // 敌人
    if (this.enemy) {
      lines.push(this.enemy.format(60, indent));
    }

    // Buff列表
    if (this.buffs.length > 0) {
      lines.push(`${prefix}【Buff】(${this.buffs.length}个，激活${this.getActiveBuffs().length}个)`);
      this.buffs.forEach((buff) => {
        const status = this.buffStatusMap.get(buff.id) ? '✓' : '✗';
        lines.push(`  ${prefix}${status} ${buff.name}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 获取前台角色
   */
  getFrontAgent(): Agent | null {
    return this.frontAgent;
  }

  /**
   * 获取后台角色列表
   */
  getBackAgents(): Agent[] {
    return this.backAgents;
  }

  /**
   * 获取敌人
   */
  getEnemy(): Enemy | null {
    return this.enemy;
  }

  /**
   * 获取Buff列表
   */
  getBuffs(): Buff[] {
    return this.buffs;
  }

  /**
   * 获取Buff状态映射
   */
  getBuffStatusMap(): Map<string, boolean> {
    return new Map(this.buffStatusMap);
  }
}
