"""
角色模型
"""
from typing import Optional, List, Dict, TYPE_CHECKING
from dataclasses import dataclass, field

from optimizer.zzz_models.base import Rarity, ElementType, WeaponType, PropertyType
from optimizer.zzz_models.buff import Buff, ConversionBuff
from optimizer.zzz_models.combat_stats import CombatStats
from optimizer.zzz_models.property_collection import PropertyCollection

if TYPE_CHECKING:
    from .agent_skill import AgentSkillSet
    from optimizer.optimizer_context import OptimizerContext


@dataclass
class AgentSkills:
    """角色技能等级"""
    normal: int = 1         # 普通攻击 (1-12)
    dodge: int = 1          # 闪避反击 (1-12)
    assist: int = 1         # 支援技 (1-12)
    special: int = 1        # 特殊技 (1-12)
    chain: int = 1          # 连携技 (1-12)

    @property
    def is_max(self) -> bool:
        """是否全部满级"""
        return all([
            self.normal >= 12,
            self.dodge >= 12,
            self.assist >= 12,
            self.special >= 12,
            self.chain >= 12
        ])

    @property
    def total_level(self) -> int:
        """总技能等级"""
        return self.normal + self.dodge + self.assist + self.special + self.chain

    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'normal': self.normal,
            'dodge': self.dodge,
            'assist': self.assist,
            'special': self.special,
            'chain': self.chain,
        }


@dataclass
class SkillParam:
    """技能参数

    包含技能的各项战斗参数，用于计算实际伤害和效果
    """
    damage_percentage: float      # 伤害倍率 (%)
    damage_growth: float          # 伤害成长
    stun_ratio: float             # 失衡倍率 (%)
    stun_growth: float            # 失衡成长
    attribute_infliction: float   # 属性异常积蓄
    sp_recovery: float = 0.0      # 能量回复
    rp_recovery: float = 0.0      # 共鸣能量回复
    ether_purify: float = 0.0     # 以太净化值
    sp_consume: float = 0.0       # 能量消耗

    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'damage_percentage': self.damage_percentage,
            'damage_growth': self.damage_growth,
            'stun_ratio': self.stun_ratio,
            'stun_growth': self.stun_growth,
            'attribute_infliction': self.attribute_infliction,
            'sp_recovery': self.sp_recovery,
            'rp_recovery': self.rp_recovery,
            'ether_purify': self.ether_purify,
            'sp_consume': self.sp_consume,
        }


@dataclass
class Skill:
    """技能详细数据

    包含技能的描述和所有参数
    """
    name: str                     # 技能名称
    skill_id: str                 # 技能ID
    description: str              # 技能描述
    params: dict[str, SkillParam]  # 参数列表（键为参数名，如"一段伤害倍率"、"失衡倍率"等）
    level: int = 1                # 技能等级 (1-12)

    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'name': self.name,
            'skill_id': self.skill_id,
            'description': self.description,
            'params': {k: v.to_dict() for k, v in self.params.items()},
            'level': self.level,
        }


@dataclass
class LevelGrowth:
    """等级成长数据

    记录角色在不同等级段的属性成长
    """
    level_min: int                # 最低等级
    level_max: int                # 最高等级
    hp: float                     # 生命值
    attack: float                 # 攻击力
    defence: float                # 防御力
    materials: dict[str, int] = field(default_factory=dict)  # 升级材料 {材料ID: 数量}

    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'level_min': self.level_min,
            'level_max': self.level_max,
            'hp': self.hp,
            'attack': self.attack,
            'defence': self.defence,
            'materials': self.materials,
        }


@dataclass
class BreakthroughBonus:
    """突破额外属性

    记录突破等级带来的额外属性加成
    """
    breakthrough_level: int       # 突破等级 (1-6)
    max_level: int                # 该突破等级解锁的最大等级
    bonuses: dict[str, float]     # 额外属性 {属性名: 数值}

    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'breakthrough_level': self.breakthrough_level,
            'max_level': self.max_level,
            'bonuses': self.bonuses,
        }


@dataclass
class Agent:
    """
    角色数据模型

    核心属性：
    - 基础信息：ID、名称、稀有度
    - 成长属性：等级、突破、影院、核心技能、技能等级
    - 战斗属性：元素、武器类型
    - 装备关联：音擎、驱动盘
    """
    id: str                             # 实例ID（唯一，用于仓库管理）
    game_id: str                        # 游戏ID（如 "1021"，用于查找游戏数据）
    name_cn: str                        # 名称（中文，如 "猫又"）
    rarity: Rarity                      # 稀有度 (S/A/B)
    level: int                          # 等级 (1-60)
    breakthrough: int                   # 突破等级 (0-6)
    element: ElementType                # 元素类型
    weapon_type: WeaponType             # 武器类型
    icon: str = ""                      # 图标名称（如 "IconRole09"）
    source: str = "imported"            # 数据来源（"imported" 或 "manual"）

    # 进阶属性
    cinema: int = 0                     # 影院等级 (0-6，对应M0-M6)
    core_skill: int = 1                 # 核心技能等级 (1-7)
    skills: AgentSkills = field(default_factory=AgentSkills)  # 技能等级

    # 技能详细数据（用于战斗计算）
    skills_detail: dict[str, Skill] = field(default_factory=dict)  # 技能详细数据 {技能类型: Skill}

    # CSV技能数据（新增，基于CSV的完整技能数据）
    skill_set: Optional['AgentSkillSet'] = None  # 技能集（包含所有技能的详细数据）

    # 成长数据
    level_growth: dict[int, LevelGrowth] = field(default_factory=dict)  # 等级成长数据 {等级段: LevelGrowth}
    breakthrough_bonuses: dict[int, BreakthroughBonus] = field(default_factory=dict)  # 突破属性 {突破等级: BreakthroughBonus}

    # 装备关联
    equipped_wengine: Optional[str] = None              # 装备音擎ID
    equipped_drive_disks: List[str] = field(default_factory=list)  # 装备驱动盘ID列表(6个)

    # 上下文引用（运行时注入，不序列化）
    _context: Optional['OptimizerContext'] = field(default=None, init=False, repr=False)

    # 自身属性集合（包含基础攻击、成长、突破、核心技能等所有基础属性）
    self_properties: PropertyCollection = field(default_factory=PropertyCollection)

    # BUFF系统（按来源分类）
    self_buffs: List[Buff] = field(default_factory=list)  # 自身BUFF（突破加成、基础暴击等）
    wengine_buffs: List[Buff] = field(default_factory=list)  # 武器BUFF
    drive_disk_buffs: List[Buff] = field(default_factory=list)  # 驱动盘BUFF
    core_passive_buffs: List[Buff] = field(default_factory=list)  # 核心被动BUFF
    talent_buffs: List[Buff] = field(default_factory=list)  # 天赋BUFF
    conversion_buffs: List[ConversionBuff] = field(default_factory=list)  # 转换类BUFF
    potential_buffs: List[ConversionBuff] = field(default_factory=list)  # 潜能觉醒BUFF

    def __post_init__(self):
        """初始化后处理"""
        # 自动转换枚举类型
        if isinstance(self.rarity, int):
            self.rarity = Rarity(self.rarity)
        if isinstance(self.element, int):
            self.element = ElementType(self.element)
        if isinstance(self.weapon_type, int):
            self.weapon_type = WeaponType(self.weapon_type)
        if isinstance(self.skills, dict):
            self.skills = AgentSkills(**self.skills)

    def get_bare_stats(self) -> PropertyCollection:
        """获取角色裸面板属性（不包含任何装备和BUFF）

        Returns:
            自身属性集合
        """
        return self.self_properties

    def get_self_buff(self, wengines_dict: dict = None, drive_disks_dict: dict = None,
                       data_loader=None) -> List[Buff]:
        """获取角色自身的 Buff 列表（包含所有来源）

        Args:
            wengines_dict: 音擎字典 {id: WEngine}，用于获取装备的音擎 Buff
            drive_disks_dict: 驱动盘字典 {id: DriveDisk}，用于获取装备的驱动盘 Buff
            data_loader: DataLoaderService，用于查询套装 Buff
        """
        buffs = []
        buffs.extend(self.self_buffs)

        # 音擎 Buff
        if self.equipped_wengine and wengines_dict:
            wengine = wengines_dict.get(self.equipped_wengine)
            if wengine:
                buffs.extend(wengine.get_active_buffs())

        # 驱动盘 Buff
        if self.equipped_drive_disks and drive_disks_dict and data_loader:
            # 统计套装数量
            set_counts = {}
            for disk_id in self.equipped_drive_disks:
                disk = drive_disks_dict.get(disk_id)
                if disk:
                    set_name = disk.set_name
                    set_counts[set_name] = set_counts.get(set_name, 0) + 1

            # 收集每个套装的第一个驱动盘来调用
            processed_sets = set()
            for disk_id in self.equipped_drive_disks:
                disk = drive_disks_dict.get(disk_id)
                if not disk:
                    continue

                set_name = disk.set_name
                if set_name in processed_sets:
                    continue
                processed_sets.add(set_name)

                count = set_counts[set_name]

                # 2 件套效果
                if count >= 2:
                    buffs.extend(disk.get_two_piece_bonus(data_loader))
                # 4 件套效果
                if count >= 4:
                    buffs.extend(disk.get_four_piece_bonus(data_loader))

        buffs.extend(self.core_passive_buffs)
        buffs.extend(self.talent_buffs)
        return buffs

    def get_combat_stats(self, context: Optional['OptimizerContext'] = None, buffs: List = None) -> 'CombatStats':
        """获取角色战斗属性

        局外最终面板 = 角色自身 + 武器固定属性 + 驱动盘固定属性 + 驱动盘2件套 + BUFF属性
        注意：武器buff、驱动盘4件套、天赋buff、核心buff 属于局内，不在这里计算

        Args:
            context: 优化器上下文（可选，默认使用 self._context）
            buffs: 额外的 BUFF 列表（用于叠加 BUFF 属性）

        Returns:
            CombatStats 对象
        """
        from .combat_stats import CombatStats
        from .property_collection import PropertyCollection
        from .buff import BuffContext

        # 使用提供的 context，如果没有则使用 self._context
        ctx = context if context is not None else self._context

        # 1. 收集所有局外属性集
        collections = []

        # 角色自身属性
        collections.append(self.self_properties)

        # 武器固定属性
        if ctx and self.equipped_wengine:
            wengine = ctx.get_wengine(self.equipped_wengine)
            if wengine:
                wengine_stats = wengine.get_stats_at_level(wengine.level)
                collections.append(wengine_stats)

        # 驱动盘固定属性
        if ctx and self.equipped_drive_disks:
            for disk_id in self.equipped_drive_disks:
                if not disk_id:  # 跳过None值
                    continue
                disk = ctx.get_drive_disk(disk_id)
                if disk:
                    disk_stats = disk.get_stats()
                    collections.append(disk_stats)

        # 驱动盘2件套效果
        if ctx and ctx.data_loader and self.equipped_drive_disks:
            # 统计套装数量
            set_counts = {}
            for disk_id in self.equipped_drive_disks:
                if not disk_id:  # 跳过None值
                    continue
                disk = ctx.get_drive_disk(disk_id)
                if disk:
                    set_name = disk.set_name
                    set_counts[set_name] = set_counts.get(set_name, 0) + 1

            # 收集2件套效果（去重处理）
            processed_sets = set()
            for disk_id in self.equipped_drive_disks:
                if not disk_id:  # 跳过None值
                    continue
                disk = ctx.get_drive_disk(disk_id)
                if not disk:
                    continue

                set_name = disk.set_name
                if set_name in processed_sets:
                    continue
                processed_sets.add(set_name)

                count = set_counts.get(set_name, 0)
                if count >= 2:
                    two_piece_bonus = disk.get_two_piece_bonus(ctx.data_loader)
                    if two_piece_bonus:
                        # 将 Buff 列表转换为 PropertyCollection
                        pc = PropertyCollection()
                        for buff in two_piece_bonus:
                            if buff.context == BuffContext.OUT_OF_COMBAT:
                                for prop, value in buff.out_of_combat_stats.items():
                                    pc.out_of_combat[prop] = pc.out_of_combat.get(prop, 0.0) + value
                            elif buff.context == BuffContext.IN_COMBAT:
                                for prop, value in buff.in_combat_stats.items():
                                    pc.in_combat[prop] = pc.in_combat.get(prop, 0.0) + value
                        collections.append(pc)

        # 叠加额外的 BUFF 属性
        if buffs:
            for buff in buffs:
                if hasattr(buff, 'out_of_combat_stats'):
                    collections.append(PropertyCollection(
                        out_of_combat=buff.out_of_combat_stats.copy(),
                        in_combat=buff.in_combat_stats.copy() if hasattr(buff, 'in_combat_stats') else {}
                    ))

        # 2. 使用工厂方法生成 CombatStats（自动处理局外最终→局内基础转换）
        combat_stats = CombatStats.from_property_collections(collections, level=self.level)

        # 3. 特殊规则：星见雅（烈霜）的异常攻击倍率
        if self.game_id == '1091' and self.element == ElementType.ICE:
            combat_stats.anomaly_atk_ratio_mult = 15.0  # 1500%

        return combat_stats

    @property
    def display_name(self) -> str:
        """显示名称"""
        return self.name_cn

    @property
    def rarity_symbol(self) -> str:
        """稀有度符号"""
        return {
            Rarity.S: "S",
            Rarity.A: "A",
            Rarity.B: "B",
        }.get(self.rarity, "?")

    @classmethod
    def from_character_data(cls, character_file_path: str, buff_file_path: str) -> 'Agent':
        """
        从角色数据文件和BUFF数据文件创建Agent实例

        Args:
            character_file_path: 角色原始数据文件路径
            buff_file_path: BUFF数据文件路径

        Returns:
            Agent实例
        """
        import json
        from .base import ElementType, WeaponType

        # 读取角色原始数据
        with open(character_file_path, 'r', encoding='utf-8') as f:
            char_data = json.load(f)

        # 提取元素类型和武器类型（处理字典格式）
        element_value = None
        if isinstance(char_data['ElementType'], dict):
            element_value = list(char_data['ElementType'].values())[0]
        else:
            element_value = char_data['ElementType']

        weapon_type_value = None
        if isinstance(char_data['WeaponType'], dict):
            weapon_type_value = list(char_data['WeaponType'].values())[0]
        else:
            weapon_type_value = char_data['WeaponType']

        # 从Stats字段读取1级基础属性
        stats = char_data.get('Stats', {})
        base_hp = stats.get('HpMax', 0)
        base_atk = stats.get('Attack', 0)
        base_def = stats.get('Defence', 0)
        break_stun = stats.get('BreakStun', 0)
        element_abnormal_power = stats.get('ElementAbnormalPower', 0)
        element_mystery = stats.get('ElementMystery', 0)

        # 从Level字段读取60级成长后的属性
        level_data = char_data.get('Level', {}).get('6', {})
        level_hp = level_data.get('HpMax', 0)
        level_atk = level_data.get('Attack', 0)
        level_def = level_data.get('Defence', 0)

        # 从ExtraLevel字段读取突破加成
        breakthrough_bonuses = {}
        extra_level_data = char_data.get('ExtraLevel', {})
        for bt_level, bt_data in extra_level_data.items():
            try:
                bt_level_int = int(bt_level)
                bonuses = {}
                for prop_id, prop_data in bt_data.get('Extra', {}).items():
                    prop_name = prop_data.get('Name', '')
                    prop_value = prop_data.get('Value', 0)
                    if prop_name and prop_value:
                        bonuses[prop_name] = prop_value
                breakthrough_bonuses[bt_level_int] = BreakthroughBonus(
                    breakthrough_level=bt_level_int,
                    max_level=bt_data.get('MaxLevel', 0),
                    bonuses=bonuses
                )
            except (ValueError, KeyError):
                continue

        # 创建Agent实例（使用满级数据）
        agent = cls(
            id=str(char_data['Id']),
            game_id=str(char_data['Id']),
            name_cn=char_data['Name'],
            rarity=char_data['Rarity'],
            level=60,  # 满级
            breakthrough=6,  # 满突破
            element=element_value,
            weapon_type=weapon_type_value,
            cinema=6,  # 满影院
            core_skill=7,  # 满核心技能
            skills=AgentSkills(
                normal=12,  # 满技能
                dodge=12,
                assist=12,
                special=12,
                chain=12,
            ),
            base_hp=base_hp,  # 1级基础属性
            base_atk=base_atk,
            base_def=base_def,
            level_hp=level_hp,  # 60级成长后的属性
            level_atk=level_atk,
            level_def=level_def,
            break_stun=break_stun,  # 冲击力
            element_abnormal_power=element_abnormal_power,  # 异常掌控
            element_mystery=element_mystery,  # 异常精通
            breakthrough_bonuses=breakthrough_bonuses,  # 突破加成
        )

        # 加载BUFF数据
        agent.load_buffs_from_file(buff_file_path)

        return agent

    def load_buffs_from_file(self, buff_file_path: str) -> None:
        """
        从BUFF数据文件加载BUFF

        Args:
            buff_file_path: BUFF数据文件路径
        """
        import json

        with open(buff_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 加载核心被动BUFF
        self.core_passive_buffs = [
            Buff.from_dict(buff_data) for buff_data in data.get('core_passive_buffs', [])
        ]

        # 加载天赋BUFF
        self.talent_buffs = [
            Buff.from_dict(buff_data) for buff_data in data.get('talent_buffs', [])
        ]

        # 加载转换类BUFF
        self.conversion_buffs = [
            ConversionBuff.from_dict(buff_data) for buff_data in data.get('conversion_buffs', [])
        ]

        # 加载潜能觉醒BUFF
        self.potential_buffs = [
            ConversionBuff.from_dict(buff_data) for buff_data in data.get('potential_buffs', [])
        ]

    def _map_attribute_name(self, attr_name: str) -> str:
        """
        将中文属性名映射为英文键名

        Args:
            attr_name: 中文属性名（如"暴击率"、"基础攻击力"）

        Returns:
            英文键名（如"crit_rate"、"base_atk"）
        """
        attr_map = {
            '暴击率': 'crit_rate',
            '暴击伤害': 'crit_damage',
            '基础攻击': 'base_atk',
            '基础生命': 'base_hp',
            '基础防御': 'base_def',
            '元素异常积蓄': 'element_abnormal_power',
            '元素精通': 'element_mastery',
            '异常掌控': 'element_mastery',  # 添加异常掌控映射
            '穿透': 'penetration',
            '穿透率': 'penetration_rate',
        }
        return attr_map.get(attr_name, attr_name.lower())

    def load_skill_set(self, skill_set: 'AgentSkillSet') -> None:
        """加载技能集数据（基于CSV）

        Args:
            skill_set: AgentSkillSet对象
        """
        self.skill_set = skill_set

        # 同步技能等级到skill_set
        if skill_set:
            skill_set.normal_attack_level = self.skills.normal
            skill_set.special_skill_level = self.skills.special
            skill_set.dodge_counter_level = self.skills.dodge
            skill_set.assist_level = self.skills.assist
            skill_set.chain_attack_level = self.skills.chain

    def get_skill_from_set(self, skill_name: str) -> Optional['AgentSkill']:
        """从技能集中获取指定技能

        Args:
            skill_name: 技能名称

        Returns:
            AgentSkill对象，如果不存在返回None
        """
        if not self.skill_set:
            return None
        return self.skill_set.get_skill(skill_name)

    def get_all_skills_from_set(self) -> List['AgentSkill']:
        """从技能集中获取所有技能

        Returns:
            技能列表
        """
        if not self.skill_set:
            return []
        return self.skill_set.get_all_skills()

    def get_all_buffs(self, drive_disks_dict: dict = None) -> dict:
        """获取角色的所有buff清单

        包含：
        - 角色自身buff（突破加成等）
        - 核心被动buff
        - 天赋buff
        - 转化buff
        - 潜能buff
        - 音擎buff（根据当前精炼等级）
        - 驱动盘buff（根据套装数量）

        Args:
            drive_disks_dict: 仓库中所有驱动盘的字典 {id: DriveDisk对象}，
                            如果为None则跳过驱动盘buff

        Returns:
            包含所有buff分类的字典
        """
        from typing import Dict
        from ..zzz_models.drive_disk import DriveDisk

        result = {
            'self_buffs': [],
            'core_passive_buffs': [],
            'talent_buffs': [],
            'conversion_buffs': [],
            'potential_buffs': [],
            'wengine_buffs': [],
            'drive_disk_buffs': [],
        }

        # 1. 角色自身buff
        result['self_buffs'] = [buff for buff in self.self_buffs if buff.is_active]

        # 2. 核心被动buff
        result['core_passive_buffs'] = [buff for buff in self.core_passive_buffs if buff.is_active]

        # 3. 天赋buff
        result['talent_buffs'] = [buff for buff in self.talent_buffs if buff.is_active]

        # 4. 转化buff
        result['conversion_buffs'] = [buff for buff in self.conversion_buffs if buff.is_active]

        # 5. 潜能buff
        result['potential_buffs'] = [buff for buff in self.potential_buffs if buff.is_active]

        # 6. 音擎buff（根据当前精炼等级）
        if self.equipped_wengine:
            # 获取当前精炼等级的天赋
            if hasattr(self.equipped_wengine, '_talents') and self.equipped_wengine._talents:
                for talent in self.equipped_wengine._talents:
                    if talent.level == self.equipped_wengine.refinement:
                        if hasattr(talent, 'buffs'):
                            result['wengine_buffs'] = [buff for buff in talent.buffs if buff.is_active]
                        break

        # 7. 驱动盘buff（根据套装数量）
        if self.equipped_drive_disks and drive_disks_dict:
            # 统计套装数量
            set_counts = {}
            for disk_id in self.equipped_drive_disks:
                disk = drive_disks_dict.get(disk_id)
                if disk:
                    set_name = disk.set_name_cn
                    set_counts[set_name] = set_counts.get(set_name, 0) + 1

            # 收集激活的套装buff
            drive_disk_buffs = []
            processed_sets = set()

            for disk_id in self.equipped_drive_disks:
                disk = drive_disks_dict.get(disk_id)
                if not disk:
                    continue

                set_name = disk.set_name_cn
                if set_name in processed_sets:
                    continue
                processed_sets.add(set_name)

                count = set_counts[set_name]

                # 2件套buff
                if count >= 2 and hasattr(disk, '_two_piece_buffs'):
                    drive_disk_buffs.extend([buff for buff in disk._two_piece_buffs if buff.is_active])

                # 4件套buff
                if count >= 4 and hasattr(disk, '_four_piece_buffs'):
                    drive_disk_buffs.extend([buff for buff in disk._four_piece_buffs if buff.is_active])

            result['drive_disk_buffs'] = drive_disk_buffs

        return result

    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'id': self.id,
            'game_id': self.game_id,
            'name_cn': self.name_cn,
            'rarity': self.rarity.value,
            'level': self.level,
            'breakthrough': self.breakthrough,
            'element': self.element.value,
            'weapon_type': self.weapon_type.value,
            'cinema': self.cinema,
            'core_skill': self.core_skill,
            'skills': self.skills.to_dict(),
            'equipped_wengine': self.equipped_wengine,
            'equipped_drive_disks': self.equipped_drive_disks,
            'base_hp': self.base_hp,
            'base_atk': self.base_atk,
            'base_def': self.base_def,
        }

    def __str__(self) -> str:
        """字符串表示"""
        return (
            f"{self.display_name} "
            f"[{self.rarity_symbol}] "
            f"Lv.{self.level}/{self.breakthrough}突 "
            f"M{self.cinema} "
            f"核心{self.core_skill}"
        )

    def format(self, context: Optional['OptimizerContext'] = None, indent: int = 0) -> str:
        """格式化输出角色信息（只输出有意义的值）

        Args:
            context: 优化器上下文，用于访问装备对象。如果为None，则只显示装备ID
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 基础信息
        lines.append(f"{prefix}【角色信息】")
        lines.append(f"  {prefix}名称: {self.name_cn}")
        lines.append(f"  {prefix}稀有度: {self.rarity_symbol}")
        lines.append(f"  {prefix}等级: {self.level}")
        lines.append(f"  {prefix}影画: M{self.cinema}")
        lines.append(f"  {prefix}核心技能: Lv.{self.core_skill}")
        lines.append(f"  {prefix}元素: {self.element.cn_name}")

        # 技能等级
        lines.append(f"{prefix}【技能等级】")
        lines.append(f"  {prefix}普攻: Lv.{self.skills.normal}")
        lines.append(f"  {prefix}闪避: Lv.{self.skills.dodge}")
        lines.append(f"  {prefix}支援: Lv.{self.skills.assist}")
        lines.append(f"  {prefix}特殊: Lv.{self.skills.special}")
        lines.append(f"  {prefix}连携: Lv.{self.skills.chain}")

        # 属性集合
        if self.self_properties and (self.self_properties.out_of_combat or self.self_properties.in_combat):
            lines.append(f"{prefix}【自身属性】")
            lines.append(self.self_properties.format(indent=indent+2))

        # 音擎信息（完整输出）
        if self.equipped_wengine:
            if context:
                wengine = context.get_wengine(self.equipped_wengine)
                if wengine:
                    lines.append(f"{prefix}【音擎】")
                    lines.append(wengine.format(indent=indent+2))
                else:
                    # 回退：音擎ID在上下文中不存在
                    lines.append(f"{prefix}【音擎】")
                    lines.append(f"  {prefix}ID: {self.equipped_wengine} (未找到)")
            else:
                # 回退：没有上下文，只显示ID
                lines.append(f"{prefix}【音擎】")
                lines.append(f"  {prefix}ID: {self.equipped_wengine}")

        # 驱动盘信息（完整输出）
        if self.equipped_drive_disks:
            lines.append(f"{prefix}【驱动盘】({len(self.equipped_drive_disks)}个)")
            if context:
                for disk_id in self.equipped_drive_disks:
                    if not disk_id:  # 跳过None值
                        continue
                    disk = context.get_drive_disk(disk_id)
                    if disk:
                        lines.append(disk.format(indent=indent+2))
                    else:
                        # 回退：驱动盘ID在上下文中不存在
                        lines.append(f"  {prefix}ID: {disk_id} (未找到)")
            else:
                # 回退：没有上下文，只显示ID
                for disk_id in self.equipped_drive_disks:
                    if not disk_id:  # 跳过None值
                        continue
                    lines.append(f"  {prefix}ID: {disk_id}")

        # 局内基础面板（局外最终属性作为局内基础）
        if context:
            lines.append(f"{prefix}【局内基础面板】")
            # 直接调用 get_combat_stats() 获取合并后的属性
            combat_stats = self.get_combat_stats(context=context)
            lines.append(combat_stats.format(indent=indent+2))

        # 局内 BUFF 加成汇总
        if context:
            from .property_collection import PropertyCollection
            in_combat_collection = PropertyCollection()

            # 收集所有 buff 的局内属性
            all_buffs = (
                self.self_buffs +
                self.wengine_buffs +
                self.drive_disk_buffs +
                self.core_passive_buffs +
                self.talent_buffs
            )

            for buff in all_buffs:
                if hasattr(buff, 'in_combat_stats') and buff.in_combat_stats:
                    for prop, value in buff.in_combat_stats.items():
                        in_combat_collection.in_combat[prop] = in_combat_collection.in_combat.get(prop, 0.0) + value

            # 只有存在局内属性时才输出
            if in_combat_collection.in_combat:
                lines.append(f"{prefix}【局内 BUFF 加成】")
                lines.append(in_combat_collection.format(indent=indent+2))

        # BUFF列表（按来源分类）
        buff_groups = [
            ("自身BUFF", self.self_buffs),
            ("武器BUFF", self.wengine_buffs),
            ("驱动盘BUFF", self.drive_disk_buffs),
            ("核心被动", self.core_passive_buffs),
            ("天赋BUFF", self.talent_buffs),
            ("转换BUFF", self.conversion_buffs),
            ("潜能BUFF", self.potential_buffs),
        ]

        for group_name, buffs in buff_groups:
            if buffs:
                lines.append(f"{prefix}【{group_name}】({len(buffs)}个)")
                for buff in buffs:
                    lines.append(buff.format(indent=indent+2))

        return "\n".join(lines)

    def get_stats_snapshot(self, context: Optional['OptimizerContext'] = None) -> dict:
        """获取完整的数据快照（用于调试和数据验证）

        返回结构化的字典，包含角色、装备、属性的原始数值（未格式化）

        Args:
            context: 优化器上下文

        Returns:
            包含完整数据的字典，所有百分比值为小数形式（如 0.05 表示 5%）
        """
        snapshot = {
            "agent": {
                "id": self.id,
                "game_id": self.game_id,
                "name_cn": self.name_cn,
                "level": self.level,
                "breakthrough": self.breakthrough,
                "rarity": self.rarity.value,
                "cinema": self.cinema,
                "core_skill": self.core_skill,
                "element": self.element.value,
                "weapon_type": self.weapon_type.value,
                "skills": {
                    "normal": self.skills.normal,
                    "dodge": self.skills.dodge,
                    "assist": self.skills.assist,
                    "special": self.skills.special,
                    "chain": self.skills.chain,
                }
            },
            "self_properties": {
                "out_of_combat": {prop.value: val for prop, val in self.self_properties.out_of_combat.items()} if self.self_properties else {},
                "in_combat": {prop.value: val for prop, val in self.self_properties.in_combat.items()} if self.self_properties else {},
            },
            "wengine": None,
            "drive_disks": [],
            "buffs": {
                "core_passive": [buff.name for buff in self.core_passive_buffs],
                "talent": [buff.name for buff in self.talent_buffs],
                "conversion": [buff.name for buff in self.conversion_buffs],
            }
        }

        # 音擎详细数据
        if context and self.equipped_wengine:
            wengine = context.get_wengine(self.equipped_wengine)
            if wengine:
                snapshot["wengine"] = {
                    "id": wengine.id,
                    "wengine_id": wengine.wengine_id,
                    "name": wengine.name,
                    "level": wengine.level,
                    "breakthrough": wengine.breakthrough,
                    "refinement": wengine.refinement,
                    "base_atk": wengine.base_atk,
                    "rand_stat": wengine.rand_stat,
                    "rand_stat_type": wengine.rand_stat_type.value if wengine.rand_stat_type else None,
                    "base_stats": {
                        "out_of_combat": {prop.value: val for prop, val in wengine.base_stats.out_of_combat.items()} if wengine.base_stats else {},
                        "in_combat": {prop.value: val for prop, val in wengine.base_stats.in_combat.items()} if wengine.base_stats else {},
                    }
                }

        # 驱动盘详细数据
        if context and self.equipped_drive_disks:
            for disk_id in self.equipped_drive_disks:
                if not disk_id:
                    continue
                disk = context.get_drive_disk(disk_id)
                if disk:
                    snapshot["drive_disks"].append({
                        "id": disk.id,
                        "set_name": disk.set_name,
                        "set_name_cn": disk.set_name_cn,
                        "position": disk.position.value,
                        "level": disk.level,
                        "rarity": disk.rarity.value,
                        "main_stat": disk.main_stat.value,
                        "main_stat_value": {
                            "value": disk.main_stat_value.value,
                            "is_percent": disk.main_stat_value.is_percent,
                        },
                        "sub_stats": {
                            str(prop.value): {
                                "value": stat_val.value,
                                "is_percent": stat_val.is_percent,
                            }
                            for prop, stat_val in disk.sub_stats.items()
                        }
                    })

        return snapshot