/**
 * 角色模型
 */

import { Rarity, ElementType, WeaponType, PropertyType } from './base';
import { PropertyCollection } from './property-collection';
import { CombatStats } from './combat-stats';
import { Buff, ConversionBuff, BuffSource, BuffTarget, Conversion } from './buff';
import type { ZodCharacterData } from './save-data-zod';
import type { AgentSkillSet } from './skill';
import type { dataLoaderService } from '../services/data-loader.service';
import type { WEngine } from './wengine';
import type { DriveDisk } from './drive-disk';
import { DriveDiskSetBonus } from './drive-disk';

/**
 * 角色技能等级
 */
export class AgentSkills {
  normal: number = 1; // 普通攻击 (1-12)
  dodge: number = 1; // 闪避反击 (1-12)
  assist: number = 1; // 支援技 (1-12)
  special: number = 1; // 特殊技 (1-12)
  chain: number = 1; // 连携技 (1-12)

  constructor(
    normal?: number,
    dodge?: number,
    assist?: number,
    special?: number,
    chain?: number
  ) {
    this.normal = normal ?? 1;
    this.dodge = dodge ?? 1;
    this.assist = assist ?? 1;
    this.special = special ?? 1;
    this.chain = chain ?? 1;
  }

  /**
   * 是否全部满级
   */
  get isMax(): boolean {
    return (
      this.normal >= 12 &&
      this.dodge >= 12 &&
      this.assist >= 12 &&
      this.special >= 12 &&
      this.chain >= 12
    );
  }

  /**
   * 总技能等级
   */
  get totalLevel(): number {
    return this.normal + this.dodge + this.assist + this.special + this.chain;
  }

  /**
   * 转为字典
   */
  toDict(): any {
    return {
      normal: this.normal,
      dodge: this.dodge,
      assist: this.assist,
      special: this.special,
      chain: this.chain,
    };
  }

  /**
   * 从字典创建
   */
  static fromDict(data: any): AgentSkills {
    return new AgentSkills(
      data.normal,
      data.dodge,
      data.assist,
      data.special,
      data.chain
    );
  }
}

/**
 * 角色模型
 *
 * ⚠️ 重要说明：
 * 这是一个运行时对象，从存档数据生成，用于属性计算和战斗模拟
 * - 包含计算缓存（self_properties、buff列表等）
 * - 不是存档本身，不应该被持久化
 * - 每次从存档加载时重新创建
 */
export class Agent {
  // 实例ID（存档中的唯一标识）
  id: string;

  // 游戏ID（对应character.json中的键）
  game_id: string;

  // 基础信息（从游戏数据加载）
  name_cn: string = '';
  name_en: string = '';
  rarity: Rarity = Rarity.S;
  element: ElementType = ElementType.PHYSICAL;
  weapon_type: WeaponType = WeaponType.ATTACK;
  icon: string = '';

  // 成长属性（玩家数据）
  level: number = 1;
  breakthrough: number = 0;
  cinema: number = 0;
  core_skill: number = 1;
  skills: AgentSkills = new AgentSkills();

  // 装备关联
  equipped_wengine: string | null = null; // 音擎ID
  equipped_drive_disks: (string | null)[] = [null, null, null, null, null, null]; // 驱动盘ID（6个位置）

  // 缓存的角色自身属性（在fromZodData中计算，只包含角色基础+成长+突破+核心技能）
  self_properties: PropertyCollection = new PropertyCollection();

  // Buff系统（从游戏数据加载）
  core_passive_buffs: Buff[] = [];
  talent_buffs: Buff[] = [];
  conversion_buffs: ConversionBuff[] = [];
  potential_buffs: Buff[] = [];
  
  // 技能数据（从游戏数据加载）
  agentSkills: AgentSkillSet | null = null;

  constructor(
    id: string,
    gameId: string,
    nameCn?: string,
    level?: number,
    rarity?: Rarity,
    element?: ElementType,
    weaponType?: WeaponType
  ) {
    this.id = id;
    this.game_id = gameId;
    this.name_cn = nameCn ?? '';
    this.level = level ?? 1;
    this.rarity = rarity ?? Rarity.S;
    this.element = element ?? ElementType.PHYSICAL;
    this.weapon_type = weaponType ?? WeaponType.ATTACK;
  }

  // 计算属性加载状态
  private _isSelfPropertiesLoaded: boolean = false;
  private _isBuffsLoaded: boolean = false;

  /**
   * 获取角色基础属性（仅角色自身，不含装备、buff）
   *
   * @returns 属性集合
   */
  getCharacterBaseStats(): PropertyCollection {
    if (!this._isSelfPropertiesLoaded || !this.self_properties) {
      this._calculateSelfProperties();
    }
    return this.self_properties;
  }

  /**
   * 获取角色+装备属性（角色基础 + 武器 + 驱动盘基础 + 驱动盘两件套）
   *
   * @returns 属性集合
   */
  getCharacterEquipmentStats(): PropertyCollection {
    // 1. 先获取角色基础属性
    const baseStats = this.getCharacterBaseStats();
    
    // 2. 创建新的属性集合来存储角色+装备属性
    const equipmentStats = new PropertyCollection();
    equipmentStats.add(baseStats);
    
    // 3. 获取武器属性（如果有装备）
    if (this.equipped_wengine && this._wengines) {
      const wengine = this._wengines.get(this.equipped_wengine);
      if (wengine) {
        equipmentStats.add(wengine.getBaseStats());
      }
    }
    
    // 4. 获取驱动盘属性和两件套效果
    if (this._driveDisks) {
      // 统计不同套装的数量
      const setCounts = new Map<string, number>();
      
      // 先计算所有驱动盘的基础属性
      for (const diskId of this.equipped_drive_disks) {
        if (diskId) {
          const disk = this._driveDisks!.get(diskId);
          if (disk) {
            // 添加驱动盘基础属性
            equipmentStats.add(disk.getStats());
            
            // 统计套装数量
            const setName = disk.set_name;
            setCounts.set(setName, (setCounts.get(setName) || 0) + 1);
          }
        }
      }
      
      // 计算两件套效果
      // 遍历所有驱动盘，为每个至少有2件的套装添加两件套效果
      for (const diskId of this.equipped_drive_disks) {
        if (diskId) {
          const disk = this._driveDisks!.get(diskId);
          if (disk) {
            const setName = disk.set_name;
            const count = setCounts.get(setName) || 0;
            
            // 如果套装数量 >= 2，添加两件套效果
            if (count >= 2) {
              const twoPieceBonus = disk.getSetBuff(2);
              equipmentStats.add(twoPieceBonus);
              // 为了避免重复添加同一套装的两件套效果，移除该套装的计数
              setCounts.set(setName, 0);
            }
          }
        }
      }
    }
    
    return equipmentStats;
  }

  /**
   * 获取角色战斗属性（角色+装备的战斗属性）
   *
   * 严格遵循三层属性转换流程：
   * 局外属性(1) → 局内属性(2) → 最终属性(3)
   *
   * 此方法执行的是第一层到第二层的转换：
   * - 输入：角色+装备的局外属性（from getCharacterEquipmentStats()）
   * - 转换：调用 toCombatStats() 将局外属性转换为局内属性
   * - 输出：只包含局内属性的 PropertyCollection
   *
   * @returns 战斗属性PropertyCollection，只包含局内面板
   */
  getCharacterCombatStats(): PropertyCollection {
    const equipmentStats = this.getCharacterEquipmentStats();
    // 直接返回toCombatStats()的结果，它已经是计算好的战斗属性PropertyCollection
    return equipmentStats.toCombatStats();
  }

  // 兼容层：保留原有方法，指向新方法
  
  /**
   * 获取裸属性（只有角色自身，不含装备）
   *
   * @returns 属性集合
   */
  getBareStats(): PropertyCollection {
    return this.getCharacterBaseStats();
  }

  /**
   * 获取角色自身属性（裸 + 武器 + 驱动盘基础 + 所有驱动盘两件套）
   *
   * @returns 属性集合
   */
  getSelfProperties(): PropertyCollection {
    return this.getCharacterEquipmentStats();
  }

  /**
   * 获取战斗属性（角色+装备）
   *
   * 基础战斗面板 = 角色自身 + 武器固定属性 + 驱动盘固定属性 + 驱动盘2件套
   * 最终战斗属性 = 基础战斗面板 + Buff属性
   *
   * @param buffs Buff属性数组（可选）
   * @returns 战斗属性
   */
  getCombatStats(buffs?: Buff[]): CombatStats {
    const collections: PropertyCollection[] = [];

    // 1. 角色自身属性 + 装备属性（裸 + 武器 + 驱动盘基础 + 所有驱动盘两件套）
    collections.push(this.getCharacterEquipmentStats());

    // 2. Buff属性
    if (buffs) {
      for (const buff of buffs) {
        // 将buff的属性转换为PropertyCollection
        const buffCollection = new PropertyCollection();
        
        // 添加局外属性
        if (buff.out_of_combat_stats) {
          buff.out_of_combat_stats.forEach((value, key) => {
            buffCollection.addProperty(key, value);
          });
        }
        
        // 添加局内属性
        if (buff.in_combat_stats) {
          buff.in_combat_stats.forEach((value, key) => {
            buffCollection.addProperty(key, value);
          });
        }
        
        collections.push(buffCollection);
      }
    }

    return CombatStats.fromPropertyCollections(collections, this.level);
  }

  /**
   * 计算角色自身属性（内部方法，懒加载）
   */
  private _calculateSelfProperties(): void {
    if (!this._charDetail || !this._zodData || !this._charDetail.Stats) {
      this._isSelfPropertiesLoaded = true;
      return;
    }

    const stats = this._charDetail.Stats;
    const level = this._zodData.level;
    const promotion = this._zodData.promotion;

    // 基础属性公式：(Base + (Level - 1) * Growth / 10000)
    const calcBase = (base: number, growth: number) => {
      return base + ((level - 1) * growth) / 10000;
    };

    // 计算基础属性值（HP/ATK/DEF 需要加上突破和核心技加成）
    const baseHp = calcBase(stats.HpMax, stats.HpGrowth);
    const baseAtk = calcBase(stats.Attack, stats.AttackGrowth);
    const baseDef = calcBase(stats.Defence, stats.DefenceGrowth);

    // 突破加成
    let promotionHp = 0;
    let promotionAtk = 0;
    let promotionDef = 0;
    if (promotion > 0 && this._charDetail.Level) {
      const levelKey = (promotion + 1).toString();
      const levelData = this._charDetail.Level[levelKey];
      if (levelData) {
        promotionHp = levelData.HpMax || 0;
        promotionAtk = levelData.Attack || 0;
        promotionDef = levelData.Defence || 0;
      }
    }

    // 核心技加成
    let coreHp = 0;
    let coreAtk = 0;
    let coreDef = 0;
    let coreImpact = 0;
    if (this._charDetail.ExtraLevel) {
      const coreKey = this._zodData.core.toString();
      const extraData = this._charDetail.ExtraLevel[coreKey];
      if (extraData && extraData.Extra) {
        for (const bonus of Object.values(extraData.Extra) as any[]) {
          if (bonus.Name === '基础攻击力') coreAtk += bonus.Value;
          if (bonus.Name === '基础生命值') coreHp += bonus.Value;
          if (bonus.Name === '基础防御力') coreDef += bonus.Value;
          if (bonus.Name === '冲击力') coreImpact += bonus.Value;
        }
      }
    }

    // 动态填充所有不为 0 的属性
    // 属性名映射：stats 字段名 -> PropertyType -> 转换因子
    const propertyMapping: Record<string, { propType: PropertyType | null; divisor?: number }> = {
      // 基础属性（需要加上突破和核心技加成）
      'HpMax': { propType: PropertyType.HP_BASE },
      'Attack': { propType: PropertyType.ATK_BASE },
      'Defence': { propType: PropertyType.DEF_BASE },

      // 其他属性（不需要额外加成）
      'BreakStun': { propType: PropertyType.IMPACT },
      'Crit': { propType: PropertyType.CRIT_, divisor: 10000 },
      'CritDamage': { propType: PropertyType.CRIT_DMG_, divisor: 10000 },
      'CritRes': { propType: null }, // 移除CRIT_RATE_映射，避免重复计算
      'CritDmgRes': { propType: null }, // 暂无对应枚举
      'ElementAbnormalPower': { propType: PropertyType.ANOM_MAS },
      'ElementMystery': { propType: PropertyType.ANOM_PROF },
      'SpRecover': { propType: PropertyType.ENER_REGEN, divisor: 100 },
      'SpBarPoint': { propType: null }, // 暂无对应枚举
      'PenDelta': { propType: PropertyType.PEN },
      'PenRate': { propType: PropertyType.PEN_, divisor: 100 },
      'Armor': { propType: null }, // 暂无对应枚举
      'Shield': { propType: PropertyType.SHIELD_ },
      'Endurance': { propType: null }, // 暂无对应枚举
      'Stun': { propType: null }, // 暂无对应枚举
      'Rbl': { propType: null }, // 暂无对应枚举
    };
    
    console.log('[DEBUG] Agent._calculateSelfProperties() - 属性映射:', propertyMapping);

    for (const [key, value] of Object.entries(stats)) {
      // 跳过 Growth 字段和其他非数值字段
      if (key.includes('Growth')) continue;
      if (typeof value !== 'number' || value === 0) continue;

      const mapping = propertyMapping[key];
      if (!mapping || mapping.propType === null) continue;

      // 计算最终值
    let finalValue = value;
    console.log(`[DEBUG] Agent._calculateSelfProperties() - 处理属性 ${key}: 原始值=${value}, mapping=${JSON.stringify(mapping)}`);
    
    if (key === 'HpMax') {
      finalValue = baseHp + promotionHp + coreHp;
      console.log(`[DEBUG] Agent._calculateSelfProperties() - HpMax: baseHp=${baseHp}, promotionHp=${promotionHp}, coreHp=${coreHp}, finalValue=${finalValue}`);
    } else if (key === 'Attack') {
      finalValue = baseAtk + promotionAtk + coreAtk;
      console.log(`[DEBUG] Agent._calculateSelfProperties() - Attack: baseAtk=${baseAtk}, promotionAtk=${promotionAtk}, coreAtk=${coreAtk}, finalValue=${finalValue}`);
    } else if (key === 'Defence') {
      finalValue = baseDef + promotionDef + coreDef;
      console.log(`[DEBUG] Agent._calculateSelfProperties() - Defence: baseDef=${baseDef}, promotionDef=${promotionDef}, coreDef=${coreDef}, finalValue=${finalValue}`);
    } else if (key === 'BreakStun') {
      finalValue = value + coreImpact;
      console.log(`[DEBUG] Agent._calculateSelfProperties() - BreakStun: value=${value}, coreImpact=${coreImpact}, finalValue=${finalValue}`);
    } else if (mapping.divisor) {
      // 对于需要除以divisor的属性，确保使用正确的计算方式
      finalValue = value / mapping.divisor;
      console.log(`[DEBUG] Agent._calculateSelfProperties() - 使用divisor计算 ${key}: value=${value}, divisor=${mapping.divisor}, finalValue=${finalValue}`);
    }
    
    // 特别关注暴击率相关属性
    if (key === 'Crit' || key === 'CritDamage' || key === 'CritRes') {
      console.log(`[DEBUG] Agent._calculateSelfProperties() - 暴击相关属性 ${key}: 最终值=${finalValue}, 属性类型=${PropertyType[mapping.propType as PropertyType]}`);
    }

      // 只添加不为 0 的属性
      if (finalValue !== 0) {
        // 角色基础属性只属于局外面板
        this.self_properties.out_of_combat.set(mapping.propType, finalValue);
      }
    }

    this._isSelfPropertiesLoaded = true;
  }

  /**
   * 转为字典（只序列化实例特有数据）
   */
  toDict(): any {
    return {
      game_id: this.game_id,
      level: this.level,
      breakthrough: this.breakthrough,
      cinema: this.cinema,
      core_skill: this.core_skill,
      skills: this.skills.toDict(),
      equipped_wengine: this.equipped_wengine,
      equipped_drive_disks: this.equipped_drive_disks,
    };
  }

  /**
   * 从ZOD数据创建Agent实例
   *
   * @param zodData ZOD角色数据
   * @param dataLoader 数据加载服务
   * @returns Agent实例
   */
  static async fromZodData(
    zodData: ZodCharacterData,
    dataLoader: typeof dataLoaderService
  ): Promise<Agent> {
    // 1. 根据key (CodeName) 查找游戏数据中的角色ID
    // zodData.key 通常是 EN 名称（如 "Astra Yao"），需要同时匹配 EN 和 code 字段
    let gameCharId: string | null = null;
    const charMap = dataLoader.characterData;
    if (charMap) {
      for (const [id, data] of charMap.entries()) {
        // 先尝试匹配 EN 字段（忽略大小写）
        if (data.EN && data.EN.trim().toLowerCase() === zodData.key.trim().toLowerCase()) {
          gameCharId = id;
          break;
        }
        // 如果 EN 不匹配，再尝试 code 字段（忽略大小写）
        if (data.code && data.code.trim().toLowerCase() === zodData.key.trim().toLowerCase()) {
          gameCharId = id;
          break;
        }
      }
    }

    if (!gameCharId) {
      throw new Error(`未找到角色游戏数据: ${zodData.key}`);
    }

    // 2. 获取角色基础信息
    const charInfo = charMap!.get(gameCharId)!;

    // 3. 创建Agent实例（只设置基本属性，不进行计算）
    const agent = new Agent(
      zodData.id,
      gameCharId,
      charInfo.CHS || charInfo.EN,
      zodData.level,
      charInfo.rank as Rarity,
      charInfo.element as ElementType,
      charInfo.type as WeaponType
    );

    // 4. 设置实例数据
    agent.name_en = charInfo.EN || '';
    agent.icon = charInfo.icon || '';
    agent.breakthrough = zodData.promotion;
    agent.cinema = zodData.mindscape;
    agent.core_skill = zodData.core;

    // 技能等级
    agent.skills = new AgentSkills(
      zodData.basic,
      zodData.dodge,
      zodData.assist,
      zodData.special,
      zodData.chain
    );

    // 装备关联
    agent.equipped_wengine = zodData.equippedWengine || null;

    // 驱动盘装备（ZOD格式是 Record<string, string>，需要转换为数组）
    const discs: (string | null)[] = [null, null, null, null, null, null];
    if (zodData.equippedDiscs) {
      // ZOD的key是"1"到"6"，转换为数组索引0-5
      for (const [slotKey, discId] of Object.entries(zodData.equippedDiscs)) {
        const slotNum = parseInt(slotKey);
        if (slotNum >= 1 && slotNum <= 6) {
          discs[slotNum - 1] = discId;
        }
      }
    }
    agent.equipped_drive_disks = discs;

    // 保存dataLoader引用，用于后续懒加载
    agent._dataLoader = dataLoader;
    agent._charDetail = await dataLoader.getCharacterDetail(gameCharId);
    agent._gameCharId = gameCharId;
    agent._zodData = zodData;
    
    // 加载技能数据
    const agentName = agent.name_cn || agent.name_en;
    agent.agentSkills = dataLoader.getAgentSkills(agentName);
    
    // 尝试使用游戏ID作为备用名称加载技能
    if (!agent.agentSkills || agent.agentSkills.skills.size === 0) {
      const skillsByGameId = dataLoader.getAgentSkills(agent.game_id);
      if (skillsByGameId) {
        agent.agentSkills = skillsByGameId;
      }
    }

    return agent;
  }

  /**
   * 获取所有有效的Buff（懒加载）
   */
  async getAllBuffs(): Promise<Buff[]> {
    if (!this._isBuffsLoaded || !this.core_passive_buffs) {
      await this._loadBuffs();
    }
    return this.getAllBuffsSync();
  }
  
  /**
   * 获取所有有效的Buff（同步，仅返回已加载的Buff）
   */
  getAllBuffsSync(): Buff[] {
    const allBuffs: Buff[] = [
      ...this.core_passive_buffs || [],
      ...this.talent_buffs || [],
      ...this.potential_buffs || [],
      ...this.conversion_buffs || [],
    ];

    // 添加武器BUFF
    if (this.equipped_wengine && this._wengines) {
      const wengine = this._wengines.get(this.equipped_wengine);
      if (wengine) {
        const wengineBuffs = wengine.getActiveBuffs();
        if (wengineBuffs && wengineBuffs.length > 0) {
          allBuffs.push(...wengineBuffs);
        }
      } else {
        console.warn(`[Agent.getAllBuffsSync] Wengine not found: ${this.equipped_wengine} for agent ${this.id}`);
      }
    } else if (this.equipped_wengine && !this._wengines) {
      console.warn(`[Agent.getAllBuffsSync] Wengine reference not set for agent ${this.id}. Call setEquipmentReferences() first.`);
    }

    // 添加驱动盘四件套BUFF
    if (this._driveDisks) {
      // 统计套装数量
      const setCounts = new Map<string, number>();
      for (const diskId of this.equipped_drive_disks) {
        if (diskId) {
          const disk = this._driveDisks!.get(diskId);
          if (disk) {
            const setName = disk.set_name;
            setCounts.set(setName, (setCounts.get(setName) || 0) + 1);
          }
        }
      }

      // 收集每个套装的四件套BUFF
      const processedSets = new Set<string>();
      for (const diskId of this.equipped_drive_disks) {
        if (diskId) {
          const disk = this._driveDisks!.get(diskId);
          if (!disk) {
            continue;
          }

          const setName = disk.set_name;
          const count = setCounts.get(setName) || 0;

          // 如果套装数量 >= 4 且未处理过
          if (count >= 4 && !processedSets.has(setName)) {
            if (disk.four_piece_buffs && disk.four_piece_buffs.length > 0) {
              allBuffs.push(...disk.four_piece_buffs);
            }
            processedSets.add(setName);
          }
        }
      }
    } else if (this.equipped_drive_disks.some(id => id !== null) && !this._driveDisks) {
      console.warn(`[Agent.getAllBuffsSync] DriveDisk reference not set for agent ${this.id}. Call setEquipmentReferences() first.`);
    }

    // 验证返回的buff都有有效的in_combat_stats
    const validBuffs = allBuffs.filter(buff => {
      if (!buff) {
        console.warn('[Agent.getAllBuffsSync] Null buff found');
        return false;
      }
      if (!buff.in_combat_stats) {
        console.warn(`[Agent.getAllBuffsSync] Buff ${buff.id} has no in_combat_stats`);
        return false;
      }
      return true;
    });

    return validBuffs;
  }

  /**
   * 加载角色Buff数据（内部方法）
   */
  private async _loadBuffs(): Promise<void> {
    if (!this._dataLoader || !this._gameCharId) {
      console.warn(`无法加载BUFF数据，缺少_dataLoader或_gameCharId`, { _dataLoader: !!this._dataLoader, _gameCharId: this._gameCharId });
      return;
    }

    try {
      console.log(`[DEBUG] 开始加载角色 ${this.name_cn} (${this._gameCharId}) 的BUFF数据`);
      const buffData = await this._dataLoader.getCharacterBuff(this._gameCharId);
      console.log(`[DEBUG] 获取到的BUFF数据:`, buffData);

      // 重置BUFF数组
      this.core_passive_buffs = [];
      this.talent_buffs = [];
      this.potential_buffs = [];
      this.conversion_buffs = [];

      // 检查buffData是否是数组
      if (Array.isArray(buffData)) {
        console.log(`[DEBUG] BUFF数据是数组，长度为: ${buffData.length}`);
        
        // 遍历BUFF数组，根据source字段分配到不同的数组中
        for (const buff of buffData) {
          try {
            console.log(`[DEBUG] 处理BUFF:`, buff.id, buff.source);
            
            // 解析BUFF ID，提取影画等级（比如从 "1411_talent_6_1" 中提取出 6）
            let requiredMindscapeLevel = 0;
            if (buff.id && buff.id.includes('_talent_')) {
              const parts = buff.id.split('_');
              if (parts.length >= 3) {
                const mindscapePart = parts[2];
                requiredMindscapeLevel = parseInt(mindscapePart) || 0;
                console.log(`[DEBUG] 从BUFF ID解析出影画等级: ${requiredMindscapeLevel}`);
              }
            }
            
            // 检查角色影画等级是否满足条件
            const characterMindscapeLevel = this._zodData?.mindscape || 0;
            if (requiredMindscapeLevel > characterMindscapeLevel) {
              console.log(`[DEBUG] 角色影画等级 ${characterMindscapeLevel} 小于BUFF所需影画等级 ${requiredMindscapeLevel}，跳过该BUFF`);
              continue;
            }
            
            // 直接创建简单的buff实例，跳过复杂的解析和转换
            let buffSource: BuffSource;
            if (buff.source === 'CORE_PASSIVE') {
              buffSource = BuffSource.CORE_PASSIVE;
            } else if (buff.source === 'TALENT') {
              buffSource = BuffSource.TALENT;
            } else if (buff.source === 'MINDSCAPE') {
              buffSource = BuffSource.POTENTIAL;
            } else {
              buffSource = BuffSource.TALENT;
            }
            
            // 创建并初始化BuffTarget实例，使用实际的target数据
            const buffTarget = new BuffTarget();
            if (buff.target) {
              // 只有当buff.target中明确设置了target_self时才覆盖默认值
              if (buff.target.target_self !== undefined) {
                buffTarget.target_self = buff.target.target_self;
              }
              // 其他目标属性没有默认值，直接赋值
              buffTarget.target_teammate = buff.target.target_teammate || false;
              buffTarget.target_enemy = buff.target.target_enemy || false;
              buffTarget.target_bund = buff.target.target_bund || false;
            }
            
            const simpleBuff = new Buff(
              buffSource,
              new Map(),
              new Map(),
              undefined,
              buffTarget,
              1,
              'linear',
              true,
              buff.id || '',
              buff.name || '',
              buff.description || ''
            );
            
            // 根据source字段分配到不同的数组中
            if (buff.source === 'CORE_PASSIVE') {
              this.core_passive_buffs.push(simpleBuff);
              console.log(`[DEBUG] 添加核心被动BUFF:`, buff.id, `当前数量:`, this.core_passive_buffs.length);
            } else if (buff.source === 'TALENT') {
              this.talent_buffs.push(simpleBuff);
              console.log(`[DEBUG] 添加天赋BUFF:`, buff.id, `当前数量:`, this.talent_buffs.length);
            } else if (buff.source === 'MINDSCAPE') {
              // 检查影画等级是否满足条件
              if (this._zodData && (!buff.mindscape_level || buff.mindscape_level <= this._zodData.mindscape)) {
                this.potential_buffs.push(simpleBuff);
                console.log(`[DEBUG] 添加影画BUFF:`, buff.id, `当前数量:`, this.potential_buffs.length);
              }
            } else {
              this.talent_buffs.push(simpleBuff);
              console.log(`[DEBUG] 添加未知类型BUFF:`, buff.id, `当前数量:`, this.talent_buffs.length);
            }
          } catch (error) {
            console.error(`[DEBUG] 创建BUFF失败:`, buff.id, error);
          }
        }
      } else {
        // 旧格式处理（如果buffData是对象）
        console.log(`[DEBUG] BUFF数据是对象`);
        
        // 辅助函数：创建BuffTarget实例
        const createBuffTarget = (targetData: any): BuffTarget => {
          const target = new BuffTarget();
          if (targetData) {
            // 只有当targetData中明确设置了target_self时才覆盖默认值
            if (targetData.target_self !== undefined) {
              target.target_self = targetData.target_self;
            }
            // 其他目标属性没有默认值，直接赋值
            target.target_teammate = targetData.target_teammate || false;
            target.target_enemy = targetData.target_enemy || false;
            target.target_bund = targetData.target_bund || false;
          }
          return target;
        };
        
        // 核心被动Buff
        if (buffData.core_passive_buffs) {
          console.log(`[DEBUG] 核心被动Buff数量:`, buffData.core_passive_buffs.length);
          for (const b of buffData.core_passive_buffs) {
            this.core_passive_buffs.push(new Buff(
              BuffSource.CORE_PASSIVE,
              new Map(),
              new Map(),
              undefined,
              createBuffTarget(b.target),
              1,
              'linear',
              true,
              b.id || '',
              b.name || '',
              b.description || ''
            ));
          }
        }

        // 天赋Buff
        if (buffData.talent_buffs) {
          console.log(`[DEBUG] 天赋Buff数量:`, buffData.talent_buffs.length);
          for (const b of buffData.talent_buffs) {
            // 解析BUFF ID，提取影画等级
            let requiredMindscapeLevel = 0;
            if (b.id && b.id.includes('_talent_')) {
              const parts = b.id.split('_');
              if (parts.length >= 3) {
                const mindscapePart = parts[2];
                requiredMindscapeLevel = parseInt(mindscapePart) || 0;
              }
            }
            
            // 检查角色影画等级是否满足条件
            const characterMindscapeLevel = this._zodData?.mindscape || 0;
            if (requiredMindscapeLevel > characterMindscapeLevel) {
              continue;
            }
            
            this.talent_buffs.push(new Buff(
              BuffSource.TALENT,
              new Map(),
              new Map(),
              undefined,
              createBuffTarget(b.target),
              1,
              'linear',
              true,
              b.id || '',
              b.name || '',
              b.description || ''
            ));
          }
        }

        // 影画Buff
        if (buffData.mindscape_buffs && this._zodData) {
          const filteredBuffs = buffData.mindscape_buffs.filter((b: any) => b.mindscape_level <= (this._zodData?.mindscape || 0));
          console.log(`[DEBUG] 影画Buff数量: ${filteredBuffs.length} (总数量: ${buffData.mindscape_buffs.length}, 影画等级: ${this._zodData?.mindscape || 0})`);
          for (const b of filteredBuffs) {
            this.potential_buffs.push(new Buff(
              BuffSource.POTENTIAL,
              new Map(),
              new Map(),
              undefined,
              createBuffTarget(b.target),
              1,
              'linear',
              true,
              b.id || '',
              b.name || '',
              b.description || ''
            ));
          }
        }

        // 转化Buff
        if (buffData.conversion_buffs) {
          console.log(`[DEBUG] 转化Buff数量:`, buffData.conversion_buffs.length);
          for (const b of buffData.conversion_buffs) {
            try {
              // 使用ConversionBuff.fromBuffData方法创建实例
              const conversionBuff = ConversionBuff.fromBuffData(b);
              this.conversion_buffs.push(conversionBuff);
              console.log(`[DEBUG] 添加转化BUFF:`, b.id, `当前数量:`, this.conversion_buffs.length);
            } catch (error) {
              console.error(`[DEBUG] 创建转化BUFF失败:`, b.id, error);
            }
          }
        }
      }

      // 显示最终加载的BUFF数量
      console.log(`[DEBUG] 最终加载的BUFF数量: 核心被动${this.core_passive_buffs.length}, 天赋${this.talent_buffs.length}, 影画${this.potential_buffs.length}, 转化${this.conversion_buffs.length}`);
      this._isBuffsLoaded = true;
    } catch (err) {
      console.error(`加载角色Buff数据失败: ${this.game_id}`, err);
    }
  }

  // 保存用于懒加载的数据
  private _dataLoader: typeof dataLoaderService | null = null;
  private _charDetail: any = null;
  private _gameCharId: string | null = null;
  private _zodData: ZodCharacterData | null = null;
  
  // 装备集合引用（从外部注入，用于获取装备属性）
  private _wengines: Map<string, WEngine> | null = null;
  private _driveDisks: Map<string, DriveDisk> | null = null;
  
  /**
   * 设置装备集合引用
   */
  setEquipmentReferences(wengines: Map<string, WEngine>, driveDisks: Map<string, DriveDisk>): void {
    this._wengines = wengines;
    this._driveDisks = driveDisks;
  }


}