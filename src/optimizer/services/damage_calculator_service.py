"""
伤害计算服务

基于绝区零伤害机制导论实现的伤害计算系统
参考文档：assets/inventory_data/docs/DAMAGE_GUIDE.MD
"""

from typing import Optional
import math

from optimizer.zzz_models.combat_stats import (
    AnomalyType,
    AnomalyEffect,
    CombatStats,
    ICE_SHATTER,
    SHOCK,
    BURN,
    CORRUPTION,
    ASSAULT,
)
from optimizer.zzz_models.zone_collection import ZoneCollection
from optimizer.zzz_models.damage_result import DirectDamageResult, AnomalyDamageResult, TotalDamageResult
from optimizer.services.damage.data import EnemyStats, SkillDamageParams
from optimizer.services.combat_stats_factory import create_combat_stats_from_agent
from optimizer.services.combat_stats_factory import create_combat_stats_from_agent


class DamageCalculatorService:
    """伤害计算服务"""

    @staticmethod
    def calculate_base_damage(attacker: CombatStats, skill: SkillDamageParams) -> float:
        """计算基础伤害区（向后兼容）

        公式：基础伤害区 = Σ(伤害倍率 × 对应属性)

        Args:
            attacker: 攻击方属性
            skill: 技能参数

        Returns:
            基础伤害
        """
        if skill.is_penetration:
            # 贯穿伤害基于贯穿力
            return skill.damage_ratio * attacker.get_final_penetration()
        else:
            # 常规伤害基于攻击力
            return skill.damage_ratio * attacker.get_final_atk()

    @staticmethod
    def create_ratio_set_from_skill(skill: SkillDamageParams) -> 'RatioSet':
        """从技能参数创建倍率集

        Args:
            skill: 技能参数

        Returns:
            RatioSet 对象
        """
        return skill.get_effective_ratios()

    @staticmethod
    def calculate_dmg_bonus_multiplier(attacker: CombatStats) -> float:
        """计算增伤区

        公式：增伤区 = 1 + Σ增伤
        有效范围：[0, 6]

        Args:
            attacker: 攻击方属性

        Returns:
            增伤乘区
        """
        multiplier = 1.0 + attacker.dmg_bonus + attacker.element_dmg_bonus
        return max(0.0, min(6.0, multiplier))

    @staticmethod
    def calculate_crit_multiplier(
        attacker: CombatStats, is_crit: bool = False
    ) -> float:
        """计算暴击区

        公式：
        - 暴击时：1 + 暴击伤害
        - 未暴击时：1

        有效范围：[1, 6]

        Args:
            attacker: 攻击方属性
            is_crit: 是否暴击

        Returns:
            暴击乘区
        """
        if is_crit:
            multiplier = 1.0 + attacker.crit_dmg
            return max(1.0, min(6.0, multiplier))
        return 1.0

    @staticmethod
    def calculate_crit_expectation(attacker: CombatStats) -> float:
        """计算暴击期望

        公式：暴击期望 = 1 + 暴击率 × 暴击伤害

        Args:
            attacker: 攻击方属性

        Returns:
            暴击期望乘区
        """
        crit_rate = max(0.0, min(1.0, attacker.crit_rate))
        return 1.0 + crit_rate * attacker.crit_dmg

    @staticmethod
    def calculate_defense_multiplier(attacker: CombatStats, enemy: EnemyStats) -> float:
        """计算防御区

        公式：防御区 = 攻击方等级基数 / (受击方有效防御 + 攻击方等级基数)

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性

        Returns:
            防御乘区
        """
        level_coef = enemy.get_level_coefficient()
        effective_def = enemy.get_effective_defense(
            attacker.penetration_rate, attacker.penetration_value
        )

        return level_coef / (effective_def + level_coef)

    @staticmethod
    def calculate_resistance_multiplier(
        attacker: CombatStats,
        enemy: EnemyStats,
        element: str,
    ) -> float:
        """计算抗性区

        公式：抗性区 = 1 - 受击方抗性 + 受击方抗性降低 + 攻击方无视抗性
        有效范围：[0, 2]

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            element: 元素类型（"ice", "fire", "electric", "physical", "ether"）

        Returns:
            抗性乘区
        """
        resistance = enemy.get_element_resistance(element)
        multiplier = 1.0 - resistance
        return max(0.0, min(2.0, multiplier))

    @staticmethod
    def calculate_dmg_taken_multiplier(enemy: EnemyStats) -> float:
        """计算减易伤区

        公式：减易伤区 = 1 + 受击方易伤 - 受击方减伤
        有效范围：[0.2, 2]

        Args:
            enemy: 敌人属性

        Returns:
            减易伤乘区
        """
        # 敌人当前不提供易伤/减伤数据，返回1.0
        return 1.0

    @staticmethod
    def calculate_stun_vulnerability_multiplier(enemy: EnemyStats) -> float:
        """计算失衡易伤区

        公式：
        - 失衡时：1 + 失衡易伤倍率
        - 未失衡时：1

        有效范围：失衡时[0.2, 5]，未失衡时[1, 3]

        Args:
            enemy: 敌人属性

        Returns:
            失衡易伤乘区
        """
        if enemy.is_stunned:
            multiplier = 1.0 + enemy.stun_vulnerability
            return max(0.2, min(5.0, multiplier))
        return 1.0

    @staticmethod
    def calculate_penetration_dmg_multiplier(attacker: CombatStats) -> float:
        """计算贯穿增伤区

        公式：贯穿增伤区 = 1 + 贯穿增伤
        有效范围：[0.2, 9]

        Args:
            attacker: 攻击方属性

        Returns:
            贯穿增伤乘区
        """
        multiplier = 1.0 + attacker.penetration_dmg_bonus
        return max(0.2, min(9.0, multiplier))

    @staticmethod
    def calculate_distance_decay_multiplier(
        skill: SkillDamageParams, decay_type: str = "default"
    ) -> float:
        """计算距离衰减区

        Args:
            skill: 技能参数
            decay_type: 衰减类型（"default"或"grace"）

        Returns:
            距离衰减乘区
        """
        if skill.distance <= 15.0:
            return 1.0

        if decay_type == "grace":
            # 格莉丝型：超过15m时伤害衰减30%
            return 0.7
        else:
            # 默认型：超过15m时伤害衰减25%，每继续远离5m继续衰减25%
            extra_distance = skill.distance - 15.0
            decay_count = 1 + int(extra_distance / 5.0)
            return 0.75**decay_count

    @staticmethod
    def calculate_stun_value(
        attacker: CombatStats,
        enemy: EnemyStats,
        skill: SkillDamageParams,
        decay_type: str = "default",
    ) -> float:
        """计算失衡值累积

        公式：失衡值累积 = 基础失衡区 × 失衡抗性区 × 失衡值提升区 × 受到失衡值提升区 × 距离衰减区

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            skill: 技能参数
            decay_type: 距离衰减类型

        Returns:
            失衡值累积
        """
        # 1. 基础失衡区
        base_stun = attacker.get_final_impact() * skill.stun_ratio

        # 2. 失衡抗性区
        stun_res_mult = 1.0 - enemy.stun_resistance
        stun_res_mult = max(0.0, min(2.0, stun_res_mult))

        # 3. 失衡值提升区
        stun_bonus_mult = 1.0 + attacker.stun_value_bonus
        stun_bonus_mult = max(0.0, min(4.0, stun_bonus_mult))

        # 4. 受到失衡值提升区（默认为1，敌人特殊机制）
        received_stun_mult = 1.0

        # 5. 距离衰减区
        distance_mult = DamageCalculatorService.calculate_distance_decay_multiplier(
            skill, decay_type
        )

        # 计算最终失衡值
        final_stun = (
            base_stun
            * stun_res_mult
            * stun_bonus_mult
            * received_stun_mult
            * distance_mult
        )

        return final_stun

    @staticmethod
    def calculate_anomaly_buildup(
        attacker: CombatStats,
        enemy: EnemyStats,
        skill: SkillDamageParams,
        decay_type: str = "default",
    ) -> float:
        """计算异常积蓄值

        公式：异常积蓄值 = 基础异常积蓄值 × 异常掌控区 × 异常积蓄效率区 × 异常积蓄抗性区 × 距离衰减区

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            skill: 技能参数
            decay_type: 距离衰减类型

        Returns:
            异常积蓄值
        """
        # 1. 基础异常积蓄值
        base_buildup = skill.anomaly_buildup

        # 2. 异常掌控区
        anomaly_mastery_mult = math.floor(attacker.base_anomaly_mastery) / 100.0
        anomaly_mastery_mult = max(0.0, min(3.0, anomaly_mastery_mult))

        # 3. 异常积蓄效率区
        buildup_eff_mult = 1.0 + attacker.anomaly_buildup_efficiency

        # 4. 异常积蓄抗性区
        anomaly_res_mult = 1.0 - enemy.anomaly_resistance

        # 5. 距离衰减区
        distance_mult = DamageCalculatorService.calculate_distance_decay_multiplier(
            skill, decay_type
        )

        # 计算最终异常积蓄值
        final_buildup = (
            base_buildup
            * anomaly_mastery_mult
            * buildup_eff_mult
            * anomaly_res_mult
            * distance_mult
        )

        return final_buildup

    @staticmethod
    def calculate_disorder_ratio(
        anomaly_type: AnomalyType, remaining_duration: float = 10.0
    ) -> float:
        """计算紊乱伤害倍率

        公式：450% + floor(T / interval) × increment

        Args:
            anomaly_type: 异常类型
            remaining_duration: 剩余持续时间（默认10秒满）

        Returns:
            紊乱伤害倍率
        """
        base_ratio = 4.5  # 450%

        if anomaly_type == AnomalyType.FIRE:
            # 灼烧：450% + floor(T/0.5) × 50%
            return base_ratio + math.floor(remaining_duration / 0.5) * 0.5
        elif anomaly_type == AnomalyType.ELECTRIC:
            # 感电：450% + floor(T) × 125%
            return base_ratio + math.floor(remaining_duration) * 1.25
        elif anomaly_type == AnomalyType.ETHER:
            # 侵蚀：450% + floor(T/0.5) × 62.5%
            return base_ratio + math.floor(remaining_duration / 0.5) * 0.625
        elif anomaly_type == AnomalyType.ICE:
            # 霜寒：450% + floor(T) × 7.5%
            return base_ratio + math.floor(remaining_duration) * 0.075
        elif anomaly_type == AnomalyType.PHYSICAL:
            # 畏缩：450% + floor(T) × 7.5%
            return base_ratio + math.floor(remaining_duration) * 0.075

        return base_ratio

    @staticmethod
    def calculate_anomaly_damage(
        attacker: CombatStats,
        enemy: EnemyStats,
        anomaly_ratio: float,
        is_anomaly_crit: bool = False,
    ) -> float:
        """计算标准异常伤害

        公式：异常伤害 = 基础伤害区 × 增伤区 × 异常精通区 × 防御区 × 抗性区 ×
                        减易伤区 × 失衡易伤区 × 伤害等级区 × 异常增伤区 × 异常暴击区

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            anomaly_ratio: 异常伤害倍率
            is_anomaly_crit: 是否异常暴击

        Returns:
            最终异常伤害（向上取整）
        """
        # 1. 基础伤害区
        base_dmg = anomaly_ratio * attacker.get_final_atk()

        # 2. 增伤区
        dmg_bonus = DamageCalculatorService.calculate_dmg_bonus_multiplier(attacker)

        # 3. 异常精通区
        anomaly_prof_mult = attacker.base_anomaly_proficiency / 100.0
        anomaly_prof_mult = max(0.0, min(10.0, anomaly_prof_mult))

        # 4. 防御区
        def_mult = DamageCalculatorService.calculate_defense_multiplier(attacker, enemy)

        # 5. 抗性区
        res_mult = DamageCalculatorService.calculate_resistance_multiplier(
            attacker, enemy, skill.element
        )

        # 6. 减易伤区
        dmg_taken_mult = DamageCalculatorService.calculate_dmg_taken_multiplier(enemy)

        # 7. 失衡易伤区
        stun_vuln_mult = (
            DamageCalculatorService.calculate_stun_vulnerability_multiplier(enemy)
        )

        # 8. 伤害等级区
        level_mult = 1.0 + (1.0 / 59.0) * (attacker.level - 1)
        level_mult = math.floor(level_mult * 10000) / 10000

        # 9. 异常增伤区
        anomaly_dmg_mult = 1.0 + attacker.anomaly_dmg_bonus
        anomaly_dmg_mult = max(0.0, min(3.0, anomaly_dmg_mult))

        # 10. 异常暴击区
        if is_anomaly_crit:
            anomaly_crit_mult = 1.0 + attacker.anomaly_crit_dmg
            anomaly_crit_mult = max(1.0, min(3.0, anomaly_crit_mult))
        else:
            anomaly_crit_mult = 1.0

        # 计算最终伤害
        final_dmg = (
            base_dmg
            * dmg_bonus
            * anomaly_prof_mult
            * def_mult
            * res_mult
            * dmg_taken_mult
            * stun_vuln_mult
            * level_mult
            * anomaly_dmg_mult
            * anomaly_crit_mult
        )

        return math.ceil(final_dmg)

    @staticmethod
    def calculate_anomaly_trigger_expectation(
        anomaly_buildup: float, anomaly_threshold: float
    ) -> float:
        """计算异常触发期望

        Args:
            anomaly_buildup: 异常积蓄值
            anomaly_threshold: 异常条阈值

        Returns:
            触发期望（0-1之间）
        """
        if anomaly_threshold <= 0:
            return 0.0
        return min(1.0, anomaly_buildup / anomaly_threshold)

    @staticmethod
    def calculate_total_anomaly_damage(
        attacker: CombatStats,
        enemy: EnemyStats,
        anomaly_effect: AnomalyEffect,
        anomaly_buildup: float,
        anomaly_threshold: float,
        special_direct_dmg_ratio: float = 0.0,
        is_anomaly_crit: bool = False,
        is_direct_crit: bool = False,
    ) -> dict:
        """计算完整的异常伤害（包含期望）

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            anomaly_effect: 异常效果
            anomaly_buildup: 异常积蓄值
            anomaly_threshold: 异常条阈值
            special_direct_dmg_ratio: 特殊直伤倍率（如星见雅1500%）
            is_anomaly_crit: 是否异常暴击
            is_direct_crit: 是否直伤暴击

        Returns:
            包含各项伤害的字典
        """
        # 1. 计算触发期望
        trigger_expect = DamageCalculatorService.calculate_anomaly_trigger_expectation(
            anomaly_buildup, anomaly_threshold
        )

        # 2. 计算异常本体伤害（标准异常伤害）
        anomaly_ratio = anomaly_effect.get_total_ratio()
        anomaly_dmg = DamageCalculatorService.calculate_anomaly_damage(
            attacker, enemy, anomaly_ratio, is_anomaly_crit
        )

        # 3. 计算紊乱伤害（标准异常伤害）
        disorder_ratio = DamageCalculatorService.calculate_disorder_ratio(
            anomaly_effect.anomaly_type, anomaly_effect.duration
        )
        disorder_dmg = DamageCalculatorService.calculate_anomaly_damage(
            attacker, enemy, disorder_ratio, is_anomaly_crit
        )

        # 4. 计算特殊直伤（如星见雅）
        special_dmg = 0.0
        if special_direct_dmg_ratio > 0:
            skill_params = SkillDamageParams(damage_ratio=special_direct_dmg_ratio)
            direct_result = DamageCalculatorService.calculate_direct_damage(
                attacker, enemy, skill_params, is_crit=is_direct_crit
            )
            special_dmg = direct_result.damage_expected

        # 5. 计算期望伤害
        expected_anomaly_dmg = anomaly_dmg * trigger_expect
        expected_disorder_dmg = disorder_dmg * trigger_expect
        expected_special_dmg = special_dmg * trigger_expect
        expected_total_dmg = (
            expected_anomaly_dmg + expected_disorder_dmg + expected_special_dmg
        )

        return {
            "trigger_expectation": trigger_expect,
            "anomaly_damage": anomaly_dmg,
            "disorder_damage": disorder_dmg,
            "special_direct_damage": special_dmg,
            "expected_anomaly_damage": expected_anomaly_dmg,
            "expected_disorder_damage": expected_disorder_dmg,
            "expected_special_damage": expected_special_dmg,
            "expected_total_damage": expected_total_dmg,
        }

    @staticmethod
    def calculate_damage_from_agent(
        agent,
        enemy: EnemyStats,
        skill_params: SkillDamageParams,
        wengine=None,
        drive_disks=None,
        include_anomaly: bool = False,
        anomaly_effect: Optional[AnomalyEffect] = None,
        anomaly_threshold: float = 3000.0,
        special_direct_dmg_ratio: float = 0.0,
    ) -> dict:
        """从 Agent 对象计算伤害

        自动处理：
        1. 从 Agent 的 buff 中提取局外属性
        2. 从 Agent 的 buff 中提取局内属性
        3. 创建 CombatStats 对象
        4. 计算常规伤害和异常伤害

        Args:
            agent: 角色对象
            enemy: 敌人属性
            skill_params: 技能参数
            wengine: 音擎对象（可选）
            drive_disks: 驱动盘列表（可选）
            include_anomaly: 是否计算异常伤害
            anomaly_effect: 异常效果
            anomaly_threshold: 异常条阈值
            special_direct_dmg_ratio: 特殊直伤倍率

        Returns:
            包含所有伤害信息的字典：
            - combat_stats: CombatStats 对象
            - normal_damage_no_crit: 未暴击伤害
            - normal_damage_crit: 暴击伤害
            - normal_damage_expected: 期望伤害
            - anomaly_result: 异常伤害结果（如果 include_anomaly=True）
            - zones: 乘区缓存（用于增量计算）
        """
        # 1. 创建 CombatStats
        combat_stats = create_combat_stats_from_agent(agent, wengine, drive_disks)

        # 2. 计算常规伤害（使用新的 calculate_direct_damage 方法）
        direct_result = DamageCalculatorService.calculate_direct_damage(
            combat_stats, enemy, skill_params, is_crit=False
        )
        normal_dmg_no_crit = direct_result.damage_no_crit

        direct_result_crit = DamageCalculatorService.calculate_direct_damage(
            combat_stats, enemy, skill_params, is_crit=True
        )
        normal_dmg_crit = direct_result_crit.damage_crit

        # 期望伤害
        normal_dmg_expected = direct_result.damage_expected

        # 计算期望伤害和乘区（兼容旧接口）
        crit_expect = DamageCalculatorService.calculate_crit_expectation(combat_stats)
        base_dmg = DamageCalculatorService.calculate_base_damage(
            combat_stats, skill_params
        )
        dmg_bonus = DamageCalculatorService.calculate_dmg_bonus_multiplier(combat_stats)
        def_mult = DamageCalculatorService.calculate_defense_multiplier(
            combat_stats, enemy
        )
        res_mult = DamageCalculatorService.calculate_resistance_multiplier(
            combat_stats, enemy, skill_params.element
        )
        dmg_taken_mult = DamageCalculatorService.calculate_dmg_taken_multiplier(enemy)
        stun_vuln_mult = (
            DamageCalculatorService.calculate_stun_vulnerability_multiplier(enemy)
        )

        # 缓存乘区（用于增量计算）
        zones = {
            "base_dmg": base_dmg,
            "dmg_bonus": dmg_bonus,
            "crit_expect": crit_expect,
            "def_mult": def_mult,
            "res_mult": res_mult,
            "dmg_taken_mult": dmg_taken_mult,
            "stun_vuln_mult": stun_vuln_mult,
        }

        result = {
            "combat_stats": combat_stats,
            "normal_damage_no_crit": normal_dmg_no_crit,
            "normal_damage_crit": normal_dmg_crit,
            "normal_damage_expected": normal_dmg_expected,
            "crit_expectation": crit_expect,  # 添加兼容字段
            "zones": zones,
        }

        # 3. 计算异常伤害（如果需要）
        if include_anomaly and anomaly_effect:
            anomaly_buildup = DamageCalculatorService.calculate_anomaly_buildup(
                combat_stats, enemy, skill_params
            )

            anomaly_result = DamageCalculatorService.calculate_total_anomaly_damage(
                attacker=combat_stats,
                enemy=enemy,
                anomaly_effect=anomaly_effect,
                anomaly_buildup=anomaly_buildup,
                anomaly_threshold=anomaly_threshold,
                special_direct_dmg_ratio=special_direct_dmg_ratio,
                is_anomaly_crit=False,
                is_direct_crit=False,
            )

            result["anomaly_result"] = anomaly_result

            # 异常伤害乘区
            zones["anomaly_buildup"] = anomaly_buildup
            zones["anomaly_prof_mult"] = combat_stats.base_anomaly_proficiency / 100.0

        return result

    @staticmethod
    @staticmethod
    def calculate_direct_damage(
        attacker: CombatStats,
        enemy: EnemyStats,
        skill: SkillDamageParams,
        is_crit: bool = False,
        decay_type: str = "default",
    ) -> "DirectDamageResult":
        """计算直伤（整合常规伤害和贯穿伤害）

        返回一个 DirectDamageResult 对象，包含所有计算细节。

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            skill: 技能参数
            is_crit: 是否暴击
            decay_type: 距离衰减类型

        Returns:
            DirectDamageResult 对象
        """
        from ..zzz_models.damage_result import DirectDamageResult

        # 1. 基础伤害区
        base_dmg = DamageCalculatorService.calculate_base_damage(attacker, skill)

        # 2. 增伤区
        dmg_bonus = DamageCalculatorService.calculate_dmg_bonus_multiplier(attacker)

        # 3. 暴击区
        crit_rate = max(0.0, min(1.0, attacker.crit_rate))
        crit_dmg = attacker.crit_dmg
        crit_zone = DamageCalculatorService.calculate_crit_expectation(attacker)

        # 4. 防御区
        def_mult = DamageCalculatorService.calculate_defense_multiplier(attacker, enemy)

        # 5. 抗性区
        res_mult = DamageCalculatorService.calculate_resistance_multiplier(
            attacker, enemy, skill.element
        )

        # 6. 减易伤区
        dmg_taken_mult = DamageCalculatorService.calculate_dmg_taken_multiplier(enemy)

        # 7. 失衡易伤区
        stun_vuln_mult = (
            DamageCalculatorService.calculate_stun_vulnerability_multiplier(enemy)
        )

        # 8. 距离衰减区
        distance_mult = DamageCalculatorService.calculate_distance_decay_multiplier(
            skill, decay_type
        )

        # 9. 贯穿伤害特有
        if skill.is_penetration:
            pen_dmg_mult = DamageCalculatorService.calculate_penetration_dmg_multiplier(
                attacker
            )
            # 贯穿伤害：基础伤害 × 增伤区 × 暴击区 × 贯穿增伤区 × 抗性区 × 减易伤区 × 失衡易伤区 × 距离衰减区
            final_dmg_no_crit = (
                base_dmg
                * dmg_bonus
                * 1.0  # 非暴击
                * pen_dmg_mult
                * res_mult
                * dmg_taken_mult
                * stun_vuln_mult
                * distance_mult
            )
            final_dmg_crit = (
                base_dmg
                * dmg_bonus
                * (1.0 + crit_dmg)
                * pen_dmg_mult
                * res_mult
                * dmg_taken_mult
                * stun_vuln_mult
                * distance_mult
            )
            final_dmg_expected = (
                base_dmg
                * dmg_bonus
                * crit_zone
                * pen_dmg_mult
                * res_mult
                * dmg_taken_mult
                * stun_vuln_mult
                * distance_mult
            )
        else:
            # 常规伤害：基础伤害 × 增伤区 × 暴击区 × 防御区 × 抗性区 × 减易伤区 × 失衡易伤区 × 距离衰减区
            final_dmg_no_crit = (
                base_dmg
                * dmg_bonus
                * 1.0  # 非暴击
                * def_mult
                * res_mult
                * dmg_taken_mult
                * stun_vuln_mult
                * distance_mult
            )
            final_dmg_crit = (
                base_dmg
                * dmg_bonus
                * (1.0 + crit_dmg)
                * def_mult
                * res_mult
                * dmg_taken_mult
                * stun_vuln_mult
                * distance_mult
            )
            final_dmg_expected = (
                base_dmg
                * dmg_bonus
                * crit_zone
                * def_mult
                * res_mult
                * dmg_taken_mult
                * stun_vuln_mult
                * distance_mult
            )

        # 向上取整
        final_dmg_no_crit = math.ceil(final_dmg_no_crit)
        final_dmg_crit = math.ceil(final_dmg_crit)
        final_dmg_expected = math.ceil(final_dmg_expected)

        # 构建结果对象
        result = DirectDamageResult(
            damage_no_crit=final_dmg_no_crit,
            damage_crit=final_dmg_crit,
            damage_expected=final_dmg_expected,
            base_damage=base_dmg,
            skill_ratio=skill.damage_ratio,
            element=skill.element,
            atk_zone=attacker.get_final_atk() if not skill.is_penetration else attacker.get_final_penetration(),
            dmg_bonus=dmg_bonus,
            crit_rate=crit_rate,
            crit_dmg=crit_dmg,
            crit_zone=crit_zone,
            def_mult=def_mult,
            res_mult=res_mult,
            dmg_taken_mult=dmg_taken_mult,
            stun_vuln_mult=stun_vuln_mult,
            distance_mult=distance_mult,
            is_penetration=skill.is_penetration,
            penetration_dmg_bonus=attacker.penetration_dmg_bonus if skill.is_penetration else 0.0,
        )

        return result

    @staticmethod
    def calculate_anomaly_damage(
        attacker: CombatStats,
        enemy: EnemyStats,
        anomaly_ratio: float,
        anomaly_buildup: float = 0.0,
        anomaly_type: str = "ice",
        is_anomaly_crit: bool = False,
        special_direct_dmg_ratio: float = 0.0,
    ) -> "AnomalyDamageResult":
        """计算异常伤害（返回 AnomalyDamageResult 对象）

        从 BattleService.calculate_skill_damage 中迁移异常伤害计算逻辑。

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            anomaly_ratio: 异常伤害倍率
            anomaly_buildup: 异常积蓄值
            anomaly_type: 异常类型
            is_anomaly_crit: 是否异常暴击
            special_direct_dmg_ratio: 特殊直伤倍率（如星见雅1500%）

        Returns:
            AnomalyDamageResult 对象
        """
        from ..zzz_models.damage_result import AnomalyDamageResult

        # 1. 攻击力
        atk_zone = attacker.get_final_atk()

        # 2. 增伤区
        dmg_bonus = DamageCalculatorService.calculate_dmg_bonus_multiplier(attacker)

        # 3. 异常精通区
        anomaly_prof_mult = attacker.base_anomaly_proficiency / 100.0
        anomaly_prof_mult = max(0.0, min(10.0, anomaly_prof_mult))

        # 4. 异常增伤区
        anomaly_dmg_bonus = attacker.anomaly_dmg_bonus
        anomaly_dmg_mult = 1.0 + anomaly_dmg_bonus
        anomaly_dmg_mult = max(0.0, min(3.0, anomaly_dmg_mult))

        # 5. 异常暴击区
        anomaly_crit_rate = getattr(attacker, 'anomaly_crit_rate', 0.0)
        anomaly_crit_dmg = attacker.anomaly_crit_dmg
        anomaly_crit_mult = 1.0 + anomaly_crit_dmg
        anomaly_crit_mult = max(1.0, min(3.0, anomaly_crit_mult))

        # 6. 等级区
        level_mult = 1.0 + (1.0 / 59.0) * (attacker.level - 1)
        level_mult = math.floor(level_mult * 10000) / 10000

        # 7. 积蓄区
        anomaly_threshold = enemy.get_anomaly_threshold(anomaly_type)
        accumulate_zone = min(1.0, anomaly_buildup / anomaly_threshold) if anomaly_threshold > 0 else 0

        # 8. 触发期望
        trigger_expect = accumulate_zone

        # 9. 通用乘区
        def_mult = DamageCalculatorService.calculate_defense_multiplier(attacker, enemy)
        res_mult = DamageCalculatorService.calculate_resistance_multiplier(
            attacker, enemy, anomaly_type
        )
        dmg_taken_mult = DamageCalculatorService.calculate_dmg_taken_multiplier(enemy)
        stun_vuln_mult = DamageCalculatorService.calculate_stun_vulnerability_multiplier(enemy)

        # 10. 计算基础异常伤害（不含暴击）
        base_anomaly_damage = (
            atk_zone *
            anomaly_ratio *
            dmg_bonus *
            anomaly_prof_mult *
            anomaly_dmg_mult *
            level_mult *
            def_mult *
            res_mult *
            dmg_taken_mult *
            stun_vuln_mult
        )

        # 11. 非暴击异常伤害
        anomaly_dmg_no_crit = base_anomaly_damage

        # 12. 暴击异常伤害
        anomaly_dmg_crit = base_anomaly_damage * anomaly_crit_mult

        # 13. 期望异常伤害 = 基础 × 触发期望 × (1 + 异常暴击率 × 异常暴击伤害)
        anomaly_dmg_expected = trigger_expect * base_anomaly_damage * (1.0 + anomaly_crit_rate * anomaly_crit_dmg)

        # 14. 向上取整
        anomaly_dmg_no_crit = math.ceil(anomaly_dmg_no_crit)
        anomaly_dmg_crit = math.ceil(anomaly_dmg_crit)
        anomaly_dmg_expected = math.ceil(anomaly_dmg_expected)

        # 15. 特殊直伤（如星见雅）
        special_direct_damage = 0.0
        if special_direct_dmg_ratio > 0:
            skill_params = SkillDamageParams(
                damage_ratio=special_direct_dmg_ratio,
                element=anomaly_type
            )
            special_result = DamageCalculatorService.calculate_direct_damage(
                attacker, enemy, skill_params, is_crit=False
            )
            special_direct_damage = special_result.damage_expected

        # 构建结果对象
        result = AnomalyDamageResult(
            damage_no_crit=anomaly_dmg_no_crit,
            damage_crit=anomaly_dmg_crit,
            damage_expected=anomaly_dmg_expected,
            anomaly_type=anomaly_type,
            anomaly_ratio=anomaly_ratio,
            anomaly_buildup=anomaly_buildup,
            anomaly_threshold=anomaly_threshold,
            atk_zone=atk_zone,
            dmg_bonus=dmg_bonus,
            anomaly_prof_mult=anomaly_prof_mult,
            anomaly_dmg_bonus=anomaly_dmg_bonus,
            anomaly_dmg_mult=anomaly_dmg_mult,
            anomaly_crit_rate=anomaly_crit_rate,
            anomaly_crit_dmg=anomaly_crit_dmg,
            anomaly_crit_mult=anomaly_crit_mult,
            level_mult=level_mult,
            accumulate_zone=accumulate_zone,
            trigger_expect=trigger_expect,
            def_mult=def_mult,
            res_mult=res_mult,
            dmg_taken_mult=dmg_taken_mult,
            stun_vuln_mult=stun_vuln_mult,
            special_direct_dmg_ratio=special_direct_dmg_ratio,
            special_direct_damage=special_direct_damage,
        )

        return result

    @staticmethod
    def calculate_total_damage(
        attacker: CombatStats,
        enemy: EnemyStats,
        skill: SkillDamageParams,
        anomaly_ratio: float = 0.0,
        anomaly_buildup: float = 0.0,
        anomaly_type: str = "ice",
        is_crit: bool = False,
        is_anomaly_crit: bool = False,
        special_direct_dmg_ratio: float = 0.0,
        decay_type: str = "default",
    ) -> "TotalDamageResult":
        """计算总伤害（直伤 + 异常伤害）

        调用 calculate_direct_damage 和 calculate_anomaly_damage，并汇总结果。

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            skill: 技能参数
            anomaly_ratio: 异常伤害倍率
            anomaly_buildup: 异常积蓄值
            anomaly_type: 异常类型
            is_crit: 是否直伤暴击
            is_anomaly_crit: 是否异常暴击
            special_direct_dmg_ratio: 特殊直伤倍率（如星见雅1500%）
            decay_type: 距离衰减类型

        Returns:
            TotalDamageResult 对象
        """
        from ..zzz_models.damage_result import TotalDamageResult

        # 1. 计算直伤
        direct_result = DamageCalculatorService.calculate_direct_damage(
            attacker, enemy, skill, is_crit=is_crit, decay_type=decay_type
        )

        # 2. 计算异常伤害（如果需要）
        anomaly_result = None
        if anomaly_ratio > 0:
            anomaly_result = DamageCalculatorService.calculate_anomaly_damage(
                attacker=attacker,
                enemy=enemy,
                anomaly_ratio=anomaly_ratio,
                anomaly_buildup=anomaly_buildup,
                anomaly_type=anomaly_type,
                is_anomaly_crit=is_anomaly_crit,
                special_direct_dmg_ratio=special_direct_dmg_ratio,
            )

        # 3. 汇总总伤害
        total_damage_no_crit = direct_result.damage_no_crit
        total_damage_crit = direct_result.damage_crit
        total_damage_expected = direct_result.damage_expected

        if anomaly_result:
            total_damage_no_crit += anomaly_result.damage_no_crit
            total_damage_crit += anomaly_result.damage_crit
            total_damage_expected += anomaly_result.damage_expected

        # 4. 构建结果对象
        result = TotalDamageResult(
            direct_result=direct_result,
            anomaly_result=anomaly_result,
            total_damage_no_crit=total_damage_no_crit,
            total_damage_crit=total_damage_crit,
            total_damage_expected=total_damage_expected,
        )

        return result

    @staticmethod
    def update_all_zones(
        agent_stats: CombatStats,
        enemy_stats: EnemyStats,
    ) -> "ZoneCollection":
        """计算所有通用乘区

        接收 agent_stats 和 enemy_stats，计算并返回一个完整的 ZoneCollection 对象，
        包含所有通用乘区（与元素无关）。

        Args:
            agent_stats: Agent 的 CombatStats
            enemy_stats: Enemy 的 EnemyStats

        Returns:
            ZoneCollection 对象
        """
        from ..zzz_models.zone_collection import ZoneCollection

        zones = ZoneCollection()

        # 攻击区（攻击力）
        zones.atk_zone = agent_stats.get_final_atk()

        # 增伤区
        zones.dmg_bonus = DamageCalculatorService.calculate_dmg_bonus_multiplier(agent_stats)

        # 暴击区
        zones.crit_zone = DamageCalculatorService.calculate_crit_expectation(agent_stats)

        # 防御区
        zones.def_mult = DamageCalculatorService.calculate_defense_multiplier(
            agent_stats, enemy_stats
        )

        # 减易伤区
        zones.dmg_taken_mult = DamageCalculatorService.calculate_dmg_taken_multiplier(
            enemy_stats
        )

        # 失衡易伤区
        zones.stun_vuln_mult = DamageCalculatorService.calculate_stun_vulnerability_multiplier(
            enemy_stats
        )

        return zones

    # ==================== 乘区计算窗口方法 ====================

    @staticmethod
    def calculate_base_damage_zone(attacker: CombatStats, skill: SkillDamageParams, zones: ZoneCollection) -> ZoneCollection:
        """计算基础伤害区（乘区计算窗口）

        Args:
            attacker: 攻击方属性
            skill: 技能参数
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        if skill.is_penetration:
            zones.atk_zone = attacker.get_final_penetration()
        else:
            zones.atk_zone = attacker.get_final_atk()

        zones.ratio_zone = skill.damage_ratio
        return zones

    @staticmethod
    def calculate_dmg_bonus_zone(attacker: CombatStats, zones: ZoneCollection) -> ZoneCollection:
        """计算增伤区（乘区计算窗口）

        Args:
            attacker: 攻击方属性
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        multiplier = 1.0 + attacker.dmg_bonus + attacker.element_dmg_bonus
        zones.dmg_bonus = max(0.0, min(6.0, multiplier))
        return zones

    @staticmethod
    def calculate_crit_zone(attacker: CombatStats, zones: ZoneCollection) -> ZoneCollection:
        """计算暴击区（乘区计算窗口）

        Args:
            attacker: 攻击方属性
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        crit_rate = max(0.0, min(1.0, attacker.crit_rate))
        crit_dmg = attacker.crit_dmg
        crit_expect = 1.0 + crit_rate * crit_dmg
        zones.crit_zone = crit_expect
        return zones

    @staticmethod
    def calculate_defense_zone(attacker: CombatStats, enemy: EnemyStats, zones: ZoneCollection) -> ZoneCollection:
        """计算防御区（乘区计算窗口）

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        level_coef = enemy.get_level_coefficient()
        effective_def = enemy.get_effective_defense(
            attacker.penetration_rate, attacker.penetration_value
        )
        zones.def_mult = level_coef / (effective_def + level_coef)
        return zones

    @staticmethod
    def calculate_resistance_zone(attacker: CombatStats, enemy: EnemyStats, element: str, zones: ZoneCollection) -> ZoneCollection:
        """计算抗性区（乘区计算窗口）

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            element: 元素类型
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        resistance = enemy.get_element_resistance(element)
        multiplier = 1.0 - resistance
        zones.res_mult = max(0.0, min(2.0, multiplier))
        return zones

    @staticmethod
    def calculate_damage_taken_zone(enemy: EnemyStats, zones: ZoneCollection) -> ZoneCollection:
        """计算减易伤区（乘区计算窗口）

        Args:
            enemy: 敌人属性
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        # 敌人当前不提供易伤/减伤数据，返回1.0
        zones.dmg_taken_mult = 1.0
        return zones

    @staticmethod
    def calculate_stun_vulnerability_zone(enemy: EnemyStats, zones: ZoneCollection) -> ZoneCollection:
        """计算失衡易伤区（乘区计算窗口）

        Args:
            enemy: 敌人属性
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        if enemy.is_stunned:
            multiplier = 1.0 + enemy.stun_vulnerability
            zones.stun_vuln_mult = max(0.2, min(5.0, multiplier))
        else:
            zones.stun_vuln_mult = 1.0
        return zones

    @staticmethod
    def calculate_penetration_dmg_zone(attacker: CombatStats, is_penetration: bool, zones: ZoneCollection) -> ZoneCollection:
        """计算贯穿增伤区（乘区计算窗口）

        Args:
            attacker: 攻击方属性
            is_penetration: 是否贯穿伤害
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        if is_penetration:
            multiplier = 1.0 + attacker.penetration_dmg_bonus
            zones.penetration_dmg_bonus = max(0.2, min(9.0, multiplier))
        else:
            zones.penetration_dmg_bonus = 0.0
        return zones

    @staticmethod
    def calculate_distance_decay_zone(skill: SkillDamageParams, decay_type: str = "default", zones: ZoneCollection = None) -> ZoneCollection:
        """计算距离衰减区（乘区计算窗口）

        Args:
            skill: 技能参数
            decay_type: 衰减类型（"default"或"grace"）
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        if zones is None:
            zones = ZoneCollection()

        if skill.distance <= 15.0:
            zones.distance_mult = 1.0
        elif decay_type == "grace":
            # 格莉丝型：超过15m时伤害衰减30%
            zones.distance_mult = 0.7
        else:
            # 默认型：超过15m时伤害衰减25%，每继续远离5m继续衰减25%
            extra_distance = skill.distance - 15.0
            decay_count = 1 + int(extra_distance / 5.0)
            zones.distance_mult = 0.75 ** decay_count

        return zones

    @staticmethod
    def calculate_anomaly_zones(attacker: CombatStats, enemy: EnemyStats, anomaly_type: str, anomaly_buildup: float, zones: ZoneCollection) -> ZoneCollection:
        """计算异常乘区（乘区计算窗口）

        Args:
            attacker: 攻击方属性
            enemy: 敌人属性
            anomaly_type: 异常类型
            anomaly_buildup: 异常积蓄值
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        # 积蓄区 = 异常掌控 × 技能异常积蓄 / 敌人异常条
        anomaly_threshold = enemy.get_anomaly_threshold(anomaly_type)
        anomaly_mastery = attacker.base_anomaly_mastery
        if anomaly_threshold > 0:
            zones.accumulate_zone = (anomaly_mastery * anomaly_buildup) / anomaly_threshold
        else:
            zones.accumulate_zone = 0.0

        # 触发期望（限制在0-1之间）
        zones.trigger_expect = min(1.0, zones.accumulate_zone)

        # 异常精通区 = 异常精通值
        zones.anomaly_prof_mult = attacker.base_anomaly_proficiency

        # 异常倍率已废弃（统一到基础倍率中）
        zones.anomaly_ratio_zone = 1.0

        # 异常增伤区
        zones.anomaly_dmg_mult = 1.0 + attacker.anomaly_dmg_bonus
        zones.anomaly_dmg_mult = max(0.0, min(3.0, zones.anomaly_dmg_mult))

        # 异常暴击区
        zones.anomaly_crit_mult = 1.0 + attacker.anomaly_crit_dmg
        zones.anomaly_crit_mult = max(1.0, min(3.0, zones.anomaly_crit_mult))

        # 等级区
        zones.level_mult = 1.0 + (1.0 / 59.0) * (attacker.level - 1)
        zones.level_mult = math.floor(zones.level_mult * 10000) / 10000

        return zones

    # ==================== 最终值计算窗口方法 ====================

    @staticmethod
    def calculate_direct_damage_values(
        zones: ZoneCollection,
        attacker: CombatStats,
        skill: SkillDamageParams,
        crit_rate: float = 0.0,
        crit_dmg: float = 0.0
    ) -> ZoneCollection:
        """计算直伤最终值（最终值计算窗口）

        从 ZoneCollection 读取乘区，计算各属性的伤害贡献，然后累加得到总伤害。

        公式：
        直伤 = Σ(属性 × 倍率 × 直伤乘区)
             = ATK × 攻击倍率 × 直伤乘区
             + DEF × 防御倍率 × 直伤乘区
             + HP × 生命倍率 × 直伤乘区
             + PEN × 贯穿倍率 × 直伤乘区

        Args:
            zones: ZoneCollection 对象
            attacker: 攻击方属性
            skill: 技能参数
            crit_rate: 暴击率
            crit_dmg: 暴击伤害

        Returns:
            更新后的 ZoneCollection 对象
        """
        print(f"\n[DEBUG] calculate_direct_damage_values 开始")
        print(f"  combat_stats.atk: {zones.combat_stats.get_final_atk():.2f}")
        print(f"  combat_stats.defense: {zones.combat_stats.get_final_def():.2f}")
        print(f"  combat_stats.hp: {zones.combat_stats.get_final_hp():.2f}")
        print(f"  combat_stats.penetration: {zones.combat_stats.get_final_penetration():.2f}")
        print(f"  ratios.atk_ratio: {zones.ratios.atk_ratio:.4f}")
        print(f"  ratios.def_ratio: {zones.ratios.def_ratio:.4f}")
        print(f"  ratios.hp_ratio: {zones.ratios.hp_ratio:.4f}")
        print(f"  ratios.pen_ratio: {zones.ratios.pen_ratio:.4f}")

        # 获取倍率集
        ratios = zones.ratios

        # 获取属性值
        atk = zones.combat_stats.get_final_atk()
        defense = zones.combat_stats.get_final_def()
        hp = zones.combat_stats.get_final_hp()
        penetration = zones.combat_stats.get_final_penetration()

        # 计算贯穿增伤乘区
        if skill.is_penetration:
            pen_dmg_mult = 1.0 + zones.penetration_dmg_bonus
            pen_dmg_mult = max(0.2, min(9.0, pen_dmg_mult))
        else:
            pen_dmg_mult = 1.0

        # 计算直伤乘区（不包括暴击）
        if skill.is_penetration:
            direct_mult = (
                zones.dmg_bonus
                * pen_dmg_mult
                * zones.res_mult
                * zones.dmg_taken_mult
                * zones.stun_vuln_mult
                * zones.distance_mult
            )
        else:
            direct_mult = (
                zones.dmg_bonus
                * zones.def_mult
                * zones.res_mult
                * zones.dmg_taken_mult
                * zones.stun_vuln_mult
                * zones.distance_mult
            )

        print(f"  直伤乘区（不含暴击）: {direct_mult:.4f}")

        # 计算暴击乘区
        crit_mult = 1.0 + crit_dmg

        # 计算暴击期望乘区
        crit_expectation_mult = 1.0 + crit_rate * crit_dmg

        print(f"  暴击率: {crit_rate:.4f}")
        print(f"  暴击伤害: {crit_dmg:.4f}")
        print(f"  暴击期望乘区: {crit_expectation_mult:.4f}")

        # 计算各属性的伤害贡献（非暴击）
        atk_damage = atk * ratios.atk_ratio * direct_mult
        def_damage = defense * ratios.def_ratio * direct_mult
        hp_damage = hp * ratios.hp_ratio * direct_mult
        pen_damage = penetration * ratios.pen_ratio * direct_mult

        print(f"\n[DEBUG] 各属性伤害贡献（非暴击）:")
        print(f"  攻击力伤害: {atk:.2f} × {ratios.atk_ratio:.4f} × {direct_mult:.4f} = {atk_damage:.2f}")
        print(f"  防御力伤害: {defense:.2f} × {ratios.def_ratio:.4f} × {direct_mult:.4f} = {def_damage:.2f}")
        print(f"  生命值伤害: {hp:.2f} × {ratios.hp_ratio:.4f} × {direct_mult:.4f} = {hp_damage:.2f}")
        print(f"  贯穿力伤害: {penetration:.2f} × {ratios.pen_ratio:.4f} × {direct_mult:.4f} = {pen_damage:.2f}")

        # 存储各属性伤害贡献（期望）
        zones.atk_damage = math.ceil(atk_damage * crit_expectation_mult)
        zones.def_damage = math.ceil(def_damage * crit_expectation_mult)
        zones.hp_damage = math.ceil(hp_damage * crit_expectation_mult)
        zones.pen_damage = math.ceil(pen_damage * crit_expectation_mult)
        
        print(f"\n[DEBUG] 各属性伤害贡献（期望）:")
        print(f"  攻击力伤害（期望）: {atk_damage:.2f} × {crit_expectation_mult:.4f} = {zones.atk_damage:.2f}")
        print(f"  防御力伤害（期望）: {def_damage:.2f} × {crit_expectation_mult:.4f} = {zones.def_damage:.2f}")
        print(f"  生命值伤害（期望）: {hp_damage:.2f} × {crit_expectation_mult:.4f} = {zones.hp_damage:.2f}")
        print(f"  贯穿力伤害（期望）: {pen_damage:.2f} × {crit_expectation_mult:.4f} = {zones.pen_damage:.2f}")

        # 计算总伤害（累加各属性）
        damage_no_crit = atk_damage + def_damage + hp_damage + pen_damage
        damage_crit = damage_no_crit * crit_mult
        damage_expected = damage_no_crit * crit_expectation_mult
        
        print(f"\n[DEBUG] 直伤最终值:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 向上取整
        damage_no_crit = math.ceil(damage_no_crit)
        damage_crit = math.ceil(damage_crit)
        damage_expected = math.ceil(damage_expected)
        
        print(f"\n[DEBUG] 直伤最终值（向上取整）:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 存入 ZoneCollection
        zones.direct_damage_no_crit = damage_no_crit
        zones.direct_damage_crit = damage_crit
        zones.direct_damage_expected = damage_expected
        
        print(f"\n[DEBUG] calculate_direct_damage_values 完成")

        return zones

    @staticmethod
    def calculate_anomaly_attack_damage_values(
        zones: ZoneCollection,
        anomaly_atk_ratio: float,
        trigger_expect: float,
    ) -> ZoneCollection:
        """计算异常直伤（由异常反应触发的直伤，如星见雅1500%）

        公式：ATK × 异常直伤倍率(1500%) × 直伤乘区 × 触发期望

        特点：
        - 本质是附加直伤，由异常反应触发
        - 基于 ATK，可以暴击
        - 使用直伤乘区（增伤、暴击、防御、抗性、减易伤、失衡易伤）
        - 不使用等级区、异常精通区、异常增伤区
        - 受触发期望影响

        Args:
            zones: 乘区数据（会被修改，包含 combat_stats）
            anomaly_atk_ratio: 异常直伤倍率（如星见雅的1500% = 15.0）
            trigger_expect: 触发期望 = min(1.0, 积蓄/阈值)

        Returns:
            更新后的 ZoneCollection 对象
        """
        if anomaly_atk_ratio <= 0:
            return zones

        print(f"\n[DEBUG] calculate_anomaly_attack_damage_values 开始")
        print(f"  异常直伤倍率: {anomaly_atk_ratio:.4f} ({anomaly_atk_ratio * 100:.1f}%)")
        print(f"  base_properties.atk: {zones.combat_stats.get_final_atk():.2f}")
        print(f"  触发期望: {trigger_expect:.4f}")

        # ==================== 计算直伤乘区 ====================
        # 直伤乘区 = 增伤区 × 防御区 × 抗性区 × 减易伤区 × 失衡易伤区
        direct_mult = (
            zones.dmg_bonus
            * zones.def_mult
            * zones.res_mult
            * zones.dmg_taken_mult
            * zones.stun_vuln_mult
        )

        print(f"  增伤区: {zones.dmg_bonus:.4f}")
        print(f"  防御区: {zones.def_mult:.4f}")
        print(f"  抗性区: {zones.res_mult:.4f}")
        print(f"  减易伤区: {zones.dmg_taken_mult:.4f}")
        print(f"  失衡易伤区: {zones.stun_vuln_mult:.4f}")
        print(f"  直伤乘区: {direct_mult:.4f}")

        # ==================== 计算基础伤害 ====================
        base_damage = zones.combat_stats.get_final_atk() * anomaly_atk_ratio * direct_mult * trigger_expect

        print(f"  基础伤害: {zones.combat_stats.get_final_atk():.2f} × {anomaly_atk_ratio:.4f} × {direct_mult:.4f} × {trigger_expect:.4f} = {base_damage:.2f}")

        # ==================== 应用暴击 ====================
        # 非暴击伤害
        damage_no_crit = base_damage

        # 暴击伤害 = 基础伤害 × (1 + 暴击伤害)
        damage_crit = base_damage * (1.0 + zones.combat_stats.crit_dmg)

        # 暴击期望 = 基础伤害 × (1 + 暴击率 × 暴击伤害)
        crit_expectation = 1.0 + zones.combat_stats.crit_rate * zones.combat_stats.crit_dmg
        damage_expected = base_damage * crit_expectation

        print(f"  暴击率: {zones.combat_stats.crit_rate:.4f}")
        print(f"  暴击伤害: {zones.combat_stats.crit_dmg:.4f}")
        print(f"  暴击期望乘区: {crit_expectation:.4f}")
        print(f"\n[DEBUG] 异常直伤最终值:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 向上取整
        damage_no_crit = math.ceil(damage_no_crit)
        damage_crit = math.ceil(damage_crit)
        damage_expected = math.ceil(damage_expected)

        print(f"\n[DEBUG] 异常直伤最终值（向上取整）:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 存入 ZoneCollection
        zones.anomaly_attack_damage_no_crit = damage_no_crit
        zones.anomaly_attack_damage_crit = damage_crit
        zones.anomaly_attack_damage_expected = damage_expected

        return zones

    @staticmethod
    def calculate_anomaly_proficiency_damage_values(
        zones: ZoneCollection,
        anomaly_prof_ratio: float,
        trigger_expect: float,
    ) -> ZoneCollection:
        """计算异常精通伤害（真正的异常伤害）

        公式：ATK × 异常倍率(500%) × 异常精通区 × 异常乘区 × 触发期望

        异常精通区 = ANOM_PROF / 100
        异常乘区 = 增伤区 × 防御区 × 抗性区 × 减易伤区 × 失衡易伤区 × 等级区 × 异常增伤区

        特点：
        - 基于 ATK × 异常倍率（冰碎 500%、感电 1250% 等）
        - ANOM_PROF 作为"异常精通区"（ANOM_PROF/100）参与计算
        - 使用异常乘区（包含等级区、异常增伤区）
        - 可以异常暴击
        - 受触发期望影响

        Args:
            zones: 乘区数据（会被修改，包含 base_properties）
            anomaly_prof_ratio: 异常倍率（如冰碎的500% = 5.0）
            trigger_expect: 触发期望 = min(1.0, 积蓄/阈值)

        Returns:
            更新后的 ZoneCollection 对象
        """
        if anomaly_prof_ratio <= 0:
            return zones

        print(f"\n[DEBUG] calculate_anomaly_proficiency_damage_values 开始")
        print(f"  异常倍率: {anomaly_prof_ratio:.4f} ({anomaly_prof_ratio * 100:.1f}%)")
        print(f"  base_properties.atk: {zones.combat_stats.get_final_atk():.2f}")
        print(f"  base_properties.anomaly_prof: {zones.combat_stats.base_anomaly_proficiency + zones.combat_stats.anomaly_proficiency_flat:.2f}")
        print(f"  触发期望: {trigger_expect:.4f}")

        # ==================== 计算异常精通区 ====================
        anomaly_prof_zone = zones.combat_stats.base_anomaly_proficiency + zones.combat_stats.anomaly_proficiency_flat / 100.0

        print(f"  异常精通区: {zones.combat_stats.base_anomaly_proficiency + zones.combat_stats.anomaly_proficiency_flat:.2f} / 100 = {anomaly_prof_zone:.4f}")

        # ==================== 计算异常乘区 ====================
        # 异常乘区 = 增伤区 × 防御区 × 抗性区 × 减易伤区 × 失衡易伤区 × 等级区 × 异常增伤区
        anomaly_mult = (
            zones.dmg_bonus
            * zones.def_mult
            * zones.res_mult
            * zones.dmg_taken_mult
            * zones.stun_vuln_mult
            * zones.level_mult
            * zones.anomaly_dmg_mult
        )

        print(f"  增伤区: {zones.dmg_bonus:.4f}")
        print(f"  防御区: {zones.def_mult:.4f}")
        print(f"  抗性区: {zones.res_mult:.4f}")
        print(f"  减易伤区: {zones.dmg_taken_mult:.4f}")
        print(f"  失衡易伤区: {zones.stun_vuln_mult:.4f}")
        print(f"  等级区: {zones.level_mult:.4f}")
        print(f"  异常增伤区: {zones.anomaly_dmg_mult:.4f}")
        print(f"  异常乘区: {anomaly_mult:.4f}")

        # ==================== 计算基础伤害 ====================
        base_damage = (
            zones.combat_stats.get_final_atk()
            * anomaly_prof_ratio
            * anomaly_prof_zone
            * anomaly_mult
            * trigger_expect
        )

        print(f"  基础伤害: {zones.combat_stats.get_final_atk():.2f} × {anomaly_prof_ratio:.4f} × {anomaly_prof_zone:.4f} × {anomaly_mult:.4f} × {trigger_expect:.4f} = {base_damage:.2f}")

        # ==================== 应用异常暴击 ====================
        # 非暴击伤害
        damage_no_crit = base_damage

        # 异常暴击伤害 = 基础伤害 × (1 + 异常暴击伤害)
        damage_crit = base_damage * (1.0 + zones.combat_stats.anomaly_crit_dmg)

        # 异常暴击期望 = 基础伤害 × (1 + 异常暴击率 × 异常暴击伤害)
        anomaly_crit_expectation = 1.0 + zones.combat_stats.anomaly_crit_rate * zones.combat_stats.anomaly_crit_dmg
        damage_expected = base_damage * anomaly_crit_expectation

        print(f"  异常暴击率: {zones.combat_stats.anomaly_crit_rate:.4f}")
        print(f"  异常暴击伤害: {zones.combat_stats.anomaly_crit_dmg:.4f}")
        print(f"  异常暴击期望乘区: {anomaly_crit_expectation:.4f}")
        print(f"\n[DEBUG] 异常精通伤害最终值:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 向上取整
        damage_no_crit = math.ceil(damage_no_crit)
        damage_crit = math.ceil(damage_crit)
        damage_expected = math.ceil(damage_expected)

        print(f"\n[DEBUG] 异常精通伤害最终值（向上取整）:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 存入 ZoneCollection
        zones.anomaly_prof_damage_no_crit = damage_no_crit
        zones.anomaly_prof_damage_crit = damage_crit
        zones.anomaly_prof_damage_expected = damage_expected

        return zones

    @staticmethod
    def calculate_disorder_damage_values(
        zones: ZoneCollection,
        disorder_ratio: float,
        trigger_expect: float,
    ) -> ZoneCollection:
        """计算紊乱伤害

        公式：ATK × 紊乱倍率(450%+) × 异常精通区 × 异常乘区 × 触发期望

        紊乱倍率 = 450% + 持续时间加成
        异常精通区 = ANOM_PROF / 100

        特点：
        - 与异常精通伤害使用相同的计算方式
        - 有持续时间加成
        - 使用异常乘区

        Args:
            zones: 乘区数据（会被修改，包含 base_properties）
            disorder_ratio: 紊乱倍率（如450% = 4.5）
            trigger_expect: 触发期望

        Returns:
            更新后的 ZoneCollection 对象
        """
        if disorder_ratio <= 0:
            return zones

        print(f"\n[DEBUG] calculate_disorder_damage_values 开始")
        print(f"  紊乱倍率: {disorder_ratio:.4f} ({disorder_ratio * 100:.1f}%)")
        print(f"  触发期望: {trigger_expect:.4f}")

        # ==================== 计算异常精通区 ====================
        anomaly_prof_zone = zones.combat_stats.base_anomaly_proficiency + zones.combat_stats.anomaly_proficiency_flat / 100.0

        # ==================== 计算异常乘区 ====================
        anomaly_mult = (
            zones.dmg_bonus
            * zones.def_mult
            * zones.res_mult
            * zones.dmg_taken_mult
            * zones.stun_vuln_mult
            * zones.level_mult
            * zones.anomaly_dmg_mult
        )

        # ==================== 计算基础伤害 ====================
        base_damage = (
            zones.combat_stats.get_final_atk()
            * disorder_ratio
            * anomaly_prof_zone
            * anomaly_mult
            * trigger_expect
        )

        print(f"  基础伤害: {zones.combat_stats.get_final_atk():.2f} × {disorder_ratio:.4f} × {anomaly_prof_zone:.4f} × {anomaly_mult:.4f} × {trigger_expect:.4f} = {base_damage:.2f}")

        # ==================== 应用异常暴击 ====================
        damage_no_crit = base_damage
        damage_crit = base_damage * (1.0 + zones.combat_stats.anomaly_crit_dmg)

        anomaly_crit_expectation = 1.0 + zones.combat_stats.anomaly_crit_rate * zones.combat_stats.anomaly_crit_dmg
        damage_expected = base_damage * anomaly_crit_expectation

        print(f"\n[DEBUG] 紊乱伤害最终值:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 向上取整
        damage_no_crit = math.ceil(damage_no_crit)
        damage_crit = math.ceil(damage_crit)
        damage_expected = math.ceil(damage_expected)

        print(f"\n[DEBUG] 紊乱伤害最终值（向上取整）:")
        print(f"  非暴击: {damage_no_crit:.2f}")
        print(f"  暴击: {damage_crit:.2f}")
        print(f"  期望: {damage_expected:.2f}")

        # 存入 ZoneCollection
        zones.disorder_damage_no_crit = damage_no_crit
        zones.disorder_damage_crit = damage_crit
        zones.disorder_damage_expected = damage_expected

        return zones

    @staticmethod
    def calculate_total_damage_values(zones: ZoneCollection) -> ZoneCollection:
        """计算总伤害最终值（最终值计算窗口）

        从 ZoneCollection 读取乘区，计算最终伤害值，并存入 ZoneCollection。

        Args:
            zones: ZoneCollection 对象

        Returns:
            更新后的 ZoneCollection 对象
        """
        # 计算总伤害（直伤 + 异常攻击 + 异常精通 + 紊乱）
        total_no_crit = (
            zones.direct_damage_no_crit
            + zones.anomaly_attack_damage_no_crit
            + zones.anomaly_prof_damage_no_crit
            + zones.disorder_damage_no_crit
        )
        total_crit = (
            zones.direct_damage_crit
            + zones.anomaly_attack_damage_crit
            + zones.anomaly_prof_damage_crit
            + zones.disorder_damage_crit
        )
        total_expected = (
            zones.direct_damage_expected
            + zones.anomaly_attack_damage_expected
            + zones.anomaly_prof_damage_expected
            + zones.disorder_damage_expected
        )

        # 存入 ZoneCollection
        zones.total_damage_no_crit = total_no_crit
        zones.total_damage_crit = total_crit
        zones.total_damage_expected = total_expected

        return zones

    # ==================== 打包方法 ====================

    @staticmethod
    def pack_direct_damage_result(zones: ZoneCollection, base_damage: float, skill_ratio: float, element: str, is_penetration: bool, crit_rate: float, crit_dmg: float) -> DirectDamageResult:
        """打包直伤结果（打包方法）

        从 ZoneCollection 读取乘区和最终伤害值，复制到 DirectDamageResult 对象。
        不执行任何计算。

        Args:
            zones: ZoneCollection 对象
            base_damage: 基础伤害（攻击力 × 倍率）
            skill_ratio: 技能倍率
            element: 元素类型
            is_penetration: 是否贯穿伤害
            crit_rate: 暴击率
            crit_dmg: 暴击伤害

        Returns:
            DirectDamageResult 对象
        """
        from ..zzz_models.damage_result import DirectDamageResult

        return DirectDamageResult(
            damage_no_crit=zones.direct_damage_no_crit,
            damage_crit=zones.direct_damage_crit,
            damage_expected=zones.direct_damage_expected,
            base_damage=base_damage,
            skill_ratio=skill_ratio,
            element=element,
            atk_zone=zones.atk_zone,
            dmg_bonus=zones.dmg_bonus,
            crit_rate=crit_rate,
            crit_dmg=crit_dmg,
            crit_zone=zones.crit_zone,
            def_mult=zones.def_mult,
            res_mult=zones.res_mult,
            dmg_taken_mult=zones.dmg_taken_mult,
            stun_vuln_mult=zones.stun_vuln_mult,
            distance_mult=zones.distance_mult,
            is_penetration=is_penetration,
            penetration_dmg_bonus=zones.penetration_dmg_bonus if is_penetration else 0.0,
        )

    @staticmethod
    def pack_anomaly_damage_result(zones: ZoneCollection, anomaly_type: str, anomaly_ratio: float, anomaly_buildup: float, anomaly_threshold: float, anomaly_crit_rate: float) -> AnomalyDamageResult:
        """打包异常伤害结果（打包方法）

        从 ZoneCollection 读取乘区，计算最终伤害值，创建 AnomalyDamageResult 对象。

        Args:
            zones: ZoneCollection 对象
            anomaly_type: 异常类型
            anomaly_ratio: 异常伤害倍率
            anomaly_buildup: 异常积蓄值
            anomaly_threshold: 异常条阈值
            anomaly_crit_rate: 异常暴击率

        Returns:
            AnomalyDamageResult 对象
        """
        from ..zzz_models.damage_result import AnomalyDamageResult

        # 计算基础异常伤害（不含暴击）
        base_anomaly_damage = (
            zones.atk_zone
            * anomaly_ratio
            * zones.dmg_bonus
            * zones.anomaly_prof_mult
            * zones.anomaly_dmg_mult
            * zones.level_mult
            * zones.def_mult
            * zones.res_mult
            * zones.dmg_taken_mult
            * zones.stun_vuln_mult
        )

        # 非暴击异常伤害
        damage_no_crit = base_anomaly_damage

        # 暴击异常伤害
        damage_crit = base_anomaly_damage * zones.anomaly_crit_mult

        # 期望异常伤害 = 基础 × 触发期望 × (1 + 异常暴击率 × 异常暴击伤害)
        anomaly_crit_dmg = zones.anomaly_crit_mult - 1.0
        damage_expected = zones.trigger_expect * base_anomaly_damage * (1.0 + anomaly_crit_rate * anomaly_crit_dmg)

        # 向上取整
        damage_no_crit = math.ceil(damage_no_crit)
        damage_crit = math.ceil(damage_crit)
        damage_expected = math.ceil(damage_expected)

        return AnomalyDamageResult(
            damage_no_crit=damage_no_crit,
            damage_crit=damage_crit,
            damage_expected=damage_expected,
            anomaly_type=anomaly_type,
            anomaly_ratio=anomaly_ratio,
            anomaly_buildup=anomaly_buildup,
            anomaly_threshold=anomaly_threshold,
            atk_zone=zones.atk_zone,
            dmg_bonus=zones.dmg_bonus,
            anomaly_prof_mult=zones.anomaly_prof_mult,
            anomaly_dmg_bonus=zones.anomaly_dmg_mult - 1.0,
            anomaly_dmg_mult=zones.anomaly_dmg_mult,
            anomaly_crit_rate=anomaly_crit_rate,
            anomaly_crit_dmg=zones.anomaly_crit_mult - 1.0,
            anomaly_crit_mult=zones.anomaly_crit_mult,
            level_mult=zones.level_mult,
            accumulate_zone=zones.accumulate_zone,
            trigger_expect=zones.trigger_expect,
            def_mult=zones.def_mult,
            res_mult=zones.res_mult,
            dmg_taken_mult=zones.dmg_taken_mult,
            stun_vuln_mult=zones.stun_vuln_mult,
        )

    @staticmethod
    def pack_total_damage_result(zones: ZoneCollection, direct_result: Optional[DirectDamageResult] = None, anomaly_result: Optional[AnomalyDamageResult] = None) -> TotalDamageResult:
        """打包总伤害结果（打包方法）

        从 ZoneCollection 读取总伤害值，创建 TotalDamageResult 对象。
        不执行任何计算。

        Args:
            zones: ZoneCollection 对象
            direct_result: 直伤结果（可选）
            anomaly_result: 异常伤害结果（可选）

        Returns:
            TotalDamageResult 对象
        """
        from ..zzz_models.damage_result import TotalDamageResult

        return TotalDamageResult(
            direct_result=direct_result,
            anomaly_result=anomaly_result,
            total_damage_no_crit=zones.total_damage_no_crit,
            total_damage_crit=zones.total_damage_crit,
            total_damage_expected=zones.total_damage_expected,
        )
