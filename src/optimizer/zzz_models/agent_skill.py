"""
代理人技能模型（基于CSV数据）

数据来源：assets/inventory_data/csv/代理人技能数据.csv
"""
from typing import Optional
from dataclasses import dataclass


@dataclass
class AgentSkillSegment:
    """代理人技能段数据

    对应CSV中的一行数据，表示一个技能的一段（如普通攻击的一段、二段等）
    """
    agent_name: str                     # 代理人名称
    skill_name: str                     # 技能名称
    segment_name: str                   # 段名称（如"一段"、"二段"、空字符串表示单段技能）

    # 伤害相关
    damage_ratio: float                 # 伤害倍率（基础值）
    damage_ratio_growth: float          # 伤害倍率成长

    # 失衡相关
    stun_ratio: float                   # 失衡倍率（基础值）
    stun_ratio_growth: float            # 失衡倍率成长

    # 能量相关
    energy_recovery: float              # 能量回复

    # 异常相关
    anomaly_buildup: float              # 异常积蓄

    # 喧响值相关
    decibel_recovery: float             # 喧响值回复

    # 其他
    flash_energy_accumulation: float    # 闪能累积
    corruption_shield_reduction: float  # 秽盾削减值

    # 技能类型
    skill_type: int                     # 技能类型（0=普通攻击, 1=特殊技, 2=其他）
    attack_type: int                    # 攻击类型（0=普通, 1=特殊技, 2=冲刺, 3=闪避, 4=反击等）

    # 能量消耗
    energy_extra_cost: float            # 能量额外消耗

    # 特殊能量
    special_energy: str = ""            # 特殊能量（如"电能"等）

    # 距离衰减
    distance_decay: str = ""            # 距离衰减

    def get_damage_ratio_at_level(self, level: int) -> float:
        """获取指定等级的伤害倍率

        Args:
            level: 技能等级 (1-12)

        Returns:
            伤害倍率（小数形式，如0.312表示31.2%）
        """
        return self.damage_ratio + self.damage_ratio_growth * (level - 1)

    def get_stun_ratio_at_level(self, level: int) -> float:
        """获取指定等级的失衡倍率

        Args:
            level: 技能等级 (1-12)

        Returns:
            失衡倍率（小数形式）
        """
        return self.stun_ratio + self.stun_ratio_growth * (level - 1)

    def format(self, level: int = 1, indent: int = 0) -> str:
        """格式化输出技能段信息

        Args:
            level: 技能等级
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        if self.segment_name:
            lines.append(f"{prefix}【{self.segment_name}】")
        else:
            lines.append(f"{prefix}【单段】")

        damage_at_level = self.get_damage_ratio_at_level(level)
        lines.append(f"{prefix}  伤害倍率: {damage_at_level:.4f} ({damage_at_level*100:.1f}%)")

        if self.anomaly_buildup > 0:
            lines.append(f"{prefix}  异常积蓄: {self.anomaly_buildup:.2f}")

        if self.stun_ratio > 0:
            stun_at_level = self.get_stun_ratio_at_level(level)
            lines.append(f"{prefix}  失衡倍率: {stun_at_level:.4f}")

        return "\n".join(lines)

    @classmethod
    def from_csv_row(cls, row: dict) -> 'AgentSkillSegment':
        """从CSV行数据创建对象

        Args:
            row: CSV行数据字典

        Returns:
            AgentSkillSegment对象
        """
        def safe_float(value, default=0.0) -> float:
            """安全地转换为浮点数"""
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        def safe_int(value, default=0) -> int:
            """安全地转换为整数"""
            if value is None or value == '':
                return default
            try:
                return int(float(value))
            except (ValueError, TypeError):
                return default

        return cls(
            agent_name=row.get('代理人', ''),
            skill_name=row.get('技能', ''),
            segment_name=row.get('段', ''),
            damage_ratio=safe_float(row.get('伤害倍率', 0)),
            damage_ratio_growth=safe_float(row.get('伤害倍率成长', 0)),
            stun_ratio=safe_float(row.get('失衡倍率', 0)),
            stun_ratio_growth=safe_float(row.get('失衡倍率成长', 0)),
            energy_recovery=safe_float(row.get('能量回复', 0)),
            anomaly_buildup=safe_float(row.get('异常积蓄', 0)),
            decibel_recovery=safe_float(row.get('喧响值回复', 0)),
            flash_energy_accumulation=safe_float(row.get('闪能累积', 0)),
            corruption_shield_reduction=safe_float(row.get('秽盾削减值', 0)),
            skill_type=safe_int(row.get('技能类型', 0)),
            attack_type=safe_int(row.get('攻击类型', 0)),
            energy_extra_cost=safe_float(row.get('能量额外消耗', 0)),
            special_energy=row.get('特殊能量', ''),
            distance_decay=row.get('距离衰减', ''),
        )


@dataclass
class AgentSkill:
    """代理人技能

    一个完整的技能，可能包含多段（如普通攻击的一二三四段）
    """
    agent_name: str                     # 代理人名称
    skill_name: str                     # 技能名称
    segments: list[AgentSkillSegment]   # 技能段列表
    level: int = 1                      # 技能等级 (1-12)

    def get_total_damage_ratio(self, level: Optional[int] = None) -> float:
        """获取技能总伤害倍率（所有段之和）

        Args:
            level: 技能等级，如果为None则使用self.level

        Returns:
            总伤害倍率
        """
        if level is None:
            level = self.level

        total = 0.0
        for segment in self.segments:
            total += segment.get_damage_ratio_at_level(level)
        return total

    def get_total_stun_ratio(self, level: Optional[int] = None) -> float:
        """获取技能总失衡倍率（所有段之和）

        Args:
            level: 技能等级，如果为None则使用self.level

        Returns:
            总失衡倍率
        """
        if level is None:
            level = self.level

        total = 0.0
        for segment in self.segments:
            total += segment.get_stun_ratio_at_level(level)
        return total

    def get_total_energy_recovery(self) -> float:
        """获取技能总能量回复（所有段之和）

        Returns:
            总能量回复
        """
        return sum(segment.energy_recovery for segment in self.segments)

    def get_total_anomaly_buildup(self) -> float:
        """获取技能总异常积蓄（所有段之和）

        Returns:
            总异常积蓄
        """
        return sum(segment.anomaly_buildup for segment in self.segments)

    def format(self, indent: int = 0) -> str:
        """格式化输出技能信息

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        lines.append(f"{prefix}【{self.skill_name}】")
        lines.append(f"{prefix}  等级: Lv.{self.level}")

        # 总参数
        total_damage = self.get_total_damage_ratio()
        lines.append(f"{prefix}  总伤害倍率: {total_damage:.4f} ({total_damage*100:.1f}%)")

        total_anomaly = self.get_total_anomaly_buildup()
        if total_anomaly > 0:
            lines.append(f"{prefix}  总异常积蓄: {total_anomaly:.2f}")

        # 各段信息
        if len(self.segments) > 1:
            lines.append(f"{prefix}  技能段数: {len(self.segments)}")
            for segment in self.segments:
                lines.append(segment.format(level=self.level, indent=indent+2))

        return "\n".join(lines)


@dataclass
class AgentSkillSet:
    """代理人技能集

    包含一个代理人的所有技能
    """
    agent_name: str                     # 代理人名称
    skills: dict[str, AgentSkill]       # 技能字典 {技能名称: 技能对象}

    # 技能等级（按类型分类）
    normal_attack_level: int = 1        # 普通攻击等级
    special_skill_level: int = 1        # 特殊技等级
    dodge_counter_level: int = 1        # 闪避反击等级
    assist_level: int = 1               # 支援技等级
    chain_attack_level: int = 1         # 连携技等级

    def get_skill(self, skill_name: str) -> Optional[AgentSkill]:
        """获取指定技能

        Args:
            skill_name: 技能名称

        Returns:
            技能对象，如果不存在返回None
        """
        return self.skills.get(skill_name)

    def get_all_skills(self) -> list[AgentSkill]:
        """获取所有技能列表

        Returns:
            技能列表
        """
        return list(self.skills.values())
