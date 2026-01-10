"""
技能伤害参数数据类
"""

from dataclasses import dataclass, field
from typing import Literal, Optional
from optimizer.zzz_models.ratio_set import RatioSet


@dataclass
class SkillDamageParams:
    """技能伤害参数（重构版）"""

    # 向后兼容字段
    damage_ratio: float  # 伤害倍率（向后兼容，自动映射到对应属性倍率）
    element: Literal['ice', 'fire', 'electric', 'physical', 'ether']  # 元素类型
    is_penetration: bool = False  # 是否为贯穿伤害
    stun_ratio: float = 0.0  # 失衡倍率
    anomaly_buildup: float = 0.0  # 异常积蓄
    distance: float = 0.0  # 距离（用于距离衰减）

    # 新增字段：多倍率支持
    ratios: Optional[RatioSet] = None  # 倍率集（如果为None，则使用 damage_ratio 自动映射）

    def __post_init__(self):
        """初始化后处理：自动映射 damage_ratio"""
        if self.ratios is None:
            # 自动映射：根据 is_penetration 决定使用哪个倍率
            self.ratios = RatioSet(
                atk_ratio=self.damage_ratio if not self.is_penetration else 0.0,
                pen_ratio=self.damage_ratio if self.is_penetration else 0.0,
            )

    def get_effective_ratios(self) -> RatioSet:
        """获取有效倍率集

        Returns:
            RatioSet 对象
        """
        return self.ratios if self.ratios is not None else RatioSet()

    @classmethod
    def from_legacy(cls, damage_ratio: float, element: str, is_penetration: bool = False, **kwargs):
        """从旧格式创建对象（向后兼容）

        Args:
            damage_ratio: 伤害倍率
            element: 元素类型
            is_penetration: 是否贯穿伤害
            **kwargs: 其他参数

        Returns:
            SkillDamageParams 对象
        """
        return cls(
            damage_ratio=damage_ratio,
            element=element,
            is_penetration=is_penetration,
            **kwargs
        )

    @classmethod
    def from_ratio_set(cls, ratios: RatioSet, element: str, **kwargs):
        """从倍率集创建对象（新接口）

        Args:
            ratios: 倍率集
            element: 元素类型
            **kwargs: 其他参数

        Returns:
            SkillDamageParams 对象
        """
        # 计算主要倍率（用于向后兼容）
        main_ratio = ratios.atk_ratio + ratios.pen_ratio  # 简化处理

        return cls(
            damage_ratio=main_ratio,
            element=element,
            ratios=ratios,
            **kwargs
        )

    def format(self, indent: int = 0) -> str:
        """格式化输出技能参数

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        lines.append(f"{prefix}【技能参数】")
        lines.append(f"{prefix}  伤害倍率: {self.damage_ratio:.4f} ({self.damage_ratio*100:.1f}%)")
        lines.append(f"{prefix}  元素类型: {self.element}")
        lines.append(f"{prefix}  是否贯穿: {self.is_penetration}")

        if self.stun_ratio > 0:
            lines.append(f"{prefix}  失衡倍率: {self.stun_ratio:.4f}")

        if self.anomaly_buildup > 0:
            lines.append(f"{prefix}  异常积蓄: {self.anomaly_buildup:.2f}")

        if self.distance > 0:
            lines.append(f"{prefix}  距离: {self.distance:.2f}")

        # 输出倍率集详情
        if self.ratios:
            lines.append(f"{prefix}  倍率集:")
            if self.ratios.atk_ratio > 0:
                lines.append(f"{prefix}    攻击倍率: {self.ratios.atk_ratio:.4f} ({self.ratios.atk_ratio*100:.1f}%)")
            if self.ratios.def_ratio > 0:
                lines.append(f"{prefix}    防御倍率: {self.ratios.def_ratio:.4f} ({self.ratios.def_ratio*100:.1f}%)")
            if self.ratios.hp_ratio > 0:
                lines.append(f"{prefix}    生命倍率: {self.ratios.hp_ratio:.4f} ({self.ratios.hp_ratio*100:.1f}%)")
            if self.ratios.pen_ratio > 0:
                lines.append(f"{prefix}    贯穿力倍率: {self.ratios.pen_ratio:.4f} ({self.ratios.pen_ratio*100:.1f}%)")
            if self.ratios.anom_prof_ratio > 0:
                lines.append(f"{prefix}    异常精通倍率: {self.ratios.anom_prof_ratio:.4f} ({self.ratios.anom_prof_ratio*100:.1f}%)")
            if self.ratios.anom_atk_ratio > 0:
                lines.append(f"{prefix}    异常攻击倍率: {self.ratios.anom_atk_ratio:.4f} ({self.ratios.anom_atk_ratio*100:.1f}%)")

        return "\n".join(lines)
