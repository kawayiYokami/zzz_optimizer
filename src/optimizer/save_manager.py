"""存档管理器"""
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from optimizer.save_data import SaveData
from optimizer.zzz_models.agent import Agent
from optimizer.zzz_models.drive_disk import DriveDisk
from optimizer.zzz_models.wengine import WEngine
from optimizer.services.data_loader_service import DataLoaderService


class SaveManager:
    """存档管理器"""

    def __init__(self, save_dir: str = ".debug/saves"):
        self.save_dir = Path(save_dir)
        self.save_dir.mkdir(parents=True, exist_ok=True)
        self.saves: Dict[str, SaveData] = {}
        self.current_save: Optional[str] = None
        self.loader_service: Optional[DataLoaderService] = None
        self._current_context: Optional['OptimizerContext'] = None  # 上下文缓存
        self._load_config()

    def _load_config(self):
        """加载全局配置"""
        config_path = self.save_dir / "config.json"
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.current_save = config.get("current_save")
            except Exception as e:
                print(f"加载配置失败: {e}")

    def _save_config(self):
        """保存全局配置"""
        config_path = self.save_dir / "config.json"
        config = {
            "current_save": self.current_save,
            "updated_at": datetime.now().isoformat()
        }
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"保存配置失败: {e}")

    def set_loader_service(self, loader_service: DataLoaderService):
        """设置数据加载服务"""
        self.loader_service = loader_service

    def create_save(self, name: str) -> bool:
        """创建新存档"""
        if name in self.saves:
            return False
        self.saves[name] = SaveData(name=name)
        self.current_save = name
        self._persist_save(name)
        self._save_config()
        return True

    def delete_save(self, name: str) -> bool:
        """删除存档"""
        if name not in self.saves:
            return False
        del self.saves[name]
        save_file = self.save_dir / f"{name}.json"
        if save_file.exists():
            save_file.unlink()
        if self.current_save == name:
            self.current_save = None
        self._save_config()
        return True

    def list_saves(self) -> List[str]:
        """列出所有存档"""
        return list(self.saves.keys())

    def switch_save(self, name: str) -> bool:
        """切换当前存档"""
        if name not in self.saves:
            return False
        self.current_save = name
        self._current_context = None  # 清空上下文缓存，下次访问时重新创建
        self._save_config()
        return True

    def get_current_save(self) -> Optional[SaveData]:
        """获取当前存档"""
        if not self.current_save:
            return None
        return self.saves.get(self.current_save)

    def get_current_context(self) -> Optional['OptimizerContext']:
        """获取当前存档的上下文

        Returns:
            OptimizerContext 实例，如果没有当前存档则返回None

        Note:
            上下文会被缓存，直到调用 switch_save() 切换存档时清空
        """
        if not self._current_context:
            current_save = self.get_current_save()
            if current_save:
                self._current_context = current_save.create_context(
                    data_loader=self.loader_service
                )
        return self._current_context

    def import_from_scan(self, inventory_data: dict, overwrite_manual: bool = False):
        """从扫描数据导入更新当前存档

        Args:
            inventory_data: 扫描数据
            overwrite_manual: 是否覆盖手动添加的数据
        """
        save = self.get_current_save()
        if not save or not self.loader_service:
            return False

        # 清空所有"来源于导入的"数据（保留手动添加的）
        if not overwrite_manual:
            # 保留 source="manual" 的数据
            save.agents = {k: v for k, v in save.agents.items() if v.source == "manual"}
            save.drive_disks = {k: v for k, v in save.drive_disks.items() if v.source == "manual"}
            save.wengines = {k: v for k, v in save.wengines.items() if v.source == "manual"}
        else:
            # 覆盖所有数据
            save.agents.clear()
            save.drive_disks.clear()
            save.wengines.clear()

        # 导入新的角色数据
        for char_data in inventory_data.get('characters', []):
            agent = self.loader_service._parse_agent(char_data)
            if agent:
                # 分配新ID
                new_id = str(save._metadata['next_agent_id'])
                save._metadata['next_agent_id'] += 1
                agent.id = new_id
                save.agents[new_id] = agent

        # 导入新的驱动盘数据
        for disk_data in inventory_data.get('discs', []):
            disk = self.loader_service._parse_drive_disk(disk_data)
            if disk:
                # 分配新ID
                new_id = str(save._metadata['next_drive_disk_id'])
                save._metadata['next_drive_disk_id'] += 1
                disk.id = new_id
                save.drive_disks[new_id] = disk

        # 导入新的音擎数据
        for wengine_data in inventory_data.get('wengines', []):
            wengine = self.loader_service._parse_wengine(wengine_data)
            if wengine:
                # 分配新ID
                new_id = str(save._metadata['next_wengine_id'])
                save._metadata['next_wengine_id'] += 1
                wengine.id = new_id
                save.wengines[new_id] = wengine

        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def add_agent_manual(self, agent: Agent) -> bool:
        """手动添加角色"""
        save = self.get_current_save()
        if not save:
            return False
        agent.source = "manual"
        # 分配新ID
        new_id = str(save._metadata['next_agent_id'])
        save._metadata['next_agent_id'] += 1
        agent.id = new_id
        save.agents[new_id] = agent
        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def add_disk_manual(self, disk: DriveDisk) -> bool:
        """手动添加驱动盘"""
        save = self.get_current_save()
        if not save:
            return False
        disk.source = "manual"
        # 分配新ID
        new_id = str(save._metadata['next_drive_disk_id'])
        save._metadata['next_drive_disk_id'] += 1
        disk.id = new_id
        save.drive_disks[new_id] = disk
        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def add_wengine_manual(self, wengine: WEngine) -> bool:
        """手动添加音擎"""
        save = self.get_current_save()
        if not save:
            return False
        wengine.source = "manual"
        # 分配新ID
        new_id = str(save._metadata['next_wengine_id'])
        save._metadata['next_wengine_id'] += 1
        wengine.id = new_id
        save.wengines[new_id] = wengine
        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def remove_agent(self, agent_id: str) -> bool:
        """删除角色"""
        save = self.get_current_save()
        if not save or agent_id not in save.agents:
            return False
        del save.agents[agent_id]
        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def remove_disk(self, disk_id: str) -> bool:
        """删除驱动盘"""
        save = self.get_current_save()
        if not save or disk_id not in save.drive_disks:
            return False
        del save.drive_disks[disk_id]
        save.manual_disk_ids.discard(disk_id)
        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def remove_wengine(self, wengine_id: str) -> bool:
        """删除音擎"""
        save = self.get_current_save()
        if not save or wengine_id not in save.wengines:
            return False
        del save.wengines[wengine_id]
        save.manual_wengine_ids.discard(wengine_id)
        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def equip_wengine(self, agent_id: str, wengine_id: str) -> bool:
        """为角色装备音擎"""
        save = self.get_current_save()
        if not save or agent_id not in save.agents or wengine_id not in save.wengines:
            return False

        agent = save.agents[agent_id]
        wengine = save.wengines[wengine_id]

        # 卸载原音擎
        if agent.equipped_wengine and agent.equipped_wengine in save.wengines:
            save.wengines[agent.equipped_wengine].equipped_agent = None

        # 如果音擎已装备在其他角色上，先卸载
        if wengine.equipped_agent and wengine.equipped_agent in save.agents:
            save.agents[wengine.equipped_agent].equipped_wengine = None

        # 装备新音擎
        agent.equipped_wengine = wengine_id
        wengine.equipped_agent = agent_id

        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def unequip_wengine(self, agent_id: str) -> bool:
        """卸载角色的音擎"""
        save = self.get_current_save()
        if not save or agent_id not in save.agents:
            return False

        agent = save.agents[agent_id]
        if agent.equipped_wengine and agent.equipped_wengine in save.wengines:
            save.wengines[agent.equipped_wengine].equipped_agent = None
        agent.equipped_wengine = None

        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def equip_disk(self, agent_id: str, disk_id: str) -> bool:
        """为角色装备驱动盘"""
        save = self.get_current_save()
        if not save or agent_id not in save.agents or disk_id not in save.drive_disks:
            return False

        agent = save.agents[agent_id]
        disk = save.drive_disks[disk_id]
        position = disk.position.value - 1  # 转换为索引

        # 如果驱动盘已装备在其他角色上，先卸载
        if disk.equipped_agent and disk.equipped_agent in save.agents:
            other_agent = save.agents[disk.equipped_agent]
            if disk_id in other_agent.equipped_drive_disks:
                other_agent.equipped_drive_disks.remove(disk_id)

        # 如果该位置已有驱动盘，先卸载
        if len(agent.equipped_drive_disks) > position and agent.equipped_drive_disks[position]:
            old_disk_id = agent.equipped_drive_disks[position]
            if old_disk_id in save.drive_disks:
                save.drive_disks[old_disk_id].equipped_agent = None

        # 确保列表长度足够
        while len(agent.equipped_drive_disks) <= position:
            agent.equipped_drive_disks.append(None)

        # 装备新驱动盘
        agent.equipped_drive_disks[position] = disk_id
        disk.equipped_agent = agent_id

        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def unequip_disk(self, agent_id: str, position: int) -> bool:
        """卸载角色指定位置的驱动盘"""
        save = self.get_current_save()
        if not save or agent_id not in save.agents:
            return False

        agent = save.agents[agent_id]
        idx = position - 1
        if idx >= len(agent.equipped_drive_disks):
            return False

        disk_id = agent.equipped_drive_disks[idx]
        if disk_id and disk_id in save.drive_disks:
            save.drive_disks[disk_id].equipped_agent = None
        agent.equipped_drive_disks[idx] = None

        save.updated_at = datetime.now()
        self._persist_save(self.current_save)
        return True

    def load_all_saves(self):
        """加载所有存档文件"""
        for save_file in self.save_dir.glob("*.json"):
            if save_file.name == "config.json":
                continue
            try:
                with open(save_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    save = SaveData.from_dict(data, self.loader_service)
                    self.saves[save.name] = save
            except Exception as e:
                print(f"加载存档失败 {save_file}: {e}")

    def _persist_save(self, name: str):
        """持久化存档到文件"""
        if name not in self.saves:
            return
        save_file = self.save_dir / f"{name}.json"
        with open(save_file, 'w', encoding='utf-8') as f:
            json.dump(self.saves[name].to_dict(), f, ensure_ascii=False, indent=2)
