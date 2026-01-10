"""
倍率集

用于存储伤害计算的倍率。
"""

from dataclasses import dataclass


@dataclass
class RatioSet:
    """倍率集

    存储6种倍率，用于伤害计算
    """
    atk_ratio: float = 0.0         # 攻击倍率
    def_ratio: float = 0.0         # 防御倍率
    hp_ratio: float = 0.0          # 生命倍率
    pen_ratio: float = 0.0         # 贯穿力倍率
    anom_prof_ratio: float = 0.0   # 异常精通倍率
    anom_atk_ratio: float = 0.0    # 异常攻击倍率（吃攻击）

    def get_ratio(self, ratio_name: str) -> float:
        """根据倍率名获取倍率值

        Args:
            ratio_name: 倍率名 ('atk', 'def', 'hp', 'pen', 'anom_prof', 'anom_atk')

        Returns:
            倍率值
        """
        ratio_map = {
            'atk': self.atk_ratio,
            'def': self.def_ratio,
            'hp': self.hp_ratio,
            'pen': self.pen_ratio,
            'anom_prof': self.anom_prof_ratio,
            'anom_atk': self.anom_atk_ratio,
        }
        return ratio_map.get(ratio_name.lower(), 0.0)

    def format(self, indent: int = 0) -> str:
        """格式化输出

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        prefix = " " * indent
        lines = [
            f"{prefix}倍率集:",
            f"{prefix}  攻击倍率: {self.atk_ratio:.4f}",
            f"{prefix}  防御倍率: {self.def_ratio:.4f}",
            f"{prefix}  生命倍率: {self.hp_ratio:.4f}",
            f"{prefix}  贯穿力倍率: {self.pen_ratio:.4f}",
            f"{prefix}  异常精通倍率: {self.anom_prof_ratio:.4f}",
            f"{prefix}  异常攻击倍率: {self.anom_atk_ratio:.4f}",
        ]
        return "\n".join(lines)
