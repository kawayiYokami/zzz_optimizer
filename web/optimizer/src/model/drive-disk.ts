/**
 * 驱动盘模型
 */

import { Rarity, PropertyType, StatValue, isPercentageProperty } from './base';
import { Buff } from './buff';
import { PropertyCollection } from './property-collection';
import type { ZodDiscData } from './save-data-zod';
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
  set_name: string = ''; // 套装中文名

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

  // 套装属性和Buff（从游戏数据加载）
  set_properties: Buff[] = []; // 2件套属性（静态，直接加面板）
  set_buffs: Buff[] = []; // 4件套Buff（动态，战斗生效）

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
   * 获取副词条（包含强化次数）
   *
   * @returns 副词条数组，每项包含属性类型、数值、是否百分比、强化次数
   */
  getSubStatsWithRolls(): Array<{
    prop: PropertyType;
    value: number;
    isPercent: boolean;
    rolls: number;
  }> {
    const result: Array<{
      prop: PropertyType;
      value: number;
      isPercent: boolean;
      rolls: number;
    }> = [];

    const rarityStr = Rarity[this.rarity] as 'S' | 'A' | 'B';

    for (const [prop, statValue] of this.sub_stats.entries()) {
      const subStatKey = this.propertyTypeToKey(prop);
      
      if (subStatKey && (DriveDiskStats.SUB_STAT_BASE_VALUES[rarityStr] as any)[subStatKey] !== undefined) {
        // statValue.value 存储的是强化次数（rolls）
        const rolls = statValue.value;
        const actualValue = DriveDiskStats.calculateSubStatValue(rarityStr, subStatKey, rolls);
        
        // 根据数值判断是否是百分比（小于1的认为是百分比）
        const isPercent = actualValue < 1;
        
        // 强化次数显示为 rolls - 1（因为初始有1条副词条）
        const displayRolls = Math.max(0, rolls - 1);

        result.push({
          prop: prop,
          value: actualValue,
          isPercent: isPercent,
          rolls: displayRolls
        });
      } else {
        // 记录无法识别的副词条
        console.warn(`驱动盘副词条无法识别:`, {
          diskId: this.id,
          diskName: this.set_name,
          propId: prop,
          propKey: subStatKey,
          rolls: statValue.value,
          rarity: rarityStr
        });
      }
    }

    return result;
  }

  /**
   * 获取用于支配关系剪枝的有效词条总分
   *
   * 计算规则：
   * - 主词条 = 10条
   * - 副词条 = 1条（强化次数）
   * - 固定值属性（HP/ATK/DEF/PEN）如果用户选择的是百分比属性，按 1/3 折算
   *
   * @param effectiveStats 有效词条列表
   * @returns 有效词条总分
   */
  getEffectiveStatCounts(effectiveStats: PropertyType[]): number {
    let totalScore = 0;

    // 固定值到百分比的映射
    const flatToPercentMap: Partial<Record<PropertyType, PropertyType>> = {
      [PropertyType.ATK]: PropertyType.ATK_,
      [PropertyType.HP]: PropertyType.HP_,
      [PropertyType.DEF]: PropertyType.DEF_,
      [PropertyType.PEN]: PropertyType.PEN_,
    };

    // 检查属性是否是有效词条（支持固定值映射）
    const isEffectiveStat = (prop: PropertyType): boolean => {
      // 直接匹配
      if (effectiveStats.includes(prop)) return true;
      // 固定值映射到百分比
      const percentType = flatToPercentMap[prop];
      return percentType !== undefined && effectiveStats.includes(percentType);
    };

    // 获取用户选择的有效词条类型（用于判断是否需要折算）
    const getEffectiveStatType = (prop: PropertyType): PropertyType | null => {
      // 直接匹配
      if (effectiveStats.includes(prop)) return prop;
      // 固定值映射到百分比
      const percentType = flatToPercentMap[prop];
      if (percentType !== undefined && effectiveStats.includes(percentType)) {
        return percentType;
      }
      return null;
    };

    // 主词条：10条（如果属于有效词条）
    if (isEffectiveStat(this.main_stat)) {
      totalScore += 10;
    }

    // 副词条：1条（强化次数，如果属于有效词条）
    for (const [prop, statValue] of this.sub_stats.entries()) {
      if (!isEffectiveStat(prop)) continue;

      const rolls = statValue.value; // 强化次数（词条数）
      const effectiveType = getEffectiveStatType(prop);

      // 如果用户选择的是百分比属性，而当前是固定值属性，按 1/3 折算
      const shouldDiscount = effectiveType !== null &&
        flatToPercentMap[prop] === effectiveType;

      // 固定值属性按 1/3 折算（当用户选择的是百分比属性时）
      const count = shouldDiscount ? rolls / 3 : rolls;
      totalScore += count;
    }

    return totalScore;
  }

  /**
   * 获取用于支配关系剪枝的有效词条详细分布
   *
   * 计算规则：
   * - 主词条 = 10条
   * - 副词条 = 1条（强化次数）
   * - 固定值属性（HP/ATK/DEF/PEN）如果用户选择的是百分比属性，按 1/3 折算
   *
   * @param effectiveStats 有效词条列表
   * @returns 有效词条类型 -> 词条数的映射（只包含有效词条）
   */
  getEffectiveStatDetails(effectiveStats: PropertyType[]): Map<PropertyType, number> {
    const result = new Map<PropertyType, number>();

    // 固定值到百分比的映射
    const flatToPercentMap: Partial<Record<PropertyType, PropertyType>> = {
      [PropertyType.ATK]: PropertyType.ATK_,
      [PropertyType.HP]: PropertyType.HP_,
      [PropertyType.DEF]: PropertyType.DEF_,
      [PropertyType.PEN]: PropertyType.PEN_,
    };

    // 检查属性是否是有效词条（支持固定值映射）
    const isEffectiveStat = (prop: PropertyType): boolean => {
      // 直接匹配
      if (effectiveStats.includes(prop)) return true;
      // 固定值映射到百分比
      const percentType = flatToPercentMap[prop];
      return percentType !== undefined && effectiveStats.includes(percentType);
    };

    // 获取用户选择的有效词条类型（用于判断是否需要折算）
    const getEffectiveStatType = (prop: PropertyType): PropertyType | null => {
      // 直接匹配
      if (effectiveStats.includes(prop)) return prop;
      // 固定值映射到百分比
      const percentType = flatToPercentMap[prop];
      if (percentType !== undefined && effectiveStats.includes(percentType)) {
        return percentType;
      }
      return null;
    };

    // 主词条：10条（如果属于有效词条）
    if (isEffectiveStat(this.main_stat)) {
      result.set(this.main_stat, 10);
    }

    // 副词条：1条（强化次数，如果属于有效词条）
    for (const [prop, statValue] of this.sub_stats.entries()) {
      if (!isEffectiveStat(prop)) continue;

      const rolls = statValue.value; // 强化次数（词条数）
      const effectiveType = getEffectiveStatType(prop);

      // 如果用户选择的是百分比属性，而当前是固定值属性，按 1/3 折算
      const shouldDiscount = effectiveType !== null &&
        flatToPercentMap[prop] === effectiveType;

      // 固定值属性按 1/3 折算（当用户选择的是百分比属性时）
      const count = shouldDiscount ? rolls / 3 : rolls;
      result.set(prop, (result.get(prop) ?? 0) + count);
    }

    return result;
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
      for (const buff of this.set_properties) {
        collections.push(buff.toPropertyCollection());
      }
    } else if (setBonus === DriveDiskSetBonus.FOUR_PIECE) {
      for (const buff of this.set_buffs) {
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
   * 从字典创建DriveDisk实例（用于反序列化）
   *
   * @param data 字典数据
   * @param id 实例ID
   * @param dataLoader 数据加载服务
   * @returns DriveDisk实例
   */
  static async fromDict(
    data: any,
    id: string,
    dataLoader: typeof dataLoaderService
  ): Promise<DriveDisk> {
    // 恢复副词条Map
    const subStats = new Map<PropertyType, StatValue>();
    if (data.sub_stats) {
      for (const [propKey, statData] of Object.entries(data.sub_stats)) {
        const propType = PropertyType[propKey as keyof typeof PropertyType];
        if (propType !== undefined) {
          // 添加类型断言，确保statData是包含value和isPercent属性的对象
          const typedStatData = statData as { value: number; isPercent: boolean };
          subStats.set(propType, new StatValue(typedStatData.value, typedStatData.isPercent));
        }
      }
    }

    // 创建实例
    const disk = new DriveDisk(
      id,
      data.game_id,
      data.position,
      data.rarity,
      data.level,
      data.main_stat,
      new StatValue(data.main_stat_value.value, data.main_stat_value.isPercent),
      subStats
    );

    // 恢复装备状态
    disk.equipped_agent = data.equipped_agent;
    disk.locked = data.locked || false;

    // 从游戏数据加载套装名称
    const equipInfo = dataLoader.equipmentData?.get(data.game_id);
    if (equipInfo) {
      disk.set_name = equipInfo.CHS?.name || equipInfo.EN?.name || '';
    }

    // 加载套装Buff数据
    try {
      const equipBuffData = await dataLoader.getEquipmentBuff(data.game_id);

      // 2件套属性
      if (equipBuffData.two_piece_buffs) {
        disk.set_properties = equipBuffData.two_piece_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 4件套Buff
      if (equipBuffData.four_piece_buffs) {
        disk.set_buffs = equipBuffData.four_piece_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }
    } catch (err) {
      console.warn(`加载驱动盘套装Buff数据失败: ${data.game_id}`, err);
    }

    return disk;
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
    // Basic validity check (throws with a human-readable message when invalid)
    DriveDisk.validateZodData(zodData);

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
        // 根据属性类型判断是否是百分比属性
        const isPercent = isPercentageProperty(propType);
        const statValue = new StatValue(substat.upgrades, isPercent);
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
    disk.set_name = equipmentInfo.CHS?.name || equipmentInfo.EN?.name || zodData.setKey;
    disk.equipped_agent = zodData.location || null;
    disk.locked = zodData.lock;

    // 9. 加载套装Buff数据
    try {
      const equipBuffData = await dataLoader.getEquipmentBuff(gameEquipId);

      // 2件套属性
      if (equipBuffData.two_piece_buffs) {
        disk.set_properties = equipBuffData.two_piece_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 4件套Buff
      if (equipBuffData.four_piece_buffs) {
        disk.set_buffs = equipBuffData.four_piece_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }
    } catch (err) {
      console.warn(`加载驱动盘套装Buff数据失败: ${zodData.setKey}`, err);
    }

    return disk;
  }

  /**
   * 校验 ZOD 驱动盘数据是否合法
   *
   * 规则来源：docs/ZZZ_DISC_STATS.md
   * - slotKey 必须是 "1".."6"
   * - 主词条必须符合槽位限制
   * - 副词条：只允许出现在白名单里，且不能与主词条重复，且不能重复
   */
  static validateZodData(zodData: ZodDiscData): void {
    const slotNum = parseInt(zodData.slotKey);
    if (!Number.isFinite(slotNum) || slotNum < 1 || slotNum > 6) {
      throw new Error(`无效的驱动盘位置: ${zodData.slotKey}`);
    }

    const mainStatKey = normalizeZodStatKey(zodData.mainStatKey);

    const allowedMainBySlot: Record<number, Set<string>> = {
      1: new Set(['hp']),
      2: new Set(['atk']),
      3: new Set(['def']),
      4: new Set(['hp_', 'atk_', 'def_', 'crit_', 'crit_dmg_', 'anomProf']),
      5: new Set(['hp_', 'atk_', 'def_', 'pen_', 'fire_dmg_', 'ice_dmg_', 'electric_dmg_', 'physical_dmg_', 'ether_dmg_']),
      6: new Set(['hp_', 'atk_', 'def_', 'anomMas_', 'impact_', 'enerRegen_', 'energyRegen_']),
    };

    const allowedMain = allowedMainBySlot[slotNum];
    const normalizedMain = normalizeMainStatKeyForSlot(slotNum, mainStatKey);
    if (!allowedMain || !allowedMain.has(normalizedMain)) {
      throw new Error(`驱动盘主词条不合法: slot=${slotNum}, mainStatKey=${zodData.mainStatKey}`);
    }

    const allowedSub = new Set([
      'hp',
      'atk',
      'def',
      'pen',
      'anomProf',
      'hp_',
      'atk_',
      'def_',
      'crit_',
      'crit_dmg_',
    ]);

    const seen = new Set<string>();
    const subs = zodData.substats ?? [];

    // Substat types validity
    for (const sub of subs) {
      const subKey = normalizeZodStatKey(sub.key);

      if (!allowedSub.has(subKey)) {
        throw new Error(`驱动盘副词条不合法: ${sub.key}`);
      }
      if (subKey === normalizedMain) {
        throw new Error(`驱动盘副词条不能与主词条重复: ${sub.key}`);
      }
      if (seen.has(subKey)) {
        throw new Error(`驱动盘副词条不能重复: ${sub.key}`);
      }
      seen.add(subKey);

      const upgrades = Number(sub.upgrades);
      if (!Number.isFinite(upgrades) || upgrades < 1) {
        throw new Error(`驱动盘副词条 upgrades 不合法: ${sub.key}=${sub.upgrades}`);
      }
    }

    // Total lines validity (substat rolls/lines):
    // - base lines: 3~4 at lv0
    // - every +3 levels adds +1 line
    // - max enhancement times is 5, so total lines never exceeds 8~9
    // - A disc has at most 4 substat TYPES; extra lines must be allocated as upgrades among the existing 4.
    // - If substat TYPES < 4, then you cannot allocate extra lines; total lines must equal types count.
    const extraLines = Math.min(5, Math.floor((zodData.level ?? 0) / 3));
    const maxTotalLines = 4 + extraLines;

    const typeCount = subs.length;
    if (typeCount < 0 || typeCount > 4) {
      throw new Error(`驱动盘副词条种类数量不合法: count=${typeCount}, expected=0~4`);
    }

    const totalLines = subs.reduce((sum, s) => sum + (Number(s.upgrades) || 0), 0);
    if (totalLines > maxTotalLines) {
      throw new Error(
        `驱动盘副词条总条数不合法: level=${zodData.level}, total=${totalLines}, max=${maxTotalLines}`
      );
    }

    if (typeCount < 4) {
      // Import tolerance: some scanners export "roll totals" without splitting into 4 distinct substat types.
      // We accept these records and let the UI/editor normalize later.
      return;
    } else {
      // typeCount === 4: ok, can have totalLines >= 4 by adding upgrades
      if (subs.some((s) => Number(s.upgrades) < 1)) {
        throw new Error('驱动盘副词条 upgrades 不合法: upgrades 必须 >= 1');
      }
    }
  }
}

/**
 * 解析属性类型
 */
function parsePropertyType(key: string): PropertyType {
  // ZOD的key可能是简写形式，需要映射到PropertyType
  const keyMap: Record<string, PropertyType> = {
    // 大写形式
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
    'ENERGY_REGEN_': PropertyType.ENER_REGEN_,
    'IMPACT': PropertyType.IMPACT,
    'IMPACT_': PropertyType.IMPACT_,
    // 小写形式
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
    'energyregen': PropertyType.ENER_REGEN,
    'energyregen_': PropertyType.ENER_REGEN_,
    'anomprof': PropertyType.ANOM_PROF,
    'anomaly_proficiency': PropertyType.ANOM_PROF,
    'impact': PropertyType.IMPACT,
    'impact_': PropertyType.IMPACT_,
    'physical_dmg_': PropertyType.PHYSICAL_DMG_,
    'fire_dmg_': PropertyType.FIRE_DMG_,
    'ice_dmg_': PropertyType.ICE_DMG_,
    'electric_dmg_': PropertyType.ELECTRIC_DMG_,
    'ether_dmg_': PropertyType.ETHER_DMG_,
    // 驼峰形式
    'energyRegen': PropertyType.ENER_REGEN,
    'energyRegen_': PropertyType.ENER_REGEN_,
    'anomProf': PropertyType.ANOM_PROF,
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

function normalizeZodStatKey(key: string): string {
  // We keep keys as-is (trim only) because the project uses mixed conventions:
  // - disk creation UI uses lowercase (atk_)
  // - some imports use uppercase (CRIT_)
  // Validation rules in this file list both where needed (e.g. enerRegen_/energyRegen_).
  return (key ?? '').trim();
}

function normalizeMainStatKeyForSlot(slot: number, key: string): string {
  // Some imports may use flat keys for main stats that are only valid as % keys in our rules.
  // Example: slot 6 "impact" should be treated as "impact_".
  const k = (key ?? '').trim();

  if (slot === 6 && k === 'impact') return 'impact_';

  return k;
}
