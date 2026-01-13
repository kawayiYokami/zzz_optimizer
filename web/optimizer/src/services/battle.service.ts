/**
 * 战场服务
 *
 * 管理战斗场景，计算技能伤害
 */

import type { Agent } from '../model/agent';
import type { Enemy } from '../model/enemy';
import type { Buff } from '../model/buff';
import { Team } from '../model/team';
import { DamageCalculatorService } from './damage-calculator.service';
import { PropertyCollection } from '../model/property-collection';
import { PropertyType, ElementType } from '../model/base';
import { RatioSet } from '../model/ratio-set';

/**
 * 技能伤害参数
 */
export interface SkillDamageParams {
  damage_ratio: number;
  element?: string;
  anomaly_buildup?: number;
  anomaly_ratio?: number;
  is_penetration?: boolean;
  distance?: number;
}

/**
 * 完整伤害计算结果
 */
export interface TotalDamageResult {
  directDamage: number;         // 直伤/贯穿期望
  anomalyDamage: number;        // 异常持续伤害期望
  disorderDamage: number;       // 紊乱伤害期望 (450%)
  specialAnomalyDamage: number; // 特殊异常伤害（烈霜等）
  totalDamage: number;          // 总伤害期望
  triggerExpectation: number;   // 异常触发期望
}

/**
 * Buff状态管理
 */
export interface BuffStatus {
  buffId: string;
  isActive: boolean;      // 开关状态，默认打开
  isToggleable: boolean;  // 可开关性
}

/**
 * 战斗状态快照
 */
export interface BattleStateSnapshot {
  teamId: string;
  teamName: string;
  frontAgentId: string;
  frontAgentName: string;
  mergedProperties: PropertyCollection;
  finalStats: Map<PropertyType, number>;
  activeBuffs: Buff[];
  timestamp: number;
}

/**
 * Buff信息结构（用于UI显示）
 */
export interface BuffInfo {
  id: string;
  name: string;
  description: string;
  context: string;
  stats: Record<string, number>;
  target: any;
  isActive: boolean; // 是否激活
  isToggleable: boolean; // 是否可开关
}

/**
 * 战场服务
 *
 * 管理战斗场景，支持增量伤害计算
 */
export class BattleService {
  // 战斗实体
  private team: Team | null = null;
  private enemy: Enemy | null = null;
  private characterBuffs: Buff[] = [];      // 角色获取的buff
  private manualBuffs: Buff[] = [];         // 手动添加的buff
  private buffStatusMap: Map<string, BuffStatus> = new Map(); // 包含可开关性的状态映射

  // 状态标记
  private isBattleStarted: boolean = false;
  private isBattlePaused: boolean = false;

  // 属性缓存
  private mergedInCombatProperties: PropertyCollection | null = null;
  private finalStats: Map<PropertyType, number> | null = null;

  // 战斗状态快照
  private currentSnapshot: BattleStateSnapshot | null = null;
  private finalPropertySnapshot: BattleStateSnapshot | null = null;

  constructor() {
    // 初始化
  }

  // ==================== 设置/变更方法 ====================

  /**
   * 设置队伍
   */
  async setTeam(team: Team): Promise<void> {
    if (!team) {
      throw new Error('队伍不能为空');
    }

    // 保存当前状态，用于回滚
    const previousTeam = this.team;
    const previousCharacterBuffs = [...this.characterBuffs];
    const previousBuffStatusMap = new Map(this.buffStatusMap);

    try {
      // 步骤1：更新当前持有的前台角色的战斗属性快照
      if (this.team) {
        this.currentSnapshot = {
          teamId: this.team.id,
          teamName: this.team.name,
          frontAgentId: this.team.frontAgent.id,
          frontAgentName: this.team.frontAgent.name_cn,
          mergedProperties: this.mergeCombatProperties(),
          finalStats: this.convertToFinalStats(),
          activeBuffs: this.getActiveBuffs(),
          timestamp: Date.now()
        };
      }

      // 步骤2：更新所有相关的buff效果
      // 清除当前角色buff和相关状态映射
      const characterBuffIds = new Set(this.characterBuffs.map(buff => buff.id));
      this.characterBuffs = [];
      characterBuffIds.forEach(buffId => {
        this.buffStatusMap.delete(buffId);
      });

      // 设置新队伍
      this.team = team;

      // 清除属性缓存
      this.clearPropertyCache();

      // 加载新队伍的buff
      await this.loadBuffsFromAllAgentsAsync();

      // 步骤3：生成并保存更新后的最终属性快照
      this.finalPropertySnapshot = {
        teamId: this.team.id,
        teamName: this.team.name,
        frontAgentId: this.team.frontAgent.id,
        frontAgentName: this.team.frontAgent.name_cn,
        mergedProperties: this.mergeCombatProperties(),
        finalStats: this.convertToFinalStats(),
        activeBuffs: this.getActiveBuffs(),
        timestamp: Date.now()
      };

      // 验证激活buff数量一致性
      const generatedActiveBuffs = this.getActiveBuffs();
      if (generatedActiveBuffs.length !== this.finalPropertySnapshot.activeBuffs.length) {
        throw new Error('激活buff数量不一致');
      }

    } catch (error) {
      console.error('队伍更换失败:', error);
      // 回滚到之前的状态
      this.team = previousTeam;
      this.characterBuffs = previousCharacterBuffs;
      this.buffStatusMap = previousBuffStatusMap;
      this.clearPropertyCache();
      throw error;
    }
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
      // 这里修改逻辑，先尝试将所有buff添加到characterBuffs中，不管target属性
      this.addCharacterBuff(buff, isOnField);
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

    // 不筛选，直接添加所有buff
    for (const buff of allBuffs) {
      this.addCharacterBuff(buff, isOnField);
    }
  }

  /**
   * 从所有角色加载Buff（异步版本）
   */
  async loadBuffsFromAllAgentsAsync(): Promise<void> {
    // 记录当前角色buff的ID，用于后续清除状态映射
    const characterBuffIds = new Set(this.characterBuffs.map(buff => buff.id));

    // 只清除角色buff，保留手动buff
    this.characterBuffs = [];

    // 清除相关状态映射
    characterBuffIds.forEach(buffId => {
      this.buffStatusMap.delete(buffId);
    });

    if (this.team) {
      // 加载前台角色Buff
      await this.loadBuffsFromAgentAsync(this.team.frontAgent, true);

      // 加载后台角色Buff
      for (const agent of this.team.backAgents) {
        await this.loadBuffsFromAgentAsync(agent, false);
      }
    }

    // 清除属性缓存
    this.clearPropertyCache();
  }

  /**
   * 从所有角色加载Buff（同步版本，仅用于已确认buff已加载的情况）
   */
  loadBuffsFromAllAgents(): void {
    // 记录当前角色buff的ID，用于后续清除状态映射
    const characterBuffIds = new Set(this.characterBuffs.map(buff => buff.id));

    // 只清除角色buff，保留手动buff
    this.characterBuffs = [];

    // 清除相关状态映射
    characterBuffIds.forEach(buffId => {
      this.buffStatusMap.delete(buffId);
    });

    if (this.team) {
      // 加载前台角色Buff
      this.loadBuffsFromAgent(this.team.frontAgent, true);

      // 加载后台角色Buff
      this.team.backAgents.forEach(agent => {
        this.loadBuffsFromAgent(agent, false);
      });
    }

    // 清除属性缓存
    this.clearPropertyCache();
  }

  /**
   * 计算Buff是否可开关
   * 规则：
   * - 能对敌人的buff，可开关
   * - 前台能对自己的buff，可开关
   * - 后台只对自身生效的buff，不可开关
   */
  private isBuffToggleable(buff: Buff, isOnField: boolean): boolean {
    // 检查buff是否能对敌人生效（暂时假设buff没有直接针对敌人的属性，所有buff都可以对敌人生效）
    // 后台只对自身生效的buff，不可开关
    if (!isOnField && buff.target.target_self && !buff.target.target_teammate) {
      return false;
    }
    // 其他情况可开关
    return true;
  }

  /**
   * 添加角色Buff
   */
  private addCharacterBuff(buff: Buff, isOnField: boolean): void {
    // 检查Buff是否已存在
    const existingIndex = this.characterBuffs.findIndex(b => b.id === buff.id);
    if (existingIndex === -1) {
      this.characterBuffs.push(buff);

      // 设置Buff状态，包括可开关性
      const isToggleable = this.isBuffToggleable(buff, isOnField);
      if (!this.buffStatusMap.has(buff.id)) {
        this.buffStatusMap.set(buff.id, {
          buffId: buff.id,
          isActive: true,      // 默认打开
          isToggleable: isToggleable
        });
      }
    }
  }

  /**
   * 添加手动Buff
   */
  addManualBuff(buff: Buff): void {
    // 检查Buff是否已存在
    const existingIndex = this.manualBuffs.findIndex(b => b.id === buff.id);
    if (existingIndex === -1) {
      this.manualBuffs.push(buff);
      // 手动添加的buff默认可开关
      if (!this.buffStatusMap.has(buff.id)) {
        this.buffStatusMap.set(buff.id, {
          buffId: buff.id,
          isActive: true,
          isToggleable: true
        });
      }
      // 清除属性缓存
      this.clearPropertyCache();
    }
  }

  /**
   * 兼容旧接口的添加Buff方法
   */
  addBuff(buff: Buff): void {
    this.addCharacterBuff(buff, true); // 默认视为前台角色的buff
  }

  /**
   * 删除指定ID的Buff
   */
  removeBuff(buffId: string): void {
    // 从角色buff列表中删除
    this.characterBuffs = this.characterBuffs.filter((b) => b.id !== buffId);
    // 从手动buff列表中删除
    this.manualBuffs = this.manualBuffs.filter((b) => b.id !== buffId);
    // 从状态映射中删除
    this.buffStatusMap.delete(buffId);
  }

  /**
   * 删除指定ID的手动Buff
   */
  removeManualBuff(buffId: string): void {
    // 只从手动buff列表中删除
    this.manualBuffs = this.manualBuffs.filter((b) => b.id !== buffId);
    // 从状态映射中删除
    this.buffStatusMap.delete(buffId);
  }

  /**
   * 清空所有角色Buff
   */
  clearCharacterBuffs(): void {
    // 清除相关状态映射
    this.characterBuffs.forEach(buff => {
      this.buffStatusMap.delete(buff.id);
    });
    // 清空角色buff列表
    this.characterBuffs = [];
  }

  /**
   * 清空所有手动Buff
   */
  clearManualBuffs(): void {
    // 清除相关状态映射
    this.manualBuffs.forEach(buff => {
      this.buffStatusMap.delete(buff.id);
    });
    // 清空手动buff列表
    this.manualBuffs = [];
  }

  /**
   * 清空所有Buff
   */
  clearBuffs(): void {
    this.characterBuffs = [];
    this.manualBuffs = [];
    this.buffStatusMap.clear();
  }

  /**
   * 更新Buff激活状态
   */
  updateBuffStatus(buffId: string, isActive: boolean): void {
    const status = this.buffStatusMap.get(buffId);
    if (status) {
      // 更新状态，保持可开关性不变
      this.buffStatusMap.set(buffId, {
        ...status,
        isActive
      });
      // 清除属性缓存
      this.clearPropertyCache();
    }
  }

  /**
   * 获取Buff完整状态（包含可开关性）
   */
  getBuffStatus(buffId: string): BuffStatus {
    return this.buffStatusMap.get(buffId) || {
      buffId,
      isActive: false,
      isToggleable: false
    };
  }

  /**
   * 获取Buff的可开关性
   */
  getBuffToggleable(buffId: string): boolean {
    return this.buffStatusMap.get(buffId)?.isToggleable || false;
  }

  /**
   * 获取Buff的开关状态
   */
  getBuffIsActive(buffId: string): boolean {
    return this.buffStatusMap.get(buffId)?.isActive || false;
  }

  /**
   * 获取当前激活的Buff列表
   */
  getActiveBuffs(): Buff[] {
    const allBuffs = [...this.characterBuffs, ...this.manualBuffs];
    return allBuffs.filter(buff => {
      const status = this.buffStatusMap.get(buff.id);
      return status?.isActive === true;
    });
  }

  /**
   * 获取所有Buff列表
   */
  getAllBuffs(): Buff[] {
    return [...this.characterBuffs, ...this.manualBuffs];
  }

  /**
   * 获取角色Buff列表
   */
  getCharacterBuffs(): Buff[] {
    return this.characterBuffs;
  }

  /**
   * 获取手动Buff列表
   */
  getManualBuffs(): Buff[] {
    return this.manualBuffs;
  }

  // ==================== 生命周期控制 ====================

  /**
   * 开始战斗
   */
  startBattle(): void {
    if (this.isBattleStarted) {
      return; // 已经开始了
    }

    if (!this.team) {
      throw new Error('请先设置队伍');
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
   * 批量应用buff到属性集
   *
   * @param buffs buff列表
   * @param props 输入属性集
   * @returns 应用后的属性集
   */
  applyBuffs(buffs: Buff[], props: PropertyCollection): PropertyCollection {
    const inCombatBuffs = buffs.filter(b => b.hasInCombatStats());
    const conversionBuffs = buffs.filter(b => b.isConversion());

    let result = props;
    for (const buff of inCombatBuffs) {
      result = buff.applyInCombatStats(result);
    }
    for (const buff of conversionBuffs) {
      result = buff.applyConversionStats(result);
    }
    return result;
  }

  /**
   * 合并前台角色和所有激活buff的属性，生成合并后的局内属性集
   *
   * @returns 合并后的局内属性集
   */
  mergeCombatProperties(): PropertyCollection {
    if (this.mergedInCombatProperties) {
      return this.mergedInCombatProperties;
    }

    if (!this.team) {
      throw new Error('请先设置队伍');
    }

    const combatStats = this.team.frontAgent.getCharacterCombatStats();
    const activeBuffs = this.getActiveBuffs();
    const mergedProperties = this.applyBuffs(activeBuffs, combatStats);

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
    has_team: boolean;
    has_enemy: boolean;
    character_buff_count: number;
    manual_buff_count: number;
    total_buff_count: number;
    active_buff_count: number;
    back_agent_count: number;
  } {
    return {
      is_battle_started: this.isBattleStarted,
      is_battle_paused: this.isBattlePaused,
      has_team: this.team !== null,
      has_enemy: this.enemy !== null,
      character_buff_count: this.characterBuffs.length,
      manual_buff_count: this.manualBuffs.length,
      total_buff_count: this.characterBuffs.length + this.manualBuffs.length,
      active_buff_count: this.getActiveBuffs().length,
      back_agent_count: this.team ? this.team.backAgents.length : 0,
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

    // 队伍信息
    if (this.team) {
      lines.push(`${prefix}【队伍】`);
      lines.push(`  ${prefix}前台角色: ${this.team.frontAgent.name_cn} Lv.${this.team.frontAgent.level} (M${this.team.frontAgent.cinema})`);

      if (this.team.backAgents.length > 0) {
        lines.push(`  ${prefix}后台角色:`);
        this.team.backAgents.forEach((agent, i) => {
          lines.push(`    ${prefix}${i + 1}. ${agent.name_cn} Lv.${agent.level}`);
        });
      }
    }

    // 敌人
    if (this.enemy) {
      lines.push(this.enemy.format(60, indent));
    }

    // Buff列表
    const allBuffs = [...this.characterBuffs, ...this.manualBuffs];
    if (allBuffs.length > 0) {
      lines.push(`${prefix}【Buff】(${allBuffs.length}个，激活${this.getActiveBuffs().length}个)`);

      // 角色Buff
      if (this.characterBuffs.length > 0) {
        lines.push(`${prefix}  【角色Buff】(${this.characterBuffs.length}个)`);
        this.characterBuffs.forEach((buff) => {
          const buffStatus = this.getBuffStatus(buff.id);
          const statusIcon = buffStatus.isActive ? '✓' : '✗';
          const toggleableText = buffStatus.isToggleable ? '' : ' (不可开关)';
          lines.push(`    ${prefix}${statusIcon} ${buff.name}${toggleableText}`);
        });
      }

      // 手动Buff
      if (this.manualBuffs.length > 0) {
        lines.push(`${prefix}  【手动Buff】(${this.manualBuffs.length}个)`);
        this.manualBuffs.forEach((buff) => {
          const buffStatus = this.getBuffStatus(buff.id);
          const statusIcon = buffStatus.isActive ? '✓' : '✗';
          lines.push(`    ${prefix}${statusIcon} ${buff.name}`);
        });
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取队伍实例
   */
  getTeam(): Team | null {
    return this.team;
  }

  /**
   * 获取前台角色
   */
  getFrontAgent(): Agent | null {
    return this.team ? this.team.frontAgent : null;
  }

  /**
   * 获取后台角色列表
   */
  getBackAgents(): Agent[] {
    return this.team ? this.team.backAgents : [];
  }

  /**
   * 获取敌人
   */
  getEnemy(): Enemy | null {
    return this.enemy;
  }

  /**
   * 获取所有Buff列表
   */
  getBuffs(): Buff[] {
    return [...this.characterBuffs, ...this.manualBuffs];
  }

  /**
   * 获取所有Buff信息列表（包含开关状态）
   */
  getBuffInfos(): BuffInfo[] {
    return this.getBuffs().map(buff => {
      // 获取buff状态
      const status = this.getBuffStatus(buff.id);
      
      // 合并局内和局外属性
      const stats: Record<string, number> = {};
      
      // 处理out_of_combat_stats
      if (buff.out_of_combat_stats instanceof Map) {
        for (const [key, value] of buff.out_of_combat_stats.entries()) {
          const propertyName = typeof key === 'number' ? PropertyType[key] : String(key);
          stats[propertyName] = value;
        }
      }
      
      // 处理in_combat_stats
      if (buff.in_combat_stats instanceof Map) {
        for (const [key, value] of buff.in_combat_stats.entries()) {
          const propertyName = typeof key === 'number' ? PropertyType[key] : String(key);
          stats[propertyName] = (stats[propertyName] || 0) + value;
        }
      }
      
      return {
        id: buff.id || '',
        name: buff.name || '',
        description: buff.description || '',
        context: 'in_combat',
        stats: stats,
        target: buff.target || {},
        isActive: status.isActive,
        isToggleable: status.isToggleable,
        conversion: buff.conversion ? {
          from_property: PropertyType[buff.conversion.from_property],
          to_property: PropertyType[buff.conversion.to_property],
          conversion_ratio: buff.conversion.conversion_ratio,
          max_value: buff.conversion.max_value,
          from_property_threshold: buff.conversion.from_property_threshold
        } : null
      };
    });
  }

  /**
   * 获取完整的Buff状态映射
   */
  getBuffStatusMap(): Map<string, BuffStatus> {
    return new Map(this.buffStatusMap);
  }

  /**
   * 获取简化的Buff开关状态映射
   */
  getBuffIsActiveMap(): Map<string, boolean> {
    const map = new Map<string, boolean>();
    this.buffStatusMap.forEach((status, buffId) => {
      map.set(buffId, status.isActive);
    });
    return map;
  }

  /**
   * 获取当前战斗状态快照
   */
  getCurrentSnapshot(): BattleStateSnapshot | null {
    return this.currentSnapshot;
  }

  /**
   * 获取最终属性快照
   */
  getFinalPropertySnapshot(): BattleStateSnapshot | null {
    return this.finalPropertySnapshot;
  }

  /**
   * 计算完整伤害期望
   * @param totalSkillRatio 技能总倍率
   * @param anomalyBuildup 异常积蓄系数
   */
  calculateTotalDamage(totalSkillRatio: number, anomalyBuildup: number): TotalDamageResult {
    if (!this.team || !this.enemy) {
      throw new Error('请先设置队伍和敌人');
    }

    const agent = this.team.frontAgent;
    const isPenetration = agent.isPenetrationAgent();
    const element = ElementType[agent.element].toLowerCase();
    
    // 获取乘区集合
    const props = this.mergeCombatProperties();
    const enemyStats = this.enemy.getCombatStats();
    const zones = DamageCalculatorService.updateAllZones(props, enemyStats, element);
    
    // 1. 计算直伤/贯穿伤害
    let directDamage = 0;
    if (isPenetration) {
      const ratios = new RatioSet();
      ratios.atk_ratio = totalSkillRatio;
      const result = DamageCalculatorService.calculatePenetrationDamage(zones, ratios);
      directDamage = result.damage_expected;
    } else {
      const ratios = new RatioSet();
      ratios.atk_ratio = totalSkillRatio;
      const result = DamageCalculatorService.calculateDirectDamageFromRatios(zones, ratios);
      directDamage = result.damage_expected;
    }
    
    // 2. 计算异常触发期望
    const triggerExpectation = this.calculateAnomalyTriggerExpectation(anomalyBuildup, element);
    
    // 3. 计算异常持续伤害
    const anomalyParams = DamageCalculatorService.getAnomalyDotParams(element);
    const anomalyRatios = new RatioSet();
    anomalyRatios.atk_ratio = anomalyParams.totalRatio;
    const anomalyResult = DamageCalculatorService.calculateAnomalyDamageFromZones(zones, anomalyRatios);
    const anomalyDamage = anomalyResult.damage_expected * triggerExpectation;
    
    // 4. 计算紊乱伤害 (450%)
    const disorderRatios = new RatioSet();
    disorderRatios.atk_ratio = 4.5;
    const disorderResult = DamageCalculatorService.calculateAnomalyDamageFromZones(zones, disorderRatios);
    const disorderDamage = disorderResult.damage_expected * triggerExpectation;
    
    // 5. 特殊异常伤害（星见雅烈霜 1500%）
    let specialAnomalyDamage = 0;
    const specialConfig = agent.getSpecialAnomalyConfig();
    if (specialConfig) {
      const specialRatios = new RatioSet();
      specialRatios.atk_ratio = specialConfig.ratio;
      const specialResult = DamageCalculatorService.calculateAnomalyDamageFromZones(zones, specialRatios);
      specialAnomalyDamage = specialResult.damage_expected * triggerExpectation;
    }
    
    return {
      directDamage,
      anomalyDamage,
      disorderDamage,
      specialAnomalyDamage,
      totalDamage: directDamage + anomalyDamage + disorderDamage + specialAnomalyDamage,
      triggerExpectation
    };
  }

  /**
   * 计算异常触发期望
   * 公式：异常积蓄 × (1 + buff效率) / 敌人异常条
   */
  calculateAnomalyTriggerExpectation(anomalyBuildup: number, element: string): number {
    if (!this.enemy) return 0;
    
    const props = this.mergeCombatProperties();
    // 使用伤害计算服务获取完整的乘区（包含属性积蓄效率和抗性）
    const zones = DamageCalculatorService.updateAllZones(props, this.enemy.getCombatStats(), element);
    const enemyThreshold = this.enemy.getCombatStats().getAnomalyThreshold(element);
    
    // zones.accumulate_zone 已经计算了 (1 + 效率) * (1 - 抗性)
    return anomalyBuildup * zones.accumulate_zone / enemyThreshold;
  }
}
