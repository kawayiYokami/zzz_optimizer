"""
优化器主类

负责管理所有服务并提供统一的访问接口
"""
from pathlib import Path
from typing import Optional

from optimizer.services.data_loader_service import DataLoaderService
from optimizer.services.agent_service import AgentService
from optimizer.services.drive_disk_service import DriveDiskService
from optimizer.services.wengine_service import WEngineService


class Optimizer:
    """优化器主类

    作为最上级管理类，负责：
    1. 初始化所有服务
    2. 提供统一的服务访问接口
    3. 管理数据加载流程
    """

    def __init__(
        self,
        game_data_dir: Optional[Path] = None,
        user_data_dir: Optional[Path] = None
    ):
        """初始化优化器

        Args:
            game_data_dir: 游戏数据目录路径，默认为 assets/inventory_data
            user_data_dir: 用户数据目录路径，默认为 .debug/inventory_exports
        """
        # 设置默认路径
        if game_data_dir is None:
            game_data_dir = Path("assets/inventory_data")
        if user_data_dir is None:
            user_data_dir = Path(".debug/inventory_exports")

        # 初始化数据加载服务
        self.data_loader = DataLoaderService(
            game_data_dir=game_data_dir,
            user_data_dir=user_data_dir
        )

        # 初始化各个服务
        self.agent_service = AgentService(self.data_loader)
        self.drive_disk_service = DriveDiskService(self.data_loader)
        self.wengine_service = WEngineService(self.data_loader)

        # 标记是否已加载数据
        self._game_data_loaded = False
        self._user_data_loaded = False

    def load_game_data(self) -> None:
        """加载游戏基础数据"""
        if not self._game_data_loaded:
            print("正在加载游戏基础数据...")
            self.data_loader.load_game_data()
            self._game_data_loaded = True
            print("游戏基础数据加载完成")

    def load_user_data(self, filename: Optional[str] = None) -> None:
        """加载用户数据

        Args:
            filename: 指定要加载的文件名，如果为None则加载最新的文件
        """
        if not self._user_data_loaded:
            print("正在加载用户数据...")
            self.data_loader.load_user_data(filename)
            self._user_data_loaded = True
            print("用户数据加载完成")

    def initialize(self, user_data_filename: Optional[str] = None) -> None:
        """初始化优化器（加载所有数据）

        Args:
            user_data_filename: 指定要加载的用户数据文件名
        """
        self.load_game_data()
        self.load_user_data(user_data_filename)

    @property
    def is_ready(self) -> bool:
        """检查优化器是否已准备就绪

        Returns:
            如果游戏数据和用户数据都已加载则返回True
        """
        return self._game_data_loaded and self._user_data_loaded

    def print_summary(self) -> None:
        """打印优化器数据摘要"""
        if not self.is_ready:
            print("优化器未初始化，请先调用 initialize() 方法")
            return

        print("\n" + "="*60)
        print("优化器数据摘要")
        print("="*60)

        # 角色统计
        agents = self.agent_service.get_all_agents()
        print(f"\n角色数量: {len(agents)}")

        # 驱动盘统计
        drive_disks = self.drive_disk_service.get_all_drive_disks()
        equipped_disks = [d for d in drive_disks if d.equipped_agent is not None]
        print(f"\n驱动盘数量: {len(drive_disks)}")
        print(f"  已装备: {len(equipped_disks)}")
        print(f"  未装备: {len(drive_disks) - len(equipped_disks)}")

        # 音擎统计
        wengines = self.wengine_service.get_all_wengines()
        equipped_wengines = [w for w in wengines if w.equipped_agent is not None]
        print(f"\n音擎数量: {len(wengines)}")
        print(f"  已装备: {len(equipped_wengines)}")
        print(f"  未装备: {len(wengines) - len(equipped_wengines)}")

        print("\n" + "="*60 + "\n")
