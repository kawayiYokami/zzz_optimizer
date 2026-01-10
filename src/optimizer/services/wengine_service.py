"""
音擎服务

负责音擎数据的查询和管理
"""
from typing import Dict, List, Optional

from optimizer.zzz_models import WEngine
from optimizer.services.data_loader_service import DataLoaderService


class WEngineService:
    """音擎服务

    提供音擎数据的查询功能
    """

    def __init__(self, data_loader: DataLoaderService):
        """初始化音擎服务

        Args:
            data_loader: 数据加载服务实例
        """
        self.data_loader = data_loader

    def get_wengine_by_id(self, wengine_id: str) -> Optional[WEngine]:
        """根据ID获取音擎

        Args:
            wengine_id: 音擎ID

        Returns:
            音擎对象，如果不存在则返回None
        """
        wengines = self.data_loader.user_wengines
        for wengine in wengines:
            if wengine.id == wengine_id:
                return wengine
        return None

    def get_all_wengines(self) -> List[WEngine]:
        """获取所有音擎

        Returns:
            音擎列表
        """
        return self.data_loader.user_wengines

    def get_wengines_by_name(self, name: str) -> List[WEngine]:
        """根据名称获取音擎

        Args:
            name: 音擎名称（英文）

        Returns:
            音擎列表
        """
        wengines = self.data_loader.user_wengines
        return [w for w in wengines if w.name == name]

    def get_wengines_by_rarity(self, rarity: int) -> List[WEngine]:
        """根据稀有度获取音擎

        Args:
            rarity: 稀有度（2-4）

        Returns:
            音擎列表
        """
        wengines = self.data_loader.user_wengines
        return [w for w in wengines if w.rarity.value == rarity]

    def get_wengines_by_weapon_type(self, weapon_type: int) -> List[WEngine]:
        """根据武器类型获取音擎

        Args:
            weapon_type: 武器类型

        Returns:
            音擎列表
        """
        wengines = self.data_loader.user_wengines
        return [w for w in wengines if w.weapon_type.value == weapon_type]

    def get_wengine_by_agent(self, agent_id: str) -> Optional[WEngine]:
        """根据角色ID获取已装备的音擎

        Args:
            agent_id: 角色ID

        Returns:
            音擎对象，如果不存在则返回None
        """
        wengines = self.data_loader.user_wengines
        for wengine in wengines:
            if wengine.equipped_agent == agent_id:
                return wengine
        return None

    def get_unequipped_wengines(self) -> List[WEngine]:
        """获取未装备的音擎

        Returns:
            音擎列表
        """
        wengines = self.data_loader.user_wengines
        return [w for w in wengines if w.equipped_agent is None]

    def get_wengine_game_data(self, wengine_id: str) -> Optional[Dict]:
        """获取音擎的游戏基础数据

        Args:
            wengine_id: 音擎ID（游戏内ID，如 "14104"）

        Returns:
            音擎游戏数据字典，如果不存在则返回None
        """
        weapon_data = self.data_loader.weapon_data
        return weapon_data.get(wengine_id)

    def print_wengine_info(self, wengine: WEngine) -> None:
        """打印音擎详细信息

        Args:
            wengine: 音擎对象
        """
        print(f"\n{'='*60}")
        print(f"音擎信息: {wengine.name_cn} ({wengine.name})")
        print(f"{'='*60}")
        print(f"ID: {wengine.id}")
        print(f"稀有度: {wengine.rarity.name}")
        print(f"武器类型: {wengine.weapon_type.name}")
        print(f"等级: {wengine.level}/60")
        print(f"精炼等级: {wengine.refinement}/5")

        print(f"\n基础属性:")
        print(f"  基础攻击力: {wengine.base_atk}")

        if wengine.special_stat:
            print(f"\n特殊属性:")
            print(f"  {wengine.special_stat.name}: {wengine.special_stat_value}")

        if wengine.equipped_agent:
            print(f"\n装备角色: {wengine.equipped_agent}")
        else:
            print(f"\n装备状态: 未装备")

        print(f"{'='*60}\n")
