"""
角色服务

负责角色数据的查询和管理
"""
from typing import Dict, List, Optional

from optimizer.zzz_models import Agent
from optimizer.services.data_loader_service import DataLoaderService


class AgentService:
    """角色服务

    提供角色数据的查询功能
    """

    def __init__(self, data_loader: DataLoaderService):
        """初始化角色服务

        Args:
            data_loader: 数据加载服务实例
        """
        self.data_loader = data_loader

    def get_agent_by_id(self, agent_id: str) -> Optional[Agent]:
        """根据ID获取角色

        Args:
            agent_id: 角色ID

        Returns:
            角色对象，如果不存在则返回None
        """
        agents = self.data_loader.user_agents
        for agent in agents:
            if agent.id == agent_id:
                return agent
        return None

    def get_agent_by_code(self, code: str) -> Optional[Agent]:
        """根据代号获取角色

        Args:
            code: 角色代号（如 "Miyabi", "Qingyi"）

        Returns:
            角色对象，如果不存在则返回None
        """
        agents = self.data_loader.user_agents
        for agent in agents:
            if agent.game_id == game_id:
                return agent
        return None

    def get_all_agents(self) -> List[Agent]:
        """获取所有角色

        Returns:
            角色列表
        """
        return self.data_loader.user_agents

    def get_agents_by_element(self, element: int) -> List[Agent]:
        """根据元素类型获取角色

        Args:
            element: 元素类型

        Returns:
            角色列表
        """
        agents = self.data_loader.user_agents
        return [agent for agent in agents if agent.element.value == element]

    def get_agents_by_weapon_type(self, weapon_type: int) -> List[Agent]:
        """根据武器类型获取角色

        Args:
            weapon_type: 武器类型

        Returns:
            角色列表
        """
        agents = self.data_loader.user_agents
        return [agent for agent in agents if agent.weapon_type.value == weapon_type]

    def get_agent_game_data(self, agent_id: str) -> Optional[Dict]:
        """获取角色的游戏基础数据

        Args:
            agent_id: 角色ID（游戏内ID，如 "1251"）

        Returns:
            角色游戏数据字典，如果不存在则返回None
        """
        character_data = self.data_loader.character_data
        return character_data.get(agent_id)

    def print_agent_info(self, agent: Agent) -> None:
        """打印角色详细信息

        Args:
            agent: 角色对象
        """
        print(f"\n{'='*60}")
        print(f"角色信息: {agent.name_cn} (game_id={agent.game_id})")
        print(f"{'='*60}")
        print(f"ID: {agent.id}")
        print(f"游戏ID: {agent.game_id}")
        print(f"突破: {agent.breakthrough}")
        print(f"稀有度: {agent.rarity.name}")
        print(f"元素: {agent.element.name}")
        print(f"武器类型: {agent.weapon_type.name}")
        print(f"影院等级: {agent.cinema}")
        print(f"核心技能等级: {agent.core_skill}")

        print(f"\n技能等级:")
        print(f"  普通攻击: {agent.skills.normal}/12")
        print(f"  闪避反击: {agent.skills.dodge}/12")
        print(f"  支援技: {agent.skills.assist}/12")
        print(f"  特殊技: {agent.skills.special}/12")
        print(f"  连携技: {agent.skills.chain}/12")
        print(f"  总技能等级: {agent.skills.normal + agent.skills.dodge + agent.skills.assist + agent.skills.special + agent.skills.chain}")

        # 显示计算后的属性
        if hasattr(agent, '_stats') and agent._stats:
            print(f"\n计算属性:")
            print(f"  生命值: {agent._stats.get('hp', 0):.0f}")
            print(f"  攻击力: {agent._stats.get('atk', 0):.0f}")
            print(f"  防御力: {agent._stats.get('def', 0):.0f}")
            print(f"  冲击力: {agent._stats.get('impact', 0):.0f}")
            print(f"  暴击率: {agent._stats.get('crit_rate', 0):.1f}%")
            print(f"  暴击伤害: {agent._stats.get('crit_dmg', 0):.1f}%")
            print(f"  异常掌控: {agent._stats.get('anom_mas', 0):.0f}")
            print(f"  异常精通: {agent._stats.get('anom_prof', 0):.0f}")
            print(f"  闪能自动累积: {agent._stats.get('ener_regen', 0):.1f}")

        if agent.equipped_wengine:
            print(f"\n装备音擎: {agent.equipped_wengine}")

        if agent.equipped_drive_disks:
            print(f"\n装备驱动盘: {len(agent.equipped_drive_disks)} 件")
            for disk_id in agent.equipped_drive_disks:
                print(f"  - {disk_id}")

        print(f"{'='*60}\n")
