"""
属性集合模板

统一的数据格式，所有属性来源都返回这个结构：
- out_of_combat: 局外属性（进入战斗前就生效）
- in_combat: 局内属性（进入战斗后生效）

所有数据源都返回 PropertyCollection：
- Agent.get_bare_stats() - 基础属性
- Agent.get_self_buff() - 角色Buff
- WEngine.get_stats_at_level() - 武器属性
- DriveDisk.get_stats() - 驱动盘属性
- Buff - Buff本身
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from optimizer.zzz_models.base import PropertyType


@dataclass
class PropertyCollection:
    """属性集合
    
    统一的数据格式，包含局外和局内两部分属性。
    相同 PropertyType 的值会累加。
    """
    out_of_combat: Dict[PropertyType, float] = field(default_factory=dict)
    in_combat: Dict[PropertyType, float] = field(default_factory=dict)
    
    def add(self, other: 'PropertyCollection') -> 'PropertyCollection':
        """累加另一个 PropertyCollection
        
        Args:
            other: 另一个属性集合
            
        Returns:
            self (方便链式调用)
        """
        for prop, value in other.out_of_combat.items():
            self.out_of_combat[prop] = self.out_of_combat.get(prop, 0.0) + value
        for prop, value in other.in_combat.items():
            self.in_combat[prop] = self.in_combat.get(prop, 0.0) + value
        return self
    
    @staticmethod
    def merge_all(collections: List['PropertyCollection']) -> 'PropertyCollection':
        """合并多个 PropertyCollection
        
        Args:
            collections: 属性集合列表
            
        Returns:
            合并后的属性集合
        """
        result = PropertyCollection()
        for collection in collections:
            if collection is not None:
                result.add(collection)
        return result
    
    def get_out_of_combat(self, prop: PropertyType, default: float = 0.0) -> float:
        """获取局外属性值"""
        return self.out_of_combat.get(prop, default)
    
    def get_in_combat(self, prop: PropertyType, default: float = 0.0) -> float:
        """获取局内属性值"""
        return self.in_combat.get(prop, default)
    
    def get_total(self, prop: PropertyType, default: float = 0.0) -> float:
        """获取属性总值（局外 + 局内）"""
        return self.get_out_of_combat(prop, 0) + self.get_in_combat(prop, default)
    
    def is_empty(self) -> bool:
        """检查是否为空"""
        return not self.out_of_combat and not self.in_combat

    def __bool__(self) -> bool:
        """布尔判断"""
        return not self.is_empty()

    def format(self, indent: int = 0) -> str:
        """格式化输出（只输出不为0的属性）

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 局外属性
        if self.out_of_combat:
            out_items = [(p, v) for p, v in self.out_of_combat.items() if v != 0]
            if out_items:
                lines.append(f"{prefix}局外 ({len(out_items)}个属性):")
                for prop, value in sorted(out_items, key=lambda x: x[0].cn_name):
                    if prop.is_percentage:
                        # 百分比属性（存储为小数形式，如 0.05 表示 5%，显示时需要乘以100）
                        lines.append(f"  {prefix}{prop.cn_name}: {value*100:.2f}%")
                    else:
                        # 固定值属性
                        if abs(value) >= 10:
                            lines.append(f"  {prefix}{prop.cn_name}: {value:.1f}")
                        else:
                            lines.append(f"  {prefix}{prop.cn_name}: {value:.3f}")

        # 局内属性
        if self.in_combat:
            in_items = [(p, v) for p, v in self.in_combat.items() if v != 0]
            if in_items:
                lines.append(f"{prefix}局内 ({len(in_items)}个属性):")
                for prop, value in sorted(in_items, key=lambda x: x[0].cn_name):
                    if prop.is_percentage:
                        # 百分比属性（存储为小数形式，如 0.05 表示 5%，显示时需要乘以100）
                        lines.append(f"  {prefix}{prop.cn_name}: {value*100:.2f}%")
                    else:
                        # 固定值属性
                        if abs(value) >= 10:
                            lines.append(f"  {prefix}{prop.cn_name}: {value:.1f}")
                        else:
                            lines.append(f"  {prefix}{prop.cn_name}: {value:.3f}")

        return "\n".join(lines)


def merge_property_collections(collections: List[Optional['PropertyCollection']]) -> 'PropertyCollection':
    """合并属性集合的便捷函数"""
    return PropertyCollection.merge_all([c for c in collections if c is not None])
