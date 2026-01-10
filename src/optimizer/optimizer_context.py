"""
优化器上下文 - 统一的实例访问接口

设计理念：
- 上下文对象持有所有游戏对象和服务的引用
- 通过传递上下文，各模块可以方便地访问需要的数据
- 避免模块间的循环依赖和隐式状态
"""
from typing import Optional, Dict, TYPE_CHECKING
from dataclasses import dataclass, field

if TYPE_CHECKING:
    from .zzz_models.agent import Agent
    from .zzz_models.wengine import WEngine
    from .zzz_models.drive_disk import DriveDisk
    from .services.data_loader_service import DataLoaderService
    from .save_data import SaveData


@dataclass
class OptimizerContext:
    """优化器上下文

    统一的实例访问接口，持有所有游戏对象和服务的引用。
    通过传递上下文对象，各模块可以方便地访问需要的数据。

    使用示例:
    ```python
    # 创建上下文
    context = save_data.create_context(data_loader=loader)

    # 通过上下文访问对象
    agent = context.get_agent('10001')
    wengine = context.get_wengine(agent.equipped_wengine)

    # 传递上下文到方法
    formatted_text = agent.format(context=context)
    combat_stats = agent.get_combat_stats(context=context)
    ```
    """
    # 实例字典
    agents: Dict[str, 'Agent'] = field(default_factory=dict)
    wengines: Dict[str, 'WEngine'] = field(default_factory=dict)
    drive_disks: Dict[str, 'DriveDisk'] = field(default_factory=dict)

    # 服务引用
    data_loader: Optional['DataLoaderService'] = None

    def get_agent(self, agent_id: str) -> Optional['Agent']:
        """获取角色

        Args:
            agent_id: 角色ID

        Returns:
            Agent对象，如果不存在返回None
        """
        return self.agents.get(agent_id)

    def get_wengine(self, wengine_id: str) -> Optional['WEngine']:
        """获取音擎

        Args:
            wengine_id: 音擎ID

        Returns:
            WEngine对象，如果不存在返回None
        """
        return self.wengines.get(wengine_id)

    def get_drive_disk(self, disk_id: str) -> Optional['DriveDisk']:
        """获取驱动盘

        Args:
            disk_id: 驱动盘ID

        Returns:
            DriveDisk对象，如果不存在返回None
        """
        return self.drive_disks.get(disk_id)

    def update_from_save(self, save_data: 'SaveData'):
        """从存档更新上下文

        Args:
            save_data: 存档数据对象
        """
        self.agents = save_data.agents
        self.wengines = save_data.wengines
        self.drive_disks = save_data.drive_disks
