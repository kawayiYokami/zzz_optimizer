"""优化器统一接口 - GUI与业务逻辑的唯一通信接口"""
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from optimizer.optimizer import Optimizer
from optimizer.save_manager import SaveManager
from optimizer.zzz_models.agent import Agent
from optimizer.zzz_models.drive_disk import DriveDisk
from optimizer.zzz_models.wengine import WEngine
from optimizer.zzz_models.base import PropertyType


class OptimizerFacade:
    """优化器门面类 - 提供统一接口给GUI"""

    def __init__(self, game_data_dir: str = "assets/inventory_data", save_dir: str = "saves"):
        self.optimizer = Optimizer(Path(game_data_dir))
        self.save_manager = SaveManager(save_dir)
        self.save_manager.set_loader_service(self.optimizer.data_loader)
        self._load_initial_data()

    def _load_initial_data(self):
        """加载初始数据"""
        self.optimizer.load_game_data()
        self.save_manager.load_all_saves()

    # ========== 存档管理 ==========
    def get_saves(self) -> List[str]:
        """获取所有存档名称"""
        return self.save_manager.list_saves()

    def get_current_save(self) -> Optional[str]:
        """获取当前存档名称"""
        return self.save_manager.current_save

    def create_save(self, name: str) -> bool:
        """创建新存档"""
        return self.save_manager.create_save(name)

    def switch_save(self, name: str) -> bool:
        """切换存档"""
        return self.save_manager.switch_save(name)

    def delete_save(self, name: str) -> bool:
        """删除存档"""
        return self.save_manager.delete_save(name)

    def import_from_scan(self, file_path: str) -> bool:
        """从扫描文件导入数据"""
        import json
        import traceback
        try:
            # 如果没有当前存档，自动创建一个或切换到 default
            if not self.save_manager.current_save:
                if not self.save_manager.create_save("default"):
                    # 创建失败（可能已存在），尝试切换
                    self.save_manager.switch_save("default")
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            result = self.save_manager.import_from_scan(data)
            if not result:
                print(f"导入失败: save_manager.import_from_scan 返回 False")
                print(f"当前存档: {self.save_manager.current_save}")
                print(f"loader_service: {self.save_manager.loader_service}")
            return result
        except Exception as e:
            print(f"导入扫描数据失败: {e}")
            traceback.print_exc()
            return False

    # ========== 角色管理 ==========
    def get_all_game_agents(self) -> List[Dict]:
        """获取所有游戏角色数据（包含是否拥有的状态）
        
        Returns:
            角色列表，每个角色包含:
            - game_id: 游戏ID
            - name_en: 英文名
            - name_cn: 中文名
            - rarity: 稀有度
            - element: 元素
            - weapon_type: 武器类型
            - icon: 图标名
            - owned: 是否拥有
            - agent_id: 如果拥有，存档中的角色ID
        """
        character_data = self.optimizer.data_loader.character_data
        if not character_data:
            return []
        
        # 获取当前存档中拥有的角色
        save = self.save_manager.get_current_save()
        owned_agents = {}
        if save:
            for agent in save.agents.values():
                owned_agents[agent.game_id] = agent
        
        result = []
        for game_id, data in character_data.items():
            name_cn = data.get('CHS', data.get('EN', ''))
            # 过滤掉测试角色
            if "(Test" in name_cn:
                continue
                
            agent_info = {
                'game_id': game_id,
                'name_en': data.get('EN', ''),
                'name_cn': name_cn,
                'rarity': data.get('rank', 4),
                'element': data.get('element', 200),
                'weapon_type': data.get('type', 1),
                'icon': data.get('icon', ''),
                'owned': game_id in owned_agents,
                'agent_id': owned_agents[game_id].id if game_id in owned_agents else None
            }
            result.append(agent_info)
        
        # 按拥有的状态、稀有度和名称排序
        # owned 为 True (1), False (0)。要让 owned 排在前面，可以用 not owned (False < True) 或 -owned
        result.sort(key=lambda x: (not x['owned'], -x['rarity'], x['name_cn']))
        return result
    
    def get_agents(self) -> List[Dict]:
        """获取当前存档的所有角色"""
        save = self.save_manager.get_current_save()
        if not save:
            return []
        return [self._agent_to_dict(a) for a in save.agents.values()]

    def get_agent_detail(self, agent_id: str) -> Optional[Dict]:
        """获取角色详情"""
        save = self.save_manager.get_current_save()
        if not save or agent_id not in save.agents:
            return None
        return self._agent_to_dict_detailed(save.agents[agent_id], save)

    # ========== 驱动盘管理 ==========
    def get_drive_disks(self, equipped: Optional[bool] = None) -> List[Dict]:
        """获取驱动盘列表"""
        save = self.save_manager.get_current_save()
        if not save:
            return []

        disks = list(save.drive_disks.values())

        if equipped is not None:
            disks = [d for d in disks if (d.equipped_agent is not None) == equipped]

        result = []
        for d in disks:
            item = self._disk_to_dict(d)
            result.append(item)

        return result

    # ========== 音擎管理 ==========
    def get_wengines(self, equipped: Optional[bool] = None) -> List[Dict]:
        """获取音擎列表"""
        save = self.save_manager.get_current_save()
        if not save:
            return []
        wengines = save.wengines.values()
        if equipped is not None:
            wengines = [w for w in wengines if (w.equipped_agent is not None) == equipped]
        return [self._wengine_to_dict(w) for w in wengines]

    # ========== 装备管理 ==========
    def equip_wengine(self, agent_id: str, wengine_id: str) -> bool:
        """装备音擎"""
        return self.save_manager.equip_wengine(agent_id, wengine_id)

    def unequip_wengine(self, agent_id: str) -> bool:
        """卸载音擎"""
        return self.save_manager.unequip_wengine(agent_id)

    def equip_disk(self, agent_id: str, disk_id: str) -> bool:
        """装备驱动盘"""
        return self.save_manager.equip_disk(agent_id, disk_id)

    def unequip_disk(self, agent_id: str, position: int) -> bool:
        """卸载驱动盘"""
        return self.save_manager.unequip_disk(agent_id, position)

    # ========== 优化功能 ==========
    def optimize_equipment(
        self,
        front_agent_id: str,
        skill_names: List[str],
        enemy_id: str,
        back_agent_1_id: Optional[str] = None,
        back_agent_2_id: Optional[str] = None,
        available_wengine_ids: Optional[List[str]] = None,
        available_disk_ids: Optional[List[str]] = None,
        include_anomaly: bool = True,
        top_n_per_position: int = 5,
    ) -> Optional[Dict]:
        """优化角色装备（支持队伍配置）

        Args:
            front_agent_id: 前台角色ID
            skill_names: 要优化的技能名称列表（如 ["终结技", "特殊技"]）
            enemy_id: 敌人ID
            back_agent_1_id: 后台角色1 ID（可选）
            back_agent_2_id: 后台角色2 ID（可选）
            available_wengine_ids: 可用音擎ID列表（可选，默认使用所有未装备的音擎）
            available_disk_ids: 可用驱动盘ID列表（可选，默认使用所有未装备的驱动盘）
            include_anomaly: 是否计算异常伤害
            top_n_per_position: 每个位置保留的候选驱动盘数量（限制组合数）

        Returns:
            优化结果字典，包含：
            - success: 是否成功
            - best_wengine: 最优音擎（字典格式）
            - best_disks: 最优驱动盘列表（字典格式）
            - max_damage: 最大伤害
            - damage_result: 详细伤害结果
            - total_combinations: 总共测试的组合数
            - elapsed_time: 耗时（秒）
            - error: 错误信息（如果失败）
        """
        from .services.equipment_optimizer_service import EquipmentOptimizerService
        from .zzz_models.agent_skill import AgentSkill, AgentSkillSegment

        try:
            # 1. 获取存档
            save = self.save_manager.get_current_save()
            if not save:
                return {'success': False, 'error': '没有当前存档'}

            # 2. 获取角色
            if front_agent_id not in save.agents:
                return {'success': False, 'error': f'前台角色不存在: {front_agent_id}'}

            front_agent = save.agents[front_agent_id]
            back_agent_1 = save.agents.get(back_agent_1_id) if back_agent_1_id else None
            back_agent_2 = save.agents.get(back_agent_2_id) if back_agent_2_id else None

            # 3. 获取技能
            skills_data = self.get_agent_skills(front_agent_id)
            if not skills_data:
                return {'success': False, 'error': '无法获取技能数据'}

            # 根据技能名称查找技能
            skills = []
            for skill_name in skill_names:
                for skill_detail in skills_data.get('skill_details', []):
                    if skill_name in skill_detail['name']:
                        # 创建 AgentSkill 对象
                        segments = []
                        for seg in skill_detail.get('segments', []):
                            segment = AgentSkillSegment(
                                agent_name=front_agent.name_cn,
                                skill_name=skill_detail['name'],
                                segment_name=seg['segment_name'],
                                damage_ratio=0,
                                damage_ratio_growth=0,
                                stun_ratio=0,
                                stun_ratio_growth=0,
                                energy_recovery=seg['energy_recovery'],
                                anomaly_buildup=seg['anomaly_buildup'],
                                decibel_recovery=0,
                                flash_energy_accumulation=0,
                                corruption_shield_reduction=0,
                                skill_type=0,
                                attack_type=0,
                                energy_extra_cost=0,
                            )
                            segments.append(segment)

                        skill = AgentSkill(
                            agent_name=front_agent.name_cn,
                            skill_name=skill_detail['name'],
                            segments=segments,
                            level=skill_detail['level']
                        )
                        skills.append(skill)
                        break

            if not skills:
                return {'success': False, 'error': f'未找到技能: {skill_names}'}

            # 4. 获取可用装备
            if available_wengine_ids:
                # 使用指定的音擎
                available_wengines = [
                    save.wengines[wid] for wid in available_wengine_ids
                    if wid in save.wengines
                ]
            else:
                # 使用所有未装备的音擎
                available_wengines = [
                    w for w in save.wengines.values()
                    if w.equipped_agent is None
                ]

            if available_disk_ids:
                # 使用指定的驱动盘
                available_disks = [
                    save.drive_disks[did] for did in available_disk_ids
                    if did in save.drive_disks
                ]
            else:
                # 使用所有未装备的驱动盘
                available_disks = [
                    d for d in save.drive_disks.values()
                    if d.equipped_agent is None
                ]

            if not available_wengines:
                return {'success': False, 'error': '没有可用音擎'}

            if not available_disks:
                return {'success': False, 'error': '没有可用驱动盘'}

            # 5. 创建优化服务
            optimizer = EquipmentOptimizerService(
                agent=front_agent,
                skills=skills,
                available_wengines=available_wengines,
                available_disks=available_disks,
                enemy_id=enemy_id,
                data_loader=self.optimizer.data_loader,
                back_agent_1=back_agent_1,
                back_agent_2=back_agent_2,
                include_anomaly=include_anomaly,
                top_n_per_position=top_n_per_position,
            )

            # 6. 执行优化
            result = optimizer.optimize()

            # 7. 转换结果为字典格式
            return {
                'success': True,
                'best_wengine': self._wengine_to_dict(result['best_wengine']) if result['best_wengine'] else None,
                'best_disks': [self._disk_to_dict(d) for d in result['best_disks']] if result['best_disks'] else [],
                'max_damage': result['max_damage'],
                'damage_result': result['damage_result'],
                'total_combinations': result['total_combinations'],
                'elapsed_time': result['elapsed_time'],
            }

        except Exception as e:
            import traceback
            return {
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }

    def calculate_damage(
        self,
        agent_id: str,
        skill_names: List[str],
        enemy_id: str,
        back_agent_1_id: Optional[str] = None,
        back_agent_2_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """计算角色伤害（使用当前装备）

        Args:
            agent_id: 角色ID
            skill_names: 技能名称列表（如 ["终结技", "特殊技"]）
            enemy_id: 敌人ID
            back_agent_1_id: 后台角色1 ID（可选）
            back_agent_2_id: 后台角色2 ID（可选）

        Returns:
            伤害结果字典，包含：
            - success: 是否成功
            - normal_damage: 直伤
            - anomaly_damage: 异常伤害
            - total_damage: 总伤害
            - error: 错误信息（如果失败）
        """
        from .services.battle_service import BattleService
        from .zzz_models.agent_skill import AgentSkill, AgentSkillSegment

        try:
            # 1. 获取存档
            save = self.save_manager.get_current_save()
            if not save:
                return {'success': False, 'error': '没有当前存档'}

            # 2. 获取角色
            if agent_id not in save.agents:
                return {'success': False, 'error': f'角色不存在: {agent_id}'}

            agent = save.agents[agent_id]
            back_agent_1 = save.agents.get(back_agent_1_id) if back_agent_1_id else None
            back_agent_2 = save.agents.get(back_agent_2_id) if back_agent_2_id else None

            # 3. 获取技能
            skills_data = self.get_agent_skills(agent_id)
            if not skills_data:
                return {'success': False, 'error': '无法获取技能数据'}

            # 根据技能名称查找技能
            skills = []
            for skill_name in skill_names:
                for skill_detail in skills_data.get('skill_details', []):
                    if skill_name in skill_detail['name']:
                        # 创建 AgentSkill 对象
                        segments = []
                        for seg in skill_detail.get('segments', []):
                            segment = AgentSkillSegment(
                                agent_name=agent.name_cn,
                                skill_name=skill_detail['name'],
                                segment_name=seg['segment_name'],
                                damage_ratio=0,
                                damage_ratio_growth=0,
                                stun_ratio=0,
                                stun_ratio_growth=0,
                                energy_recovery=seg['energy_recovery'],
                                anomaly_buildup=seg['anomaly_buildup'],
                                decibel_recovery=0,
                                flash_energy_accumulation=0,
                                corruption_shield_reduction=0,
                                skill_type=0,
                                attack_type=0,
                                energy_extra_cost=0,
                            )
                            segments.append(segment)

                        skill = AgentSkill(
                            agent_name=agent.name_cn,
                            skill_name=skill_detail['name'],
                            segments=segments,
                            level=skill_detail['level']
                        )
                        skills.append(skill)
                        break

            if not skills:
                return {'success': False, 'error': f'未找到技能: {skill_names}'}

            # 4. 获取敌人
            enemies = self.optimizer.data_loader.enemies
            if not enemies:
                return {'success': False, 'error': '没有敌人数据'}

            if enemy_id not in enemies:
                return {'success': False, 'error': f'敌人不存在: {enemy_id}'}

            # 使用 Enemy 对象（稍后通过 get_combat_stats() 转换）
            enemy_obj = enemies[enemy_id]

            # 5. 创建战场服务
            battle = BattleService()
            battle.set_front_agent(agent)
            if back_agent_1:
                battle.set_back_agents([back_agent_1] + ([back_agent_2] if back_agent_2 else []))
            battle.set_enemy(enemy_obj)

            # 开始战斗（一次性计算所有乘区）
            battle.start_battle()

            # 6. 计算伤害（遍历每个技能）
            skill_results = []
            total_normal_damage = 0
            total_anomaly_damage = 0

            for skill in skills:
                # 计算每个技能段的总伤害倍率
                total_damage_ratio = 0
                total_stun_ratio = 0
                total_anomaly_buildup = 0
                for segment in skill.segments:
                    total_damage_ratio += segment.damage_ratio
                    total_stun_ratio += segment.stun_ratio
                    total_anomaly_buildup += segment.anomaly_buildup

                # 获取技能元素
                skill_element = agent.element.value if hasattr(agent.element, 'value') else str(agent.element)

                # 计算伤害
                result = battle.calculate_skill_damage(
                    skill_damage_ratio=total_damage_ratio,
                    skill_element=skill_element,
                    stun_ratio=total_stun_ratio,
                    include_anomaly=True,
                    anomaly_buildup=total_anomaly_buildup,
                )

                skill_results.append({
                    'skill_name': skill.skill_name,
                    'damage': result['normal_damage_expected'],
                    'normal_damage_no_crit': result['normal_damage_no_crit'],
                    'normal_damage_crit': result['normal_damage_crit'],
                    'normal_damage_expected': result['normal_damage_expected'],
                })

                total_normal_damage += result['normal_damage_expected']

            result = {
                'skill_results': skill_results,
                'total_normal_damage_expected': total_normal_damage,
                'total_anomaly_damage': total_anomaly_damage,
                'total_damage': total_normal_damage + total_anomaly_damage,
                'zones': zones,
            }

            # 7. 获取角色最终属性
            agent_stats = agent.get_final_stats()

            # 8. 获取局内属性
            combat_stats = result.get('combat_stats')
            in_combat_stats = {}
            if combat_stats:
                in_combat_stats = {
                    'base_atk': combat_stats.base_atk,
                    'base_hp': combat_stats.base_hp,
                    'base_def': combat_stats.base_def,
                    'base_impact': combat_stats.base_impact,
                    'base_penetration': combat_stats.base_penetration,
                    'base_anomaly_mastery': combat_stats.base_anomaly_mastery,
                    'base_anomaly_proficiency': combat_stats.base_anomaly_proficiency,
                    'atk_percent': combat_stats.atk_percent,
                    'hp_percent': combat_stats.hp_percent,
                    'def_percent': combat_stats.def_percent,
                    'impact_percent': combat_stats.impact_percent,
                    'atk_flat': combat_stats.atk_flat,
                    'hp_flat': combat_stats.hp_flat,
                    'def_flat': combat_stats.def_flat,
                    'anomaly_mastery_flat': combat_stats.anomaly_mastery_flat,
                    'anomaly_proficiency_flat': combat_stats.anomaly_proficiency_flat,
                    'crit_rate': combat_stats.crit_rate,
                    'crit_dmg': combat_stats.crit_dmg,
                    'penetration_rate': combat_stats.penetration_rate,
                    'penetration_value': combat_stats.penetration_value,
                    'dmg_bonus': combat_stats.dmg_bonus,
                    'element_dmg_bonus': combat_stats.element_dmg_bonus,
                    'penetration_dmg_bonus': combat_stats.penetration_dmg_bonus,
                    'anomaly_buildup_efficiency': combat_stats.anomaly_buildup_efficiency,
                    'anomaly_dmg_bonus': combat_stats.anomaly_dmg_bonus,
                    'anomaly_crit_rate': combat_stats.anomaly_crit_rate,
                    'anomaly_crit_dmg': combat_stats.anomaly_crit_dmg,
                    'stun_value_bonus': combat_stats.stun_value_bonus,
                    'energy_regen': combat_stats.energy_regen,
                }

            # 9. 返回结果
            return {
                'success': True,
                'normal_damage': result.get('total_normal_damage_expected', 0),
                'anomaly_damage': result.get('total_anomaly_damage', 0),
                'total_damage': result.get('total_damage', 0),
                'zones': result.get('zones', {}),
                'anomaly_result': result.get('skill_results', [{}])[0].get('anomaly_result', {}) if result.get('skill_results') else {},
                'agent_stats': agent_stats,
                'in_combat_stats': in_combat_stats,
            }

        except Exception as e:
            import traceback
            return {
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }

    # ========== 数据转换 ==========
    def _agent_to_dict_detailed(self, agent: Agent, save_data) -> Dict:
        """角色转详细字典（包含装备详情）"""
        data = self._agent_to_dict(agent)
        
        # 填充音擎详情
        if agent.equipped_wengine and agent.equipped_wengine in save_data.wengines:
            wengine = save_data.wengines[agent.equipped_wengine]
            data['wengine_detail'] = self._wengine_to_dict(wengine)
            
        # 填充驱动盘详情
        disk_details = []
        for disk_id in agent.equipped_drive_disks:
            if disk_id and disk_id in save_data.drive_disks:
                disk = save_data.drive_disks[disk_id]
                disk_details.append(self._disk_to_dict(disk))
            else:
                disk_details.append(None)
        data['drive_disks_detail'] = disk_details
        
        # 计算面板属性
        try:
            data['stats'] = agent.get_final_stats()
        except Exception as e:
            print(f"计算角色 {agent.name_cn} 面板属性失败: {e}")
            data['stats'] = {}
        
        # 添加影画等级
        data['cinema'] = agent.cinema
        
        return data

    def _agent_to_dict(self, agent: Agent) -> Dict:
        """角色转字典"""
        breakthrough_level = self._infer_breakthrough_level(agent)
        
        # 从Agent对象获取中文名称（由_load_agent_stats加载）
        element_cn = getattr(agent, '_element_cn', '未知')
        weapon_type_cn = getattr(agent, '_weapon_type_cn', '未知')
        
        return {
            'id': agent.id,
            'game_id': agent.game_id,
            'name_cn': agent.name_cn,
            'level': agent.level,
            'breakthrough': breakthrough_level,
            'rarity': agent.rarity.value,
            'element': element_cn,
            'weapon_type': weapon_type_cn,
            'icon': agent.icon,
            'equipped_wengine': agent.equipped_wengine,
            'equipped_drive_disks': agent.equipped_drive_disks
        }
    
    def _infer_breakthrough_level(self, agent: Agent) -> int:
        """根据等级推断突破等级
        
        游戏规则：
        - 1突: 可升至10级
        - 2突: 可升至20级
        - 3突: 可升至30级
        - 4突: 可升至40级
        - 5突: 可升至50级
        - 6突: 可升至60级
        
        突破等级 = 当前等级所在的突破档位
        """
        level = agent.level
        
        # 如果Agent对象有breakthrough属性且非0，直接返回
        if hasattr(agent, 'breakthrough') and agent.breakthrough > 0:
            return agent.breakthrough
        
        # 根据等级推断突破等级
        if level < 10:
            return 0  # 未达到10级，还没完成1突
        elif level == 10:
            return 1  # 10级是1突
        elif level <= 20:
            return 2  # 11-20级是2突
        elif level <= 30:
            return 3  # 21-30级是3突
        elif level <= 40:
            return 4  # 31-40级是4突
        elif level <= 50:
            return 5  # 41-50级是5突
        else:  # level > 50
            return 6  # 51-60级是6突
    
    def get_agent_skills(self, agent_id: str) -> Optional[Dict]:
        """获取角色技能详细数据（从CSV加载）
        
        Returns:
            包含技能等级和详细数据的字典
        """
        from pathlib import Path
        from optimizer.services.csv_loader_service import CsvDataLoaderService
        
        save = self.save_manager.get_current_save()
        if not save or agent_id not in save.agents:
            return None
        
        agent = save.agents[agent_id]
        skills_dict = agent.skills.to_dict()
        
        result = {
            'levels': skills_dict,
            'core_skill': agent.core_skill,
            'cinema': agent.cinema,
            'is_max': agent.skills.is_max,
            'total_level': agent.skills.total_level,
            'skill_details': []
        }
        
        # 从CSV加载技能数据
        csv_dir = self.optimizer.data_loader.game_data_dir / "csv"
        if csv_dir.exists():
            csv_loader = CsvDataLoaderService(csv_dir)
            agent_skill_sets = csv_loader.load_agent_skills()
            
            # 通过中文名查找技能数据
            skill_set = agent_skill_sets.get(agent.name_cn)
            if skill_set:
                for skill_name, skill in skill_set.skills.items():
                    # 根据技能名称确定等级
                    level = 1
                    if '普通攻击' in skill_name or '强化普通攻击' in skill_name:
                        level = skills_dict.get('normal', 1)
                    elif '特殊技' in skill_name or '强化特殊技' in skill_name:
                        level = skills_dict.get('special', 1)
                    elif '闪避' in skill_name or '反击' in skill_name:
                        level = skills_dict.get('dodge', 1)
                    elif '支援' in skill_name:
                        level = skills_dict.get('assist', 1)
                    elif '连携' in skill_name or '终结技' in skill_name:
                        level = skills_dict.get('chain', 1)
                    
                    # 计算技能数据
                    total_damage = skill.get_total_damage_ratio(level)
                    total_stun = skill.get_total_stun_ratio(level)
                    total_energy = skill.get_total_energy_recovery()
                    total_anomaly = skill.get_total_anomaly_buildup()
                    
                    # 构建段数据
                    segments_data = []
                    for seg in skill.segments:
                        segments_data.append({
                            'segment_name': seg.segment_name or '单段',
                            'damage_ratio': seg.get_damage_ratio_at_level(level),
                            'stun_ratio': seg.get_stun_ratio_at_level(level),
                            'energy_recovery': seg.energy_recovery,
                            'anomaly_buildup': seg.anomaly_buildup,
                        })
                    
                    result['skill_details'].append({
                        'name': skill_name,
                        'level': level,
                        'segments_count': len(skill.segments),
                        'total_damage_ratio': total_damage,
                        'total_stun_ratio': total_stun,
                        'total_energy_recovery': total_energy,
                        'total_anomaly_buildup': total_anomaly,
                        'segments': segments_data,  # 添加段详细数据
                    })
        
        return result
    
    def get_agent_buffs(self, agent_id: str) -> Optional[Dict]:
        """获取角色所有buff
        
        Returns:
            包含所有buff分类的字典
        """
        save = self.save_manager.get_current_save()
        if not save or agent_id not in save.agents:
            return None
        
        agent = save.agents[agent_id]
        buffs = agent.get_all_buffs()
        
        # 将Buff对象转换为字典
        result = {}
        for category, buff_list in buffs.items():
            result[category] = []
            for buff in buff_list:
                buff_dict = {
                    'name': buff.name,
                    'description': buff.description,
                    'is_active': buff.is_active,
                    'out_of_combat_stats': {},
                    'in_combat_stats': {},
                }
                
                # 获取局外属性加成
                if hasattr(buff, 'out_of_combat_stats'):
                    for prop_type, value in buff.out_of_combat_stats.items():
                        buff_dict['out_of_combat_stats'][prop_type.name] = value
                
                # 获取局内属性加成
                if hasattr(buff, 'in_combat_stats'):
                    for prop_type, value in buff.in_combat_stats.items():
                        buff_dict['in_combat_stats'][prop_type.name] = value
                
                result[category].append(buff_dict)
        
        return result
    
    def get_agent_profile(self, agent_id: str) -> Optional[Dict]:
        """获取角色个人信息（从character/{game_id}.json读取PartnerInfo）
        
        Returns:
            包含个人信息的字典，如：
            - birthday: 生日
            - full_name: 全名
            - gender: 性别
            - stature: 身高
            - profile_desc: 个人简介
            - race: 阵营
            - impression: 印象评价
        """
        import json
        from pathlib import Path
        
        save = self.save_manager.get_current_save()
        if not save or agent_id not in save.agents:
            return None
        
        agent = save.agents[agent_id]
        if not agent.game_id:
            return None
        
        # 直接读取character/{game_id}.json文件
        char_file = self.optimizer.data_loader.game_data_dir / "character" / f"{agent.game_id}.json"
        if not char_file.exists():
            return None
        
        try:
            with open(char_file, 'r', encoding='utf-8') as f:
                char_data = json.load(f)
            
            partner_info = char_data.get('PartnerInfo', {})
            if not partner_info:
                return None
            
            return {
                'birthday': partner_info.get('Birthday', '未知'),
                'full_name': partner_info.get('FullName', agent.name_cn),
                'gender': partner_info.get('Gender', '未知'),
                'stature': partner_info.get('Stature', '未知'),
                'profile_desc': partner_info.get('ProfileDesc', '暂无简介'),
                'race': partner_info.get('Race', '未知'),
                'impression_f': partner_info.get('ImpressionF', ''),
                'impression_m': partner_info.get('ImpressionM', ''),
            }
        except Exception as e:
            print(f"读取角色{agent.name_cn}的个人信息失败: {e}")
            return None

    # ========== 敌人管理 ==========
    def get_enemies(self) -> List[Dict]:
        """获取所有敌人列表
        
        Returns:
            敌人列表，每个敌人包含：
            - id: 敌人ID（用于唯一标识，格式为 "完整名称_ID"）
            - full_name: 完整名称
            - full_name_en: 英文名称
            - code_name: 代码名称
            - tags: 标签（用于判断是否是首领/精英）
            - is_boss: 是否为首领
            - is_elite: 是否为精英
            - size_category: 体型分类
            - hp: 生命值
            - atk: 攻击力
            - defense: 防御力
            - crit_dmg: 暴击伤害
            - stun_max: 失衡值上限
            - can_stun: 能否失衡
            - stun_vulnerability_multiplier: 失衡易伤倍率
            - ice_dmg_resistance: 冰伤害抗性
            - fire_dmg_resistance: 火伤害抗性
            - electric_dmg_resistance: 电伤害抗性
            - physical_dmg_resistance: 物理伤害抗性
            - ether_dmg_resistance: 以太伤害抗性
        """
        enemies = self.optimizer.data_loader.enemies
        if not enemies:
            return []
        
        result = []
        for enemy_key, enemy in enemies.items():
            enemy_dict = {
                'id': enemy_key,
                'full_name': enemy.full_name,
                'full_name_en': enemy.full_name_en,
                'code_name': enemy.code_name,
                'tags': enemy.tags,
                'is_boss': enemy.is_boss,
                'is_elite': enemy.is_elite,
                'size_category': enemy.size_category,
                'hp': enemy.hp,
                'atk': enemy.atk,
                'defense': enemy.defense,
                'crit_dmg': enemy.crit_dmg,
                'stun_max': enemy.stun_max,
                'can_stun': enemy.can_stun,
                'stun_vulnerability_multiplier': enemy.stun_vulnerability_multiplier,
                'ice_dmg_resistance': enemy.ice_dmg_resistance,
                'fire_dmg_resistance': enemy.fire_dmg_resistance,
                'electric_dmg_resistance': enemy.electric_dmg_resistance,
                'physical_dmg_resistance': enemy.physical_dmg_resistance,
                'ether_dmg_resistance': enemy.ether_dmg_resistance,
            }
            result.append(enemy_dict)
        
        # 按名称排序
        result.sort(key=lambda x: x['full_name'])
        return result

    def _disk_to_dict(self, disk: DriveDisk) -> Dict:
        """驱动盘转字典"""
        # 使用 get_stats() 获取属性（内部已缓存）
        calculated_stats = disk.get_stats()

        # 获取主属性值（适配 PropertyCollection）
        main_stat_value = calculated_stats.get_out_of_combat(disk.main_stat, disk.main_stat_value.value)

        # 获取副属性列表（包含强化次数）
        sub_stats_list = []
        for prop_type, stat_value in disk.sub_stats.items():
            # 从计算结果中获取实际数值
            actual_value = calculated_stats.get_out_of_combat(prop_type, stat_value.value)
            # stat_value.value 存储的是强化次数（rolls）
            rolls = int(stat_value.value)
            sub_stats_list.append({
                'name': prop_type.cn_name,  # 使用中文名称
                'value': actual_value,
                'rolls': rolls,  # 强化次数
                'is_percentage': prop_type.is_percentage
            })

        # 获取图标名称
        icon_name = self.get_equipment_icon_name(disk.game_id)

        return {
            'id': disk.id,
            'game_id': disk.game_id,
            'set_name_cn': disk.set_name_cn,
            'position': disk.position.value,
            'rarity': disk.rarity.value,
            'level': disk.level,
            'main_stat': disk.main_stat.cn_name,  # 使用中文名称
            'main_stat_value': main_stat_value,
            'main_stat_is_percentage': disk.main_stat.is_percentage,
            'sub_stats': sub_stats_list,
            'equipped_agent': disk.equipped_agent,
            'locked': disk.locked,
            'icon': icon_name
        }

    def _wengine_to_dict(self, wengine: WEngine) -> Dict:
        """音擎转字典"""
        # 计算当前等级的属性
        stats = wengine.get_stats_at_level(wengine.level, wengine.breakthrough)

        # 获取基础攻击力和副属性（适配 PropertyCollection）
        base_atk = stats.get_out_of_combat(PropertyType.ATK_BASE, wengine.base_atk)
        rand_stat_value = 0
        rand_stat_name = ""
        rand_stat_is_percentage = False
        if wengine.rand_stat_type:
            rand_stat_value = stats.get_out_of_combat(wengine.rand_stat_type, wengine.rand_stat)
            rand_stat_name = wengine.rand_stat_type.cn_name  # 使用中文名称
            rand_stat_is_percentage = wengine.rand_stat_type.is_percentage

        # 获取图标名称
        icon_name = self.get_wengine_icon_name(wengine.wengine_id)

        # 获取天赋描述
        talent_description = ""
        if wengine.talents:
            # 根据精炼等级获取对应的天赋
            for talent in wengine.talents:
                if talent.level == wengine.refinement:
                    talent_description = talent.description
                    break

        return {
            'id': wengine.id,
            'wengine_id': wengine.wengine_id,
            'name': wengine.name,
            'rarity': wengine.rarity,
            'level': wengine.level,
            'refinement': wengine.refinement,
            'breakthrough': wengine.breakthrough,
            'equipped_agent': wengine.equipped_agent,
            'base_atk': base_atk,
            'rand_stat_type': rand_stat_name,
            'rand_stat_value': rand_stat_value,
            'rand_stat_is_percentage': rand_stat_is_percentage,
            'talent_description': talent_description,
            'icon': icon_name
        }

    def get_equipment_icon_name(self, game_id: str) -> Optional[str]:
        """获取驱动盘图标名称

        Args:
            game_id: 驱动盘游戏ID（如 "33500"）

        Returns:
            图标名称（如 "SuitWhiteWaterBallad"），如果未找到则返回None
        """
        if not self.optimizer.data_loader.equipment_data:
            return None

        equipment_info = self.optimizer.data_loader.equipment_data.get(game_id)
        if not equipment_info:
            return None

        # 从icon路径中提取文件名
        # 例如: "UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitWhiteWaterBallad.png"
        # 提取: "SuitWhiteWaterBallad"
        icon_path = equipment_info.get('icon', '')
        if icon_path:
            # 提取最后一个斜杠后的文件名，去掉扩展名
            icon_name = icon_path.split('/')[-1].replace('.png', '')
            return icon_name

        return None

    def get_wengine_icon_name(self, wengine_id: str) -> Optional[str]:
        """获取音擎图标名称

        Args:
            wengine_id: 音擎游戏ID（如 "13108"）

        Returns:
            图标名称（如 "Weapon_A_1081"），如果未找到则返回None
        """
        if not self.optimizer.data_loader.weapon_data:
            return None

        weapon_info = self.optimizer.data_loader.weapon_data.get(wengine_id)
        if not weapon_info:
            return None

        # 直接返回icon字段
        # 例如: "Weapon_A_1081"
        return weapon_info.get('icon')
