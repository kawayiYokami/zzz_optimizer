"""
驱动盘服务

负责驱动盘数据的查询和管理
"""
from typing import Dict, List, Optional

from optimizer.zzz_models import DriveDisk
from optimizer.services.data_loader_service import DataLoaderService


class DriveDiskService:
    """驱动盘服务

    提供驱动盘数据的查询功能
    """

    def __init__(self, data_loader: DataLoaderService):
        """初始化驱动盘服务

        Args:
            data_loader: 数据加载服务实例
        """
        self.data_loader = data_loader

    def get_drive_disk_by_id(self, disk_id: str) -> Optional[DriveDisk]:
        """根据ID获取驱动盘

        Args:
            disk_id: 驱动盘ID

        Returns:
            驱动盘对象，如果不存在则返回None
        """
        disks = self.data_loader.user_drive_disks
        for disk in disks:
            if disk.id == disk_id:
                return disk
        return None

    def get_all_drive_disks(self) -> List[DriveDisk]:
        """获取所有驱动盘

        Returns:
            驱动盘列表
        """
        return self.data_loader.user_drive_disks

    def get_drive_disks_by_set(self, set_name: str) -> List[DriveDisk]:
        """根据套装名称获取驱动盘

        Args:
            set_name: 套装名称（英文）

        Returns:
            驱动盘列表
        """
        disks = self.data_loader.user_drive_disks
        return [disk for disk in disks if disk.set_name == set_name]

    def get_drive_disks_by_position(self, position: int) -> List[DriveDisk]:
        """根据位置获取驱动盘

        Args:
            position: 驱动盘位置 (1-6)

        Returns:
            驱动盘列表
        """
        disks = self.data_loader.user_drive_disks
        return [disk for disk in disks if disk.position == position]

    def get_drive_disks_by_agent(self, agent_id: str) -> List[DriveDisk]:
        """根据角色ID获取已装备的驱动盘

        Args:
            agent_id: 角色ID

        Returns:
            驱动盘列表
        """
        disks = self.data_loader.user_drive_disks
        return [disk for disk in disks if disk.equipped_agent == agent_id]

    def get_unequipped_drive_disks(self) -> List[DriveDisk]:
        """获取未装备的驱动盘

        Returns:
            驱动盘列表
        """
        disks = self.data_loader.user_drive_disks
        return [disk for disk in disks if disk.equipped_agent is None]

    def get_drive_disk_set_data(self, set_id: str) -> Optional[Dict]:
        """获取驱动盘套装的游戏基础数据

        Args:
            set_id: 套装ID（如 "33500"）

        Returns:
            套装游戏数据字典，如果不存在则返回None
        """
        equipment_data = self.data_loader.equipment_data
        return equipment_data.get(set_id)

    def print_drive_disk_info(self, disk: DriveDisk) -> None:
        """打印驱动盘详细信息

        Args:
            disk: 驱动盘对象
        """
        print(f"\n{'='*60}")
        print(f"驱动盘信息: {disk.set_name_cn}")
        print(f"{'='*60}")
        print(f"ID: {disk.id}")
        print(f"套装: {disk.set_name} ({disk.set_name_cn})")
        print(f"位置: {disk.position}号位")
        print(f"稀有度: {disk.rarity.name}")
        print(f"等级: {disk.level}/15")

        print(f"\n主属性:")
        print(f"  {disk.main_stat.name}: {disk.main_stat_value}")

        if disk.sub_stats:
            print(f"\n副属性:")
            for prop_type, stat_value in disk.sub_stats.items():
                print(f"  {prop_type.name}: {stat_value}")

        if disk.equipped_agent:
            print(f"\n装备角色: {disk.equipped_agent}")
        else:
            print(f"\n装备状态: 未装备")

        print(f"{'='*60}\n")
