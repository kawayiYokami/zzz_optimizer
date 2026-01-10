"""
属性词条模型
"""
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from enum import Enum

from optimizer.zzz_models.base import PropertyType, StatValue


class BuffType(Enum):
    """增益类型"""
    ADDITIVE = 1        # 加算（直接相加）
    MULTIPLICATIVE = 2  # 乘算（乘法）
    UNIQUE = 3          # 独立乘区（特殊计算）


class BuffSource(Enum):
    """增益来源"""
    AGENT_PASSIVE = 1       # 角色被动
    AGENT_TALENT = 2        # 角色天赋
    WENGINE = 3             # 音擎
    DRIVE_DISK_SET = 4      # 驱动盘套装
    TEAM_BUFF = 5           # 队伍增益
    ENEMY_DEBUFF = 6        # 敌人减益


@dataclass
class Stat:
    """
    属性词条
    
    代表一个具体的属性数值，包含：
    - 属性类型（攻击力、暴击率等）
    - 数值大小
    - 是否为百分比
    """
    prop_type: PropertyType     # 属性类型
    value: float                # 数值
    is_percent: bool = False    # 是否为百分比
    
    def __post_init__(self):
        """初始化后处理"""
        if isinstance(self.prop_type, int):
            self.prop_type = PropertyType(self.prop_type)
    
    @property
    def stat_value(self) -> StatValue:
        """转换为StatValue对象"""
        return StatValue(value=self.value, is_percent=self.is_percent)
    
    def __add__(self, other):
        """支持加法运算"""
        if isinstance(other, Stat):
            if self.prop_type != other.prop_type:
                raise ValueError(f"Cannot add different property types: {self.prop_type} and {other.prop_type}")
            if self.is_percent != other.is_percent:
                raise ValueError(f"Cannot add percent and non-percent values")
            return Stat(
                prop_type=self.prop_type,
                value=self.value + other.value,
                is_percent=self.is_percent
            )
        return NotImplemented
    
    def __str__(self) -> str:
        """字符串表示"""
        value_str = f"{self.value:.1f}%" if self.is_percent else f"{int(self.value)}"
        return f"{self.prop_type.name}: {value_str}"


@dataclass
class StatModifier:
    """
    属性修正器
    
    用于表示各种加成/减益效果，如：
    - 角色被动：暴击率+10%
    - 音擎效果：攻击力+15%
    - 套装效果：物理伤害+10%
    """
    prop_type: PropertyType     # 影响的属性类型
    value: float                # 修正数值
    buff_type: BuffType         # 增益类型（加算/乘算）
    source: BuffSource          # 增益来源
    description: str = ""       # 效果描述
    duration: int = 0           # 持续时间（0表示永久）
    stacks: int = 1             # 层数
    max_stacks: int = 1         # 最大层数
    
    def __post_init__(self):
        """初始化后处理"""
        if isinstance(self.prop_type, int):
            self.prop_type = PropertyType(self.prop_type)
        if isinstance(self.buff_type, int):
            self.buff_type = BuffType(self.buff_type)
        if isinstance(self.source, int):
            self.source = BuffSource(self.source)
    
    @property
    def effective_value(self) -> float:
        """获取有效数值（考虑层数）"""
        return self.value * min(self.stacks, self.max_stacks)
    
    @property
    def is_permanent(self) -> bool:
        """是否为永久效果"""
        return self.duration == 0
    
    def __str__(self) -> str:
        """字符串表示"""
        stack_str = ""
        if self.max_stacks > 1:
            stack_str = f" [{self.stacks}/{self.max_stacks}层]"
        
        duration_str = ""
        if not self.is_permanent:
            duration_str = f" ({self.duration}s)"
        
        return (
            f"{self.description or self.prop_type.name} "
            f"+{self.effective_value:.1f}%{stack_str}{duration_str}"
        )


@dataclass
class BuffEffect:
    """
    完整的增益效果
    
    一个增益效果可能包含多个属性修正，如：
    - 音擎效果：攻击力+15% + 暴击率+5%
    - 套装效果：物理伤害+10% (2件套) + 额外伤害提升25% (4件套)
    """
    name: str                           # 效果名称
    description: str                    # 效果描述
    source: BuffSource                  # 来源
    modifiers: List[StatModifier] = field(default_factory=list)  # 属性修正列表
    
    # 激活条件
    condition: str = ""                 # 激活条件描述
    is_active: bool = True              # 是否激活
    
    # 时间相关
    duration: int = 0                   # 持续时间（0表示永久）
    cooldown: int = 0                   # 冷却时间
    
    def add_modifier(self, modifier: StatModifier) -> None:
        """添加属性修正"""
        self.modifiers.append(modifier)
    
    def get_modifiers_by_type(self, prop_type: PropertyType) -> List[StatModifier]:
        """获取指定属性类型的所有修正"""
        return [m for m in self.modifiers if m.prop_type == prop_type]
    
    def get_total_modifier(self, prop_type: PropertyType, buff_type: BuffType = None) -> float:
        """
        获取指定属性的总修正值
        
        Args:
            prop_type: 属性类型
            buff_type: 增益类型筛选，None表示不筛选
            
        Returns:
            总修正值
        """
        total = 0.0
        for modifier in self.modifiers:
            if modifier.prop_type == prop_type:
                if buff_type is None or modifier.buff_type == buff_type:
                    total += modifier.effective_value
        return total
    
    @property
    def is_permanent(self) -> bool:
        """是否为永久效果"""
        return self.duration == 0
    
    def __str__(self) -> str:
        """字符串表示"""
        modifiers_str = ", ".join([str(m) for m in self.modifiers])
        active_str = "✓" if self.is_active else "✗"
        return f"[{active_str}] {self.name}: {modifiers_str}"


@dataclass
class StatCalculator:
    """
    属性计算器
    
    用于计算角色的最终属性，考虑：
    1. 基础属性（角色等级、突破）
    2. 音擎属性
    3. 驱动盘主属性和副属性
    4. 驱动盘套装效果
    5. 角色被动/天赋
    6. 队伍增益
    """
    base_stats: Dict[PropertyType, float] = field(default_factory=dict)      # 基础属性
    flat_bonuses: Dict[PropertyType, float] = field(default_factory=dict)    # 固定值加成
    percent_bonuses: Dict[PropertyType, float] = field(default_factory=dict) # 百分比加成
    buffs: List[BuffEffect] = field(default_factory=list)                    # 增益效果列表
    
    def add_base_stat(self, prop_type: PropertyType, value: float) -> None:
        """添加基础属性"""
        self.base_stats[prop_type] = self.base_stats.get(prop_type, 0.0) + value
    
    def add_flat_bonus(self, prop_type: PropertyType, value: float) -> None:
        """添加固定值加成"""
        self.flat_bonuses[prop_type] = self.flat_bonuses.get(prop_type, 0.0) + value
    
    def add_percent_bonus(self, prop_type: PropertyType, value: float) -> None:
        """添加百分比加成"""
        self.percent_bonuses[prop_type] = self.percent_bonuses.get(prop_type, 0.0) + value
    
    def add_buff(self, buff: BuffEffect) -> None:
        """添加增益效果"""
        self.buffs.append(buff)
    
    def calculate_final_stat(self, prop_type: PropertyType) -> float:
        """
        计算最终属性
        
        计算公式：
        最终属性 = (基础属性 + 固定值加成) × (1 + 百分比加成) × 增益乘算
        
        Args:
            prop_type: 属性类型
            
        Returns:
            最终属性值
        """
        # 1. 基础值 + 固定值加成
        base = self.base_stats.get(prop_type, 0.0)
        flat = self.flat_bonuses.get(prop_type, 0.0)
        
        # 2. 百分比加成（加算）
        percent = self.percent_bonuses.get(prop_type, 0.0)
        
        # 3. 增益效果（加算）
        for buff in self.buffs:
            if not buff.is_active:
                continue
            percent += buff.get_total_modifier(prop_type, BuffType.ADDITIVE) / 100.0
        
        # 4. 基础计算
        result = (base + flat) * (1 + percent)
        
        # 5. 乘算增益（独立乘区）
        for buff in self.buffs:
            if not buff.is_active:
                continue
            multi = buff.get_total_modifier(prop_type, BuffType.MULTIPLICATIVE) / 100.0
            if multi > 0:
                result *= (1 + multi)
        
        return result
    
    def get_all_stats(self) -> Dict[PropertyType, float]:
        """获取所有属性的最终值"""
        all_props = set(self.base_stats.keys()) | set(self.flat_bonuses.keys()) | set(self.percent_bonuses.keys())
        return {prop: self.calculate_final_stat(prop) for prop in all_props}
    
    def __str__(self) -> str:
        """字符串表示"""
        stats = self.get_all_stats()
        stats_str = "\n".join([f"  {prop.name}: {value:.1f}" for prop, value in stats.items()])
        buffs_str = "\n".join([f"  {buff}" for buff in self.buffs if buff.is_active])
        
        return f"属性计算器:\n属性:\n{stats_str}\n\n增益:\n{buffs_str}"