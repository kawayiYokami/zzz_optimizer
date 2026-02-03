/**
 * 战场服务
 *
 * 管理战斗场景，计算技能伤害
 */

import type { Agent } from '../model/agent';
import type { Enemy } from '../model/enemy';
import { Buff, BuffSource, BuffTarget } from '../model/buff';
import { Team } from '../model/team';
import { PropertyCollection } from '../model/property-collection';
import { PropertyType, ElementType, WeaponType, getPropertyCnName } from '../model/base';
import type { ZodBattleData } from '../model/save-data-zod';
import type { WEngine } from '../model/wengine';
import type { DriveDisk } from '../model/drive-disk';
import { OptimizerContext } from '../optimizer/services/optimizer-context';
import { optimizerService } from '../optimizer/services/optimizer.service';

/**
 * 技能伤害参数（用于 DamageCalculator / Worker 口径）
 *
 * 说明：BattleService 已不再负责具体伤害计算，但该类型仍会被其他模块复用。
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
 * 完整伤害计算结果（旧 UI/调用方可能引用）
 */
export interface TotalDamageResult {
  directDamage: number;
  anomalyDamage: number;
  disorderDamage: number;
  specialAnomalyDamage: number;
  totalDamage: number;
  triggerExpectation: number;
  anomalyThreshold: number;
  workerResult?: import('../optimizer/types/precomputed').OptimizationBuildResult;
}

export interface DisorderTimeParams {
  durationSec: number;
  timepointSec: number;
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

export interface BuffInfo {
  id: string;
  name: string;
  description: string;
  context: string;
  stats: Record<string, number>;
  target: any;
  isActive: boolean; // 是否激活
  isToggleable: boolean; // 是否可开关
  conversion?: {
    from_property: string;
    to_property: string;
    conversion_ratio: number;
    max_value?: number;
    from_property_threshold?: number;
  } | null;
}

export interface EquipmentDetail {
  type: 'wengine' | 'drive_disk' | 'set_bonus';
  stats: PropertyCollection;
  rawData?: any; // 原始数据
  name?: string; // 名称
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

  // 目标技能 (Skill Name + Segment Index)
  private targetSkills: Set<string> = new Set();

  // 当前选中的技能（用于UI展示）
  private selectedSkill: string = '';

  // 敌人状态
  private isEnemyStunned: boolean = false;
  private enemyHasCorruptionShield: boolean = false;

  constructor() {
    // 初始化
  }

  /**
   * 差值同步 Buff 开关状态：
   * - 保留既有 buffId 的 isActive
   * - 新出现的 buffId 默认 isActive=true
   * - 消失的 buffId 从 map 移除（避免无限增长）
   */
  private syncBuffStatusMap(candidateBuffs: Buff[]): void {
    const nextIds = new Set(candidateBuffs.map(b => b.id));

    // 删除不存在的
    for (const buffId of Array.from(this.buffStatusMap.keys())) {
      if (!nextIds.has(buffId)) this.buffStatusMap.delete(buffId);
    }

    // 补齐新增的（默认开启）
    for (const buff of candidateBuffs) {
      if (!this.buffStatusMap.has(buff.id)) {
        const isToggleable = true; // 默认可开关；需要更严格规则可复用 isBuffToggleable
        this.buffStatusMap.set(buff.id, { buffId: buff.id, isActive: true, isToggleable });
      }
    }
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
          activeBuffs: [],
          timestamp: Date.now()
        };
      }

      // 步骤2：更新所有相关的buff效果
      // 清空角色 buff 列表，但不直接清空 buffStatusMap（需要差值同步）
      this.characterBuffs = [];

      // 设置新队伍
      this.team = team;

      // 清除属性缓存
      this.clearPropertyCache();

      // 确保角色与装备详情已加载（惰性实例化场景）
      await Promise.all(
        this.team.allAgents.map(async (agent) => {
          await agent.ensureDetailsLoaded();
          await agent.ensureEquippedDetailsLoaded();
        })
      );

      // 加载新队伍的buff
      await this.loadBuffsFromAllAgentsAsync();

      // 差值同步开关状态（包括角色 buff + 手动 buff）
      this.syncBuffStatusMap(this.getAllBuffs());

      // 步骤3：生成并保存更新后的最终属性快照
      this.finalPropertySnapshot = {
        teamId: this.team.id,
        teamName: this.team.name,
        frontAgentId: this.team.frontAgent.id,
        frontAgentName: this.team.frontAgent.name_cn,
        mergedProperties: this.mergeCombatProperties(),
        finalStats: this.convertToFinalStats(),
        activeBuffs: [],
        timestamp: Date.now()
      };

      // 验证激活buff数量一致性
      // legacy: activeBuffs 仅用于旧调试快照，已废弃

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

    // 不筛选，直接添加所有buff
    for (const buff of allBuffs) {
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
    // 清空角色buff列表
    this.characterBuffs = [];
  }

  /**
   * 清空所有手动Buff
   */
  clearManualBuffs(): void {
    // 清空手动buff列表
    this.manualBuffs = [];
  }

  /**
   * 清空所有Buff
   */
  clearBuffs(): void {
    this.characterBuffs = [];
    this.manualBuffs = [];
    // buffStatusMap 是“玩家选择状态”的唯一真相，不应随清空 buff 列表而清空。
    // 允许保留开关状态，等下次同步候选列表时做差值收敛。
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
   * 获取所有 Buff 列表（不含开关语义，仅用于同步/初始化）
   */
  getAllBuffs(): Buff[] {
    return [...this.characterBuffs, ...this.manualBuffs];
  }

  /**
   * 获取“优化器战斗配置卡片”的 Buff 列表（唯一口径）
   *
   * 规则（你确认的口径）：
   * - 自身来源：保留对自己生效 或 对敌人生效
   * - 队友来源：保留对队友生效 或 对敌人生效
   *
   * 注意：这里只负责“配置列表口径”，不负责最终是否启用（启用由 buffStatusMap 控制）。
   */
  getOptimizerConfigBuffs(options?: { includeFourPiece?: boolean }): { self: Buff[]; teammate: Buff[] } {
    // 优化器口径：四件套由“目标套装”强制管理，不进入可选 Buff 列表
    const includeFourPiece = options?.includeFourPiece ?? false;

    if (!this.team || !this.team.frontAgent) {
      return { self: [...this.manualBuffs], teammate: [] };
    }

    // 自身 buff：从前台角色取（包含角色/音擎/驱动盘），并按 target_self || target_enemy 过滤
    const allSelf = this.team.frontAgent.getAllBuffsSync();
    // (debug logs removed)
    const combinedSelf = [...allSelf, ...this.manualBuffs];
    const self = combinedSelf.filter(buff => {
      if (this.manualBuffs.includes(buff)) return true;
      return buff.target.target_self || buff.target.target_enemy;
    })
      // Step 2: 去掉四件套（可选）
      .filter(buff => includeFourPiece || buff.source !== BuffSource.DRIVE_DISK_4PC);

    // 队友 buff：从队伍内其它角色取，按 target_teammate || target_enemy 过滤
    const teammate: Buff[] = [];
    const agents = [
      ...this.team.backAgents,
    ].filter(Boolean);

    for (const agent of agents) {
      if (!agent) continue;
      const buffs = agent.getAllBuffsSync();
      for (const buff of buffs) {
        if (!(buff.target.target_teammate || buff.target.target_enemy)) continue;
        // Step 2: 去掉四件套（可选）
        if (!includeFourPiece && buff.source === BuffSource.DRIVE_DISK_4PC) continue;

        // Step 3: 队友转换类替换为普通 buff（基于队友快照1结算）
        if (buff.conversion) {
          const converted = this.convertTeammateConversionBuffToNormalBuff(agent, buff);
          if (converted) teammate.push(converted);
          continue;
        }

        teammate.push(buff);
      }
    }

    return { self, teammate };
  }

  /**
   * 获取“优化器配置层”的已选中 Buff（用于 UI 高亮/已激活列表）
   * - 只按 buffStatusMap 过滤
   * - 不做四件套过滤、不做队友转换替换（这些属于计算口径）
   */
  getOptimizerConfigActiveBuffs(options?: { includeFourPiece?: boolean }): { self: Buff[]; teammate: Buff[] } {
    const { self, teammate } = this.getOptimizerConfigBuffs(options);
    const isActive = (buffId: string) => this.buffStatusMap.get(buffId)?.isActive === true;
    return {
      self: self.filter(b => isActive(b.id)),
      teammate: teammate.filter(b => isActive(b.id)),
    };
  }

  /**
   * 获取“优化器计算层”最终使用的 Buff（用于 OptimizerContext/Worker）
   *
   * 规则（你确认的口径）：
   * 1) 只按 buffStatusMap 过滤（玩家选中）
   * 2) 去掉四件套普通 Buff（4pc 由目标套装机制统一处理）
   * 3) 队友转换类 Buff：基于队友快照1结算为普通 Buff（替换）
   */
  getOptimizerEvaluatorBuffs(): { self: Buff[]; teammate: Buff[] } {
    const isActive = (buffId: string) => this.buffStatusMap.get(buffId)?.isActive === true;
    const { self, teammate } = this.getOptimizerConfigBuffs({ includeFourPiece: true });

    const isFrontRupture = this.team?.frontAgent?.weapon_type === WeaponType.RUPTURE;

    const selfFiltered = self
      .filter(b => isActive(b.id))
      // 命破：worker 会在快照3阶段“额外追加”贯穿值（不覆盖），因此：
      // - 仅对【前台角色自己的】“to=贯穿值”的转换类 buff 做过滤，避免重复计算
      // - 队友/手动的“贯穿值来源”应保留（例如辅助加贯穿）
      .filter(b => !(isFrontRupture && b.conversion?.to_property === PropertyType.SHEER_FORCE))
      .filter(b => b.source !== BuffSource.DRIVE_DISK_4PC);

    const teammateFiltered: Buff[] = [];
    for (const buff of teammate) {
      if (!isActive(buff.id)) continue;
      if (buff.source === BuffSource.DRIVE_DISK_4PC) continue;
      // teammate 列表可能已经包含“队友转换替换”的普通 buff；这里再保险处理一次
      if (buff.conversion) {
        // 理论上 teammate 列表里不应存在 conversion（getOptimizerConfigBuffs 已替换），但保持防御性
        continue;
      }
      teammateFiltered.push(buff);
    }

    return { self: selfFiltered, teammate: teammateFiltered };
  }

  /**
   * 将“队友提供的转换类 Buff”基于队友快照1结算，并降级为普通 Buff。
   *
   * 说明：
   * - 使用 teammate.getSelfProperties().toCombatStats() 作为队友快照1（局内基础面板）
   * - 只将结算后的结果写入 in_combat_stats（固定值）
   * - 保留原 Buff 的开关状态/来源/目标等信息，但移除 conversion 规则
   */
  private convertTeammateConversionBuffToNormalBuff(teammate: Agent, buff: Buff): Buff | null {
    if (!buff.conversion) return null;

    // 1) 基于队友快照1拿“源属性值”
    const teammateSnapshot1 = teammate.getSelfProperties().toCombatStats();
    const fromProp = buff.conversion.from_property;
    const toProp = buff.conversion.to_property;
    const threshold = buff.conversion.from_property_threshold ?? 0;

    // PropertyCollection 快照1：从 in_combat 读取即可
    const sourceValue = teammateSnapshot1.getInCombat(fromProp, 0);
    const effectiveValue = Math.max(0, sourceValue - threshold);

    // 2) 计算转换产物并应用上限
    const ratio = buff.conversion.conversion_ratio;
    let convertedValue = effectiveValue * ratio;
    const maxValue = buff.conversion.max_value;
    if (maxValue !== undefined && maxValue !== null) {
      convertedValue = Math.min(convertedValue, maxValue);
    }

    if (!convertedValue) return null;

    // 3) 生成普通 Buff：把产物写入 in_combat_stats
    const inCombat = new Map(buff.in_combat_stats);
    inCombat.set(toProp, (inCombat.get(toProp) ?? 0) + convertedValue);

    const outOfCombat = new Map(buff.out_of_combat_stats);

    const target = Object.assign(new (BuffTarget as any)(), buff.target);

    return new Buff(
      buff.source,           // source
      inCombat,              // inCombatStats
      outOfCombat,           // outOfCombatStats
      undefined,             // conversion (已结算，移除)
      target,                // target
      buff.max_stacks,       // maxStacks
      buff.stack_mode,       // stackMode
      buff.id,               // id
      `${buff.name}（队友结算）`, // name
      buff.description,      // description
      buff.trigger_conditions // triggerConditions
    );
  }

  // getOptimizerAllBuffs removed: use getOptimizerConfigBuffs() return values directly

  /**
   * 获取装备详情
   * @param agentId 角色ID
   * @param wengines 音擎列表
   * @param driveDisks 驱动盘列表
   */
  getEquipmentDetails(agentId: string, wengines: WEngine[], driveDisks: DriveDisk[]): EquipmentDetail[] {
    if (!this.team) return [];

    // 查找角色
    const agent = this.team.allAgents.find(a => a.id === agentId);
    if (!agent) return [];

    const details: EquipmentDetail[] = [];

    // 1. 获取音擎属性
    if (agent.equipped_wengine) {
      const wengine = wengines.find(w => w.id === agent.equipped_wengine);
      if (wengine) {
        const wengineStats = wengine.getStatsAtLevel(wengine.level, wengine.breakthrough);
        details.push({
          type: 'wengine',
          stats: wengineStats,
          rawData: wengine,
          name: wengine.name
        });
      }
    }

    // 2. 获取驱动盘属性
    const equippedDisks = agent.equipped_drive_disks
      .map(diskId => diskId ? driveDisks.find(d => d.id === diskId) : null)
      .filter((d): d is DriveDisk => !!d);

    for (const disk of equippedDisks) {
      const diskStats = disk.getStats();
      details.push({
        type: 'drive_disk',
        stats: diskStats,
        rawData: disk,
        name: disk.set_name
      });
    }

    // 3. 计算套装效果（2件套）
    if (equippedDisks.length > 0) {
      const setCounts: Record<string, number> = {};
      for (const disk of equippedDisks) {
        if (disk.set_name) {
          setCounts[disk.set_name] = (setCounts[disk.set_name] || 0) + 1;
        }
      }

      const processedSets = new Set<string>();
      for (const disk of equippedDisks) {
        if (!disk.set_name) continue;
        if (processedSets.has(disk.set_name)) continue;
        processedSets.add(disk.set_name);

        const count = setCounts[disk.set_name] || 0;
        if (count >= 2 && disk.set_properties.length > 0) {
          for (const buff of disk.set_properties) {
            details.push({
              type: 'set_bonus',
              stats: buff.toPropertyCollection(),
              name: `${disk.set_name} 2件套属性`
            });
          }
        }
      }
    }

    return details;
  }

  /**
   * 获取目标技能列表
   */
  getTargetSkills(): string[] {
    return Array.from(this.targetSkills);
  }

  /**
   * 切换目标技能选中状态
   */
  toggleTargetSkill(skillId: string): void {
    if (this.targetSkills.has(skillId)) {
      this.targetSkills.delete(skillId);
    } else {
      this.targetSkills.add(skillId);
    }
  }

  /**
   * 设置目标技能列表
   */
  setTargetSkills(skillIds: string[]): void {
    this.targetSkills = new Set(skillIds);
  }

  /**
   * 清空目标技能
   */
  clearTargetSkills(): void {
    this.targetSkills.clear();
  }

  /**
   * 设置当前选中的技能
   */
  setSelectedSkill(skill: string): void {
    this.selectedSkill = skill;
  }

  /**
   * 获取当前选中的技能
   */
  getSelectedSkill(): string {
    return this.selectedSkill;
  }

  /**
   * 根据状态名称更新状态
   * 兼容旧代码的过渡方法，推荐使用 setEnemyStatus
   */
  updateEnemyStatus(key: 'stun' | 'shield', value: boolean): void {
    if (key === 'stun') {
      this.isEnemyStunned = value;
    } else if (key === 'shield') {
      this.enemyHasCorruptionShield = value;
    }
  }

  setEnemyStatus(isStunned: boolean, hasCorruptionShield: boolean): void {
    this.isEnemyStunned = isStunned;
    this.enemyHasCorruptionShield = hasCorruptionShield;
  }

  getIsEnemyStunned(): boolean {
    // 叶瞬光：强制视为失衡
    const isYeShunGuang = this.team?.frontAgent?.name_cn === '叶瞬光';
    return isYeShunGuang ? true : this.isEnemyStunned;
  }

  getEnemyHasCorruptionShield(): boolean {
    return this.enemyHasCorruptionShield;
  }

  /**
   * 获取“带战斗环境修正”的敌人战斗属性
   *
   * - 失衡：由 EnemyStats 内部根据 isStunned 处理失衡易伤乘区
   * - 秽盾：防御翻倍（仅影响 EnemyStats.defense）
   */
  getEnemyCombatStats(level: number = 60): import('../model/enemy').EnemyStats | null {
    if (!this.enemy) return null;
    const stats = this.enemy.getCombatStats(level, this.getIsEnemyStunned());
    if (this.enemyHasCorruptionShield) {
      stats.defense *= 2;
    }
    return stats;
  }

  /**
   * 获取优化器/Worker 使用的敌人序列化数据（由 BattleService 统一控制口径）
   *
   * 口径：
   * - def: 基于 getEnemyCombatStats(level) 的最终防御（包含秽盾翻倍）
   * - isStunned / stunVulnerability: 基于 BattleService 的失衡开关
   */
  getSerializedEnemy(level: number = 60): import('../optimizer/types').SerializedEnemy | null {
    if (!this.enemy) return null;
    const stats = this.getEnemyCombatStats(level);
    if (!stats) return null;

    return {
      level,
      def: stats.defense,
      resistance: {
        ice: this.enemy.ice_dmg_resistance,
        fire: this.enemy.fire_dmg_resistance,
        electric: this.enemy.electric_dmg_resistance,
        physical: this.enemy.physical_dmg_resistance,
        ether: this.enemy.ether_dmg_resistance,
      },
      isStunned: this.getIsEnemyStunned(),
      stunVulnerability: this.getStunVulnerabilityMultiplier(),
    };
  }

  /**
   * 最终失衡易伤乘区（已包含开关 & 角色特殊机制）
   *
   * - 默认：非失衡 => 1.0；失衡 => 1 + enemy.stun_vulnerability_multiplier
   * - 叶瞬光：强制视为失衡，且上限 2.1
   */
  getStunVulnerabilityMultiplier(): number {
    if (!this.enemy) return 1.0;

    const baseMult = 1 + (this.enemy.stun_vulnerability_multiplier ?? 0);

    // 叶瞬光：强制失衡 + 上限 2.1
    const isYeShunGuang = this.team?.frontAgent?.name_cn === '叶瞬光';
    if (isYeShunGuang) return Math.min(2.1, Math.max(1.0, baseMult));

    if (!this.isEnemyStunned) return 1.0;
    return Math.max(1.0, baseMult);
  }

  // 旧版接口：伤害计算已移除（统一由 Worker / evaluator 口径负责）
  calculateTotalDamage(): never {
    throw new Error('BattleService.calculateTotalDamage 已废弃：伤害计算已迁移到 Worker 口径');
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
    const conversionBuffs = buffs.filter(b => b.isConversion() && b.conversion?.to_property !== PropertyType.SHEER_FORCE);

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
    // legacy: BattleService 内部的“activeBuffs 口径”已废弃（容易与优化器/配置层混淆）。
    // 当前战斗/优化计算应统一通过 getOptimizerEvaluatorBuffs() 产生的 Buff 列表驱动。
    const mergedProperties = this.applyBuffs([], combatStats);

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
      active_buff_count: 0,
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
      lines.push(`${prefix}【Buff】(${allBuffs.length}个)`);

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
   * 获取所有 Buff 信息列表（包含开关状态）
   */
  getBuffInfos(): BuffInfo[] {
    return this.getAllBuffs().map(buff => {
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
   * 序列化为ZOD数据
   */
  toZod(id: string, name: string): ZodBattleData {
    if (!this.team) {
      throw new Error('无法保存：未设置队伍');
    }
    if (!this.enemy) {
      throw new Error('无法保存：未设置敌人');
    }

    // 构建Buff状态字典
    const activeBuffs: Record<string, boolean> = {};
    for (const [buffId, status] of this.buffStatusMap.entries()) {
      activeBuffs[buffId] = status.isActive;
    }

    // 序列化手动Buff
    // 注意：这里需要确保Buff对象可以序列化，这里暂时只保存核心信息
    // 实际项目中可能需要完善Buff的序列化逻辑
    const simplifiedManualBuffs = this.manualBuffs.map(buff => ({
      ...buff,
      // 如果buff有复杂对象引用，可能需要处理
    }));

    return {
      id,
      name,
      teamId: this.team.id,
      enemyId: this.enemy.id,
      enemyStatus: {
        isStunned: this.isEnemyStunned,
        hasCorruptionShield: this.enemyHasCorruptionShield
      },
      activeBuffs: activeBuffs,
      manualBuffs: this.manualBuffs.map(b => b.toDict()),
      targetSkills: Array.from(this.targetSkills), // 序列化目标技能
      selectedSkill: this.selectedSkill
    };
  }

  /**
   * 从ZOD数据加载状态
   */
  async loadFromZod(data: ZodBattleData, team: Team, enemy: Enemy): Promise<void> {
    // 1. 设置基本实体
    await this.setTeam(team);
    this.setEnemy(enemy);

    // 恢复敌人状态
    if (data.enemyStatus) {
      this.isEnemyStunned = data.enemyStatus.isStunned;
      this.enemyHasCorruptionShield = data.enemyStatus.hasCorruptionShield;
    }

    // 2. 恢复手动Buff (必须在恢复开关状态之前)
    if (data.manualBuffs && Array.isArray(data.manualBuffs)) {
      // 清除现有的手动buff
      this.clearManualBuffs();

      // 重新添加保存的手动buff
      // 注意：这里假设ManualBuff可以直接反序列化，实际上可能需要Buff类的静态方法支持
      for (const buffData of data.manualBuffs) {
        const buff = Buff.fromDict(buffData);
        this.addManualBuff(buff);
      }
    }

    // 3. 恢复Buff开关状态
    if (data.activeBuffs) {
      for (const [buffId, isActive] of Object.entries(data.activeBuffs)) {
        // 更新状态
        const currentStatus = this.buffStatusMap.get(buffId);
        if (currentStatus) {
          this.updateBuffStatus(buffId, isActive);
        }
      }
    }

    // 4. 恢复目标技能
    if (data.targetSkills) {
      this.setTargetSkills(data.targetSkills);
    } else {
      this.clearTargetSkills();
    }

    // 5. 恢复选中的技能
    if (data.selectedSkill) {
      this.selectedSkill = data.selectedSkill;
    }

    // 6. 计算最终属性
    this.clearPropertyCache();
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

  // 伤害计算逻辑已迁移到 Worker / DamageCalculator 管线，BattleService 不再负责计算口径。
}
