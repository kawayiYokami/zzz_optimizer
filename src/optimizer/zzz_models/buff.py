"""
Buff增益模型 - 纯数据定义
"""
from dataclasses import dataclass, field
from typing import Dict, Optional
from enum import Enum

from optimizer.zzz_models.base import PropertyType
from optimizer.zzz_models.property_collection import PropertyCollection


class BuffContext(Enum):
    """Buff生效环境"""
    OUT_OF_COMBAT = 1   # 局外（面板显示）
    IN_COMBAT = 2       # 局内（战斗中）


class BuffTarget:
    """Buff生效目标"""
    def __init__(
        self,
        target_self: bool = True,      # 对自身生效
        target_enemy: bool = False,    # 对敌人生效
        target_teammate: bool = False, # 对队友生效
        target_bund: bool = False,     # 对邦布生效
    ):
        self.target_self = target_self
        self.target_enemy = target_enemy
        self.target_teammate = target_teammate
        self.target_bund = target_bund


class BuffSource(Enum):
    """Buff来源"""
    AGENT_PASSIVE = 1       # 角色被动
    AGENT_TALENT = 2        # 角色天赋
    TALENT = 11             # 天赋（简写）
    AGENT_CORE = 3          # 核心技能
    WENGINE = 4             # 音擎
    WENGINE_TALENT = 5      # 音擎天赋
    DRIVE_DISK_2PC = 6      # 驱动盘2件套
    DRIVE_DISK_4PC = 7      # 驱动盘4件套
    TEAM_MATE = 8           # 队友
    CORE_PASSIVE = 9        # 核心被动
    POTENTIAL = 10          # 潜能觉醒


@dataclass
class ConversionBuff:
    """
    转换类BUFF模型
    
    用于属性转换效果（如：每点异常精通转伤害）
    不分局内局外，始终生效
    """
    id: str                                             # 唯一标识
    name: str                                           # 增益名称
    description: str                                    # 效果描述
    source: BuffSource                                  # 来源
    
    # 转换相关
    from_property: PropertyType                          # 源属性
    to_property: PropertyType                            # 目标属性
    conversion_ratio: float                              # 转换比例
    
    # 上限（可选）
    max_value: Optional[float] = None                   # 转换后的最大值
    
    # 触发条件（描述文本）
    trigger_conditions: str = ""                         # 触发条件
    
    # 生效条件
    is_active: bool = True
    
    def __post_init__(self):
        if isinstance(self.source, int):
            self.source = BuffSource(self.source)
        if isinstance(self.from_property, str):
            self.from_property = PropertyType[self.from_property]
        if isinstance(self.to_property, str):
            self.to_property = PropertyType[self.to_property]
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ConversionBuff':
        """从字典创建"""
        # 转换 max_value（如果目标属性是百分比，需要从百分数转为小数）
        max_value = data.get('max_value')
        if max_value is not None:
            to_prop = PropertyType[data['to_property']] if isinstance(data['to_property'], str) else PropertyType(data['to_property'])
            if to_prop.is_percentage:
                max_value = max_value / 100.0

        return cls(
            id=data['id'],
            name=data['name'],
            description=data['description'],
            source=BuffSource[data['source']] if isinstance(data['source'], str) else BuffSource(data['source']),
            from_property=PropertyType[data['from_property']] if isinstance(data['from_property'], str) else PropertyType(data['from_property']),
            to_property=PropertyType[data['to_property']] if isinstance(data['to_property'], str) else PropertyType(data['to_property']),
            conversion_ratio=data['conversion_ratio'],
            max_value=max_value,
            trigger_conditions=data.get('trigger_conditions', ''),
            is_active=data.get('is_active', True),
        )
    
    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'source': self.source.name,
            'from_property': self.from_property.name,
            'to_property': self.to_property.name,
            'conversion_ratio': self.conversion_ratio,
            'max_value': self.max_value,
            'trigger_conditions': self.trigger_conditions,
            'is_active': self.is_active,
        }
    
    def calculate_value(self, source_value: float) -> float:
        """
        计算转换后的数值
        
        Args:
            source_value: 源属性的数值
            
        Returns:
            转换后的数值
        """
        if not self.is_active:
            return 0.0
        
        # 计算转换值
        value = source_value * self.conversion_ratio
        
        # 应用上限
        if self.max_value and value > self.max_value:
            value = self.max_value
        
        return value

    def format(self, indent: int = 0) -> str:
        """格式化输出转换BUFF信息（只输出有意义的值）

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 转换BUFF基本信息
        lines.append(f"{prefix}【转换BUFF】")
        lines.append(f"  {prefix}名称: {self.name}")
        if self.description:
            lines.append(f"  {prefix}描述: {self.description}")
        lines.append(f"  {prefix}来源: {self.source.name}")
        
        # 转换信息
        lines.append(f"{prefix}【转换】")
        lines.append(f"  {prefix}源属性: {self.from_property.cn_name}")
        lines.append(f"  {prefix}目标属性: {self.to_property.cn_name}")
        lines.append(f"  {prefix}转换比例: {self.conversion_ratio * 100:.0f}%")
        
        # 上限（根据目标属性类型显示）
        if self.max_value:
            if self.to_property.is_percentage:
                # 目标属性是百分比，显示为百分比
                lines.append(f"  {prefix}上限: {self.max_value*100:.2f}%")
            else:
                # 目标属性是固定值，显示为固定值
                lines.append(f"  {prefix}上限: {self.max_value:.1f}")
        
        # 触发条件
        if self.trigger_conditions:
            lines.append(f"  {prefix}触发条件: {self.trigger_conditions}")
        
        # 生效状态
        if not self.is_active:
            lines.append(f"  {prefix}状态: 未激活")
        
        return "\n".join(lines)


@dataclass
class Buff:
    """
    增益数据模型
    
    包含所有属性加成，分为局外和局内
    """
    id: str                                             # 唯一标识
    name: str                                           # 增益名称
    description: str                                    # 效果描述
    source: BuffSource                                  # 来源
    context: BuffContext                                # 生效环境（局外/局内）
    target: BuffTarget = field(default_factory=lambda: BuffTarget())  # 生效目标（默认仅自身）
    
    # 局外属性加成（面板显示）
    out_of_combat_stats: Dict[PropertyType, float] = field(default_factory=dict)
    
    # 局内属性加成（战斗中）
    in_combat_stats: Dict[PropertyType, float] = field(default_factory=dict)
    
    # 触发条件（描述文本，为空则无条件触发）
    trigger_conditions: str = ""
    
    # 叠加层数
    max_stacks: int = 1                                 # 最大叠加层数，默认1
    stack_mode: str = "linear"                          # 叠加模式：linear（线性叠加）或 full_only（仅满层生效）
    base_value: Optional[float] = None                  # 每层基础值（用于线性叠加）
    full_stack_bonus: Optional[float] = None           # 满层额外加成
    
    # 生效条件（简化，默认全生效）
    is_active: bool = True
    
    def __post_init__(self):
        if isinstance(self.source, int):
            self.source = BuffSource(self.source)
        if isinstance(self.context, int):
            self.context = BuffContext(self.context)
        # target 已经是 BuffTarget 对象，无需转换
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Buff':
        """从字典创建"""
        # 转换 out_of_combat_stats（百分比属性需要从百分数转为小数）
        out_of_combat_stats = {}
        if 'out_of_combat_stats' in data:
            for prop_name, value in data['out_of_combat_stats'].items():
                prop_type = PropertyType[prop_name]
                # 如果是百分比属性，从百分数形式（60.0 = 60%）转为小数形式（0.6 = 60%）
                if prop_type.is_percentage:
                    out_of_combat_stats[prop_type] = value / 100.0
                else:
                    out_of_combat_stats[prop_type] = value

        # 转换 in_combat_stats（百分比属性需要从百分数转为小数）
        in_combat_stats = {}
        if 'in_combat_stats' in data:
            for prop_name, value in data['in_combat_stats'].items():
                prop_type = PropertyType[prop_name]
                # 如果是百分比属性，从百分数形式（60.0 = 60%）转为小数形式（0.6 = 60%）
                if prop_type.is_percentage:
                    in_combat_stats[prop_type] = value / 100.0
                else:
                    in_combat_stats[prop_type] = value
        
        # 转换 target
        target_data = data.get('target', {})
        target = BuffTarget(
            target_self=target_data.get('target_self', True),
            target_enemy=target_data.get('target_enemy', False),
            target_teammate=target_data.get('target_teammate', False),
            target_bund=target_data.get('target_bund', False),
        )
        
        return cls(
            id=data['id'],
            name=data['name'],
            description=data['description'],
            source=BuffSource[data['source']] if isinstance(data['source'], str) else BuffSource(data['source']),
            context=BuffContext[data['context']] if isinstance(data['context'], str) else BuffContext(data['context']),
            target=target,
            out_of_combat_stats=out_of_combat_stats,
            in_combat_stats=in_combat_stats,
            trigger_conditions=data.get('trigger_conditions', []),
            max_stacks=data.get('max_stacks', 1),
            stack_mode=data.get('stack_mode', 'linear'),
            base_value=data.get('base_value'),
            full_stack_bonus=data.get('full_stack_bonus'),
            is_active=data.get('is_active', True),
        )
    
    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'source': self.source.name,
            'context': self.context.name,
            'target': {
                'target_self': self.target.target_self,
                'target_enemy': self.target.target_enemy,
                'target_teammate': self.target.target_teammate,
                'target_bund': self.target.target_bund,
            },
            'out_of_combat_stats': {prop.name: value for prop, value in self.out_of_combat_stats.items()},
            'in_combat_stats': {prop.name: value for prop, value in self.in_combat_stats.items()},
            'trigger_conditions': self.trigger_conditions,
            'max_stacks': self.max_stacks,
            'stack_mode': self.stack_mode,
            'base_value': self.base_value,
            'full_stack_bonus': self.full_stack_bonus,
            'is_active': self.is_active,
        }
    
    def calculate_value(self, current_stacks: int = 1) -> Dict[PropertyType, float]:
        """
        计算指定层数下的buff数值
        
        Args:
            current_stacks: 当前层数 (1-max_stacks)
            
        Returns:
            属性字典 {PropertyType: value}
        
        计算规则：
        - stack_mode = "linear": value = base_value * current_stacks + (满层 ? full_stack_bonus : 0)
        - stack_mode = "full_only": value = (满层 ? base_value : 0)
        """
        if not self.is_active:
            return {}
        
        stats = {}
        
        if self.stack_mode == "linear":
            # 线性叠加模式
            for prop, base_val in self.in_combat_stats.items():
                value = base_val * current_stacks
                # 满层时额外加成
                if current_stacks == self.max_stacks and self.full_stack_bonus:
                    value += self.full_stack_bonus
                stats[prop] = value
        
        elif self.stack_mode == "full_only":
            # 仅满层生效模式
            if current_stacks == self.max_stacks:
                stats = self.in_combat_stats.copy()
        
        return stats

    def to_property_collection(self) -> PropertyCollection:
        """将 Buff 转换为 PropertyCollection
        
        Returns:
            PropertyCollection：包含局外和局内属性
        """
        if not self.is_active:
            return PropertyCollection()
        
        return PropertyCollection(
            out_of_combat=self.out_of_combat_stats.copy(),
            in_combat=self.in_combat_stats.copy(),
        )

    def format(self, indent: int = 0) -> str:
        """格式化输出Buff信息（只输出有意义的值）

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # Buff 基本信息
        lines.append(f"{prefix}【Buff】")
        lines.append(f"  {prefix}名称: {self.name}")
        if self.description:
            lines.append(f"  {prefix}描述: {self.description}")
        lines.append(f"  {prefix}来源: {self.source.name}")
        lines.append(f"  {prefix}环境: {self.context.name}")
        
        # 叠加信息
        if self.max_stacks > 1:
            lines.append(f"  {prefix}叠加: 最大{self.max_stacks}层 ({self.stack_mode})")
        
        # 触发条件
        if self.trigger_conditions:
            lines.append(f"  {prefix}触发条件: {self.trigger_conditions}")
        
        # 目标
        target_list = []
        if self.target.target_self:
            target_list.append("自身")
        if self.target.target_enemy:
            target_list.append("敌人")
        if self.target.target_teammate:
            target_list.append("队友")
        if self.target.target_bund:
            target_list.append("邦布")
        if target_list:
            lines.append(f"  {prefix}目标: {', '.join(target_list)}")
        
        # 属性集合（直接使用 PropertyCollection 的格式化方法）
        if self.out_of_combat_stats or self.in_combat_stats:
            lines.append(f"{prefix}【属性】")
            prop_collection = self.to_property_collection()
            formatted = prop_collection.format(indent=indent+2)
            if formatted:
                lines.append(formatted)
        
        return "\n".join(lines)