"""
技能数据加载服务

负责从Hakush.in角色JSON中解析技能数据
"""
from pathlib import Path
from typing import Dict, List, Optional
import json

from optimizer.zzz_models.skill import (
    Skill, SkillSegment, SkillParam, SkillType, AgentSkillSet
)


class SkillLoaderService:
    """技能数据加载服务"""
    
    @staticmethod
    def load_agent_skills(character_file: Path) -> Optional[AgentSkillSet]:
        """从角色JSON文件加载技能数据
        
        Args:
            character_file: 角色JSON文件路径（如 assets/inventory_data/character/1011.json）
            
        Returns:
            AgentSkillSet对象，加载失败返回None
        """
        if not character_file.exists():
            print(f"角色文件不存在: {character_file}")
            return None
        
        try:
            with open(character_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            agent_id = str(data.get('Id', ''))
            skill_data = data.get('Skill', {})
            
            # 解析5类技能
            basic_skills = SkillLoaderService._parse_skills(
                skill_data.get('Basic', {}), 
                SkillType.BASIC
            )
            
            dodge_skills = SkillLoaderService._parse_skills(
                skill_data.get('Dodge', {}), 
                SkillType.DODGE
            )
            
            special_skills = SkillLoaderService._parse_skills(
                skill_data.get('Special', {}), 
                SkillType.SPECIAL
            )
            
            chain_skills = SkillLoaderService._parse_skills(
                skill_data.get('Chain', {}), 
                SkillType.CHAIN
            )
            
            assist_skills = SkillLoaderService._parse_skills(
                skill_data.get('Assist', {}), 
                SkillType.ASSIST
            )
            
            return AgentSkillSet(
                agent_id=agent_id,
                basic_skills=basic_skills,
                dodge_skills=dodge_skills,
                special_skills=special_skills,
                chain_skills=chain_skills,
                assist_skills=assist_skills,
            )
            
        except Exception as e:
            print(f"加载角色技能数据失败: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def _parse_skills(skill_category_data: Dict, skill_type: SkillType) -> List[Skill]:
        """解析一类技能的所有技能
        
        Args:
            skill_category_data: 技能类别数据（如Basic、Dodge等）
            skill_type: 技能类型
            
        Returns:
            技能列表
        """
        skills = []
        descriptions = skill_category_data.get('Description', [])
        
        for desc_item in descriptions:
            # 跳过参数段落（Param段落是对前面技能的数据说明）
            if 'Param' in desc_item:
                continue
            
            skill_name = desc_item.get('Name', '')
            skill_desc = desc_item.get('Desc', '')
            
            # 查找对应的参数数据
            segments = SkillLoaderService._parse_skill_segments(
                skill_name, descriptions, skill_type
            )
            
            if segments:
                # 从segments中提取元素类型和打击类型（使用第一段的数据）
                first_param_id = segments[0].param.skill_id
                element_type, hit_type = SkillLoaderService._get_skill_types(
                    first_param_id, skill_category_data
                )
                
                skill = Skill(
                    name=skill_name,
                    description=skill_desc,
                    skill_type=skill_type,
                    element_type=element_type,
                    hit_type=hit_type,
                    segments=segments,
                )
                skills.append(skill)
        
        return skills
    
    @staticmethod
    def _parse_skill_segments(
        skill_name: str, 
        descriptions: List[Dict],
        skill_type: SkillType
    ) -> List[SkillSegment]:
        """解析技能的所有段落
        
        Args:
            skill_name: 技能名称
            descriptions: 技能描述列表
            skill_type: 技能类型
            
        Returns:
            技能段落列表
        """
        segments = []
        
        # 在descriptions中查找对应的Param段落
        for desc_item in descriptions:
            if desc_item.get('Name') == skill_name and 'Param' in desc_item:
                param_list = desc_item.get('Param', [])
                
                for param_item in param_list:
                    segment_name = param_item.get('Name', '')
                    segment_desc = param_item.get('Desc', '')
                    param_data = param_item.get('Param', {})
                    
                    # param_data是一个字典，键是技能ID，值是技能参数
                    for skill_id, skill_params in param_data.items():
                        segment = SkillSegment(
                            name=segment_name,
                            description=segment_desc,
                            param=SkillParam.from_dict(skill_id, skill_params),
                        )
                        segments.append(segment)
                
                break  # 找到对应的参数段落后退出
        
        return segments
    
    @staticmethod
    def _get_skill_types(skill_id: str, skill_category_data: Dict) -> tuple[int, int]:
        """获取技能的元素类型和打击类型
        
        Args:
            skill_id: 技能ID
            skill_category_data: 技能类别数据
            
        Returns:
            (元素类型, 打击类型)
        """
        # 从父级数据的SkillList中查找
        # 注意：这需要从完整的角色数据中获取，这里暂时返回默认值
        # TODO: 优化此处逻辑，从完整数据中获取
        return 0, 0
    
    @staticmethod
    def load_agent_skills_with_full_data(
        character_file: Path
    ) -> Optional[AgentSkillSet]:
        """从角色JSON文件加载技能数据（包含完整的元素和打击类型信息）
        
        Args:
            character_file: 角色JSON文件路径
            
        Returns:
            AgentSkillSet对象，加载失败返回None
        """
        if not character_file.exists():
            print(f"角色文件不存在: {character_file}")
            return None
        
        try:
            with open(character_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            agent_id = str(data.get('Id', ''))
            skill_data = data.get('Skill', {})
            skill_list = data.get('SkillList', {})
            
            # 解析5类技能（传入skill_list以获取完整信息）
            basic_skills = SkillLoaderService._parse_skills_full(
                skill_data.get('Basic', {}), 
                SkillType.BASIC,
                skill_list
            )
            
            dodge_skills = SkillLoaderService._parse_skills_full(
                skill_data.get('Dodge', {}), 
                SkillType.DODGE,
                skill_list
            )
            
            special_skills = SkillLoaderService._parse_skills_full(
                skill_data.get('Special', {}), 
                SkillType.SPECIAL,
                skill_list
            )
            
            chain_skills = SkillLoaderService._parse_skills_full(
                skill_data.get('Chain', {}), 
                SkillType.CHAIN,
                skill_list
            )
            
            assist_skills = SkillLoaderService._parse_skills_full(
                skill_data.get('Assist', {}), 
                SkillType.ASSIST,
                skill_list
            )
            
            return AgentSkillSet(
                agent_id=agent_id,
                basic_skills=basic_skills,
                dodge_skills=dodge_skills,
                special_skills=special_skills,
                chain_skills=chain_skills,
                assist_skills=assist_skills,
            )
            
        except Exception as e:
            print(f"加载角色技能数据失败: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def _parse_skills_full(
        skill_category_data: Dict, 
        skill_type: SkillType,
        skill_list: Dict
    ) -> List[Skill]:
        """解析一类技能的所有技能（包含完整信息）
        
        Args:
            skill_category_data: 技能类别数据
            skill_type: 技能类型
            skill_list: 技能列表数据（包含元素类型和打击类型）
            
        Returns:
            技能列表
        """
        skills = []
        descriptions = skill_category_data.get('Description', [])
        
        for desc_item in descriptions:
            if 'Param' in desc_item:
                continue
            
            skill_name = desc_item.get('Name', '')
            skill_desc = desc_item.get('Desc', '')
            
            segments = SkillLoaderService._parse_skill_segments(
                skill_name, descriptions, skill_type
            )
            
            if segments:
                # 从skill_list中获取元素类型和打击类型
                first_param_id = segments[0].param.skill_id
                element_type = 0
                hit_type = 0
                
                if first_param_id in skill_list:
                    element_type = skill_list[first_param_id].get('ElementType', 0)
                    hit_type = skill_list[first_param_id].get('HitType', 0)
                
                skill = Skill(
                    name=skill_name,
                    description=skill_desc,
                    skill_type=skill_type,
                    element_type=element_type,
                    hit_type=hit_type,
                    segments=segments,
                )
                skills.append(skill)
        
        return skills