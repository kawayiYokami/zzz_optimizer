"""
敌人模型（基于CSV数据）

数据来源：assets/inventory_data/csv/敌人属性.csv
"""
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class Enemy:
    """敌人模型

    对应CSV中的一行数据
    """
    # 基础信息
    full_name: str                      # 完整名称
    index_id: str                       # IndexID
    code_name: str                      # CodeName
    full_name_en: str                   # FullName（英文）
    id: str                             # ID

    # 基础属性
    hp: float                           # 生命值
    atk: float                          # 攻击力
    defense: float                      # 防御力
    crit_dmg: float                     # 暴击伤害

    # 失衡相关
    stun_max: float                     # 失衡值上限
    can_stun: bool                      # 能否失衡
    stun_auto_recovery: float           # 失衡值自动回复
    stun_auto_recovery_time_limit: float  # 失衡值自动回复时限
    base_stun_recovery_speed: float     # 基础失衡恢复速度
    default_stun_recovery_time: float   # 默认失衡恢复时间
    stun_vulnerability_multiplier: float  # 失衡易伤倍率

    # 连携相关
    chain_attack_count: int             # 可连携次数
    initial_interrupt_resistance: int   # 初始抗打断等级

    # 抗性
    freeze_time_resistance: float       # 冻结时间抵抗
    ice_dmg_resistance: float           # 冰伤害抗性
    fire_dmg_resistance: float          # 火伤害抗性
    electric_dmg_resistance: float      # 电伤害抗性
    physical_dmg_resistance: float      # 物理伤害抗性
    ether_dmg_resistance: float         # 以太伤害抗性

    # 异常抗性
    ice_anomaly_resistance: float       # 冰异常抗性
    fire_anomaly_resistance: float      # 火异常抗性
    electric_anomaly_resistance: float  # 电异常抗性
    physical_anomaly_resistance: float  # 物理异常抗性
    ether_anomaly_resistance: float     # 以太异常抗性

    # 失衡抗性
    ice_stun_resistance: float          # 冰失衡抗性
    fire_stun_resistance: float         # 火失衡抗性
    electric_stun_resistance: float     # 电失衡抗性
    physical_stun_resistance: float     # 物理失衡抗性
    ether_stun_resistance: float        # 以太失衡抗性

    # 异常条ID
    ice_anomaly_bar_id: str             # 冰异常条
    fire_anomaly_bar_id: str            # 火异常条
    electric_anomaly_bar_id: str        # 电异常条
    physical_anomaly_bar_id: str        # 物理异常条
    ether_anomaly_bar_id: str           # 以太异常条

    # 其他
    base_buildup_limit_multiplier: float  # 基础积蓄上限提升系数
    energy_orb_drop: str = ""           # 能量球掉落
    unknown_variable: float = 0.0       # 未知变量（1.7版本新增）
    tags: str = ""                      # 标签列表

    # 70级属性
    level_70_max_hp: float = 0.0        # 70级最大生命值
    level_70_max_atk: float = 0.0       # 70级最大攻击力
    level_70_max_stun: float = 0.0      # 70级最大失衡值上限
    level_60_plus_defense: float = 0.0  # 60级及以上防御力

    @classmethod
    def from_csv_row(cls, row: dict) -> 'Enemy':
        """从CSV行数据创建对象

        Args:
            row: CSV行数据字典

        Returns:
            Enemy对象
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

        # 处理布尔值
        can_stun = row.get('能否失衡', 'True')
        if isinstance(can_stun, str):
            can_stun = can_stun.lower() == 'true'

        return cls(
            full_name=row.get('完整名称', ''),
            index_id=row.get('IndexID', ''),
            code_name=row.get('CodeName', ''),
            full_name_en=row.get('FullName', ''),
            id=row.get('ID', ''),
            hp=safe_float(row.get('生命值', 0)),
            atk=safe_float(row.get('攻击力', 0)),
            defense=safe_float(row.get('防御力', 0)),
            crit_dmg=safe_float(row.get('暴击伤害', 0)),
            stun_max=safe_float(row.get('失衡值上限', 0)),
            can_stun=can_stun,
            stun_auto_recovery=safe_float(row.get('失衡值自动回复', 0)),
            stun_auto_recovery_time_limit=safe_float(row.get('失衡值自动回复时限', 0)),
            base_stun_recovery_speed=safe_float(row.get('基础失衡恢复速度', 0)),
            default_stun_recovery_time=safe_float(row.get('默认失衡恢复时间', 0)),
            stun_vulnerability_multiplier=safe_float(row.get('失衡易伤倍率', 0)),
            chain_attack_count=safe_int(row.get('可连携次数', 0)),
            initial_interrupt_resistance=safe_int(row.get('初始抗打断等级', 0)),
            freeze_time_resistance=safe_float(row.get('冻结时间抵抗', 0)),
            ice_dmg_resistance=safe_float(row.get('冰伤害抗性', 0)),
            fire_dmg_resistance=safe_float(row.get('火伤害抗性', 0)),
            electric_dmg_resistance=safe_float(row.get('电伤害抗性', 0)),
            physical_dmg_resistance=safe_float(row.get('物理伤害抗性', 0)),
            ether_dmg_resistance=safe_float(row.get('以太伤害抗性', 0)),
            ice_anomaly_resistance=safe_float(row.get('冰异常抗性', 0)),
            fire_anomaly_resistance=safe_float(row.get('火异常抗性', 0)),
            electric_anomaly_resistance=safe_float(row.get('电异常抗性', 0)),
            physical_anomaly_resistance=safe_float(row.get('物理异常抗性', 0)),
            ether_anomaly_resistance=safe_float(row.get('以太异常抗性', 0)),
            ice_stun_resistance=safe_float(row.get('冰失衡抗性', 0)),
            fire_stun_resistance=safe_float(row.get('火失衡抗性', 0)),
            electric_stun_resistance=safe_float(row.get('电失衡抗性', 0)),
            physical_stun_resistance=safe_float(row.get('物理失衡抗性', 0)),
            ether_stun_resistance=safe_float(row.get('以太失衡抗性', 0)),
            ice_anomaly_bar_id=row.get('冰异常条', ''),
            fire_anomaly_bar_id=row.get('火异常条', ''),
            electric_anomaly_bar_id=row.get('电异常条', ''),
            physical_anomaly_bar_id=row.get('物理异常条', ''),
            ether_anomaly_bar_id=row.get('以太异常条', ''),
            base_buildup_limit_multiplier=safe_float(row.get('基础积蓄上限提升系数', 0)),
            energy_orb_drop=row.get('能量球掉落', ''),
            unknown_variable=safe_float(row.get('未知变量（1.7版本新增）', 0)),
            tags=row.get('标签列表', ''),
            level_70_max_hp=safe_float(row.get('70级最大生命值', 0)),
            level_70_max_atk=safe_float(row.get('70级最大攻击力', 0)),
            level_70_max_stun=safe_float(row.get('70级最大失衡值上限', 0)),
            level_60_plus_defense=safe_float(row.get('60级及以上防御力', 0)),
        )

    def get_dmg_resistance(self, element: str) -> float:
        """获取指定元素的伤害抗性

        Args:
            element: 元素类型（"ice", "fire", "electric", "physical", "ether"）

        Returns:
            伤害抗性值
        """
        resistance_map = {
            'ice': self.ice_dmg_resistance,
            'fire': self.fire_dmg_resistance,
            'electric': self.electric_dmg_resistance,
            'physical': self.physical_dmg_resistance,
            'ether': self.ether_dmg_resistance,
        }
        return resistance_map.get(element.lower(), 0.0)

    def get_anomaly_resistance(self, element: str) -> float:
        """获取指定元素的异常抗性

        Args:
            element: 元素类型（"ice", "fire", "electric", "physical", "ether"）

        Returns:
            异常抗性值
        """
        resistance_map = {
            'ice': self.ice_anomaly_resistance,
            'fire': self.fire_anomaly_resistance,
            'electric': self.electric_anomaly_resistance,
            'physical': self.physical_anomaly_resistance,
            'ether': self.ether_anomaly_resistance,
        }
        return resistance_map.get(element.lower(), 0.0)

    def get_stun_resistance(self, element: str) -> float:
        """获取指定元素的失衡抗性

        Args:
            element: 元素类型（"ice", "fire", "electric", "physical", "ether"）

        Returns:
            失衡抗性值
        """
        resistance_map = {
            'ice': self.ice_stun_resistance,
            'fire': self.fire_stun_resistance,
            'electric': self.electric_stun_resistance,
            'physical': self.physical_stun_resistance,
            'ether': self.ether_stun_resistance,
        }
        return resistance_map.get(element.lower(), 0.0)

    def get_anomaly_bar_id(self, element: str) -> str:
        """获取指定元素的异常条ID

        Args:
            element: 元素类型（"ice", "fire", "electric", "physical", "ether"）

        Returns:
            异常条ID
        """
        bar_id_map = {
            'ice': self.ice_anomaly_bar_id,
            'fire': self.fire_anomaly_bar_id,
            'electric': self.electric_anomaly_bar_id,
            'physical': self.physical_anomaly_bar_id,
            'ether': self.ether_anomaly_bar_id,
        }
        return bar_id_map.get(element.lower(), '')

    @property
    def is_boss(self) -> bool:
        """是否为首领"""
        return '首领' in self.tags or 'boss' in self.tags.lower()

    @property
    def is_elite(self) -> bool:
        """是否为精英"""
        return '精英' in self.tags or 'elite' in self.tags.lower()

    @property
    def size_category(self) -> str:
        """体型分类"""
        if '大体型' in self.tags:
            return '大体型'
        elif '中体型' in self.tags:
            return '中体型'
        elif '小体型' in self.tags:
            return '小体型'
        return '未知'

    def get_combat_stats(self, level: int = 60, is_stunned: bool = False) -> 'EnemyStats':
        """获取敌人战斗属性（与 Agent.get_combat_stats() 对应）

        Args:
            level: 等级（默认60）
            is_stunned: 是否已失衡（用于计算失衡易伤）

        Returns:
            EnemyStats 对象
        """
        from optimizer.services.damage.data.enemy_stats import EnemyStats

        return EnemyStats(
            hp=self.hp,
            defense=self.defense,
            level=level,
            stun_max=self.stun_max,
            can_stun=self.can_stun,
            stun_vulnerability=self.stun_vulnerability_multiplier,
            is_stunned=is_stunned,
            element_resistances={
                'ice': self.ice_dmg_resistance,
                'fire': self.fire_dmg_resistance,
                'electric': self.electric_dmg_resistance,
                'physical': self.physical_dmg_resistance,
                'ether': self.ether_dmg_resistance,
            },
            anomaly_thresholds={
                'ice': 600.0,   # 冰异常条基础阈值
                'fire': 600.0,  # 火异常条基础阈值
                'electric': 600.0,  # 电异常条基础阈值
                'physical': 720.0,  # 物理异常条基础阈值
                'ether': 600.0,  # 以太异常条基础阈值
            },
        )

    def format(self, level: int = 60, indent: int = 0, data_loader=None) -> str:
        """格式化输出敌人信息（只输出有意义的值）

        Args:
            level: 等级（用于显示）
            indent: 缩进空格数
            data_loader: DataLoaderService（可选，用于查询异常条详细数据）

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 基础信息
        lines.append(f"{prefix}【敌人信息】")
        lines.append(f"  {prefix}名称: {self.full_name}")
        if self.code_name:
            lines.append(f"  {prefix}代号: {self.code_name}")
        lines.append(f"  {prefix}等级: Lv.{level}")

        # 标签信息
        if self.tags:
            tag_list = []
            if self.is_boss:
                tag_list.append("首领")
            elif self.is_elite:
                tag_list.append("精英")
            if self.size_category != "未知":
                tag_list.append(self.size_category)
            if tag_list:
                lines.append(f"  {prefix}标签: {', '.join(tag_list)}")

        # 基础属性
        lines.append(f"{prefix}【基础属性】")
        lines.append(f"  {prefix}生命值: {self.hp:.0f}")
        lines.append(f"  {prefix}攻击力: {self.atk:.0f}")
        lines.append(f"  {prefix}防御力: {self.defense:.0f}")
        if self.crit_dmg > 0:
            lines.append(f"  {prefix}暴击伤害: {self.crit_dmg*100:.1f}%")

        # 失衡属性
        if self.can_stun:
            lines.append(f"{prefix}【失衡属性】")
            lines.append(f"  {prefix}失衡值上限: {self.stun_max:.0f}")
            if self.stun_vulnerability_multiplier > 0:
                lines.append(f"  {prefix}失衡易伤倍率: {self.stun_vulnerability_multiplier*100:.1f}%")
            if self.stun_auto_recovery > 0:
                lines.append(f"  {prefix}失衡值自动回复: {self.stun_auto_recovery:.1f}")
        else:
            lines.append(f"{prefix}【失衡属性】")
            lines.append(f"  {prefix}无法失衡")

        # 伤害抗性
        dmg_resistances = []
        if self.ice_dmg_resistance != 0:
            dmg_resistances.append(("冰", self.ice_dmg_resistance))
        if self.fire_dmg_resistance != 0:
            dmg_resistances.append(("火", self.fire_dmg_resistance))
        if self.electric_dmg_resistance != 0:
            dmg_resistances.append(("电", self.electric_dmg_resistance))
        if self.physical_dmg_resistance != 0:
            dmg_resistances.append(("物理", self.physical_dmg_resistance))
        if self.ether_dmg_resistance != 0:
            dmg_resistances.append(("以太", self.ether_dmg_resistance))

        if dmg_resistances:
            lines.append(f"{prefix}【伤害抗性】")
            for element, resistance in dmg_resistances:
                sign = "+" if resistance >= 0 else ""
                lines.append(f"  {prefix}{element}: {sign}{resistance*100:.1f}%")

        # 异常抗性
        anomaly_resistances = []
        if self.ice_anomaly_resistance != 0:
            anomaly_resistances.append(("冰异常", self.ice_anomaly_resistance))
        if self.fire_anomaly_resistance != 0:
            anomaly_resistances.append(("火异常", self.fire_anomaly_resistance))
        if self.electric_anomaly_resistance != 0:
            anomaly_resistances.append(("电异常", self.electric_anomaly_resistance))
        if self.physical_anomaly_resistance != 0:
            anomaly_resistances.append(("物理异常", self.physical_anomaly_resistance))
        if self.ether_anomaly_resistance != 0:
            anomaly_resistances.append(("以太异常", self.ether_anomaly_resistance))

        if anomaly_resistances:
            lines.append(f"{prefix}【异常抗性】")
            for element, resistance in anomaly_resistances:
                sign = "+" if resistance >= 0 else ""
                lines.append(f"  {prefix}{element}: {sign}{resistance*100:.1f}%")

        # 失衡抗性
        stun_resistances = []
        if self.ice_stun_resistance != 0:
            stun_resistances.append(("冰失衡", self.ice_stun_resistance))
        if self.fire_stun_resistance != 0:
            stun_resistances.append(("火失衡", self.fire_stun_resistance))
        if self.electric_stun_resistance != 0:
            stun_resistances.append(("电失衡", self.electric_stun_resistance))
        if self.physical_stun_resistance != 0:
            stun_resistances.append(("物理失衡", self.physical_stun_resistance))
        if self.ether_stun_resistance != 0:
            stun_resistances.append(("以太失衡", self.ether_stun_resistance))

        if stun_resistances:
            lines.append(f"{prefix}【失衡抗性】")
            for element, resistance in stun_resistances:
                sign = "+" if resistance >= 0 else ""
                lines.append(f"  {prefix}{element}: {sign}{resistance*100:.1f}%")

        # 异常条信息
        if data_loader and hasattr(data_loader, 'anomaly_bars'):
            anomaly_bar_info = []

            # 收集所有元素的异常条
            element_mapping = [
                ('冰', self.ice_anomaly_bar_id),
                ('火', self.fire_anomaly_bar_id),
                ('电', self.electric_anomaly_bar_id),
                ('物理', self.physical_anomaly_bar_id),
                ('以太', self.ether_anomaly_bar_id),
            ]

            for element_name, bar_id in element_mapping:
                if bar_id and data_loader.anomaly_bars:
                    anomaly_bar = data_loader.anomaly_bars.get(bar_id)
                    if anomaly_bar:
                        # 第1次和第10次的积蓄需求
                        req_1 = anomaly_bar.buildup_requirement_1
                        req_10 = anomaly_bar.buildup_requirement_10
                        anomaly_bar_info.append((
                            element_name,
                            anomaly_bar.note,
                            req_1,
                            req_10,
                            anomaly_bar.anomaly_cd
                        ))

            if anomaly_bar_info:
                lines.append(f"{prefix}【异常条】")
                for element, note, req_1, req_10, cd in anomaly_bar_info:
                    lines.append(f"  {prefix}{element}: {note}")
                    lines.append(f"    {prefix}积蓄需求: {req_1:.0f} → {req_10:.0f} (第1次→第10次)")
                    if cd > 0:
                        lines.append(f"    {prefix}异常CD: {cd:.1f}秒")

        return "\n".join(lines)
