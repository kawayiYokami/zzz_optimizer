/**
 * 驱动盘模型
 */

import { Rarity, PropertyType, StatValue } from './base';
import { Buff, BuffSource, BuffContext } from './buff';
import { PropertyCollection } from './property-collection';
import type { ZodDiscData } from './save-data-simple';
import type { dataLoaderService } from '../services/data-loader.service';

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
   * 获取属性（主词条+副词条）
   *
   * @returns 属性集合
   */
  getStats(): PropertyCollection {
    const outOfCombat = new Map<PropertyType, number>();
    const inCombat = new Map<PropertyType, number>();

    // 主词条
    if (this.main_stat_value.value !== 0) {
      const value = this.main_stat_value.isPercent
        ? this.main_stat_value.value / 100.0
        : this.main_stat_value.value;
      outOfCombat.set(this.main_stat, value);
    }

    // 副词条
    for (const [prop, statValue] of this.sub_stats.entries()) {
      const value = statValue.isPercent ? statValue.value / 100.0 : statValue.value;
      outOfCombat.set(prop, (outOfCombat.get(prop) ?? 0) + value);
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

    // 5. 计算主词条数值（需要根据稀有度、等级、属性类型计算）
    const mainStatValue = calculateMainStatValue(mainStat, rarity, zodData.level);

    // 6. 解析副词条
    const subStats = new Map<PropertyType, StatValue>();
    if (zodData.substats) {
      for (const substat of zodData.substats) {
        const propType = parsePropertyType(substat.key);
        const statValue = calculateSubStatValue(propType, rarity, substat.upgrades);
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
    'HP_': PropertyType.HP_PERCENT,
    'ATK_': PropertyType.ATK_PERCENT,
    'DEF_': PropertyType.DEF_PERCENT,
    'CRIT_': PropertyType.CRIT_RATE,
    'CRIT_DMG_': PropertyType.CRIT_DMG,
    'PEN_': PropertyType.PEN_PERCENT,
    'ANOMALY_PROFICIENCY': PropertyType.ANOMALY_PROFICIENCY,
    'PHYSICAL_DMG_': PropertyType.PHYSICAL_DMG_PERCENT,
    'FIRE_DMG_': PropertyType.FIRE_DMG_PERCENT,
    'ICE_DMG_': PropertyType.ICE_DMG_PERCENT,
    'ELECTRIC_DMG_': PropertyType.ELECTRIC_DMG_PERCENT,
    'ETHER_DMG_': PropertyType.ETHER_DMG_PERCENT,
    'ENERGY_REGEN': PropertyType.ENERGY_REGEN,
    'IMPACT': PropertyType.IMPACT_PERCENT,
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
  return PropertyType.HP_BASE;
}

/**
 * 计算主词条数值
 */
function calculateMainStatValue(
  propType: PropertyType,
  rarity: Rarity,
  level: number
): StatValue {
  // 简化实现：根据属性类型判断是否为百分比
  const isPercent = [
    PropertyType.HP_PERCENT,
    PropertyType.ATK_PERCENT,
    PropertyType.DEF_PERCENT,
    PropertyType.CRIT_RATE,
    PropertyType.CRIT_DMG,
    PropertyType.PEN_PERCENT,
    PropertyType.PHYSICAL_DMG_PERCENT,
    PropertyType.FIRE_DMG_PERCENT,
    PropertyType.ICE_DMG_PERCENT,
    PropertyType.ELECTRIC_DMG_PERCENT,
    PropertyType.ETHER_DMG_PERCENT,
    PropertyType.IMPACT_PERCENT,
    PropertyType.ENERGY_REGEN,
  ].includes(propType);

  // 基础值（根据稀有度）
  let baseValue = 0;
  if (rarity === Rarity.S) {
    baseValue = isPercent ? 30.0 : 150;
  } else if (rarity === Rarity.A) {
    baseValue = isPercent ? 24.0 : 120;
  } else {
    baseValue = isPercent ? 18.0 : 90;
  }

  // 成长系数（每级增长约4%）
  const growthRate = 0.04;
  const value = baseValue * (1 + growthRate * level);

  return new StatValue(value, isPercent);
}

/**
 * 计算副词条数值
 */
function calculateSubStatValue(
  propType: PropertyType,
  rarity: Rarity,
  upgrades: number
): StatValue {
  // 简化实现：根据属性类型判断是否为百分比
  const isPercent = [
    PropertyType.HP_PERCENT,
    PropertyType.ATK_PERCENT,
    PropertyType.DEF_PERCENT,
    PropertyType.CRIT_RATE,
    PropertyType.CRIT_DMG,
    PropertyType.PEN_PERCENT,
    PropertyType.ANOMALY_PROFICIENCY,
  ].includes(propType);

  // 基础值（根据稀有度）
  let baseValue = 0;
  if (rarity === Rarity.S) {
    baseValue = isPercent ? 3.0 : 30;
  } else if (rarity === Rarity.A) {
    baseValue = isPercent ? 2.4 : 24;
  } else {
    baseValue = isPercent ? 1.8 : 18;
  }

  // 每次强化增加一次基础值
  const value = baseValue * (1 + upgrades);

  return new StatValue(value, isPercent);
}
