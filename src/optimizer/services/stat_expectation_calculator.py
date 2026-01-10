"""
词条期望计算模块

计算所有属性词条的边际收益（权重），用于装备优化时的剪枝。

设计原则：
1. 输入：完整的局内/局外BUFF、直伤/异常伤害占比
2. 输出：所有属性词条的边际权重
3. 独立性：不依赖外部状态，纯函数式计算
"""
from typing import Dict, Optional
from dataclasses import dataclass

from optimizer.zzz_models.base import PropertyType


# ========== 基础词条定义 ==========
# 基础词条 = 副词条每次强化的实际数值
# 主词条 = 基础词条 × 10
# 注意：显示值可能有舍入，实际值更精确

BASIC_SUB_STAT_VALUES = {
    # 百分比属性（乘以100得到显示值，如 0.03 → 3%）
    'atk_': 0.030,
    'hp_': 0.030,
    'def_': 0.048,
    'crit_': 0.024,
    'crit_dmg_': 0.048,
    'pen_': 0.024,
    'anomMas_': 0.024,  # 异常掌控
    'impact_': 0.018,   # 冲击力
    'enerRegen_': 0.060,  # 能量自动回复
    
    # 元素伤害
    'fire_dmg_': 0.030,
    'ice_dmg_': 0.030,
    'electric_dmg_': 0.030,
    'physical_dmg_': 0.030,
    'ether_dmg_': 0.030,
    
    # 固定值属性
    'atk': 19.0,
    'hp': 112.0,
    'def': 15.0,
    'pen': 9.0,         # 穿透值
    'anomProf': 9.2,    # 异常精通（实际值9.2，显示9）
}

# 主词条是基础词条的10倍
MAIN_STAT_MULTIPLIER = 10.0


@dataclass
class DamageZones:
    """伤害乘区数据"""
    base_dmg: float = 0.0          # 基础伤害区
    dmg_bonus: float = 1.0         # 增伤乘区
    crit_expect: float = 1.0       # 暴击期望
    def_mult: float = 1.0          # 防御乘区
    res_mult: float = 1.0          # 抗性乘区
    dmg_taken: float = 1.0         # 减易伤乘区
    stun_vuln: float = 1.0         # 失衡易伤乘区
    
    # 异常伤害专用乘区
    anomaly_prof_mult: float = 1.0  # 异常精通乘区
    anomaly_dmg_mult: float = 1.0   # 异常增伤乘区
    level_mult: float = 1.0         # 伤害等级乘区


@dataclass
class StatExpectationInput:
    """词条期望计算的输入数据"""
    # 伤害占比
    normal_ratio: float = 1.0       # 直伤占比
    anomaly_ratio: float = 0.0      # 异常伤害占比
    
    # 角色属性
    base_atk: float = 0.0           # 局内基础攻击力
    atk_percent: float = 0.0        # 局内攻击力%加成
    crit_rate: float = 0.0          # 暴击率
    crit_damage: float = 0.0        # 暴击伤害
    penetration_rate: float = 0.0   # 穿透率
    
    # 异常属性
    anomaly_mastery: float = 0.0    # 异常掌控
    anomaly_proficiency: float = 0.0  # 异常精通
    
    # 敌人属性
    enemy_defense: float = 0.0      # 敌人防御力
    enemy_level: int = 60           # 敌人等级
    
    # 乘区数据
    zones: Optional[DamageZones] = None


class StatExpectationCalculator:
    """词条期望计算器"""
    
    # 等级基数表
    LEVEL_COEFFICIENTS = {
        1: 50, 60: 794,  # 默认使用60级系数
    }
    
    @staticmethod
    def get_level_coefficient(level: int) -> float:
        """获取等级基数"""
        if level <= 1:
            return 50.0
        elif level >= 60:
            return 794.0
        else:
            # 线性插值
            return 50.0 + (794.0 - 50.0) * (level - 1) / (60 - 1)
    
    @staticmethod
    def calculate(input_data: StatExpectationInput) -> Dict[PropertyType, float]:
        """计算所有属性词条的边际收益
        
        Args:
            input_data: 词条期望计算输入
            
        Returns:
            词条期望表：{PropertyType: 边际收益值}
        """
        stat_expectation = {}
        
        # 获取等级基数
        level_coeff = StatExpectationCalculator.get_level_coefficient(input_data.enemy_level)
        
        # 获取伤害乘区
        zones = input_data.zones if input_data.zones else DamageZones()
        
        # ========== 直伤区词条 ==========
        
        # 暴击率的边际收益 = 暴击伤害
        # d(伤害)/d(暴击率) = 暴击伤害 - 1
        stat_expectation[PropertyType.CRIT_] = input_data.crit_damage * input_data.normal_ratio
        stat_expectation[PropertyType.CRIT_RATE_] = input_data.crit_damage * input_data.normal_ratio
        
        # 暴击伤害的边际收益 = 暴击率
        # d(伤害)/d(暴击伤害) = 暴击率
        stat_expectation[PropertyType.CRIT_DMG_] = input_data.crit_rate * input_data.normal_ratio
        
        # 元素伤害的边际收益 = 1.0（加法叠加）
        # 每1%元素伤害增加1%最终伤害
        stat_expectation[PropertyType.PHYSICAL_DMG_] = 1.0 * input_data.normal_ratio
        stat_expectation[PropertyType.FIRE_DMG_] = 1.0 * input_data.normal_ratio
        stat_expectation[PropertyType.ICE_DMG_] = 1.0 * input_data.normal_ratio
        stat_expectation[PropertyType.ELECTRIC_DMG_] = 1.0 * input_data.normal_ratio
        stat_expectation[PropertyType.ETHER_DMG_] = 1.0 * input_data.normal_ratio
        
        # 攻击力%的边际收益 = 局内基础攻击力
        # 公式：d(伤害)/d(ATK%) = 局内基础攻击力 × 增伤乘区
        # 增伤乘区 = dmg_bonus
        if input_data.base_atk > 0:
            stat_expectation[PropertyType.ATK_] = input_data.base_atk * zones.dmg_bonus * input_data.normal_ratio
        else:
            stat_expectation[PropertyType.ATK_] = 0.0
        
        # 攻击力固定值的边际收益 = 增伤乘区
        # 公式：d(伤害)/d(ATK) = 增伤乘区
        stat_expectation[PropertyType.ATK] = zones.dmg_bonus * input_data.normal_ratio
        
        # ========== 异常区词条 ==========
        
        # 异常精通的边际收益 = 异常精通乘区 × 异常伤害占比
        # 公式：d(伤害)/d(ANOM_PROF) = 异常精通乘区 × 异常伤害占比
        # 异常精通乘区 = base_anomaly_proficiency / 100
        anomaly_prof_mult = input_data.anomaly_proficiency / 100.0
        anomaly_prof_mult = max(0.0, min(10.0, anomaly_prof_mult))  # 限制范围
        stat_expectation[PropertyType.ANOM_PROF] = anomaly_prof_mult * input_data.anomaly_ratio
        
        # 异常掌控的边际收益 = 异常精通乘区 × 异常伤害占比
        # 公式：d(伤害)/d(ANOM_MAS) = 异常精通乘区 × 异常伤害占比
        # 异常掌控影响触发期望，进而影响异常伤害
        # 这里简化处理，使用异常精通乘区
        stat_expectation[PropertyType.ANOM_MAS_] = anomaly_prof_mult * input_data.anomaly_ratio
        
        # ========== 共同乘区词条 ==========
        
        # 穿透率的边际收益
        # 公式：d(伤害)/d(穿透率) = 防御 × 等级基数 / (等级基数 + 有效防御)^2
        # 有效防御 = 防御 × (1 - 穿透率)
        # d(伤害)/d(穿透率) = 防御 × 等级基数 / (等级基数 + 防御 × (1 - 穿透率))^2
        if input_data.enemy_defense > 0:
            # 简化计算：穿透率边际收益 = 防御 × 等级基数 / (等级基数 + 有效防御)^2
            effective_def = input_data.enemy_defense * (1 - input_data.penetration_rate)
            # 使用zones中的def_mult来估算
            def_mult = zones.def_mult if zones.def_mult > 0 else 0.5
            # 穿透率边际收益估算
            pen_expectation = input_data.enemy_defense * level_coeff / (level_coeff + effective_def) ** 2
            stat_expectation[PropertyType.PEN_] = pen_expectation * (input_data.normal_ratio + input_data.anomaly_ratio)
        else:
            stat_expectation[PropertyType.PEN_] = 0.0
        
        # ========== 其他词条 ==========
        
        # 生命值和防御力对伤害没有直接贡献
        stat_expectation[PropertyType.HP] = 0.0
        stat_expectation[PropertyType.HP_] = 0.0
        stat_expectation[PropertyType.DEF] = 0.0
        stat_expectation[PropertyType.DEF_] = 0.0
        stat_expectation[PropertyType.PEN] = 0.0  # 穿透值暂不计算
        
        # 冲击力、能量回复等不影响伤害
        stat_expectation[PropertyType.IMPACT_] = 0.0
        stat_expectation[PropertyType.ENER_REGEN_] = 0.0
        
        return stat_expectation
    
    @staticmethod
    def calculate_from_zones(
        zones: DamageZones,
        normal_ratio: float,
        anomaly_ratio: float,
        base_atk: float,
        crit_rate: float,
        crit_damage: float,
        penetration_rate: float,
        anomaly_proficiency: float,
        enemy_defense: float,
        enemy_level: int = 60
    ) -> Dict[PropertyType, float]:
        """从乘区数据计算词条期望（便捷方法）
        
        Args:
            zones: 伤害乘区数据
            normal_ratio: 直伤占比
            anomaly_ratio: 异常伤害占比
            base_atk: 局内基础攻击力
            crit_rate: 暴击率
            crit_damage: 暴击伤害
            penetration_rate: 穿透率
            anomaly_proficiency: 异常精通
            enemy_defense: 敌人防御力
            enemy_level: 敌人等级
            
        Returns:
            词条期望表
        """
        input_data = StatExpectationInput(
            normal_ratio=normal_ratio,
            anomaly_ratio=anomaly_ratio,
            base_atk=base_atk,
            crit_rate=crit_rate,
            crit_damage=crit_damage,
            penetration_rate=penetration_rate,
            anomaly_proficiency=anomaly_proficiency,
            enemy_defense=enemy_defense,
            enemy_level=enemy_level,
            zones=zones,
        )
        
        return StatExpectationCalculator.calculate(input_data)
