"""
邦布模型（基于CSV数据）

数据来源：
- assets/inventory_data/csv/邦布属性.csv
- assets/inventory_data/csv/邦布技能.csv
"""
from typing import Optional
from dataclasses import dataclass


@dataclass
class BangbooSkill:
    """邦布技能数据

    对应CSV中的一行数据
    """
    bangboo_name: str                   # 邦布名称
    skill_name: str                     # 技能名称

    # 伤害相关
    damage_ratio: float                 # 伤害倍率（基础值）
    damage_ratio_growth: float          # 伤害倍率成长

    # 失衡相关
    stun_ratio: float                   # 失衡倍率（基础值）
    stun_ratio_growth: float            # 失衡倍率成长

    # 异常相关
    anomaly_buildup: float              # 异常积蓄

    def get_damage_ratio_at_level(self, level: int) -> float:
        """获取指定等级的伤害倍率

        Args:
            level: 邦布等级 (1-60)

        Returns:
            伤害倍率（小数形式）
        """
        return self.damage_ratio + self.damage_ratio_growth * (level - 1)

    def get_stun_ratio_at_level(self, level: int) -> float:
        """获取指定等级的失衡倍率

        Args:
            level: 邦布等级 (1-60)

        Returns:
            失衡倍率（小数形式）
        """
        return self.stun_ratio + self.stun_ratio_growth * (level - 1)

    @classmethod
    def from_csv_row(cls, row: dict) -> 'BangbooSkill':
        """从CSV行数据创建对象

        Args:
            row: CSV行数据字典

        Returns:
            BangbooSkill对象
        """
        def safe_float(value, default=0.0) -> float:
            """安全地转换为浮点数"""
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        return cls(
            bangboo_name=row.get('名称', ''),
            skill_name=row.get('技能', ''),
            damage_ratio=safe_float(row.get('伤害倍率', 0)),
            damage_ratio_growth=safe_float(row.get('伤害倍率成长', 0)),
            stun_ratio=safe_float(row.get('失衡倍率', 0)),
            stun_ratio_growth=safe_float(row.get('失衡倍率成长', 0)),
            anomaly_buildup=safe_float(row.get('异常积蓄', 0)),
        )


@dataclass
class BangbooStats:
    """邦布基础属性

    对应CSV中的一行数据
    """
    name_cn: str                        # 中文名称
    id: str                             # ID

    # 基础属性
    base_hp: float                      # 基础生命值
    hp_growth: float                    # 生命值每级成长

    base_atk: float                     # 基础攻击力
    atk_growth: float                   # 攻击力每级成长

    impact: float                       # 冲击力
    anomaly_mastery: float              # 异常掌控

    base_def: float                     # 基础防御力
    def_growth: float                   # 防御力每级成长

    crit_rate: float                    # 暴击率
    crit_dmg: float                     # 暴击伤害

    # 突破加成
    breakthrough_hp_bonus: float        # 突破生命值加成
    breakthrough_atk_bonus: float       # 突破攻击力加成
    breakthrough_def_bonus: float       # 突破防御力加成

    # 60级属性
    level_60_hp: float                  # 60级生命值
    level_60_atk: float                 # 60级攻击力
    level_60_def: float                 # 60级防御力
    level_60_crit_rate: float           # 60级暴击率
    level_60_crit_dmg: float            # 60级暴击伤害

    def get_hp_at_level(self, level: int, breakthrough: int = 0) -> float:
        """获取指定等级的生命值

        Args:
            level: 等级 (1-60)
            breakthrough: 突破等级 (0-5)

        Returns:
            生命值
        """
        return self.base_hp + self.hp_growth * (level - 1) + self.breakthrough_hp_bonus * breakthrough

    def get_atk_at_level(self, level: int, breakthrough: int = 0) -> float:
        """获取指定等级的攻击力

        Args:
            level: 等级 (1-60)
            breakthrough: 突破等级 (0-5)

        Returns:
            攻击力
        """
        return self.base_atk + self.atk_growth * (level - 1) + self.breakthrough_atk_bonus * breakthrough

    def get_def_at_level(self, level: int, breakthrough: int = 0) -> float:
        """获取指定等级的防御力

        Args:
            level: 等级 (1-60)
            breakthrough: 突破等级 (0-5)

        Returns:
            防御力
        """
        return self.base_def + self.def_growth * (level - 1) + self.breakthrough_def_bonus * breakthrough

    @classmethod
    def from_csv_row(cls, row: dict) -> 'BangbooStats':
        """从CSV行数据创建对象

        Args:
            row: CSV行数据字典

        Returns:
            BangbooStats对象
        """
        def safe_float(value, default=0.0) -> float:
            """安全地转换为浮点数"""
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        return cls(
            name_cn=row.get('中文名称', ''),
            id=row.get('ID', ''),
            base_hp=safe_float(row.get('生命值', 0)),
            hp_growth=safe_float(row.get('生命值每级成长', 0)),
            base_atk=safe_float(row.get('攻击力', 0)),
            atk_growth=safe_float(row.get('攻击力每级成长', 0)),
            impact=safe_float(row.get('冲击力', 0)),
            anomaly_mastery=safe_float(row.get('异常掌控', 0)),
            base_def=safe_float(row.get('防御力', 0)),
            def_growth=safe_float(row.get('防御力每级成长', 0)),
            crit_rate=safe_float(row.get('暴击率', 0)),
            crit_dmg=safe_float(row.get('暴击伤害', 0)),
            breakthrough_hp_bonus=safe_float(row.get('突破生命值加成', 0)),
            breakthrough_atk_bonus=safe_float(row.get('突破攻击力加成', 0)),
            breakthrough_def_bonus=safe_float(row.get('突破防御力加成', 0)),
            level_60_hp=safe_float(row.get('60级生命值', 0)),
            level_60_atk=safe_float(row.get('60级攻击力', 0)),
            level_60_def=safe_float(row.get('60级防御力', 0)),
            level_60_crit_rate=safe_float(row.get('60级暴击率', 0)),
            level_60_crit_dmg=safe_float(row.get('60级暴击伤害', 0)),
        )


@dataclass
class Bangboo:
    """邦布模型

    完整的邦布数据，包含属性和技能
    """
    name_cn: str                        # 中文名称
    id: str                             # ID
    level: int                          # 等级 (1-60)
    breakthrough: int                   # 突破等级 (0-5)

    # 基础属性数据
    stats: Optional[BangbooStats] = None

    # 技能数据
    skills: list[BangbooSkill] = None

    def __post_init__(self):
        """初始化后处理"""
        if self.skills is None:
            self.skills = []

    @property
    def current_hp(self) -> float:
        """获取当前生命值"""
        if not self.stats:
            return 0.0
        return self.stats.get_hp_at_level(self.level, self.breakthrough)

    @property
    def current_atk(self) -> float:
        """获取当前攻击力"""
        if not self.stats:
            return 0.0
        return self.stats.get_atk_at_level(self.level, self.breakthrough)

    @property
    def current_def(self) -> float:
        """获取当前防御力"""
        if not self.stats:
            return 0.0
        return self.stats.get_def_at_level(self.level, self.breakthrough)

    @property
    def current_impact(self) -> float:
        """获取当前冲击力"""
        if not self.stats:
            return 0.0
        return self.stats.impact

    @property
    def current_anomaly_mastery(self) -> float:
        """获取当前异常掌控"""
        if not self.stats:
            return 0.0
        return self.stats.anomaly_mastery

    @property
    def current_crit_rate(self) -> float:
        """获取当前暴击率"""
        if not self.stats:
            return 0.0
        return self.stats.crit_rate

    @property
    def current_crit_dmg(self) -> float:
        """获取当前暴击伤害"""
        if not self.stats:
            return 0.0
        return self.stats.crit_dmg

    @property
    def is_max_level(self) -> bool:
        """是否满级"""
        return self.level >= 60 and self.breakthrough >= 5

    def get_skill(self, skill_name: str) -> Optional[BangbooSkill]:
        """获取指定技能

        Args:
            skill_name: 技能名称

        Returns:
            技能对象，如果不存在返回None
        """
        for skill in self.skills:
            if skill.skill_name == skill_name:
                return skill
        return None
