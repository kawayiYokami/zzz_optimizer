"""
异常条模型（基于CSV数据）

数据来源：assets/inventory_data/csv/异常条.csv
"""
from typing import Optional
from dataclasses import dataclass


@dataclass
class AnomalyBar:
    """异常条模型

    对应CSV中的一行数据，定义了异常条的ID、属性、积蓄值需求等
    """
    # 基础信息
    anomaly_bar_id: str                 # 异常条ID
    element: str                        # 属性（冰、火、电、物理、以太）
    corresponding_anomaly_id: str       # 对应异常ID
    note: str                           # 备注

    # 异常CD
    anomaly_cd: float                   # 异常CD（秒）

    # 积蓄值需求（10次触发的积蓄值需求）
    buildup_requirement_1: float        # 第1次触发需求
    buildup_requirement_2: float        # 第2次触发需求
    buildup_requirement_3: float        # 第3次触发需求
    buildup_requirement_4: float        # 第4次触发需求
    buildup_requirement_5: float        # 第5次触发需求
    buildup_requirement_6: float        # 第6次触发需求
    buildup_requirement_7: float        # 第7次触发需求
    buildup_requirement_8: float        # 第8次触发需求
    buildup_requirement_9: float        # 第9次触发需求
    buildup_requirement_10: float       # 第10次触发需求

    def get_buildup_requirement(self, trigger_count: int) -> float:
        """获取指定触发次数的积蓄值需求

        Args:
            trigger_count: 触发次数 (1-10)

        Returns:
            积蓄值需求
        """
        if trigger_count < 1:
            trigger_count = 1
        elif trigger_count > 10:
            trigger_count = 10

        requirements = [
            self.buildup_requirement_1,
            self.buildup_requirement_2,
            self.buildup_requirement_3,
            self.buildup_requirement_4,
            self.buildup_requirement_5,
            self.buildup_requirement_6,
            self.buildup_requirement_7,
            self.buildup_requirement_8,
            self.buildup_requirement_9,
            self.buildup_requirement_10,
        ]
        return requirements[trigger_count - 1]

    @classmethod
    def from_csv_row(cls, row: dict) -> 'AnomalyBar':
        """从CSV行数据创建对象

        Args:
            row: CSV行数据字典

        Returns:
            AnomalyBar对象
        """
        def safe_float(value, default=0.0) -> float:
            """安全地转换为浮点数"""
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        return cls(
            anomaly_bar_id=row.get('异常条ID', ''),
            element=row.get('属性', ''),
            corresponding_anomaly_id=row.get('对应异常ID', ''),
            note=row.get('备注', ''),
            anomaly_cd=safe_float(row.get('异常CD', 0)),
            buildup_requirement_1=safe_float(row.get('积蓄值需求1', 0)),
            buildup_requirement_2=safe_float(row.get('积蓄值需求2', 0)),
            buildup_requirement_3=safe_float(row.get('积蓄值需求3', 0)),
            buildup_requirement_4=safe_float(row.get('积蓄值需求4', 0)),
            buildup_requirement_5=safe_float(row.get('积蓄值需求5', 0)),
            buildup_requirement_6=safe_float(row.get('积蓄值需求6', 0)),
            buildup_requirement_7=safe_float(row.get('积蓄值需求7', 0)),
            buildup_requirement_8=safe_float(row.get('积蓄值需求8', 0)),
            buildup_requirement_9=safe_float(row.get('积蓄值需求9', 0)),
            buildup_requirement_10=safe_float(row.get('积蓄值需求10', 0)),
        )

    @property
    def is_normal_anomaly(self) -> bool:
        """是否为常规异常"""
        return '常规' in self.note

    @property
    def is_resistant_anomaly(self) -> bool:
        """是否为克制异常"""
        return '克制' in self.note

    @property
    def is_immune_anomaly(self) -> bool:
        """是否为免疫异常"""
        return '不可' in self.note or '免疫' in self.note

    def get_buildup_growth_rate(self) -> float:
        """获取积蓄值增长率（第2次相对第1次的增长率）

        Returns:
            增长率（小数形式，如0.02表示2%）
        """
        if self.buildup_requirement_1 == 0:
            return 0.0
        return (self.buildup_requirement_2 - self.buildup_requirement_1) / self.buildup_requirement_1
