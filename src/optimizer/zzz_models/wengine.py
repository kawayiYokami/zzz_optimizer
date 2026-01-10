"""
音擎模型
"""
from typing import Optional, Dict, List
from dataclasses import dataclass, field

from optimizer.zzz_models.base import PropertyType
from optimizer.zzz_models.buff import Buff
from optimizer.zzz_models.property_collection import PropertyCollection


@dataclass
class WEngineLevelData:
    """音擎等级成长数据
    
    记录音擎在不同等级的成长率
    """
    level: int                   # 等级 (1-60)
    exp: int                     # 升级所需经验
    rate: float                  # 成长率（基础属性成长）


@dataclass
class WEngineTalent:
    """音擎天赋效果
    
    记录音擎的天赋效果（被动技能）
    """
    level: int                   # 精炼等级 (1-5)
    name: str                    # 天赋名称
    description: str             # 天赋描述
    buffs: List[Buff] = field(default_factory=list)  # 天赋提供的buff列表
    
    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'level': self.level,
            'name': self.name,
            'description': self.description,
            'buffs': [buff.to_dict() for buff in self.buffs],
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'WEngineTalent':
        """从字典创建"""
        buffs = []
        if 'buffs' in data:
            buffs = [Buff.from_dict(buff_data) for buff_data in data['buffs']]
        
        return cls(
            level=data['level'],
            name=data['name'],
            description=data['description'],
            buffs=buffs
        )

    def format(self, indent: int = 0) -> str:
        """格式化输出音擎天赋信息（只输出有意义的值）

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 天赋基本信息
        lines.append(f"{prefix}【天赋】")
        lines.append(f"  {prefix}精炼等级: R{self.level}")
        lines.append(f"  {prefix}名称: {self.name}")
        if self.description:
            lines.append(f"  {prefix}描述: {self.description}")
        
        # Buff列表
        if self.buffs:
            lines.append(f"{prefix}【Buff】({len(self.buffs)}个)")
            for buff in self.buffs:
                lines.append(buff.format(indent=indent+2))
        
        return "\n".join(lines)


@dataclass
class WEngine:
    """
    音擎数据模型
    
    属性说明：
    - base_stats: 基础属性集（局外），加载时计算好缓存
    - talents: 天赋buff列表（局内）
    - get_stats_at_level(): 计算某等级的属性的方法（有隐藏系数）
    """
    id: str                     # 实例ID（唯一，用于仓库管理）
    wengine_id: str             # 游戏ID (如 "12001"，用于关联游戏数据)
    name: str                   # 名称（中文，如 "「月相」-望"）
    
    # 玩家实例数据（存储在存档中）
    level: int = 1              # 等级 (1-60)
    refinement: int = 1         # 精炼等级 (1-5)
    breakthrough: int = 0       # 突破等级 (0-6)
    equipped_agent: Optional[str] = None  # 装备角色ID
    
    # 游戏数据（从游戏数据文件读取，不存储在存档中）
    base_atk: float = 0.0       # 基础攻击力
    rand_stat_type: Optional[PropertyType] = None  # 副属性类型
    rand_stat: float = 0.0      # 副属性基础值
    level_data: Dict[int, WEngineLevelData] = field(default_factory=dict)  # 等级成长数据
    base_stats: PropertyCollection = field(default_factory=PropertyCollection)  # 基础属性集（局外）
    talents: List[WEngineTalent] = field(default_factory=list)  # 天赋buff列表（局内）
    buffs: List[Buff] = field(default_factory=list)  # 当前精炼等级的buff列表（缓存）
    
    def get_stats_at_level(self, level: int, ascension: int = None) -> PropertyCollection:
        """
        计算指定等级的属性值
        
        Args:
            level: 等级 (1-60)
            ascension: 突破等级 (0-5)，如果为None则自动计算
            
        Returns:
            PropertyCollection：武器提供的属性
        
        计算公式（参考原项目）：
        - 攻击力 = base_atk × (1 + rate / 10000 + 0.8922 × ascension)
        - 副词条 = rand_stat × (1 + 0.3 × ascension)
        """
        if ascension is None:
            ascension = min(level // 10, 5)
        
        result = PropertyCollection()
        
        if self.base_atk > 0:
            level_info = self.level_data.get(level)
            rate = level_info.rate if level_info else 0
            atk = self.base_atk * (1 + rate / 10000 + 0.8922 * ascension)
            result.out_of_combat[PropertyType.ATK_BASE] = atk
        
        if self.rand_stat > 0 and self.rand_stat_type:
            stat = self.rand_stat * (1 + 0.3 * ascension)
            result.out_of_combat[self.rand_stat_type] = stat
        
        return result
    
    def get_base_stats(self) -> PropertyCollection:
        """获取当前等级的基础属性集（局外）"""
        return self.base_stats
    
    def get_active_buffs(self) -> List[Buff]:
        """获取当前精炼等级的所有有效 Buff（局内）"""
        # 从talents中获取当前精炼等级的buff
        active_buffs = []
        for talent in self.talents:
            if talent.level == self.refinement:
                active_buffs = [buff for buff in talent.buffs if buff.is_active]
                break

        # 更新缓存
        self.buffs = active_buffs
        return active_buffs
    
    def to_dict(self) -> dict:
        """转为字典"""
        return {
            'id': self.id,
            'wengine_id': self.wengine_id,
            'name': self.name,
            'level': self.level,
            'refinement': self.refinement,
            'breakthrough': self.breakthrough,
            'equipped_agent': self.equipped_agent,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'WEngine':
        """从字典创建"""
        # 过滤掉不需要的字段（如存档中的旧字段 code_name, rarity 等）
        filtered_data = {
            k: v for k, v in data.items()
            if k in {'id', 'wengine_id', 'name', 'level', 'refinement', 'breakthrough', 'equipped_agent'}
        }
        return cls(**filtered_data)
    
    def __str__(self) -> str:
        """字符串表示"""
        equipped = ""
        if self.is_equipped:
            equipped = f" [已装备]"
        
        return f"{self.name} Lv.{self.level}/{self.breakthrough}突 精{self.refinement}{equipped}"

    def format(self, indent: int = 0) -> str:
        """格式化输出音擎信息（只输出有意义的值）

        Args:
            indent: 缩进空格数

        Returns:
            格式化字符串
        """
        lines = []
        prefix = " " * indent

        # 基础信息
        lines.append(f"{prefix}【音擎】")
        lines.append(f"  {prefix}名称: {self.name}")
        lines.append(f"  {prefix}等级: {self.level}")
        lines.append(f"  {prefix}精炼: R{self.refinement}")

        # 当前等级属性（从 base_stats 读取计算后的值）
        if self.base_stats and (self.base_stats.out_of_combat or self.base_stats.in_combat):
            lines.append(f"{prefix}【当前属性】")
            lines.append(self.base_stats.format(indent=indent+2))

        # 天赋效果（只显示当前精炼等级）
        if self.talents:
            current_talent = None
            for talent in self.talents:
                if talent.level == self.refinement:
                    current_talent = talent
                    break
            if current_talent:
                lines.append(f"{prefix}【天赋效果】")
                lines.append(current_talent.format(indent=indent+2))
        
        # 装备状态
        if self.is_equipped:
            lines.append(f"{prefix}【状态】: 已装备")
        
        return "\n".join(lines)
    
    @property
    def is_equipped(self) -> bool:
        """是否已装备"""
        return self.equipped_agent is not None
