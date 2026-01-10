"""
敌人属性数据类
"""

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class EnemyStats:
    """敌人属性"""

    # 基础属性
    hp: float = 0.0  # 生命值
    defense: float = 0.0  # 防御力
    level: int = 60  # 等级

    # 失衡相关
    stun_max: float = 0.0  # 失衡值上限
    can_stun: bool = True  # 能否失衡
    stun_vulnerability: float = 0.5  # 失衡易伤倍率（默认50%）
    is_stunned: bool = False  # 是否处于失衡状态

    # 伤害抗性（按元素）
    element_resistances: dict[Literal['ice', 'fire', 'electric', 'physical', 'ether'], float] = field(
        default_factory=dict
    )

    # 异常条阈值（按元素）
    anomaly_thresholds: dict[Literal['ice', 'fire', 'electric', 'physical', 'ether'], float] = field(
        default_factory=dict
    )

    # 秽盾
    has_corruption_shield: bool = False  # 是否有秽盾（秽盾存在时防御翻倍）

    def get_element_resistance(
        self, element: Literal['ice', 'fire', 'electric', 'physical', 'ether']
    ) -> float:
        """获取指定元素的伤害抗性

        Args:
            element: 元素类型

        Returns:
            伤害抗性值（弱点为负，抗性为正）
        """
        return self.element_resistances.get(element, 0.0)

    def get_anomaly_threshold(
        self, element: Literal['ice', 'fire', 'electric', 'physical', 'ether']
    ) -> float:
        """获取指定元素的异常条阈值

        Args:
            element: 元素类型

        Returns:
            异常条阈值
        """
        return self.anomaly_thresholds.get(element, 3000.0)  # 默认3000

    def get_level_coefficient(self) -> float:
        """获取等级基数

        等级1-60: 50-794
        等级>60: 794
        """
        if self.level <= 1:
            return 50.0
        elif self.level >= 60:
            return 794.0
        else:
            # 线性插值
            return 50.0 + (794.0 - 50.0) * (self.level - 1) / (60 - 1)

    def get_effective_defense(
        self,
        penetration_rate: float,
        penetration_value: float,
        ignore_def_rate: float = 0.0,
    ) -> float:
        """获取有效防御

        Args:
            penetration_rate: 穿透率
            penetration_value: 穿透值
            ignore_def_rate: 无视防御率

        Returns:
            有效防御值（≥0）

        公式：
        基础防御 × (秽盾?2:1) = 受击方防御
        受击方防御 × (1 - 穿透率%) - 穿透值 = 有效防御
        """
        # 计算基础防御（秽盾存在时翻倍）
        base_defense = self.defense * (2.0 if self.has_corruption_shield else 1.0)

        # 应用无视防御率
        final_defense = base_defense * (1.0 - ignore_def_rate)

        # 计算有效防御
        effective_def = final_defense * (1.0 - penetration_rate) - penetration_value

        return max(0.0, effective_def)
