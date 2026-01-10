"""
乘区集合

用于存储和管理伤害计算的所有乘区
"""
from dataclasses import dataclass, field
from typing import Dict, Optional, TYPE_CHECKING
from optimizer.zzz_models.ratio_set import RatioSet

if TYPE_CHECKING:
    from optimizer.zzz_models.combat_stats import CombatStats


@dataclass
class ZoneCollection:
    """乘区集合（重构版）

    存储伤害计算的所有乘区，提供格式化输出。
    支持属性访问 (zones.atk_zone) 和字典兼容访问 (zones['atk_zone'])
    """

    # ==================== 战斗属性快照和倍率集 ====================
    combat_stats: Optional['CombatStats'] = None  # 战斗属性快照
    ratios: RatioSet = field(default_factory=RatioSet)

    # ==================== 保留：直伤乘区（向后兼容） ====================
    atk_zone: float = 1.0       # 攻击力（已废弃，使用 base_properties.atk）
    ratio_zone: float = 1.0     # 倍率区（已废弃，使用 ratios）
    dmg_bonus: float = 1.0      # 增伤区
    crit_zone: float = 1.0      # 暴击区

    # 异常乘区
    accumulate_zone: float = 1.0       # 积蓄区（技能积蓄 × 异常掌控 / 敌人积蓄条）
    anomaly_prof_mult: float = 1.0     # 精通区
    anomaly_ratio_zone: float = 1.0    # 异常倍率
    anomaly_dmg_mult: float = 1.0      # 异常增伤区
    anomaly_crit_mult: float = 1.0     # 异常暴击区
    trigger_expect: float = 1.0        # 触发期望（1.0 = 100%触发）

    # 通用乘区（与元素无关，直伤和异常都共享）
    def_mult: float = 1.0        # 防御区
    res_mult: float = 1.0        # 抗性区
    dmg_taken_mult: float = 1.0  # 减易伤区
    stun_vuln_mult: float = 1.0  # 失衡易伤区
    distance_mult: float = 1.0   # 距离衰减区
    level_mult: float = 1.0      # 等级区

    # 直伤最终值
    direct_damage_no_crit: float = 0.0   # 直伤非暴击
    direct_damage_crit: float = 0.0      # 直伤暴击
    direct_damage_expected: float = 0.0  # 直伤期望

    # 异常直伤最终值（由异常反应触发的直伤，如星见雅1500%）
    anomaly_attack_damage_no_crit: float = 0.0  # 异常直伤非暴击
    anomaly_attack_damage_crit: float = 0.0     # 异常直伤暴击
    anomaly_attack_damage_expected: float = 0.0 # 异常直伤期望

    # 异常精通伤害最终值（真正的异常伤害）
    anomaly_prof_damage_no_crit: float = 0.0  # 异常精通非暴击
    anomaly_prof_damage_crit: float = 0.0     # 异常精通暴击
    anomaly_prof_damage_expected: float = 0.0 # 异常精通期望

    # 紊乱伤害最终值
    disorder_damage_no_crit: float = 0.0  # 紊乱非暴击
    disorder_damage_crit: float = 0.0     # 紊乱暴击
    disorder_damage_expected: float = 0.0 # 紊乱期望

    # 总伤害最终值
    total_damage_no_crit: float = 0.0    # 总非暴击
    total_damage_crit: float = 0.0       # 总暴击
    total_damage_expected: float = 0.0   # 总期望

    # ==================== 新增：各属性伤害贡献 ====================
    # 直伤属性伤害
    atk_damage: float = 0.0         # 攻击力伤害贡献
    def_damage: float = 0.0         # 防御力伤害贡献
    hp_damage: float = 0.0          # 生命值伤害贡献
    pen_damage: float = 0.0         # 贯穿力伤害贡献

    # 异常属性伤害
    anom_atk_damage: float = 0.0    # 异常直伤伤害贡献
    anom_prof_damage: float = 0.0   # 异常精通伤害贡献

    def __getitem__(self, key: str) -> float:
        """支持字典式访问"""
        if hasattr(self, key):
            return getattr(self, key)
        raise KeyError(f"'{key}' not found in ZoneCollection")

    def __setitem__(self, key: str, value: float):
        """支持字典式赋值"""
        if hasattr(self, key):
            setattr(self, key, value)
        else:
            raise KeyError(f"'{key}' not found in ZoneCollection")

    def items(self):
        """支持 items() 方法"""
        return self.__dict__.items()

    def keys(self):
        """支持 keys() 方法"""
        return self.__dict__.keys()

    def values(self):
        """支持 values() 方法"""
        return self.__dict__.values()

    def copy(self):
        """返回副本"""
        return ZoneCollection(**self.__dict__)

    def format(self, indent: int = 0, show_dynamic: bool = False) -> str:
        """格式化输出乘区

        Args:
            indent: 缩进空格数
            show_dynamic: 是否显示（已废弃，保留兼容）

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 战斗属性快照
        if self.combat_stats:
            lines.append(f"{prefix}战斗属性快照:")
            lines.append(f"{prefix}  HP: {self.combat_stats.get_final_hp():.2f}")
            lines.append(f"{prefix}  ATK: {self.combat_stats.get_final_atk():.2f}")
            lines.append(f"{prefix}  DEF: {self.combat_stats.get_final_def():.2f}")
            lines.append(f"{prefix}  PEN: {self.combat_stats.get_final_penetration():.2f}")
            lines.append(f"{prefix}  ANOM_PROF: {self.combat_stats.base_anomaly_proficiency + self.combat_stats.anomaly_proficiency_flat:.2f}")
            lines.append(f"{prefix}  暴击率: {self.combat_stats.crit_rate:.4f}")
            lines.append(f"{prefix}  暴击伤害: {self.combat_stats.crit_dmg:.4f}")
            lines.append(f"{prefix}  异常暴击率: {self.combat_stats.anomaly_crit_rate:.4f}")
            lines.append(f"{prefix}  异常暴击伤害: {self.combat_stats.anomaly_crit_dmg:.4f}")

        # 倍率集
        lines.append(f"{prefix}倍率集:")
        lines.append(f"{prefix}  攻击倍率: {self.ratios.atk_ratio:.4f}")
        lines.append(f"{prefix}  防御倍率: {self.ratios.def_ratio:.4f}")
        lines.append(f"{prefix}  生命倍率: {self.ratios.hp_ratio:.4f}")
        lines.append(f"{prefix}  贯穿力倍率: {self.ratios.pen_ratio:.4f}")
        lines.append(f"{prefix}  异常精通倍率: {self.ratios.anom_prof_ratio:.4f}")
        lines.append(f"{prefix}  异常攻击倍率: {self.ratios.anom_atk_ratio:.4f}")

        # 直伤乘区（4个）
        lines.append(f"{prefix}直伤乘区:")
        lines.append(f"{prefix}  攻击力 (atk_zone): {self.atk_zone:.4f}")
        lines.append(f"{prefix}  倍率区 (ratio_zone): {self.ratio_zone:.4f}")
        lines.append(f"{prefix}  增伤区 (dmg_bonus): {self.dmg_bonus:.4f}")
        lines.append(f"{prefix}  暴击区 (crit_zone): {self.crit_zone:.4f}")

        # 异常乘区（5个，anomaly_ratio_zone已废弃）
        lines.append(f"{prefix}异常乘区:")
        lines.append(f"{prefix}  积蓄区 (accumulate_zone): {self.accumulate_zone:.4f}")
        lines.append(f"{prefix}  精通区 (anomaly_prof_mult): {self.anomaly_prof_mult:.4f}")
        lines.append(f"{prefix}  异常增伤区 (anomaly_dmg_mult): {self.anomaly_dmg_mult:.4f}")
        lines.append(f"{prefix}  异常暴击区 (anomaly_crit_mult): {self.anomaly_crit_mult:.4f}")
        lines.append(f"{prefix}  等级区 (level_mult): {self.level_mult:.4f}")

        # 通用乘区（5个）
        lines.append(f"{prefix}通用乘区:")
        lines.append(f"{prefix}  防御区 (def_mult): {self.def_mult:.4f}")
        lines.append(f"{prefix}  抗性区 (res_mult): {self.res_mult:.4f}")
        lines.append(f"{prefix}  减易伤区 (dmg_taken_mult): {self.dmg_taken_mult:.4f}")
        lines.append(f"{prefix}  失衡易伤区 (stun_vuln_mult): {self.stun_vuln_mult:.4f}")
        lines.append(f"{prefix}  距离衰减区 (distance_mult): {self.distance_mult:.4f}")

        # 属性伤害贡献
        lines.append(f"{prefix}属性伤害贡献:")
        lines.append(f"{prefix}  攻击力伤害 (atk_damage): {self.atk_damage:.2f}")
        lines.append(f"{prefix}  防御力伤害 (def_damage): {self.def_damage:.2f}")
        lines.append(f"{prefix}  生命值伤害 (hp_damage): {self.hp_damage:.2f}")
        lines.append(f"{prefix}  贯穿力伤害 (pen_damage): {self.pen_damage:.2f}")
        lines.append(f"{prefix}  异常直伤伤害 (anom_atk_damage): {self.anom_atk_damage:.2f}")
        lines.append(f"{prefix}  异常精通伤害 (anom_prof_damage): {self.anom_prof_damage:.2f}")

        # 最终伤害值
        lines.append(f"{prefix}最终伤害值:")
        lines.append(f"{prefix}  直伤非暴击 (direct_damage_no_crit): {self.direct_damage_no_crit:.2f}")
        lines.append(f"{prefix}  直伤暴击 (direct_damage_crit): {self.direct_damage_crit:.2f}")
        lines.append(f"{prefix}  直伤期望 (direct_damage_expected): {self.direct_damage_expected:.2f}")
        lines.append(f"{prefix}  异常直伤非暴击 (anomaly_attack_damage_no_crit): {self.anomaly_attack_damage_no_crit:.2f}")
        lines.append(f"{prefix}  异常直伤暴击 (anomaly_attack_damage_crit): {self.anomaly_attack_damage_crit:.2f}")
        lines.append(f"{prefix}  异常直伤期望 (anomaly_attack_damage_expected): {self.anomaly_attack_damage_expected:.2f}")
        lines.append(f"{prefix}  异常精通非暴击 (anomaly_prof_damage_no_crit): {self.anomaly_prof_damage_no_crit:.2f}")
        lines.append(f"{prefix}  异常精通暴击 (anomaly_prof_damage_crit): {self.anomaly_prof_damage_crit:.2f}")
        lines.append(f"{prefix}  异常精通期望 (anomaly_prof_damage_expected): {self.anomaly_prof_damage_expected:.2f}")
        lines.append(f"{prefix}  紊乱非暴击 (disorder_damage_no_crit): {self.disorder_damage_no_crit:.2f}")
        lines.append(f"{prefix}  紊乱暴击 (disorder_damage_crit): {self.disorder_damage_crit:.2f}")
        lines.append(f"{prefix}  紊乱期望 (disorder_damage_expected): {self.disorder_damage_expected:.2f}")
        lines.append(f"{prefix}  总非暴击 (total_damage_no_crit): {self.total_damage_no_crit:.2f}")
        lines.append(f"{prefix}  总暴击 (total_damage_crit): {self.total_damage_crit:.2f}")
        lines.append(f"{prefix}  总期望 (total_damage_expected): {self.total_damage_expected:.2f}")

        return "\n".join(lines)

    def get_all_zones(self) -> Dict[str, float]:
        """获取所有乘区字典

        Returns:
            乘区字典
        """
        return {
            # 直伤乘区
            'atk_zone': self.atk_zone,
            'ratio_zone': self.ratio_zone,
            'dmg_bonus': self.dmg_bonus,
            'crit_zone': self.crit_zone,
            # 异常乘区
            'accumulate_zone': self.accumulate_zone,
            'anomaly_prof_mult': self.anomaly_prof_mult,
            'anomaly_ratio_zone': self.anomaly_ratio_zone,
            'anomaly_dmg_mult': self.anomaly_dmg_mult,
            'anomaly_crit_mult': self.anomaly_crit_mult,
            # 通用乘区
            'def_mult': self.def_mult,
            'res_mult': self.res_mult,
            'dmg_taken_mult': self.dmg_taken_mult,
            'stun_vuln_mult': self.stun_vuln_mult,
            'distance_mult': self.distance_mult,
            'level_mult': self.level_mult,
            # 属性伤害贡献
            'atk_damage': self.atk_damage,
            'def_damage': self.def_damage,
            'hp_damage': self.hp_damage,
            'pen_damage': self.pen_damage,
            'anom_atk_damage': self.anom_atk_damage,
            'anom_prof_damage': self.anom_prof_damage,
            # 最终伤害值
            'direct_damage_no_crit': self.direct_damage_no_crit,
            'direct_damage_crit': self.direct_damage_crit,
            'direct_damage_expected': self.direct_damage_expected,
            'anomaly_attack_damage_no_crit': self.anomaly_attack_damage_no_crit,
            'anomaly_attack_damage_crit': self.anomaly_attack_damage_crit,
            'anomaly_attack_damage_expected': self.anomaly_attack_damage_expected,
            'anomaly_prof_damage_no_crit': self.anomaly_prof_damage_no_crit,
            'anomaly_prof_damage_crit': self.anomaly_prof_damage_crit,
            'anomaly_prof_damage_expected': self.anomaly_prof_damage_expected,
            'disorder_damage_no_crit': self.disorder_damage_no_crit,
            'disorder_damage_crit': self.disorder_damage_crit,
            'disorder_damage_expected': self.disorder_damage_expected,
            'total_damage_no_crit': self.total_damage_no_crit,
            'total_damage_crit': self.total_damage_crit,
            'total_damage_expected': self.total_damage_expected,
        }

    def update_from_dict(self, zones: Dict[str, float]):
        """从字典更新乘区

        Args:
            zones: 乘区字典
        """
        for key, value in zones.items():
            if hasattr(self, key):
                setattr(self, key, value)
