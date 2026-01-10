"""存档数据模型"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from datetime import datetime
from optimizer.zzz_models.agent import Agent
from optimizer.zzz_models.drive_disk import DriveDisk
from optimizer.zzz_models.wengine import WEngine
from optimizer.zzz_models.base import Rarity, ElementType, WeaponType, PropertyType, StatValue


@dataclass
class SaveData:
    """单个存档数据

    ⚠️ 重要架构说明：
    存档中只存储玩家拥有的物品实例和状态信息：
    - 角色：等级、突破、影画、技能等级、装备关系
    - 驱动盘：等级、主副词条强化次数、装备关系
    - 音擎：等级、精炼、突破、装备关系

    所有游戏基础数据（角色基础属性、音擎基础攻击力、驱动盘套装效果等）
    都需要从游戏数据文件（character.json, weapon.json, equipment.json）中读取！

    存档不应该包含完整的游戏数据，只记录"玩家有什么"和"状态如何"。

    ID分配规则：
    - 角色：10001, 10002, 10003...
    - 驱动盘：20001, 20002, 20003...
    - 音擎：30001, 30002, 30003...
    """
    name: str  # 存档名称
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # 数据存储（字典键就是实例ID）
    agents: Dict[str, Agent] = field(default_factory=dict)
    drive_disks: Dict[str, DriveDisk] = field(default_factory=dict)
    wengines: Dict[str, WEngine] = field(default_factory=dict)

    # 元数据：ID分配信息
    _metadata: Dict[str, int] = field(default_factory=lambda: {
        'next_agent_id': 10001,
        'next_drive_disk_id': 20001,
        'next_wengine_id': 30001
    })

    def to_dict(self) -> dict:
        """序列化为字典"""
        return {
            'name': self.name,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'agents': {k: self._agent_to_dict(v) for k, v in self.agents.items()},
            'drive_disks': {k: self._disk_to_dict(v) for k, v in self.drive_disks.items()},
            'wengines': {k: self._wengine_to_dict(v) for k, v in self.wengines.items()},
            '_metadata': self._metadata
        }

    def create_context(self, data_loader=None) -> 'OptimizerContext':
        """创建优化器上下文

        Args:
            data_loader: 数据加载服务，用于访问游戏数据

        Returns:
            OptimizerContext 实例，包含当前存档的所有对象引用
        """
        from optimizer.optimizer_context import OptimizerContext

        context = OptimizerContext(
            agents=self.agents,
            wengines=self.wengines,
            drive_disks=self.drive_disks,
            data_loader=data_loader
        )

        # 给所有对象注入 context 引用
        for agent in self.agents.values():
            agent._context = context
        for wengine in self.wengines.values():
            wengine._context = context
        for disk in self.drive_disks.values():
            disk._context = context

        return context

    @classmethod
    def _dict_to_agent(cls, data: dict, loader_service=None) -> Agent:
        """字典转角色（只恢复实例特有数据）"""
        # 解析技能等级
        skills_data = data.get('skills', {})
        if isinstance(skills_data, dict):
            from .zzz_models.agent import AgentSkills
            skills = AgentSkills(
                normal=skills_data.get('normal', 1),
                dodge=skills_data.get('dodge', 1),
                assist=skills_data.get('assist', 1),
                special=skills_data.get('special', 1),
                chain=skills_data.get('chain', 1),
            )
        else:
            skills = None

        return Agent(
            id='',  # 临时ID，稍后会从字典键获取
            game_id=data['game_id'],
            name_cn='',  # 临时值，稍后会从游戏数据获取
            level=data.get('level', 1),
            rarity=Rarity.A,  # 临时值，稍后会从游戏数据获取
            element=ElementType.PHYSICAL,  # 临时值，稍后会从游戏数据获取
            weapon_type=WeaponType.ATTACK,  # 临时值，稍后会从游戏数据获取
            icon='',  # 临时值，稍后会从游戏数据获取
            source='imported',
            breakthrough=data.get('breakthrough', 0),
            cinema=data.get('cinema', 0),
            core_skill=data.get('core_skill', 1),
            skills=skills,
            equipped_wengine=data.get('equipped_wengine'),
            equipped_drive_disks=data.get('equipped_drive_disks', [])
        )

    @classmethod
    def _dict_to_disk(cls, data: dict) -> DriveDisk:
        """字典转驱动盘（只恢复实例特有数据）"""
        sub_stats = {}
        if 'sub_stats' in data:
            for k, v in data['sub_stats'].items():
                prop_type = PropertyType(int(k))
                if isinstance(v, dict):
                    stat_value = StatValue(value=v['value'], is_percent=v['is_percent'])
                else:
                    # 兼容旧格式或简单值
                    stat_value = StatValue(value=float(v), is_percent=False)
                sub_stats[prop_type] = stat_value

        main_stat_val = data.get('main_stat_value')
        if isinstance(main_stat_val, dict):
            main_stat_value = StatValue(value=main_stat_val['value'], is_percent=main_stat_val['is_percent'])
        else:
            main_stat_value = StatValue(value=float(main_stat_val), is_percent=False)

        return DriveDisk(
            id='',  # 临时ID，稍后会从字典键获取
            game_id=data['game_id'],
            set_name='',  # 临时值，稍后会从游戏数据获取
            set_name_cn='',  # 临时值，稍后会从游戏数据获取
            position=data['position'],
            rarity=data['rarity'],
            level=data['level'],
            main_stat=data['main_stat'],
            main_stat_value=main_stat_value,
            sub_stats=sub_stats,
            equipped_agent=data.get('equipped_agent'),
            locked=data.get('locked', False)
        )

    @classmethod
    def _dict_to_wengine(cls, data: dict) -> WEngine:
        """字典转音擎（只恢复实例特有数据）

        ⚠️ 游戏基础数据需要单独加载！
        """
        return WEngine(
            id='',  # 临时ID，稍后会从字典键获取
            wengine_id=data.get('game_id', data.get('wengine_id', '')),  # 兼容旧格式
            name='',  # 临时值，稍后会从游戏数据获取
            # 玩家实例数据
            level=data['level'],
            refinement=data['refinement'],
            breakthrough=data.get('breakthrough', 0),
            equipped_agent=data.get('equipped_agent')
            # 注意：base_atk、rand_stat、level_data、talents 需要从游戏数据加载
        )

    @staticmethod
    def _agent_to_dict(agent: Agent) -> dict:
        """角色序列化（只序列化实例特有数据）"""
        # 序列化技能等级
        skills_dict = None
        if agent.skills:
            skills_dict = {
                'normal': agent.skills.normal,
                'dodge': agent.skills.dodge,
                'assist': agent.skills.assist,
                'special': agent.skills.special,
                'chain': agent.skills.chain,
            }

        return {
            'game_id': agent.game_id,
            'level': agent.level,
            'breakthrough': agent.breakthrough,
            'cinema': agent.cinema,
            'core_skill': agent.core_skill,
            'skills': skills_dict,
            'equipped_wengine': agent.equipped_wengine,
            'equipped_drive_disks': agent.equipped_drive_disks
        }

    @staticmethod
    def _disk_to_dict(disk: DriveDisk) -> dict:
        """驱动盘序列化（只序列化实例特有数据）"""
        return {
            'game_id': disk.game_id,
            'position': disk.position.value,
            'rarity': disk.rarity.value,
            'level': disk.level,
            'main_stat': disk.main_stat.value,
            'main_stat_value': {'value': disk.main_stat_value.value, 'is_percent': disk.main_stat_value.is_percent},
            'sub_stats': {k.value: {'value': v.value, 'is_percent': v.is_percent} for k, v in disk.sub_stats.items()},
            'equipped_agent': disk.equipped_agent,
            'locked': disk.locked
        }

    @staticmethod
    def _wengine_to_dict(wengine: WEngine) -> dict:
        """音擎序列化（只序列化实例特有数据）

        ⚠️ 不序列化游戏基础数据（base_atk、rand_stat、level_data等）
        这些需要从 weapon.json 读取。
        """
        return {
            'game_id': wengine.wengine_id,
            'level': wengine.level,
            'refinement': wengine.refinement,
            'breakthrough': wengine.breakthrough,
            'equipped_agent': wengine.equipped_agent
        }

    @classmethod
    def from_dict(cls, data: dict, loader_service) -> 'SaveData':
        """从字典反序列化"""
        save = cls(
            name=data['name'],
            created_at=datetime.fromisoformat(data['created_at']),
            updated_at=datetime.fromisoformat(data['updated_at'])
        )

        # 加载元数据
        if '_metadata' in data:
            save._metadata = data['_metadata']

        # 反序列化对象
        if 'agents' in data:
            save.agents = {}
            for k, v in data['agents'].items():
                agent = cls._dict_to_agent(v, loader_service)
                # 设置ID为字典键
                agent.id = k
                # 加载游戏数据中的基础信息和属性
                if loader_service:
                    game_data = None
                    if hasattr(loader_service, '_get_agent_game_data_by_id'):
                        game_data = loader_service._get_agent_game_data_by_id(agent.game_id)

                    # 填充基础信息字段（name_cn、element等）
                    if game_data:
                        agent.name_cn = game_data.get("CHS", "未知角色")
                        agent.element = ElementType(game_data.get("element", 200))
                        agent.weapon_type = WeaponType(game_data.get("type", 1))
                        agent.rarity = Rarity(game_data.get("rank", 4))
                        agent.icon = game_data.get("icon", "")

                    # 加载战斗属性和技能集
                    loader_service._load_agent_stats(agent, game_data)
                    loader_service._load_agent_skill_set(agent)
                save.agents[k] = agent

        if 'drive_disks' in data:
            save.drive_disks = {}
            for k, v in data['drive_disks'].items():
                disk = cls._dict_to_disk(v)
                # 设置ID为字典键
                disk.id = k
                # 填充套装名称
                if loader_service and hasattr(loader_service, 'equipment_data'):
                    equip_data = loader_service.equipment_data.get(disk.game_id)
                    if equip_data and 'CHS' in equip_data:
                        disk.set_name_cn = equip_data['CHS'].get('name', '')
                        disk.set_name = equip_data.get('EN', {}).get('name', '')
                save.drive_disks[k] = disk

        if 'wengines' in data:
            save.wengines = {}
            for k, v in data['wengines'].items():
                wengine = cls._dict_to_wengine(v)
                # 设置ID为字典键
                wengine.id = k
                # 填充音擎名称
                if loader_service and hasattr(loader_service, 'weapon_data'):
                    weapon_info = loader_service.weapon_data.get(wengine.wengine_id)
                    if weapon_info:
                        wengine.name = weapon_info.get('CHS', '')
                # ⚠️ 从游戏数据中加载音擎基础属性
                if loader_service and hasattr(loader_service, '_load_wengine_game_data'):
                    loader_service._load_wengine_game_data(wengine)
                save.wengines[k] = wengine

        return save
