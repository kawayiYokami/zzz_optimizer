/**
 * 数据加载服务
 *
 * 负责加载：
 * 1. 游戏数据（角色、驱动盘、音擎的基础数据）
 * 2. 个人数据（从导出的JSON文件加载）
 */

import type { AgentSkillSet, AgentSkill, AgentSkillSegment } from '../model/skill';

/**
 * 角色基础信息
 */
export interface CharacterInfo {
  id: string;
  code: string;
  rank: number;
  type: number;
  element: number;
  hit: number;
  camp: number;
  icon: string;
  potential: number;
  CHS: string;
  EN: string;
  JP: string;
  KR: string;
  [key: string]: any;
}

/**
 * 音擎基础信息
 */
export interface WeaponInfo {
  id: string;
  icon: string;
  rank: number;
  type: number;
  CHS: string;
  EN: string;
  JP: string;
  KR: string;
  [key: string]: any;
}

/**
 * 驱动盘套装基础信息
 */
export interface EquipmentInfo {
  id: string;
  icon: string;
  CHS: any;
  EN: any;
  JP: any;
  KR: any;
  [key: string]: any;
}

/**
 * 邦布基础信息
 */
export interface BangbooInfo {
  id: string;
  CHS: string;
  EN: string;
  base_hp: number;
  hp_growth: number;
  base_atk: number;
  atk_growth: number;
  impact: number;
  anomaly_mastery: number;
  base_def: number;
  def_growth: number;
  crit_rate: number;
  crit_dmg: number;
  level_60_hp: number;
  level_60_atk: number;
  level_60_def: number;
  [key: string]: any;
}

/**
 * 敌人基础信息
 */
export interface EnemyInfo {
  id: string;
  full_name: string;
  CHS: string;
  EN: string;
  code_name: string;
  index_id: string;
  hp: number;
  atk: number;
  defense: number;
  stun_max: number;
  can_stun: boolean;
  tags: string;
  ice_dmg_resistance: number;
  fire_dmg_resistance: number;
  electric_dmg_resistance: number;
  physical_dmg_resistance: number;
  ether_dmg_resistance: number;
  // 70级属性
  level_70_max_hp: number;
  level_70_max_atk: number;
  level_70_max_stun: number;
  level_60_plus_defense: number;
  [key: string]: any;
}

/**
 * 数据加载服务
 */
export class DataLoaderService {
  private static instance: DataLoaderService;

  // 游戏数据缓存
  private _characterData: Map<string, CharacterInfo> | null = null;
  private _equipmentData: Map<string, EquipmentInfo> | null = null;
  private _weaponData: Map<string, WeaponInfo> | null = null;
  private _bangbooData: Map<string, BangbooInfo> | null = null;
  private _enemyData: Map<string, EnemyInfo> | null = null;
  private _agentSkills: Map<string, AgentSkillSet> | null = null;

  // 详细数据缓存（按需加载）
  private _characterDetailCache: Map<string, any> = new Map();
  private _characterBuffCache: Map<string, any> = new Map();
  private _weaponDetailCache: Map<string, any> = new Map();
  private _weaponBuffCache: Map<string, any> = new Map();
  private _equipmentDetailCache: Map<string, any> = new Map();
  private _equipmentBuffCache: Map<string, any> = new Map();

  // 加载状态
  private _isLoading = false;
  private _isInitialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): DataLoaderService {
    if (!DataLoaderService.instance) {
      DataLoaderService.instance = new DataLoaderService();
    }
    return DataLoaderService.instance;
  }

  /**
   * 获取加载状态
   */
  get isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * 获取初始化状态
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * 获取角色数据
   */
  get characterData(): Map<string, CharacterInfo> | null {
    return this._characterData;
  }

  /**
   * 获取音擎数据
   */
  get weaponData(): Map<string, WeaponInfo> | null {
    return this._weaponData;
  }

  /**
   * 获取驱动盘数据
   */
  get equipmentData(): Map<string, EquipmentInfo> | null {
    return this._equipmentData;
  }

  /**
   * 获取邦布数据
   */
  get bangbooData(): Map<string, BangbooInfo> | null {
    return this._bangbooData;
  }

  /**
   * 获取敌人数据
   */
  get enemyData(): Map<string, EnemyInfo> | null {
    return this._enemyData;
  }

  /**
   * 获取技能数据
   */
  get agentSkills(): Map<string, AgentSkillSet> | null {
    return this._agentSkills;
  }

  /**
   * 初始化（加载索引文件）
   */
  async initialize(): Promise<void> {
    if (this._isLoading || this._isInitialized) {
      return;
    }

    this._isLoading = true;

    try {
      // 并行加载所有索引文件
      const [characterData, weaponData, equipmentData, bangbooData, enemyData] = await Promise.all([
        this.loadJsonFile<CharacterInfo>('/game-data/character.json'),
        this.loadJsonFile<WeaponInfo>('/game-data/weapon.json'),
        this.loadJsonFile<EquipmentInfo>('/game-data/equipment.json'),
        this.loadJsonFile<BangbooInfo>('/game-data/bangboo.json'),
        this.loadJsonFile<EnemyInfo>('/game-data/enemy.json'),
      ]);

      // 转换为Map
      this._characterData = new Map(Object.entries(characterData));
      this._weaponData = new Map(Object.entries(weaponData));
      this._equipmentData = new Map(Object.entries(equipmentData));
      this._bangbooData = new Map(Object.entries(bangbooData));
      this._enemyData = new Map(Object.entries(enemyData));

      // 加载技能CSV数据
      await this.loadAgentSkills();

      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize DataLoaderService:', error);
      throw error;
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * 加载JSON文件
   */
  private async loadJsonFile<T>(path: string): Promise<Record<string, T>> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }
    return (await response.json()) as Record<string, T>;
  }

  /**
   * 获取角色详细信息（按需加载）
   */
  async getCharacterDetail(gameId: string): Promise<any> {
    // 检查缓存
    if (this._characterDetailCache.has(gameId)) {
      return this._characterDetailCache.get(gameId);
    }

    // 加载数据
    const detail = await this.loadJsonFile<any>(`/game-data/character/${gameId}.json`);
    this._characterDetailCache.set(gameId, detail);

    return detail;
  }

  /**
   * 获取角色Buff数据（按需加载）
   */
  async getCharacterBuff(gameId: string): Promise<any> {
    // 检查缓存
    if (this._characterBuffCache.has(gameId)) {
      return this._characterBuffCache.get(gameId);
    }

    // 加载数据
    const buff = await this.loadJsonFile<any>(`/game-data/character_data_buff/${gameId}.json`);
    this._characterBuffCache.set(gameId, buff);

    return buff;
  }

  /**
   * 获取音擎详细信息（按需加载）
   */
  async getWeaponDetail(gameId: string): Promise<any> {
    // 检查缓存
    if (this._weaponDetailCache.has(gameId)) {
      return this._weaponDetailCache.get(gameId);
    }

    // 加载数据
    const detail = await this.loadJsonFile<any>(`/game-data/weapon/${gameId}.json`);
    this._weaponDetailCache.set(gameId, detail);

    return detail;
  }

  /**
   * 获取音擎Buff数据（按需加载）
   */
  async getWeaponBuff(gameId: string): Promise<any> {
    // 检查缓存
    if (this._weaponBuffCache.has(gameId)) {
      return this._weaponBuffCache.get(gameId);
    }

    // 加载数据
    const buff = await this.loadJsonFile<any>(`/game-data/weapon_data_buff/${gameId}.json`);
    this._weaponBuffCache.set(gameId, buff);

    return buff;
  }

  /**
   * 获取驱动盘套装详细信息（按需加载）
   */
  async getEquipmentDetail(gameId: string): Promise<any> {
    // 检查缓存
    if (this._equipmentDetailCache.has(gameId)) {
      return this._equipmentDetailCache.get(gameId);
    }

    // 加载数据
    const detail = await this.loadJsonFile<any>(`/game-data/equipment/${gameId}.json`);
    this._equipmentDetailCache.set(gameId, detail);

    return detail;
  }

  /**
   * 获取驱动盘套装Buff数据（按需加载）
   */
  async getEquipmentBuff(gameId: string): Promise<any> {
    // 检查缓存
    if (this._equipmentBuffCache.has(gameId)) {
      return this._equipmentBuffCache.get(gameId);
    }

    // 加载数据
    const buff = await this.loadJsonFile<any>(`/game-data/equipment_data_buff/${gameId}.json`);
    this._equipmentBuffCache.set(gameId, buff);

    return buff;
  }

  /**
   * 获取所有角色
   */
  getAllCharacters(): CharacterInfo[] {
    if (!this._characterData) {
      return [];
    }
    return Array.from(this._characterData.values());
  }

  /**
   * 获取所有音擎
   */
  getAllWeapons(): WeaponInfo[] {
    if (!this._weaponData) {
      return [];
    }
    return Array.from(this._weaponData.values());
  }

  /**
   * 获取所有驱动盘套装
   */
  getAllEquipments(): EquipmentInfo[] {
    if (!this._equipmentData) {
      return [];
    }
    return Array.from(this._equipmentData.values());
  }

  /**
   * 获取所有邦布
   */
  getAllBangboos(): BangbooInfo[] {
    if (!this._bangbooData) {
      return [];
    }
    return Array.from(this._bangbooData.values());
  }

  /**
   * 获取所有敌人
   */
  getAllEnemies(): EnemyInfo[] {
    if (!this._enemyData) {
      return [];
    }
    return Array.from(this._enemyData.values());
  }

  /**
   * 加载技能CSV数据
   */
  async loadAgentSkills(): Promise<void> {
    try {
      const csvUrl = '/game-data/csv/代理人技能数据.csv';
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Failed to load ${csvUrl}: ${response.statusText}`);
      }
      const csvText = await response.text();

      // 手动解析CSV
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        this._agentSkills = new Map();
        return;
      }

      // 解析表头
      const headers = lines[0].split(',').map(h => h.trim());

      // 查找关键列的索引
      const getIndex = (name: string) => {
        const index = headers.indexOf(name);
        if (index === -1) {
          console.warn(`未找到CSV列: ${name}`);
        }
        return index;
      };

      const agentNameIdx = getIndex('代理人');
      const skillNameIdx = getIndex('技能');
      const segmentNameIdx = getIndex('段');
      const damageRatioIdx = getIndex('伤害倍率');
      const damageRatioGrowthIdx = getIndex('伤害倍率成长');
      const stunRatioIdx = getIndex('失衡倍率');
      const stunRatioGrowthIdx = getIndex('失衡倍率成长');
      const energyRecoveryIdx = getIndex('能量回复');
      const anomalyBuildupIdx = getIndex('异常积蓄');
      const decibelRecoveryIdx = getIndex('喧响值回复');
      const flashEnergyAccumulationIdx = getIndex('闪能累积');
      const corruptionShieldReductionIdx = getIndex('秽盾削减值');
      const skillTypeIdx = getIndex('技能类型');
      const attackTypeIdx = getIndex('攻击类型');
      const energyExtraCostIdx = getIndex('能量额外消耗');
      const specialEnergyIdx = getIndex('特殊能量');
      const distanceDecayIdx = getIndex('距离衰减');

      // 解析数据行
      const skillsMap = new Map<string, AgentSkillSet>();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');

        // 获取值的辅助函数
        const getValue = (index: number, defaultValue: any = ''): any => {
          if (index === -1 || index >= values.length) {
            return defaultValue;
          }
          const value = values[index]?.trim() || '';
          return value;
        };

        const agentName = getValue(agentNameIdx);
        const skillName = getValue(skillNameIdx);
        const segmentName = getValue(segmentNameIdx);

        if (!agentName || !skillName) {
          continue; // 跳过无效行
        }

        // 创建技能段对象
        const segment: AgentSkillSegment = {
          agentName,
          skillName,
          segmentName,
          damageRatio: parseFloat(getValue(damageRatioIdx, '0')) || 0,
          damageRatioGrowth: parseFloat(getValue(damageRatioGrowthIdx, '0')) || 0,
          stunRatio: parseFloat(getValue(stunRatioIdx, '0')) || 0,
          stunRatioGrowth: parseFloat(getValue(stunRatioGrowthIdx, '0')) || 0,
          energyRecovery: parseFloat(getValue(energyRecoveryIdx, '0')) || 0,
          anomalyBuildup: parseFloat(getValue(anomalyBuildupIdx, '0')) || 0,
          decibelRecovery: parseFloat(getValue(decibelRecoveryIdx, '0')) || 0,
          flashEnergyAccumulation: parseFloat(getValue(flashEnergyAccumulationIdx, '0')) || 0,
          corruptionShieldReduction: parseFloat(getValue(corruptionShieldReductionIdx, '0')) || 0,
          skillType: parseInt(getValue(skillTypeIdx, '0')) || 0,
          attackType: parseInt(getValue(attackTypeIdx, '0')) || 0,
          energyExtraCost: parseFloat(getValue(energyExtraCostIdx, '0')) || 0,
          specialEnergy: getValue(specialEnergyIdx, ''),
          distanceDecay: getValue(distanceDecayIdx, ''),
        };

        // 按agentName分组
        if (!skillsMap.has(agentName)) {
          skillsMap.set(agentName, {
            agentName,
            skills: new Map(),
          });
        }

        const agentSkillSet = skillsMap.get(agentName)!;

        // 按skillName分组
        if (!agentSkillSet.skills.has(skillName)) {
          agentSkillSet.skills.set(skillName, {
            skillName,
            segments: [],
          });
        }

        agentSkillSet.skills.get(skillName)!.segments.push(segment);
      }

      this._agentSkills = skillsMap;
      console.log(`成功加载 ${skillsMap.size} 个角色的技能数据`);
    } catch (error) {
      console.error('加载技能数据失败:', error);
      this._agentSkills = new Map();
    }
  }

  /**
   * 获取指定角色的技能数据
   */
  getAgentSkills(agentName: string): AgentSkillSet | null {
    return this._agentSkills?.get(agentName) || null;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this._characterDetailCache.clear();
    this._characterBuffCache.clear();
    this._weaponDetailCache.clear();
    this._weaponBuffCache.clear();
    this._equipmentDetailCache.clear();
    this._equipmentBuffCache.clear();
  }

  /**
   * 重置服务
   */
  reset(): void {
    this._characterData = null;
    this._equipmentData = null;
    this._weaponData = null;
    this._bangbooData = null;
    this._enemyData = null;
    this._agentSkills = null;
    this.clearCache();
    this._isInitialized = false;
    this._isLoading = false;
  }
}

// 导出单例实例
export const dataLoaderService = DataLoaderService.getInstance();