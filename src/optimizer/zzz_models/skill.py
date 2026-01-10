"""
技能数据模型

包含角色的5类技能：普通攻击、闪避、特殊技、连携技、支援技
"""
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


class SkillType(Enum):
    """技能类型"""
    BASIC = "Basic"          # 普通攻击
    DODGE = "Dodge"          # 闪避
    SPECIAL = "Special"      # 特殊技
    CHAIN = "Chain"          # 连携技
    ASSIST = "Assist"        # 支援技


@dataclass
class SkillParam:
    """技能参数（单段技能的数值）
    
    所有数值存储原始值（除以100后为实际百分比）
    例如: Main=3120 表示 31.2%
    """
    # 技能ID
    skill_id: str
    
    # 伤害相关
    damage_percentage: int              # 伤害倍率基础值
    damage_percentage_growth: int       # 伤害倍率成长值
    
    # 失衡相关
    stun_ratio: int                     # 失衡倍率基础值
    stun_ratio_growth: int              # 失衡倍率成长值
    
    # 能量相关
    sp_recovery: int                    # 能量回复基础值
    sp_recovery_growth: int             # 能量回复成长值
    sp_consume: int                     # 能量消耗
    
    # 喧响值相关
    fever_recovery: int                 # 喧响值回复基础值
    fever_recovery_growth: int          # 喧响值回复成长值
    
    # 属性积蓄
    attribute_infliction: int           # 属性异常积蓄值
    
    # 以太净化
    ether_purify: int                   # 以太净化值
    
    # 其他
    rp_recovery: int = 0                # RP回复（某些角色特有）
    rp_recovery_growth: int = 0         # RP回复成长值
    
    def get_damage_percentage(self, level: int) -> float:
        """获取指定等级的伤害倍率（百分比形式）
        
        Args:
            level: 技能等级 (1-12)
            
        Returns:
            伤害倍率百分比，如 31.2 表示 31.2%
        """
        base = self.damage_percentage + self.damage_percentage_growth * (level - 1)
        return base / 100.0
    
    def get_stun_ratio(self, level: int) -> float:
        """获取指定等级的失衡倍率（百分比形式）
        
        Args:
            level: 技能等级 (1-12)
            
        Returns:
            失衡倍率百分比
        """
        base = self.stun_ratio + self.stun_ratio_growth * (level - 1)
        return base / 100.0
    
    def get_sp_recovery(self, level: int) -> float:
        """获取指定等级的能量回复
        
        Args:
            level: 技能等级 (1-12)
            
        Returns:
            能量回复值
        """
        return (self.sp_recovery + self.sp_recovery_growth * (level - 1)) / 100.0
    
    def get_fever_recovery(self, level: int) -> float:
        """获取指定等级的喧响值回复
        
        Args:
            level: 技能等级 (1-12)
            
        Returns:
            喧响值回复
        """
        return (self.fever_recovery + self.fever_recovery_growth * (level - 1)) / 100.0
    
    @classmethod
    def from_dict(cls, skill_id: str, data: Dict) -> 'SkillParam':
        """从字典创建SkillParam对象
        
        Args:
            skill_id: 技能ID
            data: 技能参数字典
            
        Returns:
            SkillParam对象
        """
        return cls(
            skill_id=skill_id,
            damage_percentage=data.get('DamagePercentage', 0),
            damage_percentage_growth=data.get('DamagePercentageGrowth', 0),
            stun_ratio=data.get('StunRatio', 0),
            stun_ratio_growth=data.get('StunRatioGrowth', 0),
            sp_recovery=data.get('SpRecovery', 0),
            sp_recovery_growth=data.get('SpRecoveryGrowth', 0),
            sp_consume=data.get('SpConsume', 0),
            fever_recovery=data.get('FeverRecovery', 0),
            fever_recovery_growth=data.get('FeverRecoveryGrowth', 0),
            attribute_infliction=data.get('AttributeInfliction', 0),
            ether_purify=data.get('EtherPurify', 0),
            rp_recovery=data.get('RpRecovery', 0),
            rp_recovery_growth=data.get('RpRecoveryGrowth', 0),
        )


@dataclass
class SkillSegment:
    """技能段（一个技能可能包含多段，如普通攻击的一二三四段）"""
    # 段落名称，如"一段伤害倍率"
    name: str
    
    # 段落说明
    description: str
    
    # 技能参数（包含所有数值）
    param: SkillParam
    
    # 参数类型标识（如"1001"表示伤害倍率，"1002"表示失衡倍率）
    param_type: str = "1001"


@dataclass  
class Skill:
    """技能（一个完整的技能，如"普通攻击：伏特速攻"）"""
    # 技能名称
    name: str
    
    # 技能说明
    description: str
    
    # 技能类型
    skill_type: SkillType
    
    # 元素类型 (200=物理, 203=电, 等)
    element_type: int
    
    # 打击类型 (101=斩击, 102=打击, 103=射击)
    hit_type: int
    
    # 技能段落列表（一段、二段、三段等）
    segments: List[SkillSegment]
    
    # 技能等级 (1-12)
    level: int = 1
    
    def get_total_damage(self, level: Optional[int] = None) -> float:
        """获取技能总伤害倍率（所有段落伤害之和）
        
        Args:
            level: 技能等级，如果为None则使用self.level
            
        Returns:
            总伤害倍率百分比
        """
        if level is None:
            level = self.level
        
        total = 0.0
        for segment in self.segments:
            total += segment.param.get_damage_percentage(level)
        return total
    
    def get_total_stun(self, level: Optional[int] = None) -> float:
        """获取技能总失衡值（所有段落失衡之和）
        
        Args:
            level: 技能等级，如果为None则使用self.level
            
        Returns:
            总失衡倍率百分比
        """
        if level is None:
            level = self.level
        
        total = 0.0
        for segment in self.segments:
            total += segment.param.get_stun_ratio(level)
        return total


@dataclass
class AgentSkillSet:
    """角色技能集（包含一个角色的所有技能）"""
    # 角色ID
    agent_id: str
    
    # 5类技能
    basic_skills: List[Skill]       # 普通攻击技能列表
    dodge_skills: List[Skill]       # 闪避技能列表  
    special_skills: List[Skill]     # 特殊技技能列表
    chain_skills: List[Skill]       # 连携技技能列表
    assist_skills: List[Skill]      # 支援技技能列表
    
    # 技能等级（5类技能共享等级）
    basic_level: int = 1
    dodge_level: int = 1
    special_level: int = 1
    chain_level: int = 1
    assist_level: int = 1
    
    def get_all_skills(self) -> List[Skill]:
        """获取所有技能列表"""
        return (
            self.basic_skills + 
            self.dodge_skills + 
            self.special_skills + 
            self.chain_skills + 
            self.assist_skills
        )
    
    def get_skills_by_type(self, skill_type: SkillType) -> List[Skill]:
        """根据类型获取技能列表
        
        Args:
            skill_type: 技能类型
            
        Returns:
            技能列表
        """
        mapping = {
            SkillType.BASIC: self.basic_skills,
            SkillType.DODGE: self.dodge_skills,
            SkillType.SPECIAL: self.special_skills,
            SkillType.CHAIN: self.chain_skills,
            SkillType.ASSIST: self.assist_skills,
        }
        return mapping.get(skill_type, [])
    
    def get_skill_level(self, skill_type: SkillType) -> int:
        """获取指定类型技能的等级
        
        Args:
            skill_type: 技能类型
            
        Returns:
            技能等级
        """
        mapping = {
            SkillType.BASIC: self.basic_level,
            SkillType.DODGE: self.dodge_level,
            SkillType.SPECIAL: self.special_level,
            SkillType.CHAIN: self.chain_level,
            SkillType.ASSIST: self.assist_level,
        }
        return mapping.get(skill_type, 1)
    
    def set_skill_level(self, skill_type: SkillType, level: int) -> None:
        """设置指定类型技能的等级
        
        Args:
            skill_type: 技能类型
            level: 技能等级 (1-12)
        """
        if not 1 <= level <= 12:
            raise ValueError(f"技能等级必须在1-12之间，当前: {level}")
        
        if skill_type == SkillType.BASIC:
            self.basic_level = level
            for skill in self.basic_skills:
                skill.level = level
        elif skill_type == SkillType.DODGE:
            self.dodge_level = level
            for skill in self.dodge_skills:
                skill.level = level
        elif skill_type == SkillType.SPECIAL:
            self.special_level = level
            for skill in self.special_skills:
                skill.level = level
        elif skill_type == SkillType.CHAIN:
            self.chain_level = level
            for skill in self.chain_skills:
                skill.level = level
        elif skill_type == SkillType.ASSIST:
            self.assist_level = level
            for skill in self.assist_skills:
                skill.level = level