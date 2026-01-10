"""
战斗属性工厂

从 Agent 创建 CombatStats，支持临时替换装备进行计算。

设计原则：
1. 如果提供了新装备，临时修改装备引用
2. 调用 agent.get_combat_stats() 获取最终属性
3. 不修改原始 Agent 对象
"""
from typing import Optional, List
from optimizer.zzz_models.agent import Agent
from optimizer.zzz_models.wengine import WEngine
from optimizer.zzz_models.drive_disk import DriveDisk
from optimizer.zzz_models.combat_stats import CombatStats


def create_combat_stats_from_agent(
    agent: Agent,
    wengine: Optional[WEngine] = None,
    drive_disks: Optional[List[DriveDisk]] = None
) -> CombatStats:
    """从 Agent 创建 CombatStats，支持临时装备替换

    逻辑：
    1. 如果提供了新装备，设置到 agent 上
    2. 调用 agent.get_combat_stats() 获取战斗属性
    3. 恢复原始装备引用（不影响原始 Agent）

    Args:
        agent: 角色对象
        wengine: 可选的新音擎
        drive_disks: 可选的新驱动盘列表（6个）

    Returns:
        CombatStats 对象
    """
    # 保存原始装备引用
    original_wengine = agent.equipped_wengine
    original_disks = agent.equipped_drive_disks.copy() if agent.equipped_drive_disks else []

    # 保存原始字典引用
    original_wengine_dict = getattr(agent, '_wengine_dict', None)
    original_drive_disks_dict = getattr(agent, '_drive_disks_dict', None)
    original_data_loader = getattr(agent, '_data_loader', None)

    try:
        # 设置临时装备
        if wengine is not None:
            agent.equipped_wengine = wengine
            agent._wengine_dict = {wengine.id: wengine}

        if drive_disks is not None:
            # 将 DriveDisk 对象列表转换为 ID 列表
            agent.equipped_drive_disks = [disk.id for disk in drive_disks]
            # 创建临时字典
            agent._drive_disks_dict = {disk.id: disk for disk in drive_disks}

        # 如果没有提供 data_loader，尝试从 agent 获取
        if not hasattr(agent, '_data_loader') or agent._data_loader is None:
            # 创建一个简单的获取套装buff的方式
            # 这里需要传入 data_loader 才能获取驱动盘套装效果
            pass

        # 调用 agent 的方法获取战斗属性
        combat_stats = agent.get_combat_stats()

        return combat_stats

    finally:
        # 恢复原始装备引用
        agent.equipped_wengine = original_wengine
        agent.equipped_drive_disks = original_disks

        # 恢复原始字典引用
        if original_wengine_dict is not None:
            agent._wengine_dict = original_wengine_dict
        if original_drive_disks_dict is not None:
            agent._drive_disks_dict = original_drive_disks_dict
        if original_data_loader is not None:
            agent._data_loader = original_data_loader
