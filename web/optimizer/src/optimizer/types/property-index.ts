/**
 * 属性索引常量
 *
 * 将 PropertyType 枚举映射到连续的数组索引，用于 Float64Array 快速访问。
 * 避免 Map.get/set 的开销，提升性能。
 */

import { PropertyType } from '../../model/base';

/**
 * 属性数组索引常量
 * 用于 Float64Array 的快速索引访问
 */
export const PROP_IDX = {
  // ========== 基础属性 ==========
  HP_BASE: 0,
  ATK_BASE: 1,
  DEF_BASE: 2,
  ANOM_MAS_BASE: 3,

  // ========== 生命值 ==========
  HP: 4,
  HP_: 5,

  // ========== 攻击力 ==========
  ATK: 6,
  ATK_: 7,

  // ========== 防御力 ==========
  DEF: 8,
  DEF_: 9,

  // ========== 穿透 ==========
  PEN: 10,
  PEN_: 11,

  // ========== 贯穿 ==========
  SHEER_FORCE: 12,
  SHEER_DMG_: 13,

  // ========== 无视 ==========
  RES_IGN_: 14,
  DEF_IGN_: 15,

  // ========== 暴击 ==========
  CRIT_: 16,
  CRIT_DMG_: 17,

  // ========== 能量 ==========
  ENER_REGEN_: 18,
  ENER_REGEN: 19,
  BASE_ENER_REGEN: 20,
  ENER_EFF_: 21,

  // ========== 冲击力 ==========
  IMPACT_: 22,
  IMPACT: 23,

  // ========== 失衡 ==========
  DAZE_INC_: 24,
  FEVER_GAIN_: 25,

  // ========== 护盾 ==========
  SHIELD_: 26,

  // ========== 异常掌控 ==========
  ANOM_MAS: 27,
  ANOM_MAS_: 28,

  // ========== 异常精通 ==========
  ANOM_PROF: 29,

  // ========== 异常积蓄 ==========
  ANOM_BUILDUP_: 30,
  PHYSICAL_ANOMALY_BUILDUP_: 31,
  FIRE_ANOMALY_BUILDUP_: 32,
  ICE_ANOMALY_BUILDUP_: 33,
  ELECTRIC_ANOMALY_BUILDUP_: 34,
  ETHER_ANOMALY_BUILDUP_: 35,

  // ========== 异常暴击 ==========
  ANOM_CRIT_: 36,
  ANOM_CRIT_DMG_: 37,
  ANOM_MV_MULT_: 38,
  ADDL_DISORDER_: 39,
  ANOM_BASE_: 40,
  ANOM_FLAT_DMG: 41,

  // ========== 异常伤害加成 ==========
  BURN_DMG_: 42,
  SHOCK_DMG_: 43,
  CORRUPTION_DMG_: 44,
  SHATTER_DMG_: 45,
  ASSAULT_DMG_: 46,

  // ========== 通用伤害加成 ==========
  COMMON_DMG_: 47,
  DMG_: 48,
  FLAT_DMG: 49,

  // ========== 技能伤害加成 ==========
  NORMAL_ATK_DMG_: 50,
  ENHANCED_SPECIAL_DMG_: 51,
  CHAIN_ATK_DMG_: 52,
  ULTIMATE_ATK_DMG_: 53,
  DASH_ATK_DMG_: 54,
  DODGE_COUNTER_DMG_: 55,
  ASSIST_ATK_DMG_: 56,
  ADDL_ATK_DMG_: 57,
  SPECIAL_ATK_DMG_: 58,

  // ========== 元素伤害加成 ==========
  PHYSICAL_DMG_: 59,
  ETHER_DMG_: 60,
  ELECTRIC_DMG_: 61,
  ICE_DMG_: 62,
  FIRE_DMG_: 63,

  // ========== 属性异常伤害加成 ==========
  IMPACT_DMG_: 64,
  FREEZE_DMG_: 65,
  PENETRATION_DMG_: 66,
  DISORDER_DMG_: 67,
  ANOMALY_DMG_: 68,

  // ========== Debuff相关 ==========
  DEF_RED_: 69,
  ENEMY_RES_: 70,
  ENEMY_RES_RED_: 71,
  PHYSICAL_RES_RED_: 72,
  FIRE_RES_RED_: 73,
  ICE_RES_RED_: 74,
  ELECTRIC_RES_RED_: 75,
  ETHER_RES_RED_: 76,
  ENEMY_RES_IGN_: 77,
  PHYSICAL_RES_IGN_: 78,
  FIRE_RES_IGN_: 79,
  ICE_RES_IGN_: 80,
  ELECTRIC_RES_IGN_: 81,
  ETHER_RES_IGN_: 82,
  ANOM_BUILDUP_RES_: 83,
  PHYSICAL_ANOM_BUILDUP_RES_: 84,
  FIRE_ANOM_BUILDUP_RES_: 85,
  ICE_ANOM_BUILDUP_RES_: 86,
  ELECTRIC_ANOM_BUILDUP_RES_: 87,
  ETHER_ANOM_BUILDUP_RES_: 88,
  DAZE_RES_: 89,
  DAZE_RED_: 90,
  DMG_INC_: 91,
  DAMAGE_TAKEN_RED_: 92,
  ENEMY_DAZE_VULNERABILITY_: 93,

  // ========== 总数 ==========
  TOTAL_PROPS: 94,
} as const;

export type PropIdxType = typeof PROP_IDX;
export type PropIdxKey = keyof PropIdxType;

/**
 * PropertyType 到数组索引的映射
 */
export const PROP_TYPE_TO_IDX: Record<number, number> = {
  // 基础属性
  [PropertyType.HP_BASE]: PROP_IDX.HP_BASE,
  [PropertyType.ATK_BASE]: PROP_IDX.ATK_BASE,
  [PropertyType.DEF_BASE]: PROP_IDX.DEF_BASE,
  [PropertyType.ANOM_MAS_BASE]: PROP_IDX.ANOM_MAS_BASE,

  // 生命值
  [PropertyType.HP]: PROP_IDX.HP,
  [PropertyType.HP_]: PROP_IDX.HP_,

  // 攻击力
  [PropertyType.ATK]: PROP_IDX.ATK,
  [PropertyType.ATK_]: PROP_IDX.ATK_,

  // 防御力
  [PropertyType.DEF]: PROP_IDX.DEF,
  [PropertyType.DEF_]: PROP_IDX.DEF_,

  // 穿透
  [PropertyType.PEN]: PROP_IDX.PEN,
  [PropertyType.PEN_]: PROP_IDX.PEN_,

  // 贯穿
  [PropertyType.SHEER_FORCE]: PROP_IDX.SHEER_FORCE,
  [PropertyType.SHEER_DMG_]: PROP_IDX.SHEER_DMG_,

  // 无视
  [PropertyType.RES_IGN_]: PROP_IDX.RES_IGN_,
  [PropertyType.DEF_IGN_]: PROP_IDX.DEF_IGN_,

  // 暴击
  [PropertyType.CRIT_]: PROP_IDX.CRIT_,
  [PropertyType.CRIT_DMG_]: PROP_IDX.CRIT_DMG_,

  // 能量
  [PropertyType.ENER_REGEN_]: PROP_IDX.ENER_REGEN_,
  [PropertyType.ENER_REGEN]: PROP_IDX.ENER_REGEN,
  [PropertyType.BASE_ENER_REGEN]: PROP_IDX.BASE_ENER_REGEN,
  [PropertyType.ENER_EFF_]: PROP_IDX.ENER_EFF_,

  // 冲击力
  [PropertyType.IMPACT_]: PROP_IDX.IMPACT_,
  [PropertyType.IMPACT]: PROP_IDX.IMPACT,

  // 失衡
  [PropertyType.DAZE_INC_]: PROP_IDX.DAZE_INC_,
  [PropertyType.FEVER_GAIN_]: PROP_IDX.FEVER_GAIN_,

  // 护盾
  [PropertyType.SHIELD_]: PROP_IDX.SHIELD_,

  // 异常掌控
  [PropertyType.ANOM_MAS]: PROP_IDX.ANOM_MAS,
  [PropertyType.ANOM_MAS_]: PROP_IDX.ANOM_MAS_,

  // 异常精通
  [PropertyType.ANOM_PROF]: PROP_IDX.ANOM_PROF,

  // 异常积蓄
  [PropertyType.ANOM_BUILDUP_]: PROP_IDX.ANOM_BUILDUP_,
  [PropertyType.PHYSICAL_ANOMALY_BUILDUP_]: PROP_IDX.PHYSICAL_ANOMALY_BUILDUP_,
  [PropertyType.FIRE_ANOMALY_BUILDUP_]: PROP_IDX.FIRE_ANOMALY_BUILDUP_,
  [PropertyType.ICE_ANOMALY_BUILDUP_]: PROP_IDX.ICE_ANOMALY_BUILDUP_,
  [PropertyType.ELECTRIC_ANOMALY_BUILDUP_]: PROP_IDX.ELECTRIC_ANOMALY_BUILDUP_,
  [PropertyType.ETHER_ANOMALY_BUILDUP_]: PROP_IDX.ETHER_ANOMALY_BUILDUP_,

  // 异常暴击
  [PropertyType.ANOM_CRIT_]: PROP_IDX.ANOM_CRIT_,
  [PropertyType.ANOM_CRIT_DMG_]: PROP_IDX.ANOM_CRIT_DMG_,
  [PropertyType.ANOM_MV_MULT_]: PROP_IDX.ANOM_MV_MULT_,
  [PropertyType.ADDL_DISORDER_]: PROP_IDX.ADDL_DISORDER_,
  [PropertyType.ANOM_BASE_]: PROP_IDX.ANOM_BASE_,
  [PropertyType.ANOM_FLAT_DMG]: PROP_IDX.ANOM_FLAT_DMG,

  // 异常伤害加成
  [PropertyType.BURN_DMG_]: PROP_IDX.BURN_DMG_,
  [PropertyType.SHOCK_DMG_]: PROP_IDX.SHOCK_DMG_,
  [PropertyType.CORRUPTION_DMG_]: PROP_IDX.CORRUPTION_DMG_,
  [PropertyType.SHATTER_DMG_]: PROP_IDX.SHATTER_DMG_,
  [PropertyType.ASSAULT_DMG_]: PROP_IDX.ASSAULT_DMG_,

  // 通用伤害加成
  [PropertyType.COMMON_DMG_]: PROP_IDX.COMMON_DMG_,
  [PropertyType.DMG_]: PROP_IDX.DMG_,
  [PropertyType.FLAT_DMG]: PROP_IDX.FLAT_DMG,

  // 技能伤害加成
  [PropertyType.NORMAL_ATK_DMG_]: PROP_IDX.NORMAL_ATK_DMG_,
  [PropertyType.ENHANCED_SPECIAL_DMG_]: PROP_IDX.ENHANCED_SPECIAL_DMG_,
  [PropertyType.CHAIN_ATK_DMG_]: PROP_IDX.CHAIN_ATK_DMG_,
  [PropertyType.ULTIMATE_ATK_DMG_]: PROP_IDX.ULTIMATE_ATK_DMG_,
  [PropertyType.DASH_ATK_DMG_]: PROP_IDX.DASH_ATK_DMG_,
  [PropertyType.DODGE_COUNTER_DMG_]: PROP_IDX.DODGE_COUNTER_DMG_,
  [PropertyType.ASSIST_ATK_DMG_]: PROP_IDX.ASSIST_ATK_DMG_,
  [PropertyType.ADDL_ATK_DMG_]: PROP_IDX.ADDL_ATK_DMG_,
  [PropertyType.SPECIAL_ATK_DMG_]: PROP_IDX.SPECIAL_ATK_DMG_,

  // 元素伤害加成
  [PropertyType.PHYSICAL_DMG_]: PROP_IDX.PHYSICAL_DMG_,
  [PropertyType.ETHER_DMG_]: PROP_IDX.ETHER_DMG_,
  [PropertyType.ELECTRIC_DMG_]: PROP_IDX.ELECTRIC_DMG_,
  [PropertyType.ICE_DMG_]: PROP_IDX.ICE_DMG_,
  [PropertyType.FIRE_DMG_]: PROP_IDX.FIRE_DMG_,

  // 属性异常伤害加成
  [PropertyType.IMPACT_DMG_]: PROP_IDX.IMPACT_DMG_,
  [PropertyType.FREEZE_DMG_]: PROP_IDX.FREEZE_DMG_,
  [PropertyType.PENETRATION_DMG_]: PROP_IDX.PENETRATION_DMG_,
  [PropertyType.DISORDER_DMG_]: PROP_IDX.DISORDER_DMG_,
  [PropertyType.ANOMALY_DMG_]: PROP_IDX.ANOMALY_DMG_,

  // Debuff相关
  [PropertyType.DEF_RED_]: PROP_IDX.DEF_RED_,
  [PropertyType.ENEMY_RES_]: PROP_IDX.ENEMY_RES_,
  [PropertyType.ENEMY_RES_RED_]: PROP_IDX.ENEMY_RES_RED_,
  [PropertyType.PHYSICAL_RES_RED_]: PROP_IDX.PHYSICAL_RES_RED_,
  [PropertyType.FIRE_RES_RED_]: PROP_IDX.FIRE_RES_RED_,
  [PropertyType.ICE_RES_RED_]: PROP_IDX.ICE_RES_RED_,
  [PropertyType.ELECTRIC_RES_RED_]: PROP_IDX.ELECTRIC_RES_RED_,
  [PropertyType.ETHER_RES_RED_]: PROP_IDX.ETHER_RES_RED_,
  [PropertyType.ENEMY_RES_IGN_]: PROP_IDX.ENEMY_RES_IGN_,
  [PropertyType.PHYSICAL_RES_IGN_]: PROP_IDX.PHYSICAL_RES_IGN_,
  [PropertyType.FIRE_RES_IGN_]: PROP_IDX.FIRE_RES_IGN_,
  [PropertyType.ICE_RES_IGN_]: PROP_IDX.ICE_RES_IGN_,
  [PropertyType.ELECTRIC_RES_IGN_]: PROP_IDX.ELECTRIC_RES_IGN_,
  [PropertyType.ETHER_RES_IGN_]: PROP_IDX.ETHER_RES_IGN_,
  [PropertyType.ANOM_BUILDUP_RES_]: PROP_IDX.ANOM_BUILDUP_RES_,
  [PropertyType.PHYSICAL_ANOM_BUILDUP_RES_]: PROP_IDX.PHYSICAL_ANOM_BUILDUP_RES_,
  [PropertyType.FIRE_ANOM_BUILDUP_RES_]: PROP_IDX.FIRE_ANOM_BUILDUP_RES_,
  [PropertyType.ICE_ANOM_BUILDUP_RES_]: PROP_IDX.ICE_ANOM_BUILDUP_RES_,
  [PropertyType.ELECTRIC_ANOM_BUILDUP_RES_]: PROP_IDX.ELECTRIC_ANOM_BUILDUP_RES_,
  [PropertyType.ETHER_ANOM_BUILDUP_RES_]: PROP_IDX.ETHER_ANOM_BUILDUP_RES_,
  [PropertyType.DAZE_RES_]: PROP_IDX.DAZE_RES_,
  [PropertyType.DAZE_RED_]: PROP_IDX.DAZE_RED_,
  [PropertyType.DMG_INC_]: PROP_IDX.DMG_INC_,
  [PropertyType.DAMAGE_TAKEN_RED_]: PROP_IDX.DAMAGE_TAKEN_RED_,
  [PropertyType.ENEMY_DAZE_VULNERABILITY_]: PROP_IDX.ENEMY_DAZE_VULNERABILITY_,
};

/**
 * 数组索引到 PropertyType 的反向映射
 */
export const IDX_TO_PROP_TYPE: Record<number, PropertyType> = {};
for (const [propType, idx] of Object.entries(PROP_TYPE_TO_IDX)) {
  IDX_TO_PROP_TYPE[idx] = Number(propType) as PropertyType;
}

/**
 * 元素类型到元素增伤索引的映射
 */
export const ELEMENT_TO_DMG_IDX: Record<number, number> = {
  200: PROP_IDX.PHYSICAL_DMG_,  // PHYSICAL
  201: PROP_IDX.FIRE_DMG_,      // FIRE
  202: PROP_IDX.ICE_DMG_,       // ICE
  203: PROP_IDX.ELECTRIC_DMG_,  // ELECTRIC
  205: PROP_IDX.ETHER_DMG_,     // ETHER
};

/**
 * 元素类型到元素异常积蓄索引的映射
 */
export const ELEMENT_TO_BUILDUP_IDX: Record<number, number> = {
  200: PROP_IDX.PHYSICAL_ANOMALY_BUILDUP_,
  201: PROP_IDX.FIRE_ANOMALY_BUILDUP_,
  202: PROP_IDX.ICE_ANOMALY_BUILDUP_,
  203: PROP_IDX.ELECTRIC_ANOMALY_BUILDUP_,
  205: PROP_IDX.ETHER_ANOMALY_BUILDUP_,
};

/**
 * 创建新的属性数组
 */
export function createPropArray(): Float64Array {
  return new Float64Array(PROP_IDX.TOTAL_PROPS);
}

/**
 * 将 PropertyType 的值添加到属性数组
 */
export function addToPropArray(
  arr: Float64Array,
  propType: PropertyType | number,
  value: number
): void {
  const idx = PROP_TYPE_TO_IDX[propType];
  if (idx !== undefined) {
    arr[idx] += value;
  }
}

/**
 * 从属性数组获取 PropertyType 的值
 */
export function getFromPropArray(
  arr: Float64Array,
  propType: PropertyType | number
): number {
  const idx = PROP_TYPE_TO_IDX[propType];
  if (idx !== undefined) {
    return arr[idx];
  }
  return 0;
}
