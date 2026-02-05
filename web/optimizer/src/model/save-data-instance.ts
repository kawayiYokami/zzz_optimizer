/**
 * 存档数据模型
 */

import { Agent } from './agent';
import { DriveDisk } from './drive-disk';
import { WEngine } from './wengine';
import { Team } from './team';
import { PropertyType, Rarity } from './base';
import type { dataLoaderService } from '../services/data-loader.service';
import type { SaveDataZod, ZodCharacterData, ZodDiscData, ZodWengineData, ZodTeamData, ZodBattleData } from './save-data-zod';
import { zodParserService } from '../services/zod-parser.service';

/**
 * 单个存档数据
 *
 * ⚠️ 重要架构说明：
 * 存档中只存储玩家拥有的物品实例和状态信息：
 * - 角色：等级、突破、影画、技能等级、装备关系
 * - 驱动盘：等级、主副词条强化次数、装备关系
 * - 音擎：等级、精炼、突破、装备关系
 *
 * 所有游戏基础数据（角色基础属性、音擎基础攻击力、驱动盘套装效果等）
 * 都需要从游戏数据文件（character.json, weapon.json, equipment.json）中读取！
 *
 * 存档不应该包含完整的游戏数据，只记录"玩家有什么"和"状态如何"。
 *
 * ⚠️ 实例对象 vs 存档的区别：
 * - 存档（SaveData）：持久化数据，存储在localStorage中，是数据的"真相"
 * - 实例对象（Agent、WEngine、DriveDisk）：从存档中生成的运行时对象，用于计算
 * - 实例对象包含计算缓存（self_properties、base_stats等），不是存档本身
 * - 实例对象是从存档数据生成的，用于运行时计算，不应该持久化
 *
 * 数据流：
 * 1. 存档（原始ZOD格式） → localStorage（持久化）
 * 2. localStorage → 存档（SaveData.fromZod） → 实例对象（运行时计算）
 * 3. 实例对象（计算用） → 不持久化，从存档重新生成
 *
 * ID分配规则：
 * - 角色：10001, 10002, 10003...
 * - 驱动盘：20001, 20002, 20003...
 * - 音擎：30001, 30002, 30003...
 */
export class SaveData {
  name: string; // 存档名称
  created_at: Date;
  updated_at: Date;

  // 数据存储（字典键就是实例ID）
  agents: Map<string, Agent>;
  drive_disks: Map<string, DriveDisk>;
  wengines: Map<string, WEngine>;
  teams: Map<string, ZodTeamData>; // 原始ZOD队伍数据
  teamsMap: Map<string, Team>; // 队伍实例映射
  battles: Map<string, ZodBattleData>;

  // 元数据：ID分配信息
  _metadata: {
    next_agent_id: number;
    next_drive_disk_id: number;
    next_wengine_id: number;
    next_team_id: number;
    next_battle_id: number;
  };

  // ZOD元信息（用于保持导入/导出的字段一致）
  private zodMetadata: {
    format: string;
    dbVersion: number;
    source: string;
    version: number;
  };

  private zodCharacterKeyMap: Map<string, string>;
  private zodCharacterPotentialMap: Map<string, number>;
  private zodWengineKeyMap: Map<string, string>;
  private zodWengineLockMap: Map<string, boolean>;
  private zodWenginePhaseMap: Map<string, number>;
  private zodDriveDiskKeyMap: Map<string, string>;
  private zodDriveDiskTrashMap: Map<string, boolean>;

  // 缓存管理
  private _cache: Map<string, any>;
  private _isCacheValid: boolean;
  private _cachedAgentList: Agent[] | null = null;
  private _cachedDriveDiskList: DriveDisk[] | null = null;
  private _cachedWEngineList: WEngine[] | null = null;

  constructor(name: string) {
    this.name = name;
    this.created_at = new Date();
    this.updated_at = new Date();
    this.agents = new Map();
    this.drive_disks = new Map();
    this.wengines = new Map();
    this.teams = new Map();
    this.teamsMap = new Map();
    this.battles = new Map();
    this._metadata = {
      next_agent_id: 10001,
      next_drive_disk_id: 20001,
      next_wengine_id: 30001,
      next_team_id: 40001,
      next_battle_id: 50001,
    };
    this.zodMetadata = {
      format: 'ZOD',
      dbVersion: 2,
      source: 'zzz-optimizer',
      version: 1,
    };
    this.zodCharacterKeyMap = new Map();
    this.zodCharacterPotentialMap = new Map();
    this.zodWengineKeyMap = new Map();
    this.zodWengineLockMap = new Map();
    this.zodWenginePhaseMap = new Map();
    this.zodDriveDiskKeyMap = new Map();
    this.zodDriveDiskTrashMap = new Map();
    this._cache = new Map();
    this._isCacheValid = false;
  }

  /**
   * 使缓存失效
   */
  private _invalidateCache(): void {
    this._cache.clear();
    this._isCacheValid = false;
    this._cachedAgentList = null;
    this._cachedDriveDiskList = null;
    this._cachedWEngineList = null;
  }
  
  /**
   * 更新所有角色的装备引用
   * 
   * 当装备集合（驱动盘或音擎）发生变化时调用，确保所有角色都能访问到最新的装备数据
   */
  private _updateAllAgentsEquipmentReferences(): void {
    for (const agent of this.getAllAgents()) {
      agent.setEquipmentReferences(this.wengines, this.drive_disks);
    }
  }

  /**
   * 获取缓存值（带缓存机制）
   */
  private _getCachedValue<T>(key: string, computeFn: () => T): T {
    if (!this._isCacheValid || !this._cache.has(key)) {
      const value = computeFn();
      this._cache.set(key, value);
      this._isCacheValid = true;
      return value;
    }
    return this._cache.get(key) as T;
  }

  /**
   * 序列化为字典
   */
  toDict(): any {
    return {
      name: this.name,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString(),
      agents: Object.fromEntries(
        Array.from(this.agents.entries()).map(([k, v]) => [k, this._agentToDict(v)])
      ),
      drive_disks: Object.fromEntries(
        Array.from(this.drive_disks.entries()).map(([k, v]) => [k, this._diskToDict(v)])
      ),
      wengines: Object.fromEntries(
        Array.from(this.wengines.entries()).map(([k, v]) => [k, this._wengineToDict(v)])
      ),
      teams: Object.fromEntries(this.teams.entries()),
      battles: Object.fromEntries(this.battles.entries()),
      _metadata: this._metadata,
    };
  }

  /**
   * 设置ZOD元数据
   */
  setZodMetadata(meta: SaveDataZod): void {
    this.zodMetadata = {
      format: meta.format ?? 'ZOD',
      dbVersion: meta.dbVersion ?? 2,
      source: meta.source ?? 'zzz-optimizer',
      version: meta.version ?? 1,
    };
    if (meta.created_at) {
      this.created_at = new Date(meta.created_at);
    }
    if (meta.updated_at) {
      this.updated_at = new Date(meta.updated_at);
    }
  }

  registerZodCharacterMetadata(data: ZodCharacterData): void {
    this.zodCharacterKeyMap.set(data.id, data.key);
    this.zodCharacterPotentialMap.set(data.id, data.potential ?? 0);
  }

  registerZodWengineMetadata(data: ZodWengineData): void {
    this.zodWengineKeyMap.set(data.id, data.key);
    if (typeof data.lock === 'boolean') {
      this.zodWengineLockMap.set(data.id, data.lock);
    }
    if (typeof data.phase === 'number') {
      this.zodWenginePhaseMap.set(data.id, data.phase);
    } else if (typeof data.promotion === 'number') {
      this.zodWenginePhaseMap.set(data.id, data.promotion);
    }
  }

  registerZodDriveDiskMetadata(data: ZodDiscData): void {
    this.zodDriveDiskKeyMap.set(data.id, data.setKey);
    this.zodDriveDiskTrashMap.set(data.id, data.trash ?? false);
  }

  /**
   * 转换为ZOD格式的数据
   */
  toZodData(): SaveDataZod {
    const zodData: SaveDataZod = {
      format: this.zodMetadata.format,
      dbVersion: this.zodMetadata.dbVersion,
      source: this.zodMetadata.source,
      version: this.zodMetadata.version,
      name: this.name,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString(),
      characters: [],
      wengines: [],
      discs: [],
      teams: Array.from(this.teams.values()),
      battles: Array.from(this.battles.values()),
    };

    for (const agent of this.getAllAgents()) {
      zodData.characters.push(this._agentToZod(agent));
    }

    for (const wengine of this.getAllWEngines()) {
      zodData.wengines.push(this._wengineToZod(wengine));
    }

    for (const disk of this.getAllDriveDisks()) {
      zodData.discs.push(this._driveDiskToZod(disk));
    }

    return zodData;
  }

  /**
   * 角色序列化（只序列化实例特有数据）
   */
  private _agentToDict(agent: Agent): any {
    return agent.toDict();
  }

  private _agentToZod(agent: Agent): ZodCharacterData {
    const discs: Record<string, string> = {
      '1': agent.equipped_drive_disks[0] ?? '',
      '2': agent.equipped_drive_disks[1] ?? '',
      '3': agent.equipped_drive_disks[2] ?? '',
      '4': agent.equipped_drive_disks[3] ?? '',
      '5': agent.equipped_drive_disks[4] ?? '',
      '6': agent.equipped_drive_disks[5] ?? '',
    };

    return {
      key: this.zodCharacterKeyMap.get(agent.id) ?? agent.game_id,
      id: agent.id,
      level: agent.level,
      core: agent.core_skill,
      mindscape: agent.cinema,
      dodge: agent.skills.dodge,
      basic: agent.skills.normal,
      chain: agent.skills.chain,
      special: agent.skills.special,
      assist: agent.skills.assist,
      promotion: agent.breakthrough,
      potential: this.zodCharacterPotentialMap.get(agent.id) ?? 0,
      equippedDiscs: discs,
      equippedWengine: agent.equipped_wengine ?? '',
    };
  }

  /**
   * 驱动盘序列化（只序列化实例特有数据）
   */
  private _diskToDict(disk: DriveDisk): any {
    return disk.toDict();
  }

  private _driveDiskToZod(disk: DriveDisk): ZodDiscData {
    const substats: ZodDiscData['substats'] = [];
    for (const [prop, statValue] of disk.sub_stats.entries()) {
      substats.push({
        key: this._propertyTypeToZodKey(prop),
        upgrades: Number(statValue.value) ?? 0,
      });
    }

    return {
      setKey: (this.zodDriveDiskKeyMap.get(disk.id) ?? disk.set_name) || disk.game_id,
      rarity: Rarity[disk.rarity],
      level: disk.level,
      slotKey: disk.position.toString(),
      mainStatKey: this._propertyTypeToZodKey(disk.main_stat),
      substats,
      location: disk.equipped_agent ?? '',
      lock: disk.locked,
      trash: this.zodDriveDiskTrashMap.get(disk.id) ?? false,
      id: disk.id,
    };
  }

  /**
   * 音擎序列化（只序列化实例特有数据）
   *
   * ⚠️ 不序列化游戏基础数据（base_atk、rand_stat、level_data等）
   * 这些需要从 weapon.json 读取。
   */
  private _wengineToDict(wengine: WEngine): any {
    return wengine.toDict();
  }

  private _wengineToZod(wengine: WEngine): ZodWengineData {

  

      const base: ZodWengineData = {

        key: this.zodWengineKeyMap.get(wengine.id) ?? wengine.wengine_id,

        id: wengine.id,

        level: wengine.level,

        modification: wengine.refinement,

        promotion: wengine.breakthrough,

        location: wengine.equipped_agent ?? '',

      };

  

      const phase = this.zodWenginePhaseMap.get(wengine.id);

      if (phase !== undefined) {

        base.phase = phase;

      }

      if (this.zodWengineLockMap.has(wengine.id)) {

        base.lock = this.zodWengineLockMap.get(wengine.id);

      }

  

      return base;

    }

  private _propertyTypeToZodKey(prop: PropertyType): string {
    switch (prop) {
      case PropertyType.HP:
        return 'hp';
      case PropertyType.HP_:
        return 'hp_';
      case PropertyType.ATK:
        return 'atk';
      case PropertyType.ATK_:
        return 'atk_';
      case PropertyType.DEF:
        return 'def';
      case PropertyType.DEF_:
        return 'def_';
      case PropertyType.CRIT_:
        return 'crit_';
      case PropertyType.CRIT_DMG_:
        return 'crit_dmg_';
      case PropertyType.PEN:
        return 'pen';
      case PropertyType.PEN_:
        return 'pen_';
      case PropertyType.ANOM_PROF:
        return 'anomProf';
      case PropertyType.ANOM_MAS:
      case PropertyType.ANOM_MAS_:
        return 'anomMas_';
      case PropertyType.IMPACT:
        return 'impact';
      case PropertyType.IMPACT_:
        return 'impact_';
      case PropertyType.ENER_REGEN:
      case PropertyType.ENER_REGEN_:
        return 'energyRegen_';
      case PropertyType.PHYSICAL_DMG_:
        return 'physical_dmg_';
      case PropertyType.FIRE_DMG_:
        return 'fire_dmg_';
      case PropertyType.ICE_DMG_:
        return 'ice_dmg_';
      case PropertyType.ELECTRIC_DMG_:
        return 'electric_dmg_';
      case PropertyType.ETHER_DMG_:
        return 'ether_dmg_';
      default:
        return PropertyType[prop] ?? 'hp';
    }
  }



  /**
   * 从ZOD数据创建存档
   */
  static async fromZod(
    name: string,
    zodData: SaveDataZod,
    dataLoader: typeof dataLoaderService
  ): Promise<SaveData> {
    const save = new SaveData(name);
    save.setZodMetadata(zodData);

    const characterLookup = new Map<string, ZodCharacterData>();
    const discLookup = new Map<string, ZodDiscData>();
    const wengineLookup = new Map<string, ZodWengineData>();

    (zodData.characters ?? []).forEach((char) => characterLookup.set(char.id, char));
    (zodData.discs ?? []).forEach((disc) => discLookup.set(disc.id, disc));
    (zodData.wengines ?? []).forEach((wengine) => wengineLookup.set(wengine.id, wengine));

    const parsed = await zodParserService.parseZodData(zodData);

    // 先添加所有装备和驱动盘
    for (const disk of parsed.driveDisks.values()) {
      save.addDriveDisk(disk);
      const zodDisk = discLookup.get(disk.id);
      if (zodDisk) {
        save.registerZodDriveDiskMetadata(zodDisk);
      }
    }

    for (const wengine of parsed.wengines.values()) {
      save.addWEngine(wengine);
      const zodWengine = wengineLookup.get(wengine.id);
      if (zodWengine) {
        save.registerZodWengineMetadata(zodWengine);
      }
    }

    // 然后添加角色，并设置装备集合引用
    for (const agent of parsed.agents.values()) {
      save.addAgent(agent);
      const zodChar = characterLookup.get(agent.id);
      if (zodChar) {
        save.registerZodCharacterMetadata(zodChar);
      }
      // 设置装备集合引用，让角色可以访问装备属性
      agent.setEquipmentReferences(save.wengines, save.drive_disks);
    }

    // 添加队伍数据
    (zodData.teams ?? []).forEach((team) => {
      try {
        save.addTeam(team);
      } catch (error) {
        console.warn(`忽略无效队伍数据 [${team.id ?? 'unknown'}]:`, error);
      }
    });

    // 添加战场数据
    (zodData.battles ?? []).forEach((battle) => {
      save.addBattle(battle);
    });

    return save;
  }

  /**
   * 获取下一个角色ID
   */
  getNextAgentId(): string {
    const id = this._metadata.next_agent_id.toString();
    this._metadata.next_agent_id++;
    return id;
  }

  /**
   * 获取下一个驱动盘ID
   */
  getNextDriveDiskId(): string {
    const id = this._metadata.next_drive_disk_id.toString();
    this._metadata.next_drive_disk_id++;
    return id;
  }

  /**
   * 获取下一个音擎ID
   */
  getNextWEngineId(): string {
    const id = this._metadata.next_wengine_id.toString();
    this._metadata.next_wengine_id++;
    return id;
  }

  /**
   * 获取下一个队伍ID
   */
  getNextTeamId(): string {
    const id = this._metadata.next_team_id.toString();
    this._metadata.next_team_id++;
    return id;
  }

  /**
   * 获取下一个战场ID
   */
  getNextBattleId(): string {
    const id = this._metadata.next_battle_id.toString();
    this._metadata.next_battle_id++;
    return id;
  }

  /**
   * 添加角色
   */
  addAgent(agent: Agent): void {
    if (!agent.id) {
      agent.id = this.getNextAgentId();
    }
    this.agents.set(agent.id, agent);
    if (!this.zodCharacterKeyMap.has(agent.id)) {
      this.zodCharacterKeyMap.set(agent.id, agent.game_id);
    }
    if (!this.zodCharacterPotentialMap.has(agent.id)) {
      this.zodCharacterPotentialMap.set(agent.id, 0);
    }
    this.updated_at = new Date();
    // 触发缓存失效
    this._invalidateCache();
  }

  /**
   * 更新角色
   */
  updateAgent(agentId: string, updates: Partial<Agent>): void {
    const agent = this.getAgent(agentId);
    if (agent) {
      Object.assign(agent, updates);
      this.updated_at = new Date();
      // 触发缓存失效
      this._invalidateCache();
    }
  }

  /**
   * 添加驱动盘
   */
  addDriveDisk(disk: DriveDisk): void {
    if (!disk.id) {
      disk.id = this.getNextDriveDiskId();
    }
    this.drive_disks.set(disk.id, disk);
    if (!this.zodDriveDiskKeyMap.has(disk.id)) {
      this.zodDriveDiskKeyMap.set(disk.id, disk.game_id);
    }
    if (!this.zodDriveDiskTrashMap.has(disk.id)) {
      this.zodDriveDiskTrashMap.set(disk.id, false);
    }
    this.updated_at = new Date();
    // 触发缓存失效
    this._invalidateCache();
    // 更新所有角色的装备引用
    this._updateAllAgentsEquipmentReferences();
  }

  /**
   * 更新驱动盘
   */
  updateDriveDisk(diskId: string, updates: Partial<DriveDisk>): void {
    const disk = this.getDriveDisk(diskId);
    if (disk) {
      Object.assign(disk, updates);
      this.updated_at = new Date();
      // 触发缓存失效
      this._invalidateCache();
      // 更新所有角色的装备引用
      this._updateAllAgentsEquipmentReferences();
    }
  }

  /**
   * 添加音擎
   */
  addWEngine(wengine: WEngine): void {
    if (!wengine.id) {
      wengine.id = this.getNextWEngineId();
    }
    this.wengines.set(wengine.id, wengine);
    if (!this.zodWengineKeyMap.has(wengine.id)) {
      this.zodWengineKeyMap.set(wengine.id, wengine.wengine_id);
    }
    if (!this.zodWengineLockMap.has(wengine.id)) {
      this.zodWengineLockMap.set(wengine.id, false);
    }
    if (!this.zodWenginePhaseMap.has(wengine.id)) {
      this.zodWenginePhaseMap.set(wengine.id, wengine.breakthrough);
    }
    this.updated_at = new Date();
    // 触发缓存失效
    this._invalidateCache();
    // 更新所有角色的装备引用
    this._updateAllAgentsEquipmentReferences();
  }

  /**
   * 更新音擎
   */
  updateWEngine(wengineId: string, updates: Partial<WEngine>): void {
    const wengine = this.getWEngine(wengineId);
    if (wengine) {
      Object.assign(wengine, updates);
      this.updated_at = new Date();
      // 触发缓存失效
      this._invalidateCache();
      // 更新所有角色的装备引用
      this._updateAllAgentsEquipmentReferences();
    }
  }

  /**
   * 删除角色
   */
  removeAgent(agentId: string): boolean {
    const result = this.agents.delete(agentId);
    if (result) {
      this.zodCharacterKeyMap.delete(agentId);
      this.zodCharacterPotentialMap.delete(agentId);
      this.updated_at = new Date();
      // 触发缓存失效
      this._invalidateCache();
    }
    return result;
  }

  /**
   * 删除驱动盘
   */
  removeDriveDisk(diskId: string): boolean {
    const result = this.drive_disks.delete(diskId);
    if (result) {
      this.zodDriveDiskKeyMap.delete(diskId);
      this.zodDriveDiskTrashMap.delete(diskId);
      this.updated_at = new Date();
      // 触发缓存失效
      this._invalidateCache();
      // 更新所有角色的装备引用
      this._updateAllAgentsEquipmentReferences();
    }
    return result;
  }

  /**
   * 删除音擎
   */
  removeWEngine(wengineId: string): boolean {
    const result = this.wengines.delete(wengineId);
    if (result) {
      this.zodWengineKeyMap.delete(wengineId);
      this.zodWengineLockMap.delete(wengineId);
      this.zodWenginePhaseMap.delete(wengineId);
      this.updated_at = new Date();
      // 触发缓存失效
      this._invalidateCache();
      // 更新所有角色的装备引用
      this._updateAllAgentsEquipmentReferences();
    }
    return result;
  }

  /**
   * 获取角色
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 获取驱动盘
   */
  getDriveDisk(diskId: string): DriveDisk | undefined {
    return this.drive_disks.get(diskId);
  }

  /**
   * 获取音擎
   */
  getWEngine(wengineId: string): WEngine | undefined {
    return this.wengines.get(wengineId);
  }

  /**
   * 获取所有角色
   */
  getAllAgents(): Agent[] {
    if (!this._cachedAgentList) {
      this._cachedAgentList = Array.from(this.agents.values());
    }
    return this._cachedAgentList;
  }

  /**
   * 获取所有驱动盘
   */
  getAllDriveDisks(): DriveDisk[] {
    if (!this._cachedDriveDiskList) {
      this._cachedDriveDiskList = Array.from(this.drive_disks.values());
    }
    return this._cachedDriveDiskList;
  }

  /**
   * 获取所有音擎
   */
  getAllWEngines(): WEngine[] {
    if (!this._cachedWEngineList) {
      this._cachedWEngineList = Array.from(this.wengines.values());
    }
    return this._cachedWEngineList;
  }

  /**
   * 添加队伍
   */
  addTeam(team: ZodTeamData): void {
    if (!team.id) {
      team.id = this.getNextTeamId();
    }

    // 先验证并创建 Team 实例；失败则不落盘到 teams，避免产生“有队伍但实例为空”的状态
    const teamInstance = Team.fromZod(team, this.agents);

    this.teams.set(team.id, team);
    this.teamsMap.set(team.id, teamInstance);
    this.updated_at = new Date();
    this._invalidateCache();
  }

  /**
   * 删除队伍
   */
  deleteTeam(teamId: string): void {
    this.teams.delete(teamId);
    // 删除关联的Team实例
    this.teamsMap.delete(teamId);
    // 删除关联的战场数据
    for (const [battleId, battle] of this.battles.entries()) {
      if (battle.teamId === teamId) {
        this.battles.delete(battleId);
      }
    }
    this.updated_at = new Date();
    this._invalidateCache();
  }

  /**
   * 获取队伍
   */
  getTeam(teamId: string): ZodTeamData | undefined {
    return this.teams.get(teamId);
  }

  /**
   * 获取队伍实例
   */
  getTeamInstance(teamId: string): Team | undefined {
    return this.teamsMap.get(teamId);
  }

  /**
   * 获取所有队伍
   */
  getAllTeams(): ZodTeamData[] {
    return Array.from(this.teams.values());
  }

  /**
   * 获取所有队伍实例
   */
  getAllTeamInstances(): Team[] {
    return Array.from(this.teamsMap.values());
  }

  /**
   * 更新队伍
   * 原子化方法，同时更新ZodTeamData和Team实例
   */
  updateTeam(teamId: string, updates: Partial<ZodTeamData>): void {
    const existingTeam = this.teams.get(teamId);
    if (!existingTeam) {
      throw new Error(`队伍 ${teamId} 不存在`);
    }
    
    const updatedTeam = { ...existingTeam, ...updates };

    // 原子化：只有当新的 Team 实例可构造时才提交更新
    const newTeamInstance = Team.fromZod(updatedTeam, this.agents);

    this.teams.set(teamId, updatedTeam);
    this.teamsMap.set(teamId, newTeamInstance);
    this.updated_at = new Date();
    this._invalidateCache();
  }

  /**
   * 添加战场数据
   */
  addBattle(battle: ZodBattleData): void {
    if (!battle.id) {
      battle.id = this.getNextBattleId();
    }
    this.battles.set(battle.id, battle);
    this.updated_at = new Date();
    this._invalidateCache();
  }

  /**
   * 删除战场数据
   */
  deleteBattle(battleId: string): void {
    this.battles.delete(battleId);
    this.updated_at = new Date();
    this._invalidateCache();
  }

  /**
   * 获取战场数据
   */
  getBattle(battleId: string): ZodBattleData | undefined {
    return this.battles.get(battleId);
  }

  /**
   * 获取所有战场数据
   */
  getAllBattles(): ZodBattleData[] {
    return Array.from(this.battles.values());
  }
}
