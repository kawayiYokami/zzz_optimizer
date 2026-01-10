"""
伤害计算数据类模块

包含：
- EnemyStats: 敌人属性
- SkillDamageParams: 技能伤害参数
- CombatSnapshot: 战斗快照
"""

from .enemy_stats import EnemyStats
from .skill_params import SkillDamageParams
from .combat_snapshot import CombatSnapshot

__all__ = [
    "EnemyStats",
    "SkillDamageParams",
    "CombatSnapshot",
]
