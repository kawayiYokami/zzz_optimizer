"""
战斗快照数据类
"""

from dataclasses import dataclass, field
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from optimizer.zzz_models.agent import Agent
    from optimizer.zzz_models.buff import Buff
    from optimizer.zzz_models.combat_stats import CombatStats


@dataclass
class CombatSnapshot:
    """战斗快照

    存储战斗状态的快照，支持增量更新

    三层属性缓存机制：
    - bare_stats: 角色裸属性（来自角色本身）
    - equipment_stats: 装备属性增量（音擎+驱动盘）
    - buff_stats: buff属性增量
    - final_stats: 最终面板 = bare_stats + equipment_stats + buff_stats

    增量更新策略：
    - 角色切换：完全重建快照
    - 装备变更：只更新 equipment_stats 和 final_stats
    - buff变更：只更新 buff_stats 和 final_stats
    """

    # 角色
    front_agent: "Agent"
    back_agents: List["Agent"] = field(default_factory=list)  # 暂时保留，不实现

    # Buff列表
    buffs: List["Buff"] = field(default_factory=list)

    # 三层属性缓存
    bare_stats: Optional["CombatStats"] = None  # 裸属性
    equipment_stats: Optional["CombatStats"] = None  # 装备属性增量
    buff_stats: Optional["CombatStats"] = None  # buff属性增量

    # 最终面板
    final_stats: Optional["CombatStats"] = None

    # 缓存的装备ID（用于检测装备变更）
    _cached_wengine_id: Optional[int] = None
    _cached_disk_ids: List[int] = field(default_factory=list)

    def needs_full_rebuild(self, new_agent: "Agent") -> bool:
        """检测是否需要完全重建快照（角色切换）

        Args:
            new_agent: 新的前台角色

        Returns:
            是否需要完全重建
        """
        return self.front_agent.id != new_agent.id

    def needs_equipment_update(self) -> bool:
        """检测是否需要更新装备层

        Returns:
            是否需要更新装备
        """
        current_wengine_id = self.front_agent.wengine.id if self.front_agent.wengine else None
        current_disk_ids = sorted([d.id for d in self.front_agent.drive_disks])

        return (
            current_wengine_id != self._cached_wengine_id or
            current_disk_ids != self._cached_disk_ids
        )

    def needs_buff_update(self, new_buffs: List["Buff"]) -> bool:
        """检测是否需要更新buff层

        Args:
            new_buffs: 新的buff列表

        Returns:
            是否需要更新buff
        """
        # 比较buff列表是否变化
        if len(self.buffs) != len(new_buffs):
            return True

        # 比较每个buff的ID和激活状态
        old_buff_states = {(b.id, b.is_active) for b in self.buffs}
        new_buff_states = {(b.id, b.is_active) for b in new_buffs}

        return old_buff_states != new_buff_states

    def update_equipment_cache(self):
        """更新装备缓存"""
        self._cached_wengine_id = self.front_agent.wengine.id if self.front_agent.wengine else None
        self._cached_disk_ids = sorted([d.id for d in self.front_agent.drive_disks])
