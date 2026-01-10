"""
CSV数据加载服务

负责从CSV文件加载游戏数据
"""
import csv
from pathlib import Path
from typing import Dict, List, Optional

from optimizer.zzz_models.agent_skill import (
    AgentSkillSegment, AgentSkill, AgentSkillSet
)
from optimizer.zzz_models.bangboo import (
    BangbooSkill, BangbooStats, Bangboo
)
from optimizer.zzz_models.enemy import Enemy
from optimizer.zzz_models.anomaly_bar import AnomalyBar


class CsvDataLoaderService:
    """CSV数据加载服务

    负责从CSV文件加载：
    1. 代理人技能数据
    2. 邦布属性和技能数据
    3. 敌人属性数据
    4. 异常条数据
    """

    def __init__(self, csv_data_dir: Path):
        """初始化CSV数据加载服务

        Args:
            csv_data_dir: CSV数据目录路径（assets/inventory_data/csv）
        """
        self.csv_data_dir = csv_data_dir

        # 数据缓存
        self._agent_skill_sets: Optional[Dict[str, AgentSkillSet]] = None
        self._bangboo_stats: Optional[Dict[str, BangbooStats]] = None
        self._bangboo_skills: Optional[Dict[str, List[BangbooSkill]]] = None
        self._enemies: Optional[Dict[str, Enemy]] = None
        self._anomaly_bars: Optional[Dict[str, AnomalyBar]] = None

    def load_agent_skills(self) -> Dict[str, AgentSkillSet]:
        """加载代理人技能数据

        Returns:
            字典 {代理人名称: AgentSkillSet}
        """
        if self._agent_skill_sets is not None:
            return self._agent_skill_sets

        csv_file = self.csv_data_dir / "代理人技能数据.csv"
        if not csv_file.exists():
            print(f"警告: 代理人技能数据文件不存在: {csv_file}")
            self._agent_skill_sets = {}
            return self._agent_skill_sets

        # 读取CSV文件
        segments_by_agent: Dict[str, List[AgentSkillSegment]] = {}

        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                segment = AgentSkillSegment.from_csv_row(row)
                agent_name = segment.agent_name

                if agent_name not in segments_by_agent:
                    segments_by_agent[agent_name] = []
                segments_by_agent[agent_name].append(segment)

        # 按代理人和技能分组
        skill_sets = {}
        for agent_name, segments in segments_by_agent.items():
            # 按技能名称分组
            skills_dict: Dict[str, List[AgentSkillSegment]] = {}
            for segment in segments:
                skill_name = segment.skill_name
                if skill_name not in skills_dict:
                    skills_dict[skill_name] = []
                skills_dict[skill_name].append(segment)

            # 创建AgentSkill对象
            agent_skills = {}
            for skill_name, skill_segments in skills_dict.items():
                agent_skills[skill_name] = AgentSkill(
                    agent_name=agent_name,
                    skill_name=skill_name,
                    segments=skill_segments,
                )

            # 创建AgentSkillSet对象
            skill_sets[agent_name] = AgentSkillSet(
                agent_name=agent_name,
                skills=agent_skills,
            )

        self._agent_skill_sets = skill_sets
        return self._agent_skill_sets

    def load_bangboo_stats(self) -> Dict[str, BangbooStats]:
        """加载邦布属性数据

        Returns:
            字典 {邦布名称: BangbooStats}
        """
        if self._bangboo_stats is not None:
            return self._bangboo_stats

        csv_file = self.csv_data_dir / "邦布属性.csv"
        if not csv_file.exists():
            print(f"警告: 邦布属性数据文件不存在: {csv_file}")
            self._bangboo_stats = {}
            return self._bangboo_stats

        bangboo_stats = {}

        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                stats = BangbooStats.from_csv_row(row)
                if stats.name_cn:  # 跳过空行
                    bangboo_stats[stats.name_cn] = stats

        self._bangboo_stats = bangboo_stats
        return self._bangboo_stats

    def load_bangboo_skills(self) -> Dict[str, List[BangbooSkill]]:
        """加载邦布技能数据

        Returns:
            字典 {邦布名称: [BangbooSkill列表]}
        """
        if self._bangboo_skills is not None:
            return self._bangboo_skills

        csv_file = self.csv_data_dir / "邦布技能.csv"
        if not csv_file.exists():
            print(f"警告: 邦布技能数据文件不存在: {csv_file}")
            self._bangboo_skills = {}
            return self._bangboo_skills

        bangboo_skills: Dict[str, List[BangbooSkill]] = {}

        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                skill = BangbooSkill.from_csv_row(row)
                bangboo_name = skill.bangboo_name

                if bangboo_name not in bangboo_skills:
                    bangboo_skills[bangboo_name] = []
                bangboo_skills[bangboo_name].append(skill)

        self._bangboo_skills = bangboo_skills
        return self._bangboo_skills

    def load_bangboos(self) -> Dict[str, Bangboo]:
        """加载完整的邦布数据（属性+技能）

        Returns:
            字典 {邦布名称: Bangboo}
        """
        stats_dict = self.load_bangboo_stats()
        skills_dict = self.load_bangboo_skills()

        bangboos = {}
        for name, stats in stats_dict.items():
            skills = skills_dict.get(name, [])
            bangboo = Bangboo(
                name_cn=name,
                id=stats.id,
                level=60,  # 默认满级
                breakthrough=5,  # 默认满突破
                stats=stats,
                skills=skills,
            )
            bangboos[name] = bangboo

        return bangboos

    def load_enemies(self) -> Dict[str, Enemy]:
        """加载敌人属性数据

        Returns:
            字典 {敌人完整名称: Enemy}
        """
        if self._enemies is not None:
            return self._enemies

        csv_file = self.csv_data_dir / "敌人属性.csv"
        if not csv_file.exists():
            print(f"警告: 敌人属性数据文件不存在: {csv_file}")
            self._enemies = {}
            return self._enemies

        enemies = {}

        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                enemy = Enemy.from_csv_row(row)
                if enemy.full_name:  # 跳过空行
                    # 使用完整名称+ID作为键，避免重复
                    key = f"{enemy.full_name}_{enemy.id}"
                    enemies[key] = enemy

        self._enemies = enemies
        return self._enemies

    def load_anomaly_bars(self) -> Dict[str, AnomalyBar]:
        """加载异常条数据

        Returns:
            字典 {异常条ID: AnomalyBar}
        """
        if self._anomaly_bars is not None:
            return self._anomaly_bars

        csv_file = self.csv_data_dir / "异常条.csv"
        if not csv_file.exists():
            print(f"警告: 异常条数据文件不存在: {csv_file}")
            self._anomaly_bars = {}
            return self._anomaly_bars

        anomaly_bars = {}

        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                anomaly_bar = AnomalyBar.from_csv_row(row)
                if anomaly_bar.anomaly_bar_id:  # 跳过空行
                    anomaly_bars[anomaly_bar.anomaly_bar_id] = anomaly_bar

        self._anomaly_bars = anomaly_bars
        return self._anomaly_bars

    def get_agent_skill_set(self, agent_name: str) -> Optional[AgentSkillSet]:
        """获取指定代理人的技能集

        Args:
            agent_name: 代理人名称

        Returns:
            AgentSkillSet对象，如果不存在返回None
        """
        skill_sets = self.load_agent_skills()
        return skill_sets.get(agent_name)

    def get_bangboo(self, bangboo_name: str) -> Optional[Bangboo]:
        """获取指定邦布

        Args:
            bangboo_name: 邦布名称

        Returns:
            Bangboo对象，如果不存在返回None
        """
        bangboos = self.load_bangboos()
        return bangboos.get(bangboo_name)

    def get_enemy(self, enemy_name: str, enemy_id: str = None) -> Optional[Enemy]:
        """获取指定敌人

        Args:
            enemy_name: 敌人完整名称
            enemy_id: 敌人ID（可选，用于区分同名敌人）

        Returns:
            Enemy对象，如果不存在返回None
        """
        enemies = self.load_enemies()

        if enemy_id:
            key = f"{enemy_name}_{enemy_id}"
            return enemies.get(key)

        # 如果没有指定ID，尝试模糊匹配
        for key, enemy in enemies.items():
            if enemy.full_name == enemy_name:
                return enemy

        return None

    def get_anomaly_bar(self, anomaly_bar_id: str) -> Optional[AnomalyBar]:
        """获取指定异常条

        Args:
            anomaly_bar_id: 异常条ID

        Returns:
            AnomalyBar对象，如果不存在返回None
        """
        anomaly_bars = self.load_anomaly_bars()
        return anomaly_bars.get(anomaly_bar_id)

    @property
    def agent_skill_sets(self) -> Dict[str, AgentSkillSet]:
        """获取所有代理人技能集"""
        return self.load_agent_skills()

    @property
    def bangboos(self) -> Dict[str, Bangboo]:
        """获取所有邦布"""
        return self.load_bangboos()

    @property
    def enemies(self) -> Dict[str, Enemy]:
        """获取所有敌人"""
        return self.load_enemies()

    @property
    def anomaly_bars(self) -> Dict[str, AnomalyBar]:
        """获取所有异常条"""
        return self.load_anomaly_bars()
