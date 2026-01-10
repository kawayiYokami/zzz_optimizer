"""
优化器数据模型
"""
from .base import (
    Rarity,
    ElementType,
    WeaponType,
    PropertyType,
    StatValue,
)
from .agent import Agent, AgentSkills
from .wengine import WEngine
from .drive_disk import DriveDisk, DriveDiskSet, DriveDiskPosition, DriveDiskCollection
from .stat import Stat, StatModifier, BuffEffect, StatCalculator
from .damage import (
    DamageMultiplier,
    DamageType,
    SkillType,
)
from .buff import Buff, BuffSource, BuffContext
from .debuff import Debuff, DebuffSource
from .inventory import Inventory

# 新增：基于CSV的模型
from .agent_skill import AgentSkillSegment, AgentSkill, AgentSkillSet
from .bangboo import Bangboo, BangbooSkill, BangbooStats
from .enemy import Enemy
from .anomaly_bar import AnomalyBar

__all__ = [
    # 基础枚举
    'Rarity',
    'ElementType',
    'WeaponType',
    'PropertyType',
    'StatValue',

    # 角色
    'Agent',
    'AgentSkills',

    # 音擎
    'WEngine',

    # 驱动盘
    'DriveDisk',
    'DriveDiskSet',
    'DriveDiskPosition',
    'DriveDiskCollection',

    # 属性词条
    'Stat',
    'StatModifier',
    'BuffEffect',
    'StatCalculator',

    # 伤害相关
    'DamageMultiplier',
    'DamageType',
    'SkillType',

    # Buff/Debuff
    'Buff',
    'BuffSource',
    'BuffContext',
    'Debuff',
    'DebuffSource',

    # 仓库
    'Inventory',

    # 新增：基于CSV的模型
    'AgentSkillSegment',
    'AgentSkill',
    'AgentSkillSet',
    'Bangboo',
    'BangbooSkill',
    'BangbooStats',
    'Enemy',
    'AnomalyBar',
]