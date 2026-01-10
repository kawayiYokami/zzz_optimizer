"""
Debuff减益模型 - 纯数据定义
"""
from dataclasses import dataclass, field
from typing import Dict
from enum import Enum

from optimizer.zzz_models.base import PropertyType


class DebuffSource(Enum):
    """Debuff来源"""
    AGENT_SKILL = 1         # 角色技能
    WENGINE = 2             # 音擎
    DRIVE_DISK = 3          # 驱动盘套装
    TEAM_MATE = 4           # 队友


@dataclass
class Debuff:
    """
    减益数据模型
    
    施加在敌人身上的负面效果
    """
    id: str                                     # 唯一标识
    name: str                                   # 减益名称
    description: str                            # 效果描述
    source: DebuffSource                        # 来源
    
    # 敌人属性削减
    stats_reduction: Dict[PropertyType, float] = field(default_factory=dict)
    
    # 生效条件（简化，默认全生效）
    is_active: bool = True
    
    def __post_init__(self):
        if isinstance(self.source, int):
            self.source = DebuffSource(self.source)