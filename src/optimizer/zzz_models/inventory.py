"""
仓库模型
"""
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field

from optimizer.zzz_models.agent import Agent
from optimizer.zzz_models.wengine import WEngine
from optimizer.zzz_models.drive_disk import DriveDisk, DriveDiskPosition, DriveDiskCollection


@dataclass
class Inventory:
    """
    仓库数据模型
    
    统一管理所有游戏资源：
    - 角色
    - 音擎
    - 驱动盘
    """
    agents: Dict[str, Agent] = field(default_factory=dict)              # 角色列表 {id: Agent}
    wengines: Dict[str, WEngine] = field(default_factory=dict)          # 音擎列表 {id: WEngine}
    drive_disks: Dict[str, DriveDisk] = field(default_factory=dict)     # 驱动盘列表 {id: DriveDisk}
    
    # ==================== 添加资源 ====================
    
    def add_agent(self, agent: Agent) -> None:
        """添加角色"""
        self.agents[agent.id] = agent
    
    def add_wengine(self, wengine: WEngine) -> None:
        """添加音擎"""
        self.wengines[wengine.id] = wengine
    
    def add_drive_disk(self, disk: DriveDisk) -> None:
        """添加驱动盘"""
        self.drive_disks[disk.id] = disk
    
    # ==================== 查询资源 ====================
    
    def get_agent(self, agent_id: str) -> Optional[Agent]:
        """获取角色"""
        return self.agents.get(agent_id)
    
    def get_wengine(self, wengine_id: str) -> Optional[WEngine]:
        """获取音擎"""
        return self.wengines.get(wengine_id)
    
    def get_drive_disk(self, disk_id: str) -> Optional[DriveDisk]:
        """获取驱动盘"""
        return self.drive_disks.get(disk_id)
    
    # ==================== 筛选资源 ====================
    
    def get_unequipped_wengines(self, weapon_type=None) -> List[WEngine]:
        """
        获取未装备的音擎
        
        Args:
            weapon_type: 武器类型筛选，None表示不筛选
            
        Returns:
            未装备音擎列表
        """
        wengines = [w for w in self.wengines.values() if not w.is_equipped]
        
        if weapon_type:
            wengines = [w for w in wengines if w.weapon_type == weapon_type]
        
        return wengines
    
    def get_unequipped_drive_disks(self, position: DriveDiskPosition = None) -> List[DriveDisk]:
        """
        获取未装备的驱动盘
        
        Args:
            position: 位置筛选，None表示不筛选
            
        Returns:
            未装备驱动盘列表
        """
        disks = [d for d in self.drive_disks.values() if not d.is_equipped]
        
        if position:
            disks = [d for d in disks if d.position == position]
        
        return disks
    
    def get_drive_disks_by_set(self, set_name: str, equipped: bool = None) -> List[DriveDisk]:
        """
        获取指定套装的驱动盘
        
        Args:
            set_name: 套装名称
            equipped: True=仅已装备，False=仅未装备，None=全部
            
        Returns:
            驱动盘列表
        """
        disks = [d for d in self.drive_disks.values() if d.set_name == set_name]
        
        if equipped is not None:
            disks = [d for d in disks if d.is_equipped == equipped]
        
        return disks
    
    # ==================== 装备管理 ====================
    
    def equip_wengine(self, agent_id: str, wengine_id: str) -> bool:
        """
        为角色装备音擎
        
        Args:
            agent_id: 角色ID
            wengine_id: 音擎ID
            
        Returns:
            是否成功
        """
        agent = self.get_agent(agent_id)
        wengine = self.get_wengine(wengine_id)
        
        if not agent or not wengine:
            return False
        
        # 卸载原音擎
        if agent.equipped_wengine:
            old_wengine = self.get_wengine(agent.equipped_wengine)
            if old_wengine:
                old_wengine.equipped_agent = None
        
        # 如果音擎已装备在其他角色上，先卸载
        if wengine.equipped_agent and wengine.equipped_agent != agent_id:
            old_agent = self.get_agent(wengine.equipped_agent)
            if old_agent:
                old_agent.equipped_wengine = None
        
        # 装备新音擎
        agent.equipped_wengine = wengine_id
        wengine.equipped_agent = agent_id
        
        return True
    
    def unequip_wengine(self, agent_id: str) -> bool:
        """
        卸载角色的音擎
        
        Args:
            agent_id: 角色ID
            
        Returns:
            是否成功
        """
        agent = self.get_agent(agent_id)
        if not agent or not agent.equipped_wengine:
            return False
        
        wengine = self.get_wengine(agent.equipped_wengine)
        if wengine:
            wengine.equipped_agent = None
        
        agent.equipped_wengine = None
        return True
    
    def equip_drive_disk(self, agent_id: str, disk_id: str) -> bool:
        """
        为角色装备驱动盘
        
        Args:
            agent_id: 角色ID
            disk_id: 驱动盘ID
            
        Returns:
            是否成功
        """
        agent = self.get_agent(agent_id)
        disk = self.get_drive_disk(disk_id)
        
        if not agent or not disk:
            return False
        
        # 如果驱动盘已装备在其他角色上，先卸载
        if disk.equipped_agent and disk.equipped_agent != agent_id:
            old_agent = self.get_agent(disk.equipped_agent)
            if old_agent and disk_id in old_agent.equipped_drive_disks:
                old_agent.equipped_drive_disks.remove(disk_id)
        
        # 如果该位置已有驱动盘，先卸载
        for existing_disk_id in agent.equipped_drive_disks[:]:
            existing_disk = self.get_drive_disk(existing_disk_id)
            if existing_disk and existing_disk.position == disk.position:
                agent.equipped_drive_disks.remove(existing_disk_id)
                existing_disk.equipped_agent = None
        
        # 装备新驱动盘
        if disk_id not in agent.equipped_drive_disks:
            agent.equipped_drive_disks.append(disk_id)
        disk.equipped_agent = agent_id
        
        return True
    
    def unequip_drive_disk(self, agent_id: str, position: DriveDiskPosition) -> bool:
        """
        卸载角色指定位置的驱动盘
        
        Args:
            agent_id: 角色ID
            position: 位置
            
        Returns:
            是否成功
        """
        agent = self.get_agent(agent_id)
        if not agent:
            return False
        
        for disk_id in agent.equipped_drive_disks[:]:
            disk = self.get_drive_disk(disk_id)
            if disk and disk.position == position:
                agent.equipped_drive_disks.remove(disk_id)
                disk.equipped_agent = None
                return True
        
        return False
    
    def unequip_all_drive_disks(self, agent_id: str) -> bool:
        """
        卸载角色的所有驱动盘
        
        Args:
            agent_id: 角色ID
            
        Returns:
            是否成功
        """
        agent = self.get_agent(agent_id)
        if not agent:
            return False
        
        for disk_id in agent.equipped_drive_disks[:]:
            disk = self.get_drive_disk(disk_id)
            if disk:
                disk.equipped_agent = None
        
        agent.equipped_drive_disks.clear()
        return True
    
    # ==================== 装备查询 ====================
    
    def get_agent_equipment(self, agent_id: str) -> Tuple[Optional[WEngine], List[DriveDisk]]:
        """
        获取角色装备
        
        Args:
            agent_id: 角色ID
            
        Returns:
            (音擎, 驱动盘列表)
        """
        agent = self.get_agent(agent_id)
        if not agent:
            return None, []
        
        # 获取音擎
        wengine = None
        if agent.equipped_wengine:
            wengine = self.get_wengine(agent.equipped_wengine)
        
        # 获取驱动盘
        disks = []
        for disk_id in agent.equipped_drive_disks:
            disk = self.get_drive_disk(disk_id)
            if disk:
                disks.append(disk)
        
        # 按位置排序
        disks.sort(key=lambda d: d.position.value)
        
        return wengine, disks
    
    def get_agent_drive_disk_collection(self, agent_id: str) -> DriveDiskCollection:
        """
        获取角色的驱动盘收藏
        
        Args:
            agent_id: 角色ID
            
        Returns:
            驱动盘收藏
        """
        collection = DriveDiskCollection(agent_id=agent_id)
        
        _, disks = self.get_agent_equipment(agent_id)
        for disk in disks:
            collection.add_disk(disk)
        
        return collection
    
    # ==================== 统计信息 ====================
    
    def get_statistics(self) -> dict:
        """获取统计信息"""
        return {
            'total_agents': len(self.agents),
            'total_wengines': len(self.wengines),
            'total_drive_disks': len(self.drive_disks),
            'unequipped_wengines': len(self.get_unequipped_wengines()),
            'unequipped_drive_disks': len(self.get_unequipped_drive_disks()),
            'max_level_agents': len([a for a in self.agents.values() if a.is_max_level]),
            'fully_built_agents': len([a for a in self.agents.values() if a.is_fully_built]),
        }
    
    def __str__(self) -> str:
        """字符串表示"""
        stats = self.get_statistics()
        return (
            f"仓库统计:\n"
            f"  角色: {stats['total_agents']} (满级: {stats['max_level_agents']}, 完全养成: {stats['fully_built_agents']})\n"
            f"  音擎: {stats['total_wengines']} (未装备: {stats['unequipped_wengines']})\n"
            f"  驱动盘: {stats['total_drive_disks']} (未装备: {stats['unequipped_drive_disks']})"
        )