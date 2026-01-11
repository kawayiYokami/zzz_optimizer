/**
 * ZOD 格式解析服务
 *
 * 负责解析 ZOD 格式的导出数据（Zenless Optimizer 格式）
 * 转换为内部的 Agent、DriveDisk、WEngine 对象
 */

import { Agent, AgentSkills } from '../model/agent';
import { DriveDisk, DriveDiskPosition } from '../model/drive-disk';
import { WEngine } from '../model/wengine';
import { Rarity, ElementType, WeaponType, PropertyType, StatValue } from '../model/base';
import { dataLoaderService } from './data-loader.service';

/**
 * ZOD 格式的驱动盘数据
 */
export interface ZodDiscData {
  setKey: string; // 套装的codename，如 "Flow"、"Miasma"
  rarity: string;
  level: number;
  slotKey: string;
  mainStatKey: string;
  substats: Array<{
    key: string;
    upgrades: number;
  }>;
  location: string;
  lock: boolean;
  trash: boolean;
  id: string;
}

/**
 * ZOD 格式的角色数据
 */
export interface ZodCharacterData {
  key: string;
  level: number;
  core: number;
  mindscape: number;
  dodge: number;
  basic: number;
  chain: number;
  special: number;
  assist: number;
  promotion: number;
  potential: number;
  equippedDiscs: Record<string, string>;
  equippedWengine: string;
  id: string;
}

/**
 * ZOD 格式的音擎数据
 */
export interface ZodWengineData {
  key: string;
  level: number;
  modification: number;
  promotion: number;
  location: string;
  id: string;
}

/**
 * ZOD 格式的完整数据
 */
export interface ZodData {
  format: string;
  dbVersion: number;
  source: string;
  version: number;
  discs?: ZodDiscData[];
  characters?: ZodCharacterData[];
  wengines?: ZodWengineData[];
}

/**
 * ZOD 解析服务
 */
export class ZodParserService {
  private static instance: ZodParserService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ZodParserService {
    if (!ZodParserService.instance) {
      ZodParserService.instance = new ZodParserService();
    }
    return ZodParserService.instance;
  }

  /**
   * 解析 ZOD 格式数据
   */
  async parseZodData(data: ZodData): Promise<{
    agents: Map<string, Agent>;
    driveDisks: Map<string, DriveDisk>;
    wengines: Map<string, WEngine>;
  }> {
    const agents = new Map<string, Agent>();
    const driveDisks = new Map<string, DriveDisk>();
    const wengines = new Map<string, WEngine>();

    // 解析驱动盘
    if (data.discs) {
      for (const discData of data.discs) {
        const disk = await this.parseDisc(discData);
        if (disk) {
          driveDisks.set(disk.id, disk);
        }
      }
    }

    // 解析角色
    if (data.characters) {
      for (const charData of data.characters) {
        const agent = await this.parseCharacter(charData);
        if (agent) {
          agents.set(agent.id, agent);
        }
      }
    }

    // 解析音擎
    if (data.wengines) {
      for (const wengineData of data.wengines) {
        const wengine = await this.parseWengine(wengineData);
        if (wengine) {
          wengines.set(wengine.id, wengine);
        }
      }
    }

    return { agents, driveDisks, wengines };
  }

  /**
   * 解析驱动盘数据
   */
  private async parseDisc(data: ZodDiscData): Promise<DriveDisk | null> {
    try {
      // 解析稀有度
      const rarity = this.parseRarity(data.rarity);

      // 解析主属性
      const mainStat = this.parsePropertyType(data.mainStatKey);
      const mainStatValue = this.calculateMainStatValue(
        data.rarity,
        data.mainStatKey,
        data.level
      );

      // 解析副属性
      const subStats = new Map<PropertyType, StatValue>();
      for (const subData of data.substats) {
        const subKey = subData.key;
        const upgrades = subData.upgrades;
        const propType = this.parsePropertyType(subKey);
        // 存储强化次数（rolls），数值由 DriveDisk 计算方法处理
        subStats.set(propType, new StatValue(
          this.calculateSubStatValue(data.rarity, subKey, upgrades),
          subKey.endsWith('_')
        ));
      }

      // 获取套装信息
      const equipmentInfo = await this.getEquipmentInfo(data.setKey);
      const gameId = equipmentInfo?.id || data.setKey;
      const setNameCn = equipmentInfo?.CHS || data.setKey;
      
      // 创建驱动盘实例
      const disk = new DriveDisk(
        data.id,
        gameId,
        parseInt(data.slotKey) as DriveDiskPosition,
        rarity,
        data.level,
        mainStat,
        mainStatValue,
        subStats
      );
      
      // 设置装备信息
      disk.set_name = setNameCn;
      
      // 设置装备状态
      disk.equipped_agent = data.location || null;
      disk.locked = data.lock;
      
      return disk;
    } catch (error) {
      console.error(`Failed to parse disc ${data.id}:`, error);
      return null;
    }
  }

  /**
   * 解析角色数据
   */
  private async parseCharacter(data: ZodCharacterData): Promise<Agent | null> {
    try {
      // 解析技能等级（ZOD 格式中技能等级是数字）
      const skills = new AgentSkills(
        data.basic,
        data.dodge,
        data.assist,
        data.special,
        data.chain
      );

      // 解析影画等级
      const cinema = data.mindscape;

      // 获取角色游戏信息
      const gameInfo = await this.getCharacterInfo(data.key);
      const characterName = gameInfo?.CHS || data.key;
      const gameId = gameInfo?.id || data.key;

      const agent = new Agent(
        data.id,
        gameId,
        characterName,
        data.level,
        gameInfo ? Rarity[gameInfo.rank as keyof typeof Rarity] : Rarity.S,
        gameInfo ? ElementType[gameInfo.element as keyof typeof ElementType] : ElementType.PHYSICAL,
        gameInfo ? WeaponType[gameInfo.type as keyof typeof WeaponType] : WeaponType.ATTACK
      );

      agent.breakthrough = data.promotion; // 使用 promotion 字段
      agent.cinema = cinema;
      agent.core_skill = data.core;
      agent.skills = skills;

      return agent;
    } catch (error) {
      console.error(`Failed to parse character ${data.id}:`, error);
      return null;
    }
  }

  /**
   * 解析音擎数据
   */
  private async parseWengine(data: ZodWengineData): Promise<WEngine | null> {
    try {
      // 获取音擎游戏信息
      const gameInfo = await this.getWeaponInfo(data.key);

      if (!gameInfo) {
        console.warn(`Weapon not found: ${data.key}`);
        return null;
      }

      // 创建音擎实例
      const wengine = new WEngine(
        data.id,
        gameInfo.id,
        gameInfo.CHS || data.key
      );

      // 设置实例数据
      wengine.level = data.level;
      wengine.refinement = data.modification; // ZOD的modification对应refinement
      wengine.breakthrough = data.promotion;
      wengine.equipped_agent = data.location || null;

      // 加载音擎详细数据和Buff数据
      try {
        const wengineDetail = await dataLoaderService.getWeaponDetail(gameInfo.id);
        const wengineBuffData = await dataLoaderService.getWeaponBuff(gameInfo.id);

        // 设置基础属性（从 BaseProperty.Value 获取）
        if (wengineDetail.BaseProperty && wengineDetail.BaseProperty.Value !== undefined) {
          wengine.base_atk = wengineDetail.BaseProperty.Value;
        }

        // 设置副属性类型（从 RandProperty.Name 推断）
        if (wengineDetail.RandProperty) {
          const randPropName = wengineDetail.RandProperty.Name || wengineDetail.RandProperty.Name2;
          // 根据名称推断属性类型
          if (randPropName.includes('攻击力') && randPropName.includes('%')) {
            wengine.rand_stat_type = PropertyType.ATK_;
          } else if (randPropName.includes('攻击力')) {
            wengine.rand_stat_type = PropertyType.ATK;
          } else if (randPropName.includes('生命值') && randPropName.includes('%')) {
            wengine.rand_stat_type = PropertyType.HP_;
          } else if (randPropName.includes('生命值')) {
            wengine.rand_stat_type = PropertyType.HP;
          } else if (randPropName.includes('防御力') && randPropName.includes('%')) {
            wengine.rand_stat_type = PropertyType.DEF_;
          } else if (randPropName.includes('防御力')) {
            wengine.rand_stat_type = PropertyType.DEF;
          } else if (randPropName.includes('暴击率')) {
            wengine.rand_stat_type = PropertyType.CRIT_;
          } else if (randPropName.includes('暴击伤害')) {
            wengine.rand_stat_type = PropertyType.CRIT_DMG_;
          } else if (randPropName.includes('穿透')) {
            wengine.rand_stat_type = PropertyType.PEN_;
          } else if (randPropName.includes('异常精通')) {
            wengine.rand_stat_type = PropertyType.ANOM_PROF;
          }
        }

        // 设置副属性基础值
        if (wengineDetail.RandProperty && wengineDetail.RandProperty.Value !== undefined) {
          // 如果 Format 包含%，则是百分比属性，需要除以100
          const isPercent = wengineDetail.RandProperty.Format && wengineDetail.RandProperty.Format.includes('%');
          wengine.rand_stat = isPercent ? wengineDetail.RandProperty.Value / 100 : wengineDetail.RandProperty.Value;
        }

        // 设置等级成长数据（从 Level 获取）
        if (wengineDetail.Level) {
          for (const [level, levelData] of Object.entries(wengineDetail.Level)) {
            wengine.level_data.set(
              parseInt(level),
              { 
                level: parseInt(level),
                exp: (levelData as any).Exp || 0,
                rate: (levelData as any).Rate || 0
              } as any
            );
          }
        }

        // 加载天赋数据（从 wengineBuffData.talents 获取）
        if (wengineBuffData.talents) {
          for (const talentData of wengineBuffData.talents) {
            wengine.talents.push({
              level: talentData.level,
              name: talentData.name,
              description: talentData.description || '',
              buffs: (talentData.buffs || []).map((b: any) => ({
                id: b.id,
                name: b.name,
                description: b.description || '',
                is_active: true,
                target_type: 0,
                out_of_combat: new Map(),
                in_combat: new Map(),
                dependencies: []
              } as any))
            } as any);
          }
        }
      } catch (err) {
        console.warn(`加载音擎数据失败: ${data.key}`, err);
      }

      return wengine;
    } catch (error) {
      console.error(`Failed to parse wengine ${data.id}:`, error);
      return null;
    }
  }

  /**
   * 解析稀有度
   */
  private parseRarity(rarityStr: string): Rarity {
    switch (rarityStr) {
      case 'S':
        return Rarity.S;
      case 'A':
        return Rarity.A;
      case 'B':
        return Rarity.B;
      default:
        return Rarity.S;
    }
  }

  /**
   * 解析属性类型
   */
  private parsePropertyType(key: string): PropertyType {
    const mapping: Record<string, PropertyType> = {
      'hp': PropertyType.HP,
      'hp_': PropertyType.HP_,
      'atk': PropertyType.ATK,
      'atk_': PropertyType.ATK_,
      'def': PropertyType.DEF,
      'def_': PropertyType.DEF_,
      'crit_': PropertyType.CRIT_,
      'crit_dmg_': PropertyType.CRIT_DMG_,
      'pen': PropertyType.PEN,
      'pen_': PropertyType.PEN_,
      'anomProf': PropertyType.ANOM_PROF,
      'anomMas_': PropertyType.ANOM_MAS_,
      'impact': PropertyType.IMPACT,
      'impact_': PropertyType.IMPACT_,
      'energyRegen_': PropertyType.ENER_REGEN_,
      'physical_dmg_': PropertyType.PHYSICAL_DMG_,
      'fire_dmg_': PropertyType.FIRE_DMG_,
      'ice_dmg_': PropertyType.ICE_DMG_,
      'electric_dmg_': PropertyType.ELECTRIC_DMG_,
      'ether_dmg_': PropertyType.ETHER_DMG_,
    };
    return mapping[key] || PropertyType.HP;
  }

  /**
   * 计算主词条数值
   */
  private calculateMainStatValue(
    rarityStr: string,
    statKey: string,
    level: number
  ): StatValue {
    // 满级数值表
    const mainStatMaxValues: Record<string, Record<string, number>> = {
      'S': {
        'atk_': 0.30, 'hp_': 0.30, 'def_': 0.48,
        'crit_': 0.24, 'crit_dmg_': 0.48, 'pen_': 0.24,
        'atk': 316, 'hp': 2200, 'def': 184, 'anomProf': 92,
        'fire_dmg_': 0.30, 'ice_dmg_': 0.30, 'electric_dmg_': 0.30,
        'physical_dmg_': 0.30, 'ether_dmg_': 0.30,
        'anomMas_': 0.30, 'impact_': 0.18, 'enerRegen_': 0.60,
        'energyRegen_': 0.60, 'impact': 100,
      },
      'A': {
        'atk_': 0.20, 'hp_': 0.20, 'def_': 0.32,
        'crit_': 0.16, 'crit_dmg_': 0.32, 'pen_': 0.16,
        'atk': 212, 'hp': 1468, 'def': 124, 'anomProf': 60,
        'fire_dmg_': 0.20, 'ice_dmg_': 0.20, 'electric_dmg_': 0.20,
        'physical_dmg_': 0.20, 'ether_dmg_': 0.20,
        'anomMas_': 0.20, 'impact_': 0.12, 'enerRegen_': 0.40,
        'energyRegen_': 0.40, 'impact': 66,
      },
      'B': {
        'atk_': 0.10, 'hp_': 0.10, 'def_': 0.16,
        'crit_': 0.08, 'crit_dmg_': 0.16, 'pen_': 0.08,
        'atk': 104, 'hp': 734, 'def': 60, 'anomProf': 32,
        'fire_dmg_': 0.10, 'ice_dmg_': 0.10, 'electric_dmg_': 0.10,
        'physical_dmg_': 0.10, 'ether_dmg_': 0.10,
        'anomMas_': 0.10, 'impact_': 0.06, 'enerRegen_': 0.20,
        'energyRegen_': 0.20, 'impact': 33,
      }
    };

    // 最大等级
    const maxLevels: Record<string, number> = { 'S': 15, 'A': 12, 'B': 9 };

    const maxVal = mainStatMaxValues[rarityStr]?.[statKey] || 0;
    const maxLevel = maxLevels[rarityStr] || 15;
    const calculatedVal = maxVal * (0.25 + (0.75 * level) / maxLevel);

    return new StatValue(calculatedVal, statKey.endsWith('_'));
  }

  /**
   * 计算副词条数值
   */
  private calculateSubStatValue(
    rarityStr: string,
    statKey: string,
    rolls: number
  ): number {
    // 副词条基础数值表
    const subStatBaseValues: Record<string, Record<string, number>> = {
      'S': {
        'atk': 19, 'hp': 112, 'def': 15, 'pen': 9, 'anomProf': 9,
        'atk_': 0.03, 'hp_': 0.03, 'def_': 0.048,
        'crit_': 0.024, 'crit_dmg_': 0.048
      },
      'A': {
        'atk': 15, 'hp': 79, 'def': 10, 'pen': 6, 'anomProf': 6,
        'atk_': 0.02, 'hp_': 0.02, 'def_': 0.032,
        'crit_': 0.016, 'crit_dmg_': 0.032
      },
      'B': {
        'atk': 7, 'hp': 39, 'def': 5, 'pen': 3, 'anomProf': 3,
        'atk_': 0.01, 'hp_': 0.01, 'def_': 0.016,
        'crit_': 0.008, 'crit_dmg_': 0.016
      }
    };

    const baseVal = subStatBaseValues[rarityStr]?.[statKey] || 0;
    return baseVal * rolls;
  }

  /**
   * 解析技能等级
   */
  private parseSkillLevel(skillStr: string): number {
    if (skillStr.includes('/')) {
      return parseInt(skillStr.split('/')[0]);
    }
    return parseInt(skillStr);
  }

  /**
   * 解析影画等级
   */
  private parseCinemaLevel(cinemaStr: string): number {
    if (cinemaStr.includes('/')) {
      return parseInt(cinemaStr.split('/')[0]);
    }
    return parseInt(cinemaStr);
  }

  /**
   * 获取角色信息
   */
  private async getCharacterInfo(key: string): Promise<any> {
    const characterData = dataLoaderService.characterData;
    if (!characterData) {
      return null;
    }

    // 标准化输入key（去掉空格和特殊字符）
    const normalizedKey = key.replace(/[\s'\-]/g, '').toLowerCase();

    // 遍历查找匹配的角色
    for (const [id, char] of characterData) {
      // 检查所有语言字段
      const languageFields: (keyof typeof char)[] = ['EN', 'CHS', 'JP', 'KR', 'code'];
      for (const langField of languageFields) {
        const langValue = char[langField];
        if (langValue) {
          const normalizedLangValue = langValue.replace(/[\s'\-]/g, '').toLowerCase();
          if (normalizedLangValue === normalizedKey) {
            return { ...char, id };
          }
        }
      }
    }

    return null;
  }

  /**
   * 获取音擎信息
   */
  private async getWeaponInfo(key: string): Promise<{ id: string; EN: string; CHS: string } | null> {
    const weaponData = dataLoaderService.weaponData;
    if (!weaponData) {
      return null;
    }

    // 标准化输入key（去掉空格和特殊字符）
    const normalizedKey = key.replace(/[\s'\-]/g, '').toLowerCase();

    // 遍历查找匹配的音擎
    for (const [id, weapon] of weaponData) {
      // 检查所有语言字段
      const languageFields: (keyof typeof weapon)[] = ['EN', 'CHS', 'JP', 'KR'];
      for (const langField of languageFields) {
        const langValue = weapon[langField];
        if (langValue) {
          const normalizedLangValue = langValue.replace(/[\s'\-]/g, '').toLowerCase();
          if (normalizedLangValue === normalizedKey) {
            return { ...weapon, id };
          }
        }
      }
    }

    return null;
  }

  /**
   * 获取驱动盘套装信息
   */
  private async getEquipmentInfo(setKey: string): Promise<{ id: string; CHS: string } | null> {
    const equipmentData = dataLoaderService.equipmentData;
    if (!equipmentData) {
      return null;
    }

    // 标准化输入setKey（去掉空格和特殊字符）
    const normalizedKey = setKey.replace(/[\s'\-]/g, '').toLowerCase();

    // 遍历查找匹配的套装
    for (const [id, equip] of equipmentData) {
      // 检查各语言名称
      for (const langKey of ['EN', 'CHS', 'JA', 'KO']) {
        if (equip[langKey] && equip[langKey].name) {
          const langName = equip[langKey].name;
          const normalizedLangName = langName.replace(/[\s'\-]/g, '').toLowerCase();

          if (normalizedLangName === normalizedKey) {
            return { 
              id, 
              CHS: equip.CHS?.name || equip.EN?.name || setKey 
            };
          }
        }
      }
    }

    return null;
  }
}

// 导出单例实例
export const zodParserService = ZodParserService.getInstance();