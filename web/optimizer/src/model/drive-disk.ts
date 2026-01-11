/**
 * 驱动盘模型
 */

import { Rarity, PropertyType, StatValue } from './base';
import { Buff } from './buff';
import { PropertyCollection } from './property-collection';
import type { ZodDiscData } from './save-data-simple';
import type { dataLoaderService } from '../services/data-loader.service';

/**
 * 驱动盘数值计算数据
 */
const DriveDiskStats = {
  // 主词条满级数值表 {稀有度: {键名: 数值}}
  MAIN_STAT_MAX_VALUES: {
    'S': {
      'atk_': 0.30, 'hp_': 0.30, 'def_': 0.48,
      'crit_': 0.24, 'crit_dmg_': 0.48, 'pen_': 0.24,
      'atk': 316, 'hp': 2200, 'def': 184, 'anomProf': 92,
      'fire_dmg_': 0.30, 'ice_dmg_': 0.30, 'electric_dmg_': 0.30,
      'physical_dmg_': 0.30, 'ether_dmg_': 0.30,
      'anomMas_': 0.30, 'impact_': 0.18, 'enerRegen_': 0.60,
      'energyRegen_': 0.60,
      'impact': 100,
    },
    'A': {
      'atk_': 0.20, 'hp_': 0.20, 'def_': 0.32,
      'crit_': 0.16, 'crit_dmg_': 0.32, 'pen_': 0.16,
      'atk': 212, 'hp': 1468, 'def': 124, 'anomProf': 60,
      'fire_dmg_': 0.20, 'ice_dmg_': 0.20, 'electric_dmg_': 0.20,
      'physical_dmg_': 0.20, 'ether_dmg_': 0.20,
      'anomMas_': 0.20, 'impact_': 0.12, 'enerRegen_': 0.40,
      'energyRegen_': 0.40,
      'impact': 66,
    },
    'B': {
      'atk_': 0.10, 'hp_': 0.10, 'def_': 0.16,
      'crit_': 0.08, 'crit_dmg_': 0.16, 'pen_': 0.08,
      'atk': 104, 'hp': 734, 'def': 60, 'anomProf': 32,
      'fire_dmg_': 0.10, 'ice_dmg_': 0.10, 'electric_dmg_': 0.10,
      'physical_dmg_': 0.10, 'ether_dmg_': 0.10,
      'anomMas_': 0.10, 'impact_': 0.06, 'enerRegen_': 0.20,
      'energyRegen_': 0.20,
      'impact': 33,
    }
  },

  // 副词条基础数值表（每次强化）{稀有度: {键名: 数值}}
  SUB_STAT_BASE_VALUES: {
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
  },

  // 最大等级
  MAX_LEVELS: { 'S': 15, 'A': 12, 'B': 9 },

  // 计算主词条数值
  calculateMainStatValue(rarityStr: 'S' | 'A' | 'B', statKey: string, level: number): number {
    const maxVal = (this.MAIN_STAT_MAX_VALUES[rarityStr] as any)[statKey];
    const maxLevel = this.MAX_LEVELS[rarityStr];
    return maxVal * (0.25 + (0.75 * level) / maxLevel);
  },

  // 计算副词条数值
  calculateSubStatValue(rarityStr: 'S' | 'A' | 'B', statKey: string, rolls: number): number {
    const baseVal = (this.SUB_STAT_BASE_VALUES[rarityStr] as any)[statKey];
    return baseVal * rolls;
  }
};

/**
 * 驱动盘位置
 */
export enum DriveDiskPosition {
  SLOT_1 = 1, // 1号位
  SLOT_2 = 2, // 2号位
  SLOT_3 = 3, // 3号位
  SLOT_4 = 4, // 4号位
  SLOT_5 = 5, // 5号位
  SLOT_6 = 6, // 6号位
}

/**
 * 驱动盘套装加成类型
 */
export enum DriveDiskSetBonus {
  TWO_PIECE = 2, // 2件套效果
  FOUR_PIECE = 4, // 4件套效果
}

/**
 * 驱动盘模型
 */
export class DriveDisk {
  // 实例ID（存档中的唯一标识）
  id: string;

  // 游戏ID（对应equipment.json中的键）
  game_id: string;

  // 套装信息（从游戏数据加载）
  set_name: string = '';
  set_name_cn: string = '';

  // 位置
  position: DriveDiskPosition;

  // 稀有度
  rarity: Rarity;

  // 等级
  level: number;

  // 主词条
  main_stat: PropertyType;
  main_stat_value: StatValue;

  // 副词条
  sub_stats: Map<PropertyType, StatValue>;

  // 装备状态
  equipped_agent: string | null = null;
  locked: boolean = false;

  // 套装Buff（从游戏数据加载）
  two_piece_buffs: Buff[] = [];
  four_piece_buffs: Buff[] = [];

  constructor(
    id: string,
    gameId: string,
    position: DriveDiskPosition,
    rarity: Rarity,
    level: number,
    mainStat: PropertyType,
    mainStatValue: StatValue,
    subStats?: Map<PropertyType, StatValue>
  ) {
    this.id = id;
    this.game_id = gameId;
    this.position = position;
    this.rarity = rarity;
    this.level = level;
    this.main_stat = mainStat;
    this.main_stat_value = mainStatValue;
    this.sub_stats = subStats ?? new Map();
  }

  /**
   * 将 PropertyType 转换为键名
   */
  private propertyTypeToKey(propType: PropertyType): string {
    const mapping: Record<number, string> = {
      [PropertyType.HP]: 'hp',
      [PropertyType.HP_]: 'hp_',
      [PropertyType.ATK]: 'atk',
      [PropertyType.ATK_]: 'atk_',
      [PropertyType.DEF]: 'def',
      [PropertyType.DEF_]: 'def_',
      [PropertyType.PEN]: 'pen',
      [PropertyType.PEN_]: 'pen_',
      [PropertyType.CRIT_]: 'crit_',
      [PropertyType.CRIT_RATE_]: 'crit_',
      [PropertyType.CRIT_DMG_]: 'crit_dmg_',
      [PropertyType.ANOM_PROF]: 'anomProf',
      [PropertyType.ANOM_MAS_]: 'anomMas_',
      [PropertyType.IMPACT]: 'impact',
      [PropertyType.IMPACT_]: 'impact_',
      [PropertyType.ENER_REGEN]: 'energyRegen',
      [PropertyType.ENER_REGEN_]: 'energyRegen_',
      [PropertyType.PHYSICAL_DMG_]: 'physical_dmg_',
      [PropertyType.FIRE_DMG_]: 'fire_dmg_',
      [PropertyType.ICE_DMG_]: 'ice_dmg_',
      [PropertyType.ELECTRIC_DMG_]: 'electric_dmg_',
      [PropertyType.ETHER_DMG_]: 'ether_dmg_',
    };
    return mapping[propType] || '';
  }

  /**
   * 获取属性（主词条+副词条）
   *
   * @returns 属性集合
   */
  getStats(): PropertyCollection {
    const outOfCombat = new Map<PropertyType, number>();
    const inCombat = new Map<PropertyType, number>();

    // 获取稀有度字符串
    const rarityStr = Rarity[this.rarity];

    // 1. 计算主词条数值
    const mainStatKey = this.propertyTypeToKey(this.main_stat);
    const rarity = rarityStr as 'S' | 'A' | 'B';
    if (mainStatKey && (DriveDiskStats.MAIN_STAT_MAX_VALUES[rarity] as any)[mainStatKey] !== undefined) {
      const mainStatValue = DriveDiskStats.calculateMainStatValue(rarity, mainStatKey, this.level);
      outOfCombat.set(this.main_stat, mainStatValue);
    }

    // 2. 计算副词条数值
    for (const [prop, statValue] of this.sub_stats.entries()) {
      const subStatKey = this.propertyTypeToKey(prop);
      if (subStatKey && (DriveDiskStats.SUB_STAT_BASE_VALUES[rarity] as any)[subStatKey] !== undefined) {
        // statValue.value 存储的是强化次数（rolls）
        const rolls = statValue.value;
        const subStatValue = DriveDiskStats.calculateSubStatValue(rarity, subStatKey, rolls);
        outOfCombat.set(prop, (outOfCombat.get(prop) ?? 0) + subStatValue);
      }
    }

    return new PropertyCollection(outOfCombat, inCombat);
  }

  /**
   * 获取套装Buff
   *
   * @param setBonus 套装加成类型
   * @returns 属性集合
   */
  getSetBuff(setBonus: DriveDiskSetBonus): PropertyCollection {
    const collections: PropertyCollection[] = [];

    if (setBonus === DriveDiskSetBonus.TWO_PIECE) {
      for (const buff of this.two_piece_buffs) {
        collections.push(buff.toPropertyCollection());
      }
    } else if (setBonus === DriveDiskSetBonus.FOUR_PIECE) {
      for (const buff of this.four_piece_buffs) {
        collections.push(buff.toPropertyCollection());
      }
    }

    return PropertyCollection.mergeAll(collections);
  }

  /**
   * 转为字典（只序列化实例特有数据）
   */
  toDict(): any {
    const subStatsDict: Record<string, any> = {};
    for (const [prop, statValue] of this.sub_stats.entries()) {
      subStatsDict[PropertyType[prop]] = {
        value: statValue.value,
        isPercent: statValue.isPercent,
      };
    }

    return {
      game_id: this.game_id,
      position: this.position,
      rarity: this.rarity,
      level: this.level,
      main_stat: this.main_stat,
      main_stat_value: {
        value: this.main_stat_value.value,
        isPercent: this.main_stat_value.isPercent,
      },
      sub_stats: subStatsDict,
      equipped_agent: this.equipped_agent,
      locked: this.locked,
    };
  }

  /**
   * 从ZOD数据创建DriveDisk实例
   *
   * @param zodData ZOD驱动盘数据
   * @param dataLoader 数据加载服务
   * @returns DriveDisk实例
   */
  static async fromZodData(
    zodData: ZodDiscData,
    dataLoader: typeof dataLoaderService
  ): Promise<DriveDisk> {
    // 1. 根据setKey查找游戏数据中的驱动盘套装ID
    let gameEquipId: string | null = null;
    const equipmentMap = dataLoader.equipmentData;
    if (equipmentMap) {
      const normalized = zodData.setKey.replace(/[\s']/g, '').toLowerCase();
      for (const [id, data] of equipmentMap.entries()) {
        if (data.EN && data.EN.name) {
          const equipNormalized = data.EN.name.replace(/[\s']/g, '').toLowerCase();
          if (data.EN.name === zodData.setKey || equipNormalized === normalized) {
            gameEquipId = id;
            break;
          }
        }
      }
    }

    if (!gameEquipId) {
      throw new Error(`未找到驱动盘套装游戏数据: ${zodData.setKey}`);
    }

    // 2. 解析位置（slotKey: "1" -> DriveDiskPosition.SLOT_1）
    const slotNum = parseInt(zodData.slotKey);
    if (slotNum < 1 || slotNum > 6) {
      throw new Error(`无效的驱动盘位置: ${zodData.slotKey}`);
    }
    const position = slotNum as DriveDiskPosition;

    // 3. 解析稀有度（rarity: "S" -> Rarity.S）
    let rarity: Rarity;
    switch (zodData.rarity.toUpperCase()) {
      case 'S':
        rarity = Rarity.S;
        break;
      case 'A':
        rarity = Rarity.A;
        break;
      case 'B':
        rarity = Rarity.B;
        break;
      default:
        rarity = Rarity.B;
    }

    // 4. 解析主词条类型（mainStatKey: "CRIT_" -> PropertyType.CRIT_RATE）
    const mainStat = parsePropertyType(zodData.mainStatKey);

    // 5. 主词条数值将在 getStats() 中动态计算，这里使用占位值
    const mainStatValue = new StatValue(0, false);

    // 6. 解析副词条
    const subStats = new Map<PropertyType, StatValue>();
    if (zodData.substats) {
      for (const substat of zodData.substats) {
        const propType = parsePropertyType(substat.key);
        // value 存储强化次数（rolls），而不是实际数值
        const statValue = new StatValue(substat.upgrades, false);
        subStats.set(propType, statValue);
      }
    }

    // 7. 创建DriveDisk实例
    const disk = new DriveDisk(
      zodData.id,
      gameEquipId,
      position,
      rarity,
      zodData.level,
      mainStat,
      mainStatValue,
      subStats
    );

    // 8. 设置实例数据
    const equipmentInfo = equipmentMap!.get(gameEquipId)!;
    disk.set_name = equipmentInfo.EN?.name || zodData.setKey;
    disk.set_name_cn = equipmentInfo.CHS?.name || disk.set_name;
    disk.equipped_agent = zodData.location || null;
    disk.locked = zodData.lock;

    // 9. 加载套装Buff数据
    try {
      const equipBuffData = await dataLoader.getEquipmentBuff(gameEquipId);

      // 2件套Buff
      if (equipBuffData.two_piece_buffs) {
        disk.two_piece_buffs = equipBuffData.two_piece_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 4件套Buff
      if (equipBuffData.four_piece_buffs) {
        disk.four_piece_buffs = equipBuffData.four_piece_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }
    } catch (err) {
      console.warn(`加载驱动盘套装Buff数据失败: ${zodData.setKey}`, err);
    }

    return disk;
  }
}

/**
 * 解析属性类型
 */
function parsePropertyType(key: string): PropertyType {
  // ZOD的key可能是简写形式，需要映射到PropertyType
  const keyMap: Record<string, PropertyType> = {
    'HP_': PropertyType.HP_,
    'ATK_': PropertyType.ATK_,
    'DEF_': PropertyType.DEF_,
    'CRIT_': PropertyType.CRIT_,
    'CRIT_DMG_': PropertyType.CRIT_DMG_,
    'PEN_': PropertyType.PEN_,
    'ANOMALY_PROFICIENCY': PropertyType.ANOM_PROF,
    'PHYSICAL_DMG_': PropertyType.PHYSICAL_DMG_,
    'FIRE_DMG_': PropertyType.FIRE_DMG_,
    'ICE_DMG_': PropertyType.ICE_DMG_,
    'ELECTRIC_DMG_': PropertyType.ELECTRIC_DMG_,
    'ETHER_DMG_': PropertyType.ETHER_DMG_,
    'ENERGY_REGEN': PropertyType.ENER_REGEN,
    'IMPACT': PropertyType.IMPACT,
    // 添加缺失的映射（小写形式）
    'hp': PropertyType.HP,
    'hp_': PropertyType.HP_,
    'atk': PropertyType.ATK,
    'atk_': PropertyType.ATK_,
    'def': PropertyType.DEF,
    'def_': PropertyType.DEF_,
    'pen': PropertyType.PEN,
    'pen_': PropertyType.PEN_,
    'crit_': PropertyType.CRIT_,
    'crit_dmg_': PropertyType.CRIT_DMG_,
  };

  const mapped = keyMap[key];
  if (mapped !== undefined) {
    return mapped;
  }

  // 尝试直接匹配PropertyType枚举
  const propType = (PropertyType as any)[key];
  if (propType !== undefined) {
    return propType;
  }

  console.warn(`未知的属性类型: ${key}`);
  return PropertyType.HP;
}
