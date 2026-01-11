/**
 * 角色模型
 */

import { Rarity, ElementType, WeaponType, PropertyType } from './base';
import { PropertyCollection } from './property-collection';
import { CombatStats } from './combat-stats';
import { Buff, ConversionBuff } from './buff';
import type { ZodCharacterData } from './save-data-zod';
import type { dataLoaderService } from '../services/data-loader.service';

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
   * 获取角色自身属性（懒加载）
   *
   * @returns 属性集合
   */
  getSelfProperties(): PropertyCollection {
    if (!this._isSelfPropertiesLoaded || !this.self_properties) {
      this._calculateSelfProperties();
    }
    return this.self_properties;
  }

  /**
   * 获取裸属性（只有角色自身，不含装备）
   *
   * @returns 属性集合
   */
  getBareStats(): PropertyCollection {
    return this.getSelfProperties();
  }

  /**
   * 获取战斗属性（角色+装备）
   *
   * 基础战斗面板 = 角色自身 + 武器固定属性 + 驱动盘固定属性 + 驱动盘2件套
   *
   * @param equipmentStats 装备属性集数组（武器+驱动盘+套装，可选）
   * @returns 战斗属性
   */
  getCombatStats(equipmentStats?: PropertyCollection[]): CombatStats {
    const collections: PropertyCollection[] = [];

    // 1. 角色自身属性（懒加载）
    collections.push(this.getSelfProperties());

    // 2. 装备属性（武器+驱动盘+套装）
    if (equipmentStats) {
      collections.push(...equipmentStats);
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
      'HpMax': { propType: PropertyType.HP },
      'Attack': { propType: PropertyType.ATK },
      'Defence': { propType: PropertyType.DEF },

      // 其他属性（不需要额外加成）
      'BreakStun': { propType: PropertyType.IMPACT },
      'Crit': { propType: PropertyType.CRIT_, divisor: 10000 },
      'CritDamage': { propType: PropertyType.CRIT_DMG_, divisor: 10000 },
      'CritRes': { propType: PropertyType.CRIT_RATE_, divisor: 10000 },
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

    for (const [key, value] of Object.entries(stats)) {
      // 跳过 Growth 字段和其他非数值字段
      if (key.includes('Growth')) continue;
      if (typeof value !== 'number' || value === 0) continue;

      const mapping = propertyMapping[key];
      if (!mapping || mapping.propType === null) continue;

      // 计算最终值
      let finalValue = value;
      if (key === 'HpMax') {
        finalValue = baseHp + promotionHp + coreHp;
      } else if (key === 'Attack') {
        finalValue = baseAtk + promotionAtk + coreAtk;
      } else if (key === 'Defence') {
        finalValue = baseDef + promotionDef + coreDef;
      } else if (key === 'BreakStun') {
        finalValue = value + coreImpact;
      } else if (mapping.divisor) {
        finalValue = value / mapping.divisor;
      }

      // 只添加不为 0 的属性
      if (finalValue !== 0) {
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

    return agent;
  }

  /**
   * 获取所有有效的Buff（懒加载）
   */
  getAllBuffs(): Buff[] {
    if (!this._isBuffsLoaded || !this.core_passive_buffs) {
      this._loadBuffs();
    }
    return [
      ...this.core_passive_buffs || [],
      ...this.talent_buffs || [],
      ...this.potential_buffs || [],
    ];
  }

  /**
   * 加载角色Buff数据（内部方法）
   */
  private async _loadBuffs(): Promise<void> {
    if (!this._dataLoader || !this._gameCharId) {
      return;
    }

    try {
      const buffData = await this._dataLoader.getCharacterBuff(this._gameCharId);

      // 核心被动Buff
      if (buffData.core_passive_buffs) {
        this.core_passive_buffs = buffData.core_passive_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 天赋Buff
      if (buffData.talent_buffs) {
        this.talent_buffs = buffData.talent_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 影画Buff
      if (buffData.mindscape_buffs && this._zodData) {
        this.potential_buffs = buffData.mindscape_buffs
          .filter((b: any) => b.mindscape_level <= (this._zodData?.mindscape || 0))
          .map((b: any) => Buff.fromBuffData(b));
      }

      // 转化Buff
      if (buffData.conversion_buffs) {
        this.conversion_buffs = buffData.conversion_buffs.map((b: any) =>
          ConversionBuff.fromBuffData(b)
        );
      }

      this._isBuffsLoaded = true;
    } catch (err) {
      console.warn(`加载角色Buff数据失败: ${this.game_id}`, err);
    }
  }

  // 保存用于懒加载的数据
  private _dataLoader: typeof dataLoaderService | null = null;
  private _charDetail: any = null;
  private _gameCharId: string | null = null;
  private _zodData: ZodCharacterData | null = null;

  /**
   * 从字典创建Agent实例（用于反序列化）
   *
   * @param data 字典数据
   * @param id 实例ID
   * @param dataLoader 数据加载服务
   * @returns Agent实例
   */
  static async fromDict(
    data: any,
    id: string,
    dataLoader: typeof dataLoaderService
  ): Promise<Agent> {
    // 通过game_id从游戏数据获取基础信息（名称、稀有度、元素等）
    const charInfo = dataLoader.characterData?.get(data.game_id);
    if (!charInfo) {
      throw new Error(`未找到角色游戏数据: ${data.game_id}`);
    }

    // 创建实例
    const agent = new Agent(
      id,
      data.game_id,
      charInfo.CHS || charInfo.EN,
      data.level,
      charInfo.rank as Rarity,
      charInfo.element as ElementType,
      charInfo.type as WeaponType
    );

    // 恢复玩家数据
    agent.name_en = charInfo.EN || '';
    agent.icon = charInfo.icon || '';
    agent.breakthrough = data.breakthrough;
    agent.cinema = data.cinema;
    agent.core_skill = data.core_skill;
    agent.skills = AgentSkills.fromDict(data.skills);
    agent.equipped_wengine = data.equipped_wengine;
    agent.equipped_drive_disks = data.equipped_drive_disks;

    // 重新计算self_properties（基于game_id和level）
    const charDetail = await dataLoader.getCharacterDetail(data.game_id);
    if (charDetail && charDetail.Stats) {
      const stats = charDetail.Stats;
      const level = data.level;
      const promotion = data.breakthrough;

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
      if (promotion > 0 && charDetail.Level) {
        const levelKey = (promotion + 1).toString();
        const levelData = charDetail.Level[levelKey];
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
      if (charDetail.ExtraLevel) {
        const coreKey = data.core_skill.toString();
        const extraData = charDetail.ExtraLevel[coreKey];
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
        'CritRes': { propType: PropertyType.CRIT_RATE_, divisor: 10000 },
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

      for (const [key, value] of Object.entries(stats)) {
        // 跳过 Growth 字段和其他非数值字段
        if (key.includes('Growth')) continue;
        if (typeof value !== 'number' || value === 0) continue;

        const mapping = propertyMapping[key];
        if (!mapping || mapping.propType === null) continue;

        // 计算最终值
        let finalValue = value;
        if (key === 'HpMax') {
          finalValue = baseHp + promotionHp + coreHp;
        } else if (key === 'Attack') {
          finalValue = baseAtk + promotionAtk + coreAtk;
        } else if (key === 'Defence') {
          finalValue = baseDef + promotionDef + coreDef;
        } else if (key === 'BreakStun') {
          finalValue = value + coreImpact;
        } else if (mapping.divisor) {
          finalValue = value / mapping.divisor;
        }

        // 只添加不为 0 的属性
        if (finalValue !== 0) {
          agent.self_properties.out_of_combat.set(mapping.propType, finalValue);
        }
      }
    }

    // 加载角色Buff数据
    try {
      const buffData = await dataLoader.getCharacterBuff(data.game_id);

      // 核心被动Buff
      if (buffData.core_passive_buffs) {
        agent.core_passive_buffs = buffData.core_passive_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 天赋Buff
      if (buffData.talent_buffs) {
        agent.talent_buffs = buffData.talent_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 影画Buff（根据角色影画等级过滤）
      if (buffData.mindscape_buffs) {
        agent.potential_buffs = buffData.mindscape_buffs
          .filter((b: any) => b.mindscape_level <= data.cinema)
          .map((b: any) => Buff.fromBuffData(b));
      }

      // 转化Buff
      if (buffData.conversion_buffs) {
        agent.conversion_buffs = buffData.conversion_buffs.map((b: any) =>
          ConversionBuff.fromBuffData(b)
        );
      }
    } catch (err) {
      console.warn(`加载角色Buff数据失败: ${data.game_id}`, err);
    }

    return agent;
  }
}