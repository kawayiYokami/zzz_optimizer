"""
基础枚举和数据类型定义
"""
from dataclasses import dataclass
from enum import Enum


class Rarity(Enum):
    """稀有度枚举"""
    S = 4  # S级
    A = 3  # A级
    B = 2  # B级


class ElementType(Enum):
    """元素类型"""
    PHYSICAL = 200      # 物理
    FIRE = 201          # 火
    ICE = 202           # 冰
    ELECTRIC = 203      # 雷
    ETHER = 205         # 以太

    @property
    def cn_name(self) -> str:
        """中文名称"""
        return {
            ElementType.PHYSICAL: "物理",
            ElementType.FIRE: "火",
            ElementType.ICE: "冰",
            ElementType.ELECTRIC: "雷",
            ElementType.ETHER: "以太",
        }.get(self, "未知")


class WeaponType(Enum):
    """武器类型"""
    ATTACK = 1      # 强攻
    STUN = 2        # 击破
    ANOMALY = 3     # 异常
    SUPPORT = 4     # 支援
    DEFENSE = 5     # 防护
    UNKNOWN_6 = 6   # 未知类型6（游戏新增）

    @property
    def cn_name(self) -> str:
        """中文名称"""
        return {
            WeaponType.ATTACK: "强攻",
            WeaponType.STUN: "击破",
            WeaponType.ANOMALY: "异常",
            WeaponType.SUPPORT: "支援",
            WeaponType.DEFENSE: "防护",
            WeaponType.UNKNOWN_6: "未知",
        }.get(self, "未知")


class PropertyType(Enum):
    """属性类型"""
    # 基础属性
    HP_BASE = 11001             # 基础生命值（角色等级提供）
    ATK_BASE = 12001            # 基础攻击力（角色等级+武器提供）
    DEF_BASE = 13001            # 基础防御力（角色等级提供）
    ANOM_MAS_BASE = 31301       # 基础异常掌控

    # 生命值
    HP = 11101                  # 生命值
    HP_ = 11102                 # 生命值%

    # 攻击力
    ATK = 12101                 # 攻击力
    ATK_ = 12102                # 攻击力%

    # 防御力
    DEF = 13101                 # 防御力
    DEF_ = 13102                # 防御力%

    # 穿透
    PEN = 23101                 # 穿透值
    PEN_ = 23103                # 穿透率

    # 贯穿
    SHEER_FORCE = 24101         # 贯穿值
    SHEER_DMG_ = 24103          # 贯穿伤害

    # 无视
    RES_IGN_ = 25101            # 无视属性抗性
    DEF_IGN_ = 25102            # 无视防御

    # 暴击
    CRIT_ = 20103               # 暴击率
    CRIT_RATE_ = 20104          # 暴击率（别名）
    CRIT_DMG_ = 21103           # 暴击伤害

    # 能量
    ENER_REGEN_ = 30503         # 能量自动回复%
    ENER_REGEN = 30501          # 能量自动回复
    BASE_ENER_REGEN = 30500     # 基础能量自动回复
    ENER_EFF_ = 30504           # 能量获得效率%

    # 冲击力
    IMPACT_ = 20203             # 冲击力%
    IMPACT = 20201              # 冲击力

    # 失衡
    DAZE_INC_ = 20301           # 失衡值提升
    FEVER_GAIN_ = 20302         # 喧响值获取提升

    # 护盾
    SHIELD_ = 40101             # 护盾效果

    # 异常掌控
    ANOM_MAS = 31303            # 异常掌控
    ANOM_MAS_ = 31304           # 异常掌控%
    ANOM_MASTERY_ = 31304       # 异常掌控%（别名）

    # 异常精通
    ANOM_PROF = 31203           # 异常精通

    # 异常相关
    ANOM_BUILDUP_ = 31401       # 异常积蓄
    PHYSICAL_ANOMALY_BUILDUP_ = 31402  # 物理异常积蓄效率
    FIRE_ANOMALY_BUILDUP_ = 31403      # 火属性异常积蓄效率
    ICE_ANOMALY_BUILDUP_ = 31404       # 冰属性异常积蓄效率
    ELECTRIC_ANOMALY_BUILDUP_ = 31405  # 电属性异常积蓄效率
    ETHER_ANOMALY_BUILDUP_ = 31406     # 以太属性异常积蓄效率
    ANOM_CRIT_ = 31501          # 异常暴击率
    ANOM_CRIT_DMG_ = 31502      # 异常暴击伤害
    ANOM_MV_MULT_ = 31503       # 异常伤害倍率提升
    ADDL_DISORDER_ = 31504      # 额外紊乱倍率
    ANOM_BASE_ = 31505          # 异常基础伤害提升
    ANOM_FLAT_DMG = 31506       # 异常固定伤害加成

    # 异常伤害加成
    BURN_DMG_ = 32101           # 灼烧伤害加成
    SHOCK_DMG_ = 32102          # 感电伤害加成
    CORRUPTION_DMG_ = 32103     # 侵蚀伤害加成
    SHATTER_DMG_ = 32104        # 碎冰伤害加成
    ASSAULT_DMG_ = 32105        # 强击伤害加成

    # 通用伤害加成
    COMMON_DMG_ = 33001         # 伤害加成（通用）
    DMG_ = 33002                # 伤害加成
    FLAT_DMG = 33003            # 固定伤害加成

    # 技能伤害加成（对应DamageType的技能相关伤害）
    NORMAL_ATK_DMG_ = 33010     # 普通攻击伤害加成
    ENHANCED_SPECIAL_DMG_ = 33011  # 强化特殊技伤害加成
    CHAIN_ATK_DMG_ = 33012      # 连携技伤害加成
    ULTIMATE_ATK_DMG_ = 33013    # 终结技伤害加成
    DASH_ATK_DMG_ = 33014       # 冲刺攻击伤害加成
    DODGE_COUNTER_DMG_ = 33015   # 闪避反击伤害加成
    ASSIST_ATK_DMG_ = 33016     # 支援攻击伤害加成
    ADDL_ATK_DMG_ = 33017       # 追加攻击伤害加成
    SPECIAL_ATK_DMG_ = 33018     # 特殊技伤害加成

    # 元素伤害加成（对应DamageType的元素伤害）
    PHYSICAL_DMG_ = 33020       # 物理伤害加成
    ETHER_DMG_ = 33021          # 以太伤害加成
    ELECTRIC_DMG_ = 33022       # 电属性伤害加成
    ICE_DMG_ = 33023            # 冰属性伤害加成
    FIRE_DMG_ = 33024           # 火属性伤害加成

    # 属性异常伤害加成（对应DamageType的属性异常伤害）
    IMPACT_DMG_ = 33040         # 强击伤害加成
    FREEZE_DMG_ = 33042         # 冻结伤害加成

    # 特殊伤害加成（对应DamageType的特殊伤害类型）
    PENETRATION_DMG_ = 33051     # 贯穿伤害加成
    DISORDER_DMG_ = 33052       # 紊乱伤害加成
    ANOMALY_DMG_ = 33053        # 属性异常伤害加成

    # Debuff相关（敌人属性）
    DEF_RED_ = 41001            # 敌人防御降低
    ENEMY_RES_ = 41002          # 敌人属性抗性
    ENEMY_RES_RED_ = 41003      # 敌人属性抗性降低
    ENEMY_RES_IGN_ = 41004      # 无视敌人属性抗性
    ANOM_BUILDUP_RES_ = 41005   # 敌人异常积蓄抗性
    DAZE_RES_ = 41006           # 敌人失衡抗性
    DAZE_RED_ = 41007           # 敌人失衡易伤
    DMG_INC_ = 41008            # 敌人易伤
    DAMAGE_TAKEN_RED_ = 41009   # 受到伤害降低（别名）

    @property
    def cn_name(self) -> str:
        """获取中文名称"""
        return PROPERTY_CN_NAMES.get(self, self.name)

    @property
    def is_percentage(self) -> bool:
        """是否为百分比属性"""
        return self.name.endswith('_') or 'RATE' in self.name or 'DMG' in self.name


# 属性中文名称映射
PROPERTY_CN_NAMES = {
    # 基础属性
    PropertyType.HP_BASE: "基础生命值",
    PropertyType.ATK_BASE: "基础攻击力",
    PropertyType.DEF_BASE: "基础防御力",
    PropertyType.ANOM_MAS_BASE: "基础异常掌控",

    # 生命值
    PropertyType.HP: "生命值",
    PropertyType.HP_: "生命值%",

    # 攻击力
    PropertyType.ATK: "攻击力",
    PropertyType.ATK_: "攻击力%",

    # 防御力
    PropertyType.DEF: "防御力",
    PropertyType.DEF_: "防御力%",

    # 穿透
    PropertyType.PEN: "穿透值",
    PropertyType.PEN_: "穿透率",

    # 暴击
    PropertyType.CRIT_: "暴击率",
    PropertyType.CRIT_RATE_: "暴击率",
    PropertyType.CRIT_DMG_: "暴击伤害",

    # 能量
    PropertyType.ENER_REGEN_: "能量自动回复",
    PropertyType.ENER_REGEN: "能量自动回复",
    PropertyType.ENER_EFF_: "能量获得效率",

    # 冲击力
    PropertyType.IMPACT_: "冲击力",
    PropertyType.IMPACT: "冲击力",

    # 异常掌控
    PropertyType.ANOM_MAS: "异常掌控",
    PropertyType.ANOM_MAS_: "异常掌控",
    PropertyType.ANOM_MASTERY_: "异常掌控",

    # 异常精通
    PropertyType.ANOM_PROF: "异常精通",

    # 异常积蓄
    PropertyType.ANOM_BUILDUP_: "异常积蓄效率",
    PropertyType.PHYSICAL_ANOMALY_BUILDUP_: "物理异常积蓄效率",
    PropertyType.FIRE_ANOMALY_BUILDUP_: "火属性异常积蓄效率",
    PropertyType.ICE_ANOMALY_BUILDUP_: "冰属性异常积蓄效率",
    PropertyType.ELECTRIC_ANOMALY_BUILDUP_: "电属性异常积蓄效率",
    PropertyType.ETHER_ANOMALY_BUILDUP_: "以太属性异常积蓄效率",

    # 通用伤害加成
    PropertyType.COMMON_DMG_: "伤害加成",
    PropertyType.DMG_: "伤害加成",
    PropertyType.FLAT_DMG: "固定伤害加成",

    # 属性异常伤害加成
    PropertyType.ANOMALY_DMG_: "属性异常伤害加成",
}


@dataclass
class StatValue:
    """属性数值"""
    value: float
    is_percent: bool = False  # 是否为百分比属性

    def __str__(self) -> str:
        if self.is_percent:
            # 存档中百分比值存储为小数形式（如 0.24 表示 24%），显示时需要乘以100
            return f"{self.value * 100:.1f}%"
        return f"{int(self.value)}"
