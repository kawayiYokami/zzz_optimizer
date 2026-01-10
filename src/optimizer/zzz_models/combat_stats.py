"""
局内战斗属性模型
"""
from dataclasses import dataclass
from enum import Enum


class AnomalyType(Enum):
    """异常类型"""
    ICE = "ice"           # 冰
    FIRE = "fire"         # 火
    ELECTRIC = "electric" # 电
    PHYSICAL = "physical" # 物理
    ETHER = "ether"       # 以太


@dataclass
class AnomalyEffect:
    """异常效果数据"""
    anomaly_type: AnomalyType       # 异常类型
    base_ratio: float               # 基础伤害倍率（一次性或每次）
    duration: float = 10.0          # 持续时间（秒）
    tick_interval: float = 0.0      # 触发间隔（0表示一次性）

    def get_total_ratio(self) -> float:
        """获取总伤害倍率

        Returns:
            总伤害倍率
        """
        if self.tick_interval == 0:
            # 一次性伤害
            return self.base_ratio
        else:
            # 持续伤害
            ticks = int(self.duration / self.tick_interval)
            return self.base_ratio * ticks


# 预定义的异常效果
ICE_SHATTER = AnomalyEffect(
    anomaly_type=AnomalyType.ICE,
    base_ratio=5.0,  # 500%
    duration=10.0,
    tick_interval=0.0  # 一次性
)

SHOCK = AnomalyEffect(
    anomaly_type=AnomalyType.ELECTRIC,
    base_ratio=1.25,  # 125%每秒
    duration=10.0,
    tick_interval=1.0
)

BURN = AnomalyEffect(
    anomaly_type=AnomalyType.FIRE,
    base_ratio=0.5,  # 50%每0.5秒
    duration=10.0,
    tick_interval=0.5
)

CORRUPTION = AnomalyEffect(
    anomaly_type=AnomalyType.ETHER,
    base_ratio=0.625,  # 62.5%每0.5秒
    duration=10.0,
    tick_interval=0.5
)

ASSAULT = AnomalyEffect(
    anomaly_type=AnomalyType.PHYSICAL,
    base_ratio=7.13,  # 713%
    duration=0.0,
    tick_interval=0.0  # 一次性
)

DISORDER = AnomalyEffect(
    anomaly_type=AnomalyType.PHYSICAL,  # 紊乱可以是任意元素触发
    base_ratio=4.5,  # 450%
    duration=0.0,
    tick_interval=0.0  # 一次性
)


@dataclass
class CombatStats:
    """局内战斗属性

    绝区零的特殊机制：
    - 攻击力、生命值、防御力、冲击力：局外的最终属性会变成局内的基础属性
      例如：局外基础100攻击+30%=130，到局内130变成基础攻击，30%buff基于130计算
    - 其他属性（暴击、穿透、增伤、异常等）：依然是百分比，不会转换
    """
    # 基础属性（局内基础，即局外的最终属性）
    # 注意：只有这四个属性会经历"局外最终→局内基础"的转换
    base_atk: float = 0.0               # 基础攻击力（局内基础 = 局外最终）
    base_hp: float = 0.0                # 基础生命值（局内基础 = 局外最终）
    base_def: float = 0.0               # 基础防御力（局内基础 = 局外最终）
    base_impact: float = 0.0            # 基础冲击力（局内基础 = 局外最终）

    # 其他基础属性（不会转换）
    base_penetration: float = 0.0       # 基础贯穿力
    base_anomaly_mastery: float = 0.0   # 基础异常掌控
    base_anomaly_proficiency: float = 0.0  # 基础异常精通

    # 百分比加成（局内buff，只对四大基础属性有效）
    atk_percent: float = 0.0            # 攻击力加成%
    hp_percent: float = 0.0             # 生命值加成%
    def_percent: float = 0.0            # 防御力加成%
    impact_percent: float = 0.0         # 冲击力加成%

    # 固定值加成（局内buff）
    atk_flat: float = 0.0               # 攻击力固定值
    hp_flat: float = 0.0                # 生命值固定值
    def_flat: float = 0.0               # 防御力固定值
    anomaly_mastery_flat: float = 0.0   # 异常掌控固定值
    anomaly_proficiency_flat: float = 0.0  # 异常精通固定值

    # 暴击属性（百分比，局内局外都是百分比）
    crit_rate: float = 0.05             # 暴击率（默认5%）
    crit_dmg: float = 0.50              # 暴击伤害（默认50%）

    # 穿透属性（百分比和固定值）
    penetration_rate: float = 0.0       # 穿透率
    penetration_value: float = 0.0      # 穿透值

    # 增伤属性（百分比）
    dmg_bonus: float = 0.0              # 伤害加成
    element_dmg_bonus: float = 0.0      # 元素伤害加成
    penetration_dmg_bonus: float = 0.0  # 贯穿伤害加成

    # 异常属性（百分比）
    anomaly_buildup_efficiency: float = 0.0  # 异常积蓄效率
    anomaly_dmg_bonus: float = 0.0      # 异常伤害加成
    anomaly_crit_rate: float = 0.0      # 异常暴击率
    anomaly_crit_dmg: float = 0.0       # 异常暴击伤害

    # 异常倍率（用于异常伤害计算）
    anomaly_atk_ratio_mult: float = 0.0     # 异常攻击倍率（吃攻击力，如星见雅1500%）
    # 注意：异常精通倍率直接使用 AnomalyEffect.get_total_ratio()，不需要单独字段

    # 失衡属性（百分比）
    stun_value_bonus: float = 0.0       # 失衡值提升

    # 能量属性
    energy_regen: float = 0.0           # 能量自动回复

    # 等级
    level: int = 60                     # 角色等级

    @classmethod
    def from_property_collections(
        cls,
        collections: list,  # List[PropertyCollection]
        level: int = 60
    ) -> 'CombatStats':
        """从属性集列表生成 CombatStats

        处理流程：
        1. 合并所有 PropertyCollection
        2. 计算局外最终面板（四大基础属性）
        3. 转换为局内基础面板
        4. 填充 CombatStats 对象

        Args:
            collections: 属性集列表（角色+装备+BUFF）
            level: 等级

        Returns:
            CombatStats 对象
        """
        from optimizer.zzz_models.property_collection import PropertyCollection
        from optimizer.zzz_models.base import PropertyType

        # 1. 合并所有属性集
        merged = PropertyCollection.merge_all(collections)

        # 2. 计算局外最终面板（四大基础属性）
        # 攻击力：局外最终 = base × (1 + percent) + flat
        out_base_atk = merged.get_out_of_combat(PropertyType.ATK_BASE, 0)
        out_atk_percent = merged.get_out_of_combat(PropertyType.ATK_, 0) / 100.0
        out_atk_flat = merged.get_out_of_combat(PropertyType.ATK, 0)
        out_final_atk = out_base_atk * (1 + out_atk_percent) + out_atk_flat

        # 生命值
        out_base_hp = merged.get_out_of_combat(PropertyType.HP_BASE, 0)
        out_hp_percent = merged.get_out_of_combat(PropertyType.HP_, 0) / 100.0
        out_hp_flat = merged.get_out_of_combat(PropertyType.HP, 0)
        out_final_hp = out_base_hp * (1 + out_hp_percent) + out_hp_flat

        # 防御力
        out_base_def = merged.get_out_of_combat(PropertyType.DEF_BASE, 0)
        out_def_percent = merged.get_out_of_combat(PropertyType.DEF_, 0) / 100.0
        out_def_flat = merged.get_out_of_combat(PropertyType.DEF, 0)
        out_final_def = out_base_def * (1 + out_def_percent) + out_def_flat

        # 冲击力
        out_base_impact = merged.get_out_of_combat(PropertyType.IMPACT, 0)
        out_impact_percent = merged.get_out_of_combat(PropertyType.IMPACT_, 0) / 100.0
        out_final_impact = out_base_impact * (1 + out_impact_percent)

        # 3. 创建 CombatStats 对象
        combat = cls()

        # 四大基础属性：局外最终 → 局内基础
        combat.base_atk = out_final_atk
        combat.base_hp = out_final_hp
        combat.base_def = out_final_def
        combat.base_impact = out_final_impact

        # 其他基础属性（不转换）
        combat.base_penetration = merged.get_out_of_combat(PropertyType.PEN, 0)
        combat.base_anomaly_mastery = merged.get_out_of_combat(PropertyType.ANOM_MAS, 0)
        combat.base_anomaly_proficiency = merged.get_out_of_combat(PropertyType.ANOM_PROF, 0)

        # 局内 buff（百分比和固定值）
        combat.atk_percent = merged.get_in_combat(PropertyType.ATK_, 0) / 100.0
        combat.hp_percent = merged.get_in_combat(PropertyType.HP_, 0) / 100.0
        combat.def_percent = merged.get_in_combat(PropertyType.DEF_, 0) / 100.0
        combat.impact_percent = merged.get_in_combat(PropertyType.IMPACT_, 0) / 100.0

        combat.atk_flat = merged.get_in_combat(PropertyType.ATK, 0)
        combat.hp_flat = merged.get_in_combat(PropertyType.HP, 0)
        combat.def_flat = merged.get_in_combat(PropertyType.DEF, 0)
        combat.anomaly_mastery_flat = merged.get_in_combat(PropertyType.ANOM_MAS, 0)
        combat.anomaly_proficiency_flat = merged.get_in_combat(PropertyType.ANOM_PROF, 0)

        # 暴击属性（局外+局内累加）
        out_crit_rate = merged.get_out_of_combat(PropertyType.CRIT_, 0.05)
        in_crit_rate = merged.get_in_combat(PropertyType.CRIT_, 0)
        combat.crit_rate = out_crit_rate + in_crit_rate

        out_crit_dmg = merged.get_out_of_combat(PropertyType.CRIT_DMG_, 0.50)
        in_crit_dmg = merged.get_in_combat(PropertyType.CRIT_DMG_, 0)
        combat.crit_dmg = out_crit_dmg + in_crit_dmg

        # 穿透属性
        out_pen_rate = merged.get_out_of_combat(PropertyType.PEN_, 0) / 100.0
        in_pen_rate = merged.get_in_combat(PropertyType.PEN_, 0) / 100.0
        combat.penetration_rate = out_pen_rate + in_pen_rate

        combat.penetration_value = merged.get_out_of_combat(PropertyType.PEN, 0) + merged.get_in_combat(PropertyType.PEN, 0)

        # 增伤属性（局外+局内累加，需要转换为小数）
        out_dmg = merged.get_out_of_combat(PropertyType.DMG_, 0) / 100.0
        in_dmg = merged.get_in_combat(PropertyType.DMG_, 0) / 100.0
        combat.dmg_bonus = out_dmg + in_dmg

        # 元素伤害加成（需要根据元素类型获取，这里暂时留空，由调用方设置）
        combat.element_dmg_bonus = 0.0

        # 异常属性
        out_anom_buildup = merged.get_out_of_combat(PropertyType.ANOM_BUILDUP_, 0) / 100.0
        in_anom_buildup = merged.get_in_combat(PropertyType.ANOM_BUILDUP_, 0) / 100.0
        combat.anomaly_buildup_efficiency = out_anom_buildup + in_anom_buildup

        out_anom_dmg = merged.get_out_of_combat(PropertyType.ANOM_MV_MULT_, 0) / 100.0
        in_anom_dmg = merged.get_in_combat(PropertyType.ANOM_MV_MULT_, 0) / 100.0
        combat.anomaly_dmg_bonus = out_anom_dmg + in_anom_dmg

        out_anom_crit_rate = merged.get_out_of_combat(PropertyType.ANOM_CRIT_, 0)
        in_anom_crit_rate = merged.get_in_combat(PropertyType.ANOM_CRIT_, 0)
        combat.anomaly_crit_rate = out_anom_crit_rate + in_anom_crit_rate

        out_anom_crit_dmg = merged.get_out_of_combat(PropertyType.ANOM_CRIT_DMG_, 0)
        in_anom_crit_dmg = merged.get_in_combat(PropertyType.ANOM_CRIT_DMG_, 0)
        combat.anomaly_crit_dmg = out_anom_crit_dmg + in_anom_crit_dmg

        # 失衡属性
        out_stun = merged.get_out_of_combat(PropertyType.DAZE_INC_, 0) / 100.0
        in_stun = merged.get_in_combat(PropertyType.DAZE_INC_, 0) / 100.0
        combat.stun_value_bonus = out_stun + in_stun

        # 能量回复
        combat.energy_regen = merged.get_out_of_combat(PropertyType.ENER_REGEN, 0) + merged.get_in_combat(PropertyType.ENER_REGEN, 0)

        # 等级
        combat.level = level

        return combat

    def get_final_atk(self) -> float:
        """获取最终攻击力

        公式：最终属性 = 初始属性 × (1 + 百分比加成) + 固定值加成
        初始属性 = 基础属性（局内基础，即局外最终属性）

        注意：攻击力是四大基础属性之一，会经历"局外最终→局内基础"的转换
        """
        return self.base_atk * (1 + self.atk_percent) + self.atk_flat

    def get_final_hp(self) -> float:
        """获取最终生命值

        注意：生命值是四大基础属性之一，会经历"局外最终→局内基础"的转换
        """
        return self.base_hp * (1 + self.hp_percent) + self.hp_flat

    def get_final_def(self) -> float:
        """获取最终防御力

        注意：防御力是四大基础属性之一，会经历"局外最终→局内基础"的转换
        """
        return self.base_def * (1 + self.def_percent) + self.def_flat

    def get_final_impact(self) -> float:
        """获取最终冲击力

        注意：冲击力是四大基础属性之一，会经历"局外最终→局内基础"的转换
        """
        return self.base_impact * (1 + self.impact_percent)

    def get_final_penetration(self) -> float:
        """获取最终贯穿力（仪玄专用）

        仪玄贯穿力 = 攻击力 × 0.3 + 生命值上限 × 0.1
        注意：转化比例每个命破代理人单独设置
        """
        return self.get_final_atk() * 0.3 + self.get_final_hp() * 0.1

    def format(self, indent: int = 0) -> str:
        """格式化输出战斗属性（局内基础面板）

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 收集所有非零属性
        stats = []

        # 四大基础属性（局外最终 = 局内基础）
        if self.base_atk > 0:
            stats.append(("基础攻击力", self.base_atk, False))
        if self.base_hp > 0:
            stats.append(("基础生命值", self.base_hp, False))
        if self.base_def > 0:
            stats.append(("基础防御力", self.base_def, False))
        if self.base_impact > 0:
            stats.append(("基础冲击力", self.base_impact, False))

        # 其他基础属性
        if self.base_penetration > 0:
            stats.append(("穿透值", self.base_penetration, False))
        if self.base_anomaly_mastery > 0:
            stats.append(("异常掌控", self.base_anomaly_mastery, False))
        if self.base_anomaly_proficiency > 0:
            stats.append(("异常精通", self.base_anomaly_proficiency, False))

        # 暴击属性
        if self.crit_rate > 0:
            stats.append(("暴击率", self.crit_rate, True))
        if self.crit_dmg > 0:
            stats.append(("暴击伤害", self.crit_dmg, True))

        # 穿透属性
        if self.penetration_rate > 0:
            stats.append(("穿透率", self.penetration_rate, True))
        if self.penetration_value > 0:
            stats.append(("穿透值", self.penetration_value, False))

        # 增伤属性
        if self.dmg_bonus > 0:
            stats.append(("伤害加成", self.dmg_bonus, True))
        if self.element_dmg_bonus > 0:
            stats.append(("元素伤害加成", self.element_dmg_bonus, True))

        # 异常属性
        if self.anomaly_buildup_efficiency > 0:
            stats.append(("异常积蓄效率", self.anomaly_buildup_efficiency, True))
        if self.anomaly_dmg_bonus > 0:
            stats.append(("异常伤害加成", self.anomaly_dmg_bonus, True))
        if self.anomaly_crit_rate > 0:
            stats.append(("异常暴击率", self.anomaly_crit_rate, True))
        if self.anomaly_crit_dmg > 0:
            stats.append(("异常暴击伤害", self.anomaly_crit_dmg, True))

        # 能量属性
        if self.energy_regen > 0:
            stats.append(("能量自动回复", self.energy_regen, False))

        # 输出
        if stats:
            lines.append(f"{prefix}局内基础面板 ({len(stats)}个属性):")
            for name, value, is_percent in stats:
                if is_percent:
                    lines.append(f"  {prefix}{name}: {value*100:.2f}%")
                else:
                    if abs(value) >= 10:
                        lines.append(f"  {prefix}{name}: {value:.1f}")
                    else:
                        lines.append(f"  {prefix}{name}: {value:.3f}")

        return "\n".join(lines)