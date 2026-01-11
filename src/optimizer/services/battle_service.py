"""
战场服务

管理战斗场景，计算技能伤害。
"""
import math
from typing import Optional, List, Dict

from optimizer.zzz_models.agent import Agent
from optimizer.zzz_models.buff import Buff
from optimizer.zzz_models.enemy import Enemy
from optimizer.zzz_models.damage import AnomalyType
from optimizer.zzz_models.property_collection import PropertyCollection
from optimizer.zzz_models.zone_collection import ZoneCollection
from optimizer.services.damage_calculator_service import (
    DamageCalculatorService, EnemyStats, SkillDamageParams,
    AnomalyEffect, ICE_SHATTER
)


class BattleService:
    """战场服务

    管理战斗场景，支持增量伤害计算。
    """

    def __init__(self):
        """初始化战场服务"""
        # 战斗实体
        self.front_agent: Optional[Agent] = None
        self.back_agents: List[Agent] = []
        self.enemy: Optional[Enemy] = None
        self.buffs: List[Buff] = []
        self.skills: List = []  # 技能列表
        self.context = None  # OptimizerContext，用于访问装备

        # 状态标记
        self.is_battle_started: bool = False
        self.is_battle_paused: bool = False

        # 流水线配置
        self._pipeline_config: List[Dict] = []

    # ==================== 设置/变更方法 ====================

    def set_front_agent(self, agent: Agent):
        """设置前台角色

        Args:
            agent: 前台角色
        """
        self.front_agent = agent

    def set_back_agents(self, agents: List[Agent]):
        """设置后台角色列表

        Args:
            agents: 后台角色列表
        """
        self.back_agents = agents

    def set_enemy(self, enemy: Enemy):
        """设置敌人

        Args:
            enemy: 敌人
        """
        self.enemy = enemy

    def add_buff(self, buff: Buff):
        """添加Buff

        Args:
            buff: Buff对象
        """
        self.buffs.append(buff)

    def remove_buff(self, buff_id: str):
        """删除指定ID的Buff

        Args:
            buff_id: Buff ID
        """
        self.buffs = [b for b in self.buffs if b.id != buff_id]

    def clear_buffs(self):
        """清空所有Buff"""
        self.buffs.clear()

    def set_skill(self, skill):
        """设置战斗技能

        Args:
            skill: AgentSkill技能对象
        """
        if skill not in self.skills:
            self.skills.append(skill)

    # ==================== 生命周期控制 ====================

    def start_battle(self):
        """开始战斗"""
        if self.is_battle_started:
            return  # 已经开始了

        if not self.front_agent:
            raise ValueError("请先设置前台角色")
        if not self.enemy:
            raise ValueError("请先设置敌人")

        # 配置流水线
        self.configure_pipeline()

        self.is_battle_started = True
        self.is_battle_paused = False

    def pause_battle(self):
        """暂停战斗（停止计算，保留状态）"""
        if self.is_battle_started:
            self.is_battle_paused = True

    def resume_battle(self):
        """继续战斗"""
        if self.is_battle_started and self.is_battle_paused:
            self.is_battle_paused = False

    def is_battle_active(self) -> bool:
        """查询战斗是否进行中

        Returns:
            True 表示战斗进行中（已开始且未暂停）
        """
        return self.is_battle_started and not self.is_battle_paused

    def reset_battle(self):
        """重置战斗状态（重新开始）"""
        self.is_battle_started = False
        self.is_battle_paused = False

    # ==================== 流水线配置与执行 ====================

    def configure_pipeline(self, config: Optional[List[Dict]] = None):
        """配置流水线步骤

        Args:
            config: 流水线配置列表，每个元素是一个字典，包含：
                - name: 步骤名称
                - func: 步骤函数
                - args: 函数参数（可选）
        """
        if config is None:
            # 默认流水线配置
            self._pipeline_config = [
                # 创建倍率集
                {'name': 'create_ratios', 'func': DamageCalculatorService.create_ratio_set_from_skill, 'args': ['skill']},
                # 基础信息
                {'name': 'base_damage', 'func': DamageCalculatorService.calculate_base_damage_zone, 'args': ['skill']},
                # 直伤乘区
                {'name': 'dmg_bonus', 'func': DamageCalculatorService.calculate_dmg_bonus_zone, 'args': []},
                {'name': 'crit', 'func': DamageCalculatorService.calculate_crit_zone, 'args': []},
                {'name': 'defense', 'func': DamageCalculatorService.calculate_defense_zone, 'args': []},
                {'name': 'resistance', 'func': DamageCalculatorService.calculate_resistance_zone, 'args': ['element']},
                {'name': 'damage_taken', 'func': DamageCalculatorService.calculate_damage_taken_zone, 'args': []},
                {'name': 'stun_vulnerability', 'func': DamageCalculatorService.calculate_stun_vulnerability_zone, 'args': []},
                {'name': 'penetration_dmg', 'func': DamageCalculatorService.calculate_penetration_dmg_zone, 'args': ['is_penetration']},
                {'name': 'distance_decay', 'func': DamageCalculatorService.calculate_distance_decay_zone, 'args': ['skill']},
            ]
        else:
            self._pipeline_config = config

    def execute_pipeline(
        self,
        skill: SkillDamageParams,
        anomaly_ratio: float = 0.0,
        anomaly_buildup: float = 0.0,
        anomaly_type: str = "ice",
        is_penetration: bool = False,
        decay_type: str = "default",
    ) -> ZoneCollection:
        """执行流水线

        Args:
            skill: 技能参数
            anomaly_ratio: 异常伤害倍率
            anomaly_buildup: 异常积蓄值
            anomaly_type: 异常类型
            is_penetration: 是否贯穿伤害
            decay_type: 距离衰减类型

        Returns:
            ZoneCollection 对象
        """
        if not self.is_battle_started:
            raise RuntimeError("请先调用 start_battle()")

        # 生成 Agent 和 Enemy 的战斗属性
        agent_stats = self.front_agent.get_combat_stats(buffs=self.buffs)
        enemy_stats = self.enemy.get_combat_stats()

        # 创建新的 ZoneCollection 并设置 combat_stats
        zones = ZoneCollection()
        zones.combat_stats = agent_stats

        # 执行流水线步骤
        for i, step in enumerate(self._pipeline_config):
            func = step['func']
            args = step.get('args', [])
            step_name = step['name']

            # 构建参数
            kwargs = {}
            for arg in args:
                if arg == 'skill':
                    kwargs['skill'] = skill
                elif arg == 'element':
                    kwargs['element'] = skill.element
                elif arg == 'is_penetration':
                    kwargs['is_penetration'] = is_penetration
                elif arg == 'decay_type':
                    kwargs['decay_type'] = decay_type

            # 调用函数
            if 'attacker' in func.__code__.co_varnames:
                kwargs['attacker'] = agent_stats
            if 'enemy' in func.__code__.co_varnames:
                kwargs['enemy'] = enemy_stats

            # 根据步骤名称处理不同类型的返回值
            if step_name == 'create_ratios':
                # 创建倍率集
                result = func(**kwargs)
                zones.ratios = result
            elif 'zones' in func.__code__.co_varnames:
                # 需要传入 zones 参数
                kwargs['zones'] = zones
                zones = func(**kwargs)
            else:
                # 其他步骤，直接调用函数
                result = func(**kwargs)
                if hasattr(zones, step_name):
                    setattr(zones, step_name, result)

        # 如果有异常伤害，执行异常流水线
        if anomaly_ratio > 0:
            # 异常乘区
            zones = DamageCalculatorService.calculate_anomaly_zones(
                agent_stats, enemy_stats, anomaly_type, anomaly_buildup, zones
            )

        return zones

    # ==================== 伤害计算 ====================

    def calculate_skill_damage(
        self,
        skill_damage_ratio: float,
        skill_element: str = 'physical',
        skill_anomaly_buildup: float = 0.0,
        skill_anomaly_ratio: float = 0.0,
        is_penetration: bool = False,
        anomaly_effect: Optional[AnomalyEffect] = None,
    ) -> dict:
        """计算技能伤害（直伤 + 异常伤害）

        使用流水线模式计算伤害。

        Args:
            skill_damage_ratio: 技能倍率
            skill_element: 技能元素类型
            skill_anomaly_buildup: 技能异常积蓄值
            skill_anomaly_ratio: 技能异常倍率（已废弃，请使用 anomaly_effect）
            is_penetration: 是否为贯穿伤害
            anomaly_effect: 异常效果对象（用于计算异常伤害）

        Returns:
            伤害结果字典（包含直伤、异常伤害和总伤害）
        """
        if not self.is_battle_started:
            raise RuntimeError("请先调用 start_battle()")
        if self.is_battle_paused:
            raise RuntimeError("战斗已暂停，请调用 resume_battle()")

        # 生成 Agent 和 Enemy 的战斗属性
        agent_stats = self.front_agent.get_combat_stats(buffs=self.buffs)
        enemy_stats = self.enemy.get_combat_stats()

        # 创建技能参数
        skill_params = SkillDamageParams(
            damage_ratio=skill_damage_ratio,
            element=skill_element,
            is_penetration=is_penetration,
            anomaly_buildup=skill_anomaly_buildup,
        )

        # 执行流水线
        zones = self.execute_pipeline(
            skill=skill_params,
            anomaly_ratio=skill_anomaly_ratio,
            anomaly_buildup=skill_anomaly_buildup,
            anomaly_type=skill_element,
            is_penetration=is_penetration,
        )

        # 调用直伤最终值计算窗口
        zones = DamageCalculatorService.calculate_direct_damage_values(
            zones=zones,
            attacker=agent_stats,
            skill=skill_params,
            crit_rate=agent_stats.crit_rate,
            crit_dmg=agent_stats.crit_dmg,
        )

        # 修改判断条件：如果有异常积蓄，就计算异常伤害
        if skill_anomaly_buildup > 0:
            anomaly_threshold = enemy_stats.get_anomaly_threshold(skill_element)
            anomaly_crit_rate = getattr(agent_stats, 'anomaly_crit_rate', 0.0)

            # 获取异常效果对象（如果未提供）
            if anomaly_effect is None:
                from optimizer.zzz_models.combat_stats import ICE_SHATTER, SHOCK, BURN, CORRUPTION, ASSAULT
                anomaly_effect_map = {
                    'ice': ICE_SHATTER,
                    'fire': BURN,
                    'electric': SHOCK,
                    'ether': CORRUPTION,
                    'physical': ASSAULT,
                }
                anomaly_effect = anomaly_effect_map.get(skill_element, ICE_SHATTER)

            # 先计算异常乘区（积蓄区、精通区等）
            zones = DamageCalculatorService.calculate_anomaly_zones(
                agent_stats, enemy_stats, skill_element, skill_anomaly_buildup, zones
            )

            # 计算触发期望（积蓄 / 阈值，最大1.0）
            trigger_expect = min(1.0, skill_anomaly_buildup / anomaly_threshold)

            # 获取异常倍率
            anomaly_prof_ratio = anomaly_effect.get_total_ratio()

            # 更新 zones.ratios 以便格式化输出
            zones.ratios.anom_prof_ratio = anomaly_prof_ratio
            zones.ratios.anom_atk_ratio = agent_stats.anomaly_atk_ratio_mult

            # 1. 计算异常直伤（由异常反应触发的直伤，如星见雅1500%）
            if agent_stats.anomaly_atk_ratio_mult > 0:
                zones = DamageCalculatorService.calculate_anomaly_attack_damage_values(
                    zones=zones,
                    anomaly_atk_ratio=agent_stats.anomaly_atk_ratio_mult,
                    trigger_expect=trigger_expect,
                )

            # 2. 计算异常精通伤害（真正的异常伤害）
            if anomaly_prof_ratio > 0:
                zones = DamageCalculatorService.calculate_anomaly_proficiency_damage_values(
                    zones=zones,
                    anomaly_prof_ratio=anomaly_prof_ratio,
                    trigger_expect=trigger_expect,
                )

            # 3. 计算紊乱伤害
            disorder_ratio = DamageCalculatorService.calculate_disorder_ratio(
                anomaly_effect.anomaly_type, anomaly_effect.duration
            )
            if disorder_ratio > 0:
                zones = DamageCalculatorService.calculate_disorder_damage_values(
                    zones=zones,
                    disorder_ratio=disorder_ratio,
                    trigger_expect=trigger_expect,
                )

        # 调用总伤害最终值计算窗口
        zones = DamageCalculatorService.calculate_total_damage_values(zones=zones)

        # 构建返回字典，直接从 ZoneCollection 提取数据
        return_dict = {
            'normal_damage_no_crit': zones.direct_damage_no_crit,
            'normal_damage_crit': zones.direct_damage_crit,
            'normal_damage_expected': zones.direct_damage_expected,
            'anomaly_damage_no_crit': zones.anomaly_prof_damage_no_crit,
            'anomaly_damage_crit': zones.anomaly_prof_damage_crit,
            'anomaly_damage_expected': zones.anomaly_prof_damage_expected,
            'total_damage_expected': zones.total_damage_expected,
            'zones': zones,
        }

        # 添加兼容字段（用于 test_battle_verify.py）
        return_dict['atk_zone'] = zones.atk_zone
        return_dict['ratio_zone'] = skill_damage_ratio
        return_dict['dmg_bonus'] = zones.dmg_bonus
        return_dict['crit_zone'] = zones.crit_zone
        return_dict['def_mult'] = zones.def_mult
        return_dict['res_mult'] = zones.res_mult
        return_dict['dmg_taken_mult'] = zones.dmg_taken_mult
        return_dict['stun_vuln_mult'] = zones.stun_vuln_mult

        return return_dict

    def get_status(self) -> dict:
        """获取当前战斗状态

        Returns:
            状态字典
        """
        return {
            'is_battle_started': self.is_battle_started,
            'is_battle_paused': self.is_battle_paused,
            'has_agent': self.front_agent is not None,
            'has_enemy': self.enemy is not None,
            'buff_count': len(self.buffs),
            'back_agent_count': len(self.back_agents),
        }

    def format(self, context=None, indent: int = 0) -> str:
        """格式化输出战场服务信息（只输出有意义的值）

        Args:
            context: 优化器上下文，用于访问装备对象
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 战斗状态
        lines.append(f"{prefix}【战场服务】")
        if self.is_battle_started:
            if self.is_battle_paused:
                status = "已暂停"
            else:
                status = "进行中"
        else:
            status = "未开始"
        lines.append(f"  {prefix}状态: {status}")

        # 前台角色（只输出基本信息）
        if self.front_agent:
            lines.append(f"{prefix}【前台角色】")
            lines.append(f"  {prefix}{self.front_agent.name_cn} Lv.{self.front_agent.level} (M{self.front_agent.cinema})")

        # 后台角色
        if self.back_agents:
            lines.append(f"{prefix}【后台角色】({len(self.back_agents)}个)")
            for i, agent in enumerate(self.back_agents, 1):
                lines.append(f"  {prefix}{i}. {agent.name_cn} Lv.{agent.level}")

        # 敌人
        if self.enemy:
            enemy_stats = self.enemy.get_combat_stats()
            data_loader = context.data_loader if context else None
            lines.append(self.enemy.format(level=enemy_stats.level, indent=indent, data_loader=data_loader))

        # 技能列表
        if self.skills:
            lines.append(f"{prefix}【使用技能】({len(self.skills)}个)")
            for skill in self.skills:
                lines.append(skill.format(indent=indent+2))

        # Buff列表
        if self.buffs:
            lines.append(f"{prefix}【Buff】({len(self.buffs)}个)")
            for buff in self.buffs:
                lines.append(buff.format(indent=indent+2))

        return "\n".join(lines)