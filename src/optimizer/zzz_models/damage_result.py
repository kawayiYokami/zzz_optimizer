"""
伤害计算结果数据模型

用于存储伤害计算的中间过程和最终结果
"""
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class DirectDamageResult:
    """直伤结果

    包含直伤的暴击、非暴击、期望伤害及所有相关乘区
    """
    # 最终伤害
    damage_no_crit: float = 0.0      # 非暴击伤害
    damage_crit: float = 0.0         # 暴击伤害
    damage_expected: float = 0.0     # 期望伤害

    # 基础信息
    base_damage: float = 0.0         # 基础伤害（攻击力 × 倍率）
    skill_ratio: float = 0.0         # 技能倍率
    element: str = "physical"        # 元素类型

    # 乘区信息
    atk_zone: float = 1.0            # 攻击力
    dmg_bonus: float = 1.0           # 增伤区
    crit_rate: float = 0.0           # 暴击率
    crit_dmg: float = 0.0            # 暴击伤害
    crit_zone: float = 1.0           # 暴击期望乘区
    def_mult: float = 1.0            # 防御区
    res_mult: float = 1.0            # 抗性区
    dmg_taken_mult: float = 1.0      # 减易伤区
    stun_vuln_mult: float = 1.0      # 失衡易伤区
    distance_mult: float = 1.0       # 距离衰减区

    # 贯穿伤害特有
    is_penetration: bool = False     # 是否为贯穿伤害
    penetration_dmg_bonus: float = 0.0  # 贯穿增伤

    def format(self, indent: int = 0) -> str:
        """格式化输出

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        lines.append(f"{prefix}[直伤结果]")
        lines.append(f"{prefix}  元素: {self.element}")
        lines.append(f"{prefix}  技能倍率: {self.skill_ratio:.4f} ({self.skill_ratio*100:.1f}%)")
        lines.append(f"{prefix}  是否贯穿: {self.is_penetration}")

        lines.append(f"{prefix}  伤害结果:")
        lines.append(f"{prefix}    非暴击: {self.damage_no_crit:.2f}")
        lines.append(f"{prefix}    暴击: {self.damage_crit:.2f}")
        lines.append(f"{prefix}    期望: {self.damage_expected:.2f}")

        lines.append(f"{prefix}  乘区:")
        lines.append(f"{prefix}    基础属性区: {self.base_damage:.2f}")
        lines.append(f"{prefix}    攻击力: {self.atk_zone:.2f}")
        lines.append(f"{prefix}    增伤区: {self.dmg_bonus:.4f}")
        lines.append(f"{prefix}    暴击率: {self.crit_rate:.4f}")
        lines.append(f"{prefix}    暴击伤害: {self.crit_dmg:.4f}")
        lines.append(f"{prefix}    暴击期望: {self.crit_zone:.4f}")
        lines.append(f"{prefix}    防御区: {self.def_mult:.4f}")
        lines.append(f"{prefix}    抗性区: {self.res_mult:.4f}")
        lines.append(f"{prefix}    减易伤区: {self.dmg_taken_mult:.4f}")
        lines.append(f"{prefix}    失衡易伤区: {self.stun_vuln_mult:.4f}")
        lines.append(f"{prefix}    距离衰减区: {self.distance_mult:.4f}")

        if self.is_penetration:
            lines.append(f"{prefix}    贯穿增伤区: {1.0 + self.penetration_dmg_bonus:.4f}")

        return "\n".join(lines)


@dataclass
class AnomalyDamageResult:
    """异常伤害结果

    包含异常伤害的暴击、非暴击、期望伤害及所有相关乘区
    """
    # 最终伤害
    damage_no_crit: float = 0.0      # 非暴击伤害
    damage_crit: float = 0.0         # 暴击伤害
    damage_expected: float = 0.0     # 期望伤害

    # 基础信息
    anomaly_type: str = "ice"        # 异常类型
    anomaly_ratio: float = 0.0       # 异常伤害倍率
    anomaly_buildup: float = 0.0     # 异常积蓄值
    anomaly_threshold: float = 3000.0  # 异常条阈值

    # 乘区信息
    atk_zone: float = 1.0            # 攻击力
    dmg_bonus: float = 1.0           # 增伤区
    anomaly_prof_mult: float = 1.0   # 异常精通区
    anomaly_dmg_bonus: float = 0.0   # 异常伤害加成
    anomaly_dmg_mult: float = 1.0    # 异常增伤区
    anomaly_crit_rate: float = 0.0   # 异常暴击率
    anomaly_crit_dmg: float = 0.0    # 异常暴击伤害
    anomaly_crit_mult: float = 1.0   # 异常暴击区
    level_mult: float = 1.0          # 等级区
    accumulate_zone: float = 0.0     # 积蓄区
    trigger_expect: float = 0.0      # 触发期望

    # 通用乘区
    def_mult: float = 1.0            # 防御区
    res_mult: float = 1.0            # 抗性区
    dmg_taken_mult: float = 1.0      # 减易伤区
    stun_vuln_mult: float = 1.0      # 失衡易伤区

    # 紊乱伤害（如果有）
    disorder_ratio: float = 0.0      # 紊乱伤害倍率
    disorder_damage: float = 0.0     # 紊乱伤害

    # 特殊直伤（如星见雅）
    special_direct_dmg_ratio: float = 0.0  # 特殊直伤倍率
    special_direct_damage: float = 0.0     # 特殊直伤

    def format(self, indent: int = 0) -> str:
        """格式化输出

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        lines.append(f"{prefix}[异常伤害结果]")
        lines.append(f"{prefix}  异常类型: {self.anomaly_type}")
        lines.append(f"{prefix}  异常倍率: {self.anomaly_ratio:.4f} ({self.anomaly_ratio*100:.1f}%)")
        lines.append(f"{prefix}  积蓄值: {self.anomaly_buildup:.2f} / {self.anomaly_threshold:.2f}")
        lines.append(f"{prefix}  触发期望: {self.trigger_expect:.4f}")

        lines.append(f"{prefix}  伤害结果:")
        lines.append(f"{prefix}    非暴击: {self.damage_no_crit:.2f}")
        lines.append(f"{prefix}    暴击: {self.damage_crit:.2f}")
        lines.append(f"{prefix}    期望: {self.damage_expected:.2f}")

        if self.disorder_ratio > 0:
            lines.append(f"{prefix}    紊乱伤害: {self.disorder_damage:.2f}")

        if self.special_direct_dmg_ratio > 0:
            lines.append(f"{prefix}    特殊直伤: {self.special_direct_damage:.2f}")

        lines.append(f"{prefix}  乘区:")
        lines.append(f"{prefix}    攻击力: {self.atk_zone:.2f}")
        lines.append(f"{prefix}    增伤区: {self.dmg_bonus:.4f}")
        lines.append(f"{prefix}    异常精通区: {self.anomaly_prof_mult:.4f}")
        lines.append(f"{prefix}    异常增伤区: {self.anomaly_dmg_mult:.4f}")
        lines.append(f"{prefix}    异常暴击率: {self.anomaly_crit_rate:.4f}")
        lines.append(f"{prefix}    异常暴击伤害: {self.anomaly_crit_dmg:.4f}")
        lines.append(f"{prefix}    异常暴击区: {self.anomaly_crit_mult:.4f}")
        lines.append(f"{prefix}    等级区: {self.level_mult:.4f}")
        lines.append(f"{prefix}    积蓄区: {self.accumulate_zone:.4f}")
        lines.append(f"{prefix}    防御区: {self.def_mult:.4f}")
        lines.append(f"{prefix}    抗性区: {self.res_mult:.4f}")
        lines.append(f"{prefix}    减易伤区: {self.dmg_taken_mult:.4f}")
        lines.append(f"{prefix}    失衡易伤区: {self.stun_vuln_mult:.4f}")

        return "\n".join(lines)


@dataclass
class TotalDamageResult:
    """总伤害结果

    汇总直伤和异常伤害
    """
    # 直伤结果
    direct_result: Optional[DirectDamageResult] = None

    # 异常伤害结果
    anomaly_result: Optional[AnomalyDamageResult] = None

    # 总伤害
    total_damage_no_crit: float = 0.0   # 总非暴击伤害
    total_damage_crit: float = 0.0      # 总暴击伤害
    total_damage_expected: float = 0.0  # 总期望伤害

    def format(self, indent: int = 0) -> str:
        """格式化输出

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        lines.append(f"{prefix}[总伤害结果]")

        if self.direct_result:
            lines.append(self.direct_result.format(indent + 2))

        if self.anomaly_result:
            lines.append(self.anomaly_result.format(indent + 2))

        lines.append(f"{prefix}[汇总]")
        lines.append(f"{prefix}  总非暴击伤害: {self.total_damage_no_crit:.2f}")
        lines.append(f"{prefix}  总暴击伤害: {self.total_damage_crit:.2f}")
        lines.append(f"{prefix}  总期望伤害: {self.total_damage_expected:.2f}")

        return "\n".join(lines)