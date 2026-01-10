"""
伤害模型 - 纯数据定义
"""
from dataclasses import dataclass
from enum import Enum

from optimizer.zzz_models.base import ElementType


class DamageType(Enum):
    """
    伤害类型
    
    完整的伤害类型体系，包括：
    - 技能相关伤害（9种）
    - 元素伤害（5种）
    - 属性异常伤害（6种）
    - 特殊伤害类型（4种）
    - 特殊属性伤害（3种）
    """
    # ========== 技能相关伤害（9种）==========
    NORMAL_ATTACK = 1           # 普通攻击造成的伤害
    ENHANCED_SPECIAL = 2        # 强化特殊技造成的伤害
    CHAIN_ATTACK = 3            # 连携技造成的伤害
    ULTIMATE_ATTACK = 4         # 终结技造成的伤害
    DASH_ATTACK = 5             # 冲刺攻击造成的伤害
    DODGE_COUNTER = 6           # 闪避反击造成的伤害
    ASSIST_ATTACK = 7           # 支援攻击造成的伤害
    ADDITIONAL_ATTACK = 8       # 追加攻击造成的伤害
    SPECIAL_ATTACK = 9          # 特殊技造成的伤害
    
    # ========== 元素伤害（5种）==========
    PHYSICAL = 10               # 物理伤害 (#F0D12B 黄色)
    ETHER = 11                  # 以太伤害 (#FE437E 粉色)
    ELECTRIC = 12               # 电属性伤害 (#2EB6FF 蓝色)
    ICE = 13                    # 冰属性伤害 (#98EFF0 青色)
    FIRE = 14                   # 火属性伤害 (#FF5521 橙红色)
    
    # ========== 属性异常伤害（6种）==========
    IMPACT = 40                 # 强击（物理）
    SHOCK = 41                  # 感电（电）
    FREEZE = 42                 # 冻结（冰）
    SHATTER = 43                # 碎冰（冰触发）
    BURN = 44                   # 灼烧（火）
    CORROSION = 45              # 侵蚀（以太）
    
    # ========== 特殊伤害类型（4种）==========
    CRITICAL = 50               # 暴击伤害
    PENETRATION = 51            # 贯穿伤害（无视防御）
    DISORDER = 52               # 紊乱伤害（多属性触发）
    ANOMALY = 53                # 属性异常伤害（触发伤害）
    
    # ========== 特殊属性伤害（3种）==========
    LIE_SHUANG = 60            # 烈霜伤害（冰属性特殊伤害）
    LING_REN = 61               # 凛刃伤害（物理属性特殊伤害）
    XUAN_MO = 62                # 玄墨伤害（以太属性特殊伤害）
    
    # ========== 通用伤害类型 ==========
    NORMAL = 99                 # 普通伤害（通用）
    ADDITIONAL = 100            # 附加伤害（通用）
    DOT = 101                   # 持续伤害（通用）
    
    @property
    def is_skill_damage(self) -> bool:
        """是否为技能相关伤害"""
        return 1 <= self.value <= 9
    
    @property
    def is_element_damage(self) -> bool:
        """是否为元素伤害"""
        return 10 <= self.value <= 14
    
    @property
    def is_anomaly_damage(self) -> bool:
        """是否为属性异常伤害"""
        return 20 <= self.value <= 25
    
    @property
    def is_special_damage(self) -> bool:
        """是否为特殊伤害类型"""
        return 30 <= self.value <= 33
    
    @property
    def is_unique_attribute_damage(self) -> bool:
        """是否为特殊属性伤害"""
        return 40 <= self.value <= 42
    
    @property
    def color_code(self) -> str:
        """获取颜色代码"""
        color_map = {
            DamageType.PHYSICAL: "#F0D12B",      # 黄色
            DamageType.ETHER: "#FE437E",        # 粉色
            DamageType.ELECTRIC: "#2EB6FF",     # 蓝色
            DamageType.ICE: "#98EFF0",          # 青色
            DamageType.FIRE: "#FF5521",         # 橙红色
        }
        return color_map.get(self, "")
    
    @property
    def display_name(self) -> str:
        """显示名称"""
        name_map = {
            DamageType.NORMAL_ATTACK: "普通攻击",
            DamageType.ENHANCED_SPECIAL: "强化特殊技",
            DamageType.CHAIN_ATTACK: "连携技",
            DamageType.ULTIMATE_ATTACK: "终结技",
            DamageType.DASH_ATTACK: "冲刺攻击",
            DamageType.DODGE_COUNTER: "闪避反击",
            DamageType.ASSIST_ATTACK: "支援攻击",
            DamageType.ADDITIONAL_ATTACK: "追加攻击",
            DamageType.SPECIAL_ATTACK: "特殊技",
            DamageType.PHYSICAL: "物理",
            DamageType.ETHER: "以太",
            DamageType.ELECTRIC: "电",
            DamageType.ICE: "冰",
            DamageType.FIRE: "火",
            DamageType.IMPACT: "强击",
            DamageType.SHOCK: "感电",
            DamageType.FREEZE: "冻结",
            DamageType.SHATTER: "碎冰",
            DamageType.BURN: "灼烧",
            DamageType.CORROSION: "侵蚀",
            DamageType.CRITICAL: "暴击",
            DamageType.PENETRATION: "贯穿",
            DamageType.DISORDER: "紊乱",
            DamageType.ANOMALY: "异常",
            DamageType.LIE_SHUANG: "烈霜",
            DamageType.LING_REN: "凛刃",
            DamageType.XUAN_MO: "玄墨",
            DamageType.NORMAL: "普通",
            DamageType.ADDITIONAL: "附加",
            DamageType.DOT: "持续",
        }
        return name_map.get(self, self.name)
    
    @classmethod
    def get_all_skill_damage_types(cls) -> list:
        """获取所有技能相关伤害类型"""
        return [dt for dt in cls if dt.is_skill_damage]
    
    @classmethod
    def get_all_element_damage_types(cls) -> list:
        """获取所有元素伤害类型"""
        return [dt for dt in cls if dt.is_element_damage]
    
    @classmethod
    def get_all_anomaly_damage_types(cls) -> list:
        """获取所有属性异常伤害类型"""
        return [dt for dt in cls if dt.is_anomaly_damage]
    
    @classmethod
    def get_all_special_damage_types(cls) -> list:
        """获取所有特殊伤害类型"""
        return [dt for dt in cls if dt.is_special_damage]
    
    @classmethod
    def get_all_unique_attribute_damage_types(cls) -> list:
        """获取所有特殊属性伤害类型"""
        return [dt for dt in cls if dt.is_unique_attribute_damage]


class SkillType(Enum):
    """
    技能类型
    
    定义游戏中所有技能类型，与 DamageType 中的技能相关伤害对应
    """
    BASIC = 1           # 普通攻击
    DODGE = 2           # 闪避反击
    ASSIST = 3          # 支援技
    SPECIAL = 4         # 特殊技
    CHAIN = 5           # 连携技
    ULTIMATE = 6        # 终结技
    ENHANCED_SPECIAL = 7 # 强化特殊技
    DASH = 8            # 冲刺攻击
    ADDITIONAL = 9      # 追加攻击
    
    @property
    def display_name(self) -> str:
        """显示名称"""
        name_map = {
            SkillType.BASIC: "普通攻击",
            SkillType.DODGE: "闪避反击",
            SkillType.ASSIST: "支援技",
            SkillType.SPECIAL: "特殊技",
            SkillType.CHAIN: "连携技",
            SkillType.ULTIMATE: "终结技",
            SkillType.ENHANCED_SPECIAL: "强化特殊技",
            SkillType.DASH: "冲刺攻击",
            SkillType.ADDITIONAL: "追加攻击",
        }
        return name_map.get(self, self.name)
    
    @property
    def is_energy_consuming(self) -> bool:
        """是否消耗能量"""
        return self in [SkillType.SPECIAL, SkillType.ENHANCED_SPECIAL, SkillType.ULTIMATE]
    
    @property
    def can_trigger_chain(self) -> bool:
        """是否可以触发连携技"""
        return self in [SkillType.BASIC, SkillType.DODGE, SkillType.SPECIAL, SkillType.ENHANCED_SPECIAL]


class AnomalyType(Enum):
    """
    属性异常类型
    
    定义游戏中所有的属性异常效果，包括：
    - 基础属性异常（6种）
    - 特殊属性异常（3种）
    """
    # ========== 基础属性异常（6种）==========
    IMPACT = 1          # 强击（物理）
    SHOCK = 2           # 感电（电）
    FREEZE = 3          # 冻结（冰）
    SHATTER = 4         # 碎冰（冰触发）
    BURN = 5            # 灼烧（火）
    CORROSION = 6       # 侵蚀（以太）
    
    # ========== 特殊属性异常（3种）==========
    LIE_SHUANG = 10     # 烈霜（冰属性特殊异常）
    LING_REN = 11       # 凛刃（物理属性特殊异常）
    XUAN_MO = 12        # 玄墨（以太属性特殊异常）
    
    # ========== 复合异常（1种）==========
    DISORDER = 20       # 紊乱（多属性）
    
    @property
    def element_type(self) -> ElementType:
        """获取对应的元素类型"""
        element_map = {
            AnomalyType.IMPACT: ElementType.PHYSICAL,
            AnomalyType.SHOCK: ElementType.ELECTRIC,
            AnomalyType.FREEZE: ElementType.ICE,
            AnomalyType.SHATTER: ElementType.ICE,
            AnomalyType.BURN: ElementType.FIRE,
            AnomalyType.CORROSION: ElementType.ETHER,
            AnomalyType.LIE_SHUANG: ElementType.ICE,      # 烈霜 - 冰
            AnomalyType.LING_REN: ElementType.PHYSICAL,   # 凛刃 - 物理
            AnomalyType.XUAN_MO: ElementType.ETHER,       # 玄墨 - 以太
            AnomalyType.DISORDER: None,  # 紊乱是多属性
        }
        return element_map.get(self)
    
    @property
    def is_dot(self) -> bool:
        """是否为持续伤害"""
        return self in [AnomalyType.SHOCK, AnomalyType.BURN, AnomalyType.CORROSION]
    
    @property
    def is_control(self) -> bool:
        """是否为控制效果"""
        return self in [AnomalyType.IMPACT, AnomalyType.FREEZE]
    
    @property
    def is_unique(self) -> bool:
        """是否为特殊属性异常"""
        return self in [AnomalyType.LIE_SHUANG, AnomalyType.LING_REN, AnomalyType.XUAN_MO]
    
    @property
    def display_name(self) -> str:
        """显示名称"""
        name_map = {
            AnomalyType.IMPACT: "强击",
            AnomalyType.SHOCK: "感电",
            AnomalyType.FREEZE: "冻结",
            AnomalyType.SHATTER: "碎冰",
            AnomalyType.BURN: "灼烧",
            AnomalyType.CORROSION: "侵蚀",
            AnomalyType.LIE_SHUANG: "烈霜",
            AnomalyType.LING_REN: "凛刃",
            AnomalyType.XUAN_MO: "玄墨",
            AnomalyType.DISORDER: "紊乱",
        }
        return name_map.get(self, self.name)
    
    @property
    def damage_type(self) -> DamageType:
        """获取对应的伤害类型"""
        damage_map = {
            AnomalyType.IMPACT: DamageType.IMPACT,
            AnomalyType.SHOCK: DamageType.SHOCK,
            AnomalyType.FREEZE: DamageType.FREEZE,
            AnomalyType.SHATTER: DamageType.SHATTER,
            AnomalyType.BURN: DamageType.BURN,
            AnomalyType.CORROSION: DamageType.CORROSION,
            AnomalyType.LIE_SHUANG: DamageType.LIE_SHUANG,
            AnomalyType.LING_REN: DamageType.LING_REN,
            AnomalyType.XUAN_MO: DamageType.XUAN_MO,
            AnomalyType.DISORDER: DamageType.DISORDER,
        }
        return damage_map.get(self)


class DamageCategory(Enum):
    """
    伤害分类
    
    用于对伤害进行分类管理
    """
    SKILL = 1           # 技能伤害
    ELEMENT = 2         # 元素伤害
    ANOMALY = 3         # 属性异常伤害
    SPECIAL = 4         # 特殊伤害
    UNIQUE = 5          # 特殊属性伤害
    GENERAL = 6         # 通用伤害
    
    @classmethod
    def from_damage_type(cls, damage_type: DamageType) -> 'DamageCategory':
        """从伤害类型获取分类"""
        if damage_type.is_skill_damage:
            return cls.SKILL
        elif damage_type.is_element_damage:
            return cls.ELEMENT
        elif damage_type.is_anomaly_damage:
            return cls.ANOMALY
        elif damage_type.is_special_damage:
            return cls.SPECIAL
        elif damage_type.is_unique_attribute_damage:
            return cls.UNIQUE
        else:
            return cls.GENERAL


@dataclass
class DamageMultiplier:
    """
    伤害倍率
    
    技能的基础伤害倍率，如：
    - 普通攻击一段：55.2%
    - 特殊技：473%
    """
    skill_type: SkillType   # 技能类型
    multiplier: float       # 伤害倍率（百分比）
    element: ElementType    # 元素类型
    hits: int = 1           # 段数
    description: str = ""   # 描述
    
    def __post_init__(self):
        """初始化后处理"""
        if isinstance(self.skill_type, int):
            self.skill_type = SkillType(self.skill_type)
        if isinstance(self.element, int):
            self.element = ElementType(self.element)
    
    @property
    def total_multiplier(self) -> float:
        """总倍率（考虑段数）"""
        return self.multiplier * self.hits