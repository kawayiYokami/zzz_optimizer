"""
战斗快照生成器
"""

from typing import List
from optimizer.zzz_models.agent import Agent
from optimizer.zzz_models.buff import Buff
from optimizer.zzz_models.combat_stats import CombatStats
from optimizer.zzz_models.base import PropertyType
from optimizer.services.damage.data.combat_snapshot import CombatSnapshot


class SnapshotGenerator:
    """战斗快照生成器

    负责生成和更新战斗快照，支持增量更新
    """

    @staticmethod
    def generate_snapshot(agent: Agent, buffs: List[Buff] = None) -> CombatSnapshot:
        """生成完整的战斗快照

        Args:
            agent: 前台角色
            buffs: buff列表（可选，如果为None则从agent获取）

        Returns:
            战斗快照
        """
        if buffs is None:
            all_buffs = agent.get_all_buffs()
            buffs = (
                all_buffs.get("core_passive_buffs", []) +
                all_buffs.get("talent_buffs", []) +
                all_buffs.get("wengine_buffs", []) +
                all_buffs.get("drive_disk_buffs", [])
            )

        snapshot = CombatSnapshot(
            front_agent=agent,
            buffs=buffs
        )

        # 计算三层属性
        snapshot.bare_stats = SnapshotGenerator._calculate_bare_stats(agent)
        snapshot.equipment_stats = SnapshotGenerator._calculate_equipment_stats(agent)
        snapshot.buff_stats = SnapshotGenerator._calculate_buff_stats(buffs)

        # 合并得到最终面板
        snapshot.final_stats = SnapshotGenerator._merge_stats(
            snapshot.bare_stats,
            snapshot.equipment_stats,
            snapshot.buff_stats
        )

        # 更新装备缓存
        snapshot.update_equipment_cache()

        return snapshot

    @staticmethod
    def update_snapshot(snapshot: CombatSnapshot, agent: Agent, buffs: List[Buff] = None) -> CombatSnapshot:
        """增量更新快照

        Args:
            snapshot: 现有快照
            agent: 当前角色
            buffs: buff列表（可选）

        Returns:
            更新后的快照
        """
        if buffs is None:
            all_buffs = agent.get_all_buffs()
            buffs = (
                all_buffs.get("core_passive_buffs", []) +
                all_buffs.get("talent_buffs", []) +
                all_buffs.get("wengine_buffs", []) +
                all_buffs.get("drive_disk_buffs", [])
            )

        # 检测是否需要完全重建
        if snapshot.needs_full_rebuild(agent):
            return SnapshotGenerator.generate_snapshot(agent, buffs)

        # 更新角色引用
        snapshot.front_agent = agent

        # 检测装备变更
        if snapshot.needs_equipment_update():
            snapshot.equipment_stats = SnapshotGenerator._calculate_equipment_stats(agent)
            snapshot.update_equipment_cache()

        # 检测buff变更
        if snapshot.needs_buff_update(buffs):
            snapshot.buffs = buffs
            snapshot.buff_stats = SnapshotGenerator._calculate_buff_stats(buffs)

        # 重新合并得到最终面板
        snapshot.final_stats = SnapshotGenerator._merge_stats(
            snapshot.bare_stats,
            snapshot.equipment_stats,
            snapshot.buff_stats
        )

        return snapshot

    @staticmethod
    def _calculate_bare_stats(agent: Agent) -> CombatStats:
        """计算角色裸属性

        Args:
            agent: 角色对象

        Returns:
            裸属性 CombatStats
        """
        bare_stats = agent.get_bare_stats()
        return CombatStats(
            base_atk=bare_stats["atk"],
            base_hp=bare_stats["hp"],
            base_def=bare_stats["def"],
            base_impact=bare_stats["impact"],
            base_anomaly_mastery=bare_stats["anom_mas"],
            base_anomaly_proficiency=bare_stats["anom_prof"],
            crit_rate=bare_stats["crit_rate"] / 100.0,
            crit_dmg=bare_stats["crit_dmg"] / 100.0,
            level=agent.level,
        )

    @staticmethod
    def _calculate_equipment_stats(agent: Agent) -> CombatStats:
        """计算装备属性增量

        Args:
            agent: 角色对象

        Returns:
            装备属性增量 CombatStats
        """
        wengine = agent.wengine
        drive_disks = agent.drive_disks or []

        # 音擎攻击力
        wengine_atk = 0.0
        if wengine and hasattr(wengine, "get_stats_at_level"):
            wengine_stats = wengine.get_stats_at_level(wengine.level, wengine.breakthrough)
            for prop_type, value in wengine_stats.items():
                if prop_type in [PropertyType.ATK, PropertyType.ATK_BASE]:
                    wengine_atk += value

        # 驱动盘属性
        disk_stats = {}
        for disk in drive_disks:
            if hasattr(disk, "get_stats"):
                disk_stat = disk.get_stats()
                for prop_type, value in disk_stat.out_of_combat.items():
                    disk_stats[prop_type] = disk_stats.get(prop_type, 0.0) + value

        # 提取驱动盘属性
        disk_atk_percent = disk_stats.get(PropertyType.ATK_, 0.0) / 100.0
        disk_hp_percent = disk_stats.get(PropertyType.HP_, 0.0) / 100.0
        disk_crit_rate = disk_stats.get(PropertyType.CRIT_, 0.0) / 100.0
        disk_crit_dmg = disk_stats.get(PropertyType.CRIT_DMG_, 0.0) / 100.0
        disk_atk_flat = disk_stats.get(PropertyType.ATK, 0.0)

        return CombatStats(
            atk_flat=wengine_atk + disk_atk_flat,
            atk_percent=disk_atk_percent,
            hp_percent=disk_hp_percent,
            crit_rate=disk_crit_rate,
            crit_dmg=disk_crit_dmg,
        )

    @staticmethod
    def _calculate_buff_stats(buff_list: List[Buff]) -> CombatStats:
        """计算buff属性增量

        Args:
            buff_list: buff列表

        Returns:
            buff属性增量 CombatStats
        """
        # 聚合buff属性
        buff_stats = SnapshotGenerator._aggregate_buff_stats(buff_list)

        out_crit_dmg = buff_stats['out_of_combat'].get('crit_dmg', 0.0) / 100.0
        out_atk_percent = buff_stats['out_of_combat'].get('atk_percent', 0.0)

        in_atk_percent = buff_stats['in_combat'].get('atk_percent', 0.0)
        in_element_dmg = buff_stats['in_combat'].get('element_dmg', 0.0)
        in_anomaly_buildup = buff_stats['in_combat'].get('anomaly_buildup', 0.0)
        in_anomaly_dmg = buff_stats['in_combat'].get('anomaly_dmg', 0.0)
        in_crit_rate = buff_stats['in_combat'].get('crit_rate', 0.0)
        in_crit_dmg = buff_stats['in_combat'].get('crit_dmg', 0.0)
        in_anomaly_mastery = buff_stats['in_combat'].get('anomaly_mastery', 0.0)
        in_anomaly_proficiency = buff_stats['in_combat'].get('anomaly_proficiency', 0.0)

        return CombatStats(
            atk_percent=out_atk_percent + in_atk_percent,
            crit_rate=in_crit_rate,
            crit_dmg=out_crit_dmg + in_crit_dmg,
            element_dmg_bonus=in_element_dmg,
            anomaly_buildup_efficiency=in_anomaly_buildup,
            anomaly_dmg_bonus=in_anomaly_dmg,
            anomaly_mastery_flat=in_anomaly_mastery,
            anomaly_proficiency_flat=in_anomaly_proficiency,
        )

    @staticmethod
    def _aggregate_buff_stats(buff_list: List[Buff]) -> dict:
        """从buff列表中统计增益

        Args:
            buff_list: buff对象列表

        Returns:
            包含各类增益的字典
        """
        # 局外增益
        out_crit_dmg = 0.0
        out_atk_percent = 0.0

        # 局内增益
        in_atk_percent = 0.0
        in_element_dmg = 0.0
        in_anomaly_buildup = 0.0
        in_anomaly_dmg = 0.0
        in_crit_rate = 0.0
        in_crit_dmg = 0.0
        in_anomaly_mastery = 0.0
        in_anomaly_proficiency = 0.0

        for buff in buff_list:
            # 局外增益
            if hasattr(buff, 'out_of_combat_stats') and buff.out_of_combat_stats:
                for prop_type, value in buff.out_of_combat_stats.items():
                    if prop_type == PropertyType.CRIT_DMG_:
                        out_crit_dmg += value
                    elif prop_type == PropertyType.ATK_:
                        out_atk_percent += value / 100.0

            # 局内增益
            if hasattr(buff, 'in_combat_stats') and buff.in_combat_stats:
                for prop_type, value in buff.in_combat_stats.items():
                    prop_name = prop_type.name
                    if prop_name == 'ICE_ANOMALY_BUILDUP_':
                        in_anomaly_buildup += value / 100.0
                    elif prop_name == 'ANOMALY_DMG_':
                        in_anomaly_dmg += value / 100.0
                    elif prop_name == 'CRIT_':
                        in_crit_rate += value / 100.0
                    elif prop_name == 'CRIT_DMG_':
                        in_crit_dmg += value / 100.0
                    elif prop_name == 'ATK_':
                        in_atk_percent += value / 100.0
                    elif prop_name in ['ENHANCED_SPECIAL_DMG_', 'ICE_DMG_', 'FIRE_DMG_',
                                      'ELECTRIC_DMG_', 'ETHER_DMG_', 'PHYSICAL_DMG_']:
                        in_element_dmg += value / 100.0
                    elif prop_name == 'ANOM_MAS_':
                        in_anomaly_mastery += value
                    elif prop_name == 'ANOM_PROF_':
                        in_anomaly_proficiency += value

        return {
            'out_of_combat': {
                'crit_dmg': out_crit_dmg,
                'atk_percent': out_atk_percent,
            },
            'in_combat': {
                'atk_percent': in_atk_percent,
                'element_dmg': in_element_dmg,
                'anomaly_buildup': in_anomaly_buildup,
                'anomaly_dmg': in_anomaly_dmg,
                'crit_rate': in_crit_rate,
                'crit_dmg': in_crit_dmg,
                'anomaly_mastery': in_anomaly_mastery,
                'anomaly_proficiency': in_anomaly_proficiency,
            }
        }

    @staticmethod
    def _merge_stats(bare: CombatStats, equipment: CombatStats, buff: CombatStats) -> CombatStats:
        """合并三层属性得到最终面板

        Args:
            bare: 裸属性
            equipment: 装备属性增量
            buff: buff属性增量

        Returns:
            最终面板 CombatStats
        """
        # 计算最终属性
        # 四大基础属性：(裸属性 + 装备固定值) * (1 + 装备百分比 + buff百分比)
        final_atk = (bare.base_atk + equipment.atk_flat) * (
            1 + equipment.atk_percent + buff.atk_percent
        )
        final_hp = bare.base_hp * (1 + equipment.hp_percent + buff.hp_percent)
        final_def = bare.base_def * (1 + equipment.def_percent + buff.def_percent)
        final_impact = bare.base_impact * (1 + equipment.impact_percent + buff.impact_percent)

        # 其他属性：直接相加
        final_crit_rate = bare.crit_rate + equipment.crit_rate + buff.crit_rate
        final_crit_dmg = bare.crit_dmg + equipment.crit_dmg + buff.crit_dmg

        return CombatStats(
            # 四大基础属性（局外最终值作为局内基础）
            base_atk=final_atk,
            base_hp=final_hp,
            base_def=final_def,
            base_impact=final_impact,
            # 其他基础属性
            base_anomaly_mastery=bare.base_anomaly_mastery,
            base_anomaly_proficiency=bare.base_anomaly_proficiency,
            # 暴击属性
            crit_rate=final_crit_rate,
            crit_dmg=final_crit_dmg,
            # 局内 Buff
            atk_percent=buff.atk_percent,
            element_dmg_bonus=buff.element_dmg_bonus,
            anomaly_buildup_efficiency=buff.anomaly_buildup_efficiency,
            anomaly_dmg_bonus=buff.anomaly_dmg_bonus,
            anomaly_mastery_flat=buff.anomaly_mastery_flat,
            anomaly_proficiency_flat=buff.anomaly_proficiency_flat,
            level=bare.level,
        )
