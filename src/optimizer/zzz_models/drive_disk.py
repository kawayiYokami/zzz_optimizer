"""
驱动盘模型
"""
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum

from optimizer.zzz_models.base import Rarity, PropertyType, StatValue
from optimizer.zzz_models.buff import Buff, BuffSource, BuffContext
from optimizer.zzz_models.property_collection import PropertyCollection


class DriveDiskPosition(Enum):
    """驱动盘位置"""
    SLOT_1 = 1  # 1号位
    SLOT_2 = 2  # 2号位
    SLOT_3 = 3  # 3号位
    SLOT_4 = 4  # 4号位
    SLOT_5 = 5  # 5号位
    SLOT_6 = 6  # 6号位


class DriveDiskSetBonus(Enum):
    """驱动盘套装加成类型"""
    TWO_PIECE = 2   # 2件套效果
    FOUR_PIECE = 4  # 4件套效果


class DriveDiskStats:
    """驱动盘词条数值数据

    包含主词条和副词条的数值表，以及计算方法。
    数据来源：assets/inventory_data/docs/ZZZ_DISC_STATS.md
    """

    # 主词条满级数值表 {稀有度: {键名: 数值}}
    MAIN_STAT_MAX_VALUES = {
        'S': {
            'atk_': 0.30, 'hp_': 0.30, 'def_': 0.48,
            'crit_': 0.24, 'crit_dmg_': 0.48, 'pen_': 0.24,
            'atk': 316, 'hp': 2200, 'def': 184, 'anomProf': 92,
            'fire_dmg_': 0.30, 'ice_dmg_': 0.30, 'electric_dmg_': 0.30,
            'physical_dmg_': 0.30, 'ether_dmg_': 0.30,
            'anomMas_': 0.30, 'impact_': 0.18, 'enerRegen_': 0.60,
            # 别名（游戏数据中的键名）
            'energyRegen_': 0.60,  # 同 enerRegen_
            'impact': 100,  # 冲击力固定值（估算值，类似于 anomProf）
        },
        'A': {
            'atk_': 0.20, 'hp_': 0.20, 'def_': 0.32,
            'crit_': 0.16, 'crit_dmg_': 0.32, 'pen_': 0.16,
            'atk': 212, 'hp': 1468, 'def': 124, 'anomProf': 60,
            'fire_dmg_': 0.20, 'ice_dmg_': 0.20, 'electric_dmg_': 0.20,
            'physical_dmg_': 0.20, 'ether_dmg_': 0.20,
            'anomMas_': 0.20, 'impact_': 0.12, 'enerRegen_': 0.40,
            # 别名
            'energyRegen_': 0.40,
            'impact': 66,
        },
        'B': {
            'atk_': 0.10, 'hp_': 0.10, 'def_': 0.16,
            'crit_': 0.08, 'crit_dmg_': 0.16, 'pen_': 0.08,
            'atk': 104, 'hp': 734, 'def': 60, 'anomProf': 32,
            'fire_dmg_': 0.10, 'ice_dmg_': 0.10, 'electric_dmg_': 0.10,
            'physical_dmg_': 0.10, 'ether_dmg_': 0.10,
            'anomMas_': 0.10, 'impact_': 0.06, 'enerRegen_': 0.20,
            # 别名
            'energyRegen_': 0.20,
            'impact': 33,
        }
    }

    # 副词条基础数值表（每次强化）{稀有度: {键名: 数值}}
    SUB_STAT_BASE_VALUES = {
        'S': {
            'atk': 19, 'hp': 112, 'def': 15, 'pen': 9, 'anomProf': 9,
            'atk_': 0.03, 'hp_': 0.03, 'def_': 0.048,
            'crit_': 0.024, 'crit_dmg_': 0.048
        },
        'A': {
            'atk': 15, 'hp': 79, 'def': 10, 'pen': 6, 'anomProf': 6,
            'atk_': 0.02, 'hp_': 0.02, 'def_': 0.032,
            'crit_': 0.016, 'crit_dmg_': 0.032
        },
        'B': {
            'atk': 7, 'hp': 39, 'def': 5, 'pen': 3, 'anomProf': 3,
            'atk_': 0.01, 'hp_': 0.01, 'def_': 0.016,
            'crit_': 0.008, 'crit_dmg_': 0.016
        }
    }

    # 最大等级
    MAX_LEVELS = {'S': 15, 'A': 12, 'B': 9}

    # 槽位主词条限制
    SLOT_MAIN_STATS = {
        1: ['hp'],
        2: ['atk'],
        3: ['def'],
        4: ['hp_', 'atk_', 'def_', 'crit_', 'crit_dmg_', 'anomProf'],
        5: ['hp_', 'atk_', 'def_', 'pen_', 'fire_dmg_', 'ice_dmg_',
            'electric_dmg_', 'physical_dmg_', 'ether_dmg_'],
        6: ['hp_', 'atk_', 'def_', 'anomMas_', 'impact_', 'enerRegen_',
            # 别名（游戏数据中的键名）
            'energyRegen_', 'impact']
    }

    # 可用副词条
    AVAILABLE_SUB_STATS = ['hp', 'atk', 'def', 'pen', 'anomProf',
                           'hp_', 'atk_', 'def_', 'crit_', 'crit_dmg_']

    @staticmethod
    def calculate_main_stat_value(rarity_str: str, stat_key: str, level: int) -> float:
        """计算主词条当前等级数值

        公式: maxVal * (0.25 + 0.75 * level / maxLevel)

        Args:
            rarity_str: 稀有度字符串 ('S', 'A', 'B')
            stat_key: 属性键名 (如 'atk_', 'hp', 'crit_')
            level: 当前等级

        Returns:
            计算后的数值
        """
        max_val = DriveDiskStats.MAIN_STAT_MAX_VALUES[rarity_str][stat_key]
        max_level = DriveDiskStats.MAX_LEVELS[rarity_str]
        return max_val * (0.25 + (0.75 * level) / max_level)

    @staticmethod
    def calculate_sub_stat_value(rarity_str: str, stat_key: str, rolls: int) -> float:
        """计算副词条数值

        公式: baseVal * rolls

        Args:
            rarity_str: 稀有度字符串 ('S', 'A', 'B')
            stat_key: 属性键名 (如 'atk', 'crit_')
            rolls: 强化次数

        Returns:
            计算后的数值
        """
        base_val = DriveDiskStats.SUB_STAT_BASE_VALUES[rarity_str][stat_key]
        return base_val * rolls

    @staticmethod
    def is_valid_main_stat(slot: int, stat_key: str) -> bool:
        """验证主词条是否合法

        Args:
            slot: 槽位 (1-6)
            stat_key: 属性键名

        Returns:
            是否合法
        """
        return stat_key in DriveDiskStats.SLOT_MAIN_STATS.get(slot, [])

    @staticmethod
    def is_valid_sub_stat(main_stat_key: str, sub_stat_key: str) -> bool:
        """验证副词条是否合法（不能与主词条重复）

        Args:
            main_stat_key: 主词条键名
            sub_stat_key: 副词条键名

        Returns:
            是否合法
        """
        return (sub_stat_key in DriveDiskStats.AVAILABLE_SUB_STATS and
                sub_stat_key != main_stat_key)


@dataclass
class DriveDiskSet:
    """
    驱动盘套装定义

    套装效果：
    - 2件套：局内效果（战斗中生效）
    - 4件套：局外效果（面板显示）
    """
    set_id: str                 # 套装ID（英文名）
    name: str                   # 套装名称（英文）
    name_cn: str                # 套装名称（中文）

    # 套装效果描述
    two_piece_effect: str = ""  # 2件套效果描述
    four_piece_effect: str = "" # 4件套效果描述

    # 套装Buff列表
    two_piece_buffs: List[Buff] = field(default_factory=list)  # 2件套Buff（局内）
    four_piece_buffs: List[Buff] = field(default_factory=list) # 4件套Buff（局外）

    def __str__(self) -> str:
        return f"{self.name_cn} ({self.name})"


@dataclass
class DriveDisk:
    """
    驱动盘数据模型

    驱动盘有6个位置，每个位置固定主属性类型：
    - 1号位：HP固定值
    - 2号位：ATK固定值
    - 3号位：DEF固定值
    - 4号位：HP%/ATK%/DEF%/暴击率/暴击伤害/异常精通等（随机）
    - 5号位：HP%/ATK%/DEF%/穿透率/元素伤害加成等（随机）
    - 6号位：HP%/ATK%/DEF%/能量自动回复/异常掌控等（随机）

    副属性：
    - 初始2-4条随机副属性
    - 每3级强化一次副属性（新增或升级现有）
    - 最多4条副属性
    """
    id: str                                 # 实例ID（唯一，用于仓库管理）
    game_id: str                            # 套装ID（如 "33500"，用于查找游戏数据）
    set_name: str                           # 套装名称（英文）
    set_name_cn: str                        # 套装名称（中文）
    position: DriveDiskPosition             # 位置 (1-6)
    rarity: Rarity                          # 稀有度
    level: int                              # 等级 (0-15)

    # 主属性
    main_stat: PropertyType                 # 主属性类型
    main_stat_value: StatValue              # 主属性数值

    # 副属性（最多4条）
    sub_stats: Dict[PropertyType, StatValue] = field(default_factory=dict)

    # 套装Buff列表（缓存）
    two_piece_buffs: List[Buff] = field(default_factory=list)  # 2件套buff列表（局外）
    four_piece_buffs: List[Buff] = field(default_factory=list)  # 4件套buff列表（局内）

    # 装备状态
    equipped_agent: Optional[str] = None    # 装备角色ID
    locked: bool = False                    # 是否锁定
    source: str = "imported"                # 数据来源（"imported" 或 "manual"）

    def __post_init__(self):
        """初始化后处理"""
        if isinstance(self.rarity, int):
            self.rarity = Rarity(self.rarity)
        if isinstance(self.position, int):
            self.position = DriveDiskPosition(self.position)
        if isinstance(self.main_stat, int):
            self.main_stat = PropertyType(self.main_stat)

        # 初始化属性缓存
        self._stats_cache: Optional[PropertyCollection] = None

    @property
    def is_max_level(self) -> bool:
        """是否满级"""
        return self.level >= 15

    @property
    def sub_stat_count(self) -> int:
        """副属性数量"""
        return len(self.sub_stats)

    @property
    def is_max_sub_stats(self) -> bool:
        """是否满副属性（4条）"""
        return self.sub_stat_count >= 4

    @property
    def is_equipped(self) -> bool:
        """是否已装备"""
        return self.equipped_agent is not None

    @property
    def rarity_symbol(self) -> str:
        """稀有度符号"""
        return {
            Rarity.S: "S",
            Rarity.A: "A",
            Rarity.B: "B",
        }.get(self.rarity, "?")

    @property
    def expected_sub_stat_count(self) -> int:
        """根据等级计算期望的副属性数量"""
        # 初始2-4条，每3级增加一条（3/6/9/12级）
        initial = 2  # 简化假设初始2条
        upgrades = self.level // 3
        return min(4, initial + upgrades)

    def validate(self) -> tuple[bool, list[str]]:
        """验证驱动盘数据的合法性

        Returns:
            (是否合法, 错误信息列表)
        """
        errors = []

        # 1. 验证主词条槽位限制
        main_stat_key = self._property_type_to_key(self.main_stat)
        allowed_main_stats = DriveDiskStats.SLOT_MAIN_STATS.get(self.position.value, [])
        if main_stat_key not in allowed_main_stats:
            errors.append(f"主词条 {main_stat_key} 不允许出现在 {self.position.value} 号位")

        # 2. 验证副词条类型
        for prop_type in self.sub_stats.keys():
            sub_stat_key = self._property_type_to_key(prop_type)
            if sub_stat_key not in DriveDiskStats.AVAILABLE_SUB_STATS:
                errors.append(f"副词条 {sub_stat_key} 不是有效的副词条类型")

        # 3. 验证主副词条不能相同
        if self.main_stat in self.sub_stats:
            errors.append(f"主词条 {main_stat_key} 不能同时出现在副词条中")

        # 4. 验证副词条数量
        if len(self.sub_stats) > 4:
            errors.append(f"副词条数量 {len(self.sub_stats)} 超过最大值 4")

        # 5. 验证副词条强化次数范围（应该是1-5的整数）
        for prop_type, stat_value in self.sub_stats.items():
            rolls = stat_value.value
            if rolls < 1 or rolls > 5:
                sub_stat_key = self._property_type_to_key(prop_type)
                errors.append(f"副词条 {sub_stat_key} 强化次数 {rolls} 不在有效范围 [1, 5]")
            if rolls != int(rolls):
                sub_stat_key = self._property_type_to_key(prop_type)
                errors.append(f"副词条 {sub_stat_key} 强化次数 {rolls} 不是整数")

        # 6. 验证等级范围
        max_level = DriveDiskStats.MAX_LEVELS.get(self.rarity.name, 15)
        if self.level > max_level:
            errors.append(f"等级 {self.level} 超过 {self.rarity.name} 级驱动盘的最大等级 {max_level}")

        return len(errors) == 0, errors

    def _property_type_to_key(self, prop_type: PropertyType) -> str:
        """将PropertyType转换为键名

        Args:
            prop_type: 属性类型枚举

        Returns:
            键名字符串
        """
        mapping = {
            PropertyType.HP: 'hp',
            PropertyType.HP_: 'hp_',
            PropertyType.ATK: 'atk',
            PropertyType.ATK_: 'atk_',
            PropertyType.DEF: 'def',
            PropertyType.DEF_: 'def_',
            PropertyType.PEN: 'pen',
            PropertyType.PEN_: 'pen_',
            PropertyType.CRIT_: 'crit_',
            PropertyType.CRIT_RATE_: 'crit_',
            PropertyType.CRIT_DMG_: 'crit_dmg_',
            PropertyType.ANOM_PROF: 'anomProf',
            PropertyType.ANOM_MAS_: 'anomMas_',
            # 6号位主词条（固定值和百分比）
            PropertyType.IMPACT: 'impact',           # 冲击力（固定值）
            PropertyType.IMPACT_: 'impact_',         # 冲击力%
            PropertyType.ENER_REGEN: 'energyRegen',  # 能量回复（固定值，如果存在）
            PropertyType.ENER_REGEN_: 'energyRegen_',# 能量回复%
            # 元素伤害
            PropertyType.PHYSICAL_DMG_: 'physical_dmg_',
            PropertyType.FIRE_DMG_: 'fire_dmg_',
            PropertyType.ICE_DMG_: 'ice_dmg_',
            PropertyType.ELECTRIC_DMG_: 'electric_dmg_',
            PropertyType.ETHER_DMG_: 'ether_dmg_',
        }
        return mapping.get(prop_type, '')

    def _calculate_stats(self) -> PropertyCollection:
        """内部方法：计算当前驱动盘的所有属性增益（局外）

        Returns:
            PropertyCollection：驱动盘提供的属性
        """
        result = PropertyCollection()

        # 获取稀有度字符串
        rarity_str = self.rarity.name  # 'S', 'A', 'B'

        # 1. 计算主词条数值
        main_stat_key = self._property_type_to_key(self.main_stat)
        if main_stat_key:
            main_stat_value = DriveDiskStats.calculate_main_stat_value(
                rarity_str, main_stat_key, self.level
            )
            result.out_of_combat[self.main_stat] = main_stat_value

        # 2. 计算副词条数值
        for prop_type, stat_value in self.sub_stats.items():
            # stat_value.value 存储的是强化次数（rolls）
            sub_stat_key = self._property_type_to_key(prop_type)
            if sub_stat_key:
                sub_stat_value = DriveDiskStats.calculate_sub_stat_value(
                    rarity_str, sub_stat_key, int(stat_value.value)
                )
                result.out_of_combat[prop_type] = result.out_of_combat.get(prop_type, 0.0) + sub_stat_value

        return result

    def get_stats(self) -> PropertyCollection:
        """获取驱动盘属性（带缓存）

        Returns:
            PropertyCollection：驱动盘提供的属性
        """
        if self._stats_cache is None:
            self._stats_cache = self._calculate_stats()
        return self._stats_cache

    def _clear_stats_cache(self):
        """清除属性缓存（属性变更时调用）"""
        self._stats_cache = None

    def get_two_piece_bonus(self, data_loader=None) -> List[Buff]:
        """获取 2 件套效果

        Args:
            data_loader: DataLoaderService，用于查询套装数据

        Returns:
            2 件套 Buff 列表
        """
        if not self.game_id or not data_loader:
            return []

        set_buffs = data_loader.get_equipment_buffs(self.game_id, 2)
        if 'two_piece_buffs' in set_buffs:
            active_buffs = [buff for buff in set_buffs['two_piece_buffs'] if buff.is_active]
            # 更新缓存
            self.two_piece_buffs = active_buffs
            return active_buffs
        return []

    def get_four_piece_bonus(self, data_loader=None) -> List[Buff]:
        """获取 4 件套效果

        Args:
            data_loader: DataLoaderService，用于查询套装数据

        Returns:
            4 件套 Buff 列表
        """
        if not self.game_id or not data_loader:
            return []

        set_buffs = data_loader.get_equipment_buffs(self.game_id, 4)
        if 'four_piece_buffs' in set_buffs:
            active_buffs = [buff for buff in set_buffs['four_piece_buffs'] if buff.is_active]
            # 更新缓存
            self.four_piece_buffs = active_buffs
            return active_buffs
        return []

    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'id': self.id,
            'set_name': self.set_name,
            'set_name_cn': self.set_name_cn,
            'position': self.position.value,
            'rarity': self.rarity.value,
            'level': self.level,
            'main_stat': self.main_stat.value,
            'main_stat_value': str(self.main_stat_value),
            'sub_stats': {
                prop.value: str(value)
                for prop, value in self.sub_stats.items()
            },
            'equipped_agent': self.equipped_agent,
            'locked': self.locked,
        }

    def __str__(self) -> str:
        """字符串表示"""
        sub_stats_str = ", ".join([
            f"{prop.name}+{value}"
            for prop, value in self.sub_stats.items()
        ])

        equipped = ""
        if self.is_equipped:
            equipped = " [已装备]"

        locked = ""
        if self.locked:
            locked = " [🔒]"

        return (
            f"{self.set_name_cn} [{self.position.value}号位] "
            f"[{self.rarity_symbol}] "
            f"Lv.{self.level} "
            f"{self.main_stat.name}+{self.main_stat_value} "
            f"({sub_stats_str}){equipped}{locked}"
        )

    def format(self, indent: int = 0) -> str:
        """格式化输出驱动盘信息（只输出有意义的值）

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 基础信息
        lines.append(f"{prefix}【驱动盘】")
        lines.append(f"  {prefix}套装: {self.set_name_cn}")
        lines.append(f"  {prefix}位置: {self.position.value}号位")
        lines.append(f"  {prefix}稀有度: {self.rarity_symbol}")
        lines.append(f"  {prefix}等级: Lv.{self.level}")

        # 主属性
        lines.append(f"{prefix}【主属性】")
        lines.append(f"  {prefix}{self.main_stat.cn_name}: {self.main_stat_value}")

        # 副属性（显示强化次数和计算后的值）
        if self.sub_stats:
            lines.append(f"{prefix}【副属性】({len(self.sub_stats)}条)")
            rarity_str = self.rarity.name
            for prop, stat_value in self.sub_stats.items():
                rolls = int(stat_value.value)  # 强化次数
                sub_stat_key = self._property_type_to_key(prop)

                # 计算实际数值
                calculated_value = DriveDiskStats.calculate_sub_stat_value(
                    rarity_str, sub_stat_key, rolls
                )

                # 格式化显示
                if prop.is_percentage:
                    # 百分比属性
                    lines.append(f"  {prefix}{prop.cn_name}: {calculated_value * 100:.1f}% (强化{rolls}次)")
                else:
                    # 固定值属性
                    lines.append(f"  {prefix}{prop.cn_name}: {calculated_value:.0f} (强化{rolls}次)")

        # 装备状态
        status = []
        if self.is_equipped:
            status.append("已装备")
        if self.locked:
            status.append("已锁定")
        if status:
            lines.append(f"{prefix}【状态】: {', '.join(status)}")

        return "\n".join(lines)


@dataclass
class DriveDiskCollection:
    """驱动盘收藏（某个角色装备的6个驱动盘）"""
    agent_id: str                           # 角色ID
    disks: Dict[DriveDiskPosition, DriveDisk] = field(default_factory=dict)

    def add_disk(self, disk: DriveDisk) -> None:
        """添加驱动盘"""
        self.disks[disk.position] = disk
        disk.equipped_agent = self.agent_id

    def remove_disk(self, position: DriveDiskPosition) -> Optional[DriveDisk]:
        """移除驱动盘"""
        if position in self.disks:
            disk = self.disks.pop(position)
            disk.equipped_agent = None
            return disk
        return None

    def get_set_bonuses(self) -> Dict[str, int]:
        """
        获取套装加成统计

        Returns:
            {套装名: 件数} 字典
        """
        set_counts = {}
        for disk in self.disks.values():
            set_name = disk.set_name
            set_counts[set_name] = set_counts.get(set_name, 0) + 1
        return set_counts

    def get_active_sets(self) -> List[tuple[str, int]]:
        """
        获取激活的套装效果

        Returns:
            [(套装名, 件数)] 列表，只包含2件套和4件套
        """
        set_counts = self.get_set_bonuses()
        active_sets = []

        for set_name, count in set_counts.items():
            if count >= 4:
                active_sets.append((set_name, 4))
            elif count >= 2:
                active_sets.append((set_name, 2))

        return active_sets

    def generate_two_piece_buffs(self, set_definitions: Dict[str, DriveDiskSet]) -> List[Buff]:
        """
        生成2件套Buff

        Args:
            set_definitions: 套装定义字典 {套装名: DriveDiskSet}

        Returns:
            2件套Buff列表（局外）
        """
        buffs = []
        set_counts = self.get_set_bonuses()

        for set_name, count in set_counts.items():
            if count >= 2:
                set_def = set_definitions.get(set_name)
                if set_def:
                    two_pc_buff = Buff(
                        id=f"{self.agent_id}_{set_name}_2pc",
                        name=f"{set_def.name_cn} 2件套",
                        description=set_def.two_piece_effect,
                        source=BuffSource.DRIVE_DISK_2PC,
                        context=BuffContext.OUT_OF_COMBAT,
                        out_of_combat_stats=set_def.two_piece_bonus.copy()
                    )
                    buffs.append(two_pc_buff)

        return buffs

    def generate_four_piece_buffs(self, set_definitions: Dict[str, DriveDiskSet]) -> List[Buff]:
        """
        生成4件套Buff

        Args:
            set_definitions: 套装定义字典 {套装名: DriveDiskSet}

        Returns:
            4件套Buff列表（局内）
        """
        buffs = []
        set_counts = self.get_set_bonuses()

        for set_name, count in set_counts.items():
            if count >= 4:
                set_def = set_definitions.get(set_name)
                if set_def:
                    four_pc_buff = Buff(
                        id=f"{self.agent_id}_{set_name}_4pc",
                        name=f"{set_def.name_cn} 4件套",
                        description=set_def.four_piece_effect,
                        source=BuffSource.DRIVE_DISK_4PC,
                        context=BuffContext.IN_COMBAT,
                        in_combat_stats=set_def.four_piece_bonus.copy()
                    )
                    buffs.append(four_pc_buff)

        return buffs

    def get_total_stats(self) -> Dict[PropertyType, float]:
        """
        获取所有驱动盘提供的总属性

        Returns:
            {属性类型: 数值} 字典
        """
        total_stats = {}

        for disk in self.disks.values():
            # 主属性
            prop = disk.main_stat
            total_stats[prop] = total_stats.get(prop, 0.0) + disk.main_stat_value.value

            # 副属性
            for prop, value in disk.sub_stats.items():
                total_stats[prop] = total_stats.get(prop, 0.0) + value.value

        return total_stats

    def is_complete(self) -> bool:
        """是否完整（6个位置全部装备）"""
        return len(self.disks) == 6

    def __str__(self) -> str:
        """字符串表示"""
        set_info = ", ".join([f"{name}×{count}" for name, count in self.get_set_bonuses().items()])
        return f"驱动盘收藏 ({len(self.disks)}/6): {set_info}"