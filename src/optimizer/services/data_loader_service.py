"""
数据加载服务

负责加载游戏数据和个人数据
"""
import json
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from optimizer.zzz_models import (
    Agent, AgentSkills,
    DriveDisk, WEngine,
    Rarity, ElementType, WeaponType, PropertyType, StatValue
)


class DataLoaderService:
    """数据加载服务

    负责加载：
    1. 游戏数据（角色、驱动盘、音擎的基础数据）
    2. 个人数据（从导出的JSON文件加载）
    """

    def __init__(
        self,
        game_data_dir: Path,
        user_data_dir: Optional[Path] = None
    ):
        """初始化数据加载服务

        Args:
            game_data_dir: 游戏数据目录路径（assets/inventory_data）
            user_data_dir: 用户数据目录路径（.debug/inventory_exports）
        """
        self.game_data_dir = game_data_dir
        self.user_data_dir = user_data_dir

        # 游戏数据缓存
        self._character_data: Optional[Dict] = None
        self._equipment_data: Optional[Dict] = None
        self._weapon_data: Optional[Dict] = None

        # ⚠️ 详细数据缓存（一次性加载所有数据）
        self._weapon_detail_cache: Dict[str, Dict] = {}
        self._weapon_buff_cache: Dict[str, Dict] = {}
        self._character_detail_cache: Dict[str, Dict] = {}
        self._character_buff_cache: Dict[str, Dict] = {}
        self._equipment_detail_cache: Dict[str, Dict] = {}
        self._equipment_buff_cache: Dict[str, Dict] = {}

        # ⚠️ CSV数据缓存
        self._agent_skill_sets: Optional[Dict] = None
        self._bangboo_stats: Optional[Dict] = None
        self._bangboo_skills: Optional[Dict] = None
        self._enemies: Optional[Dict] = None
        self._anomaly_bars: Optional[Dict] = None

        # 用户数据缓存
        self._user_agents: Optional[List[Agent]] = None
        self._user_drive_disks: Optional[List[DriveDisk]] = None
        self._user_wengines: Optional[List[WEngine]] = None

    @property
    def character_data(self) -> Optional[Dict]:
        """获取角色游戏数据"""
        return self._character_data

    @property
    def weapon_data(self) -> Optional[Dict]:
        """获取音擎游戏数据"""
        return self._weapon_data

    @property
    def equipment_data(self) -> Optional[Dict]:
        """获取驱动盘游戏数据"""
        return self._equipment_data

    @property
    def agent_skill_sets(self) -> Optional[Dict]:
        """获取代理人技能数据"""
        return self._agent_skill_sets

    @property
    def bangboo_stats(self) -> Optional[Dict]:
        """获取邦布属性数据"""
        return self._bangboo_stats

    @property
    def bangboo_skills(self) -> Optional[Dict]:
        """获取邦布技能数据"""
        return self._bangboo_skills

    @property
    def enemies(self) -> Optional[Dict]:
        """获取敌人属性数据"""
        return self._enemies

    @property
    def anomaly_bars(self) -> Optional[Dict]:
        """获取异常条数据"""
        return self._anomaly_bars

    def load_game_data(self) -> None:
        """加载游戏基础数据"""
        # 加载角色数据
        character_file = self.game_data_dir / "character.json"
        if character_file.exists():
            with open(character_file, 'r', encoding='utf-8') as f:
                self._character_data = json.load(f)

        # 加载驱动盘数据
        equipment_file = self.game_data_dir / "equipment.json"
        if equipment_file.exists():
            with open(equipment_file, 'r', encoding='utf-8') as f:
                self._equipment_data = json.load(f)

        # 加载音擎数据
        weapon_file = self.game_data_dir / "weapon.json"
        if weapon_file.exists():
            with open(weapon_file, 'r', encoding='utf-8') as f:
                self._weapon_data = json.load(f)

        # ⚠️ 预加载所有详细数据到缓存
        self._preload_weapon_details()
        self._preload_character_details()
        self._preload_equipment_details()
        self._preload_csv_data()

    def load_user_data(self, filename: Optional[str] = None) -> None:
        """加载用户数据

        Args:
            filename: 指定要加载的文件名，如果为None则加载最新的文件
        """
        if self.user_data_dir is None:
            raise ValueError("用户数据目录未设置")

        # 如果没有指定文件名，找到最新的文件
        if filename is None:
            json_files = list(self.user_data_dir.glob("inventory_*.json"))
            if not json_files:
                raise FileNotFoundError(f"在 {self.user_data_dir} 中未找到任何 inventory_*.json 文件")
            # 按修改时间排序，取最新的
            latest_file = max(json_files, key=lambda p: p.stat().st_mtime)
        else:
            latest_file = self.user_data_dir / filename
            if not latest_file.exists():
                raise FileNotFoundError(f"文件不存在: {latest_file}")

        # 加载JSON数据
        with open(latest_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 解析数据
        self._parse_user_data(data)

    def _parse_user_data(self, data: Dict) -> None:
        """解析用户数据

        Args:
            data: 从JSON文件加载的数据
        """
        self._user_agents = []
        self._user_drive_disks = []
        self._user_wengines = []

        # 解析角色数据
        if "characters" in data:
            for char_data in data["characters"]:
                agent = self._parse_agent(char_data)
                if agent:
                    self._user_agents.append(agent)

        # 解析驱动盘数据
        if "discs" in data:
            for disc_data in data["discs"]:
                disk = self._parse_drive_disk(disc_data)
                if disk:
                    self._user_drive_disks.append(disk)

        # 解析音擎数据
        if "wengines" in data:
            for wengine_data in data["wengines"]:
                wengine = self._parse_wengine(wengine_data)
                if wengine:
                    self._user_wengines.append(wengine)

    def _parse_agent(self, data: Dict) -> Optional[Agent]:
        """解析角色数据

        Args:
            data: 角色JSON数据

        Returns:
            Agent对象，解析失败返回None
        """
        try:
            # 解析技能等级
            skills_data = data.get("skills", {})
            skills = AgentSkills(
                normal=self._parse_skill_level(skills_data.get("normal", "1/12")),
                dodge=self._parse_skill_level(skills_data.get("dodge", "1/12")),
                assist=self._parse_skill_level(skills_data.get("assist", "1/12")),
                special=self._parse_skill_level(skills_data.get("special", "1/12")),
                chain=self._parse_skill_level(skills_data.get("chain", "1/12")),
            )

            # 解析影院等级
            cinema_str = data.get("cinema", "0/6")
            cinema = int(cinema_str.split("/")[0]) if "/" in cinema_str else 0

            # 从游戏数据获取角色基础信息
            # 1. 从导出数据获取英文名（去掉空格和特殊字符，转换为驼峰式）
            en_name = data.get("key", "")
            # 处理英文名：去掉空格和 "-" 等特殊字符
            normalized_name = en_name.replace(" ", "").replace("-", "") if en_name else ""
            # 2. 通过处理后的英文名查找真实game_id
            agent_game_id = self._get_game_id_by_en_name(normalized_name) if normalized_name else None
            # 3. 获取角色游戏数据
            result = self._get_agent_game_data_by_id(agent_game_id) if agent_game_id else None

            # 初始化默认值
            name_cn = en_name or "未知角色"  # 默认使用英文名

            if not result:
                print(f"警告: 未找到角色 key={en_name} (game_id={agent_game_id}) 的游戏数据")
                # 使用默认值
                rarity = Rarity.S
                element = ElementType.PHYSICAL
                weapon_type = WeaponType.ATTACK
                icon = ""
                game_data = None
            else:
                game_data = result
                name_cn = game_data.get("CHS", name_cn)  # 使用中文名
                rarity = Rarity(game_data.get("rank", 4))
                element = ElementType(game_data.get("element", 200))
                weapon_type = WeaponType(game_data.get("type", 1))
                icon = game_data.get("icon", "")

            agent = Agent(
                id=data.get("id", str(uuid.uuid4())),  # 使用存档中的ID或生成新的
                game_id=agent_game_id or str(data.get("id", "")),
                name_cn=name_cn,
                rarity=rarity,
                level=data.get("level", 1),
                breakthrough=6,  # 假设满突破
                element=element,
                weapon_type=weapon_type,
                icon=icon,
                cinema=cinema,
                core_skill=data.get("core_skill", 1),
                skills=skills,
            )

            # 尝试加载角色详细属性数据
            self._load_agent_stats(agent, game_data)

            # 尝试加载角色技能集
            self._load_agent_skill_set(agent)

            return agent
        except Exception as e:
            print(f"解析角色数据失败: {e}, 数据: {data}")
            return None

    def _parse_drive_disk(self, data: Dict) -> Optional[DriveDisk]:
        """解析驱动盘数据

        Args:
            data: 驱动盘JSON数据

        Returns:
            DriveDisk对象，解析失败返回None
        """
        try:
            # 解析稀有度
            rarity_str = data.get("rarity", "S")
            rarity = Rarity.S if rarity_str == "S" else Rarity.A if rarity_str == "A" else Rarity.B

            # 解析主属性
            main_stat_key = data.get("mainStatKey", "hp")
            main_stat = self._parse_property_type(main_stat_key)

            # 计算主词条当前等级数值
            from optimizer.zzz_models.drive_disk import DriveDiskStats
            level = data.get("level", 0)
            calculated_main_val = DriveDiskStats.calculate_main_stat_value(
                rarity_str, main_stat_key, level
            )
            main_stat_value = StatValue(value=calculated_main_val, is_percent=("_" in main_stat_key))

            # 解析副属性
            sub_stats = {}
            for sub_data in data.get("substats", []):
                sub_key = sub_data.get("key", "")
                upgrades = sub_data.get("upgrades", 0)
                prop_type = self._parse_property_type(sub_key)
                # 存储强化次数（rolls），数值由DriveDisk._calculate_stats()计算
                sub_stats[prop_type] = StatValue(value=float(upgrades), is_percent=("_" in sub_key))

            # 从游戏数据获取套装名称和ID
            set_key = data.get("setKey", "")
            set_id, set_name_cn = self._get_equipment_id_and_name(set_key)

            disk = DriveDisk(
                id=data.get("id", ""),
                game_id=set_id or "",  # 套装游戏ID
                set_name=set_key,
                set_name_cn=set_name_cn,
                position=int(data.get("slotKey", "1")),
                rarity=rarity,
                level=data.get("level", 0),
                main_stat=main_stat,
                main_stat_value=main_stat_value,
                sub_stats=sub_stats,
                equipped_agent=data.get("location", None) or None,
            )

            # 加载驱动盘套装BUFF数据（使用套装ID而非setKey）
            if set_id:
                set_buff_file = self.game_data_dir / "equipment_data_buff" / f"{set_id}.json"
            else:
                set_buff_file = None
            if set_buff_file and set_buff_file.exists():
                try:
                    with open(set_buff_file, 'r', encoding='utf-8') as f:
                        set_buff_data = json.load(f)

                    from optimizer.zzz_models.buff import Buff

                    # 加载2件套BUFF
                    if 'two_piece_buffs' in set_buff_data:
                        disk._two_piece_buffs = [
                            Buff.from_dict(buff) for buff in set_buff_data['two_piece_buffs']
                        ]

                    # 加载4件套BUFF
                    if 'four_piece_buffs' in set_buff_data:
                        disk._four_piece_buffs = [
                            Buff.from_dict(buff) for buff in set_buff_data['four_piece_buffs']
                        ]

                except Exception as buff_e:
                    print(f"加载驱动盘套装 {set_key} 的BUFF数据失败: {buff_e}")

            return disk
        except Exception as e:
            print(f"解析驱动盘数据失败: {e}, 数据: {data}")
            return None

    def _parse_wengine(self, data: Dict) -> Optional[WEngine]:
        """解析音擎数据

        Args:
            data: 用户音擎JSON数据

        Returns:
            WEngine对象，解析失败返回None
        """
        try:
            from optimizer.zzz_models.wengine import WEngineLevelData, WEngineTalent

            wengine_key = data.get("key", "")

            # 获取音擎游戏ID
            wengine_game_id = None
            for gid, gdata in self.weapon_data.items():
                en_name = gdata.get("EN", "")
                import re
                spaced_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', wengine_key)
                if en_name.lower() == spaced_key.lower() or en_name.replace(" ", "").lower() == wengine_key.lower():
                    wengine_game_id = gid
                    break

            if not wengine_game_id:
                print(f"警告: 未找到音擎 {wengine_key} 的游戏ID")
                return None

            # 从缓存读取详细数据
            wengine_raw = self._weapon_detail_cache.get(wengine_game_id)
            if not wengine_raw:
                print(f"警告: 缓存中未找到音擎 {wengine_game_id} 的详细数据")
                return None

            # ===== 解析基础属性 =====
            base_property = wengine_raw.get("BaseProperty", {})
            base_atk = base_property.get("Value", 0)

            rand_property = wengine_raw.get("RandProperty", {})
            rand_stat_name = rand_property.get("Name2", "攻击力百分比")
            rand_stat_value = rand_property.get("Value", 0)
            rand_stat_format = rand_property.get("Format", "{0:0.#}")

            rand_stat_type = self._map_wengine_stat_name(rand_stat_name)
            if "%" in rand_stat_format:
                rand_stat_value = rand_stat_value / 10000
            else:
                rand_stat_value = rand_stat_value

            # ===== 解析等级成长数据 =====
            level_data_raw = wengine_raw.get("Level", {})
            level_data = {}
            for lvl_str, lvl_info in level_data_raw.items():
                try:
                    lvl = int(lvl_str)
                    level_data[lvl] = WEngineLevelData(
                        level=lvl,
                        exp=lvl_info.get("Exp", 0),
                        rate=lvl_info.get("Rate", 0)
                    )
                except (ValueError, KeyError):
                    continue

            # ===== 从用户数据获取等级和突破 =====
            level = data.get("level", 60)
            refinement = data.get("modification", 1)
            promotion = data.get("promotion", 5)

            # ===== 加载天赋buff数据 =====
            talents = []
            buff_data = self._weapon_buff_cache.get(wengine_game_id)
            if buff_data:
                try:
                    for talent_data in buff_data.get('talents', []):
                        talent = WEngineTalent(
                            level=talent_data.get('level', 1),
                            name=talent_data.get('name', ''),
                            description=talent_data.get('description', ''),
                            buffs=[]
                        )
                        talents.append(talent)
                except Exception as e:
                    print(f"解析音擎 {wengine_game_id} 的buff数据失败: {e}")

            # ===== 创建WEngine对象 =====
            from optimizer.zzz_models.wengine import WEngine as WEngineModel
            wengine = WEngineModel(
                id=data.get("id", ""),
                wengine_id=wengine_game_id,
                name=wengine_raw.get("Name", wengine_key),
                level=level,
                refinement=refinement,
                breakthrough=promotion,
                equipped_agent=data.get("location") or None,
                base_atk=base_atk,
                rand_stat_type=rand_stat_type,
                rand_stat=rand_stat_value,
                level_data=level_data,
                talents=talents,
            )

            # 加载时计算当前等级的base_stats
            wengine.base_stats = wengine.get_stats_at_level(level, promotion)

            return wengine
        except Exception as e:
            print(f"解析音擎数据失败: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _parse_skill_level(self, skill_str: str) -> int:
        """解析技能等级字符串

        Args:
            skill_str: 技能等级字符串，如 "12/12"

        Returns:
            技能等级
        """
        if "/" in skill_str:
            return int(skill_str.split("/")[0])
        return int(skill_str)

    def _parse_property_type(self, key: str) -> PropertyType:
        """解析属性类型

        Args:
            key: 属性键，如 "hp", "atk_", "crit_"

        Returns:
            PropertyType枚举
        """
        # 映射表
        mapping = {
            "hp": PropertyType.HP,
            "hp_": PropertyType.HP_,
            "atk": PropertyType.ATK,
            "atk_": PropertyType.ATK_,
            "def": PropertyType.DEF,
            "def_": PropertyType.DEF_,
            "crit_": PropertyType.CRIT_,
            "crit_dmg_": PropertyType.CRIT_DMG_,
            "pen": PropertyType.PEN,
            "pen_": PropertyType.PEN_,
            # 6号位主词条
            "anomProf": PropertyType.ANOM_PROF,          # 异常精通（固定值）
            "anomMas_": PropertyType.ANOM_MAS_,          # 异常掌控%
            "impact": PropertyType.IMPACT,               # 冲击力（固定值）
            "impact_": PropertyType.IMPACT_,             # 冲击力%
            "energyRegen_": PropertyType.ENER_REGEN_,    # 能量自动回复%
            # 元素伤害%
            "physical_dmg_": PropertyType.PHYSICAL_DMG_,
            "fire_dmg_": PropertyType.FIRE_DMG_,
            "ice_dmg_": PropertyType.ICE_DMG_,
            "electric_dmg_": PropertyType.ELECTRIC_DMG_,
            "ether_dmg_": PropertyType.ETHER_DMG_,
        }
        return mapping.get(key, PropertyType.HP)

    def _get_agent_game_data_by_id(self, agent_id: str) -> Optional[Dict]:
        """根据游戏ID获取角色游戏数据

        Args:
            agent_id: 游戏ID（如 "1061"）

        Returns:
            角色游戏数据字典或None
        """
        return self.character_data.get(agent_id)

    def _get_game_id_by_en_name(self, en_name: str) -> Optional[str]:
        """通过英文名查找角色的真实game_id

        Args:
            en_name: 角色英文名（应该已经去掉空格，如 "YeShunguang"）

        Returns:
            游戏ID（如 "1411"），未找到返回None
        """
        if not self._character_data:
            return None

        # 遍历 character.json 查找匹配的 "EN" 字段（两边都去掉空格和特殊字符）
        for game_id, char_data in self._character_data.items():
            char_en = char_data.get("EN", "")
            # 标准化：去掉空格和特殊字符
            normalized_char_en = char_en.replace(" ", "").replace("-", "")
            if normalized_char_en == en_name:
                return game_id

        return None

    def _load_agent_stats(self, agent: Agent, game_data: Optional[Dict]) -> None:
        """加载角色详细属性数据（从原始Hakush.in数据计算）

        Args:
            agent: 角色对象
            game_data: 角色游戏数据
        """
        # 直接使用 agent.game_id 获取游戏数据
        agent_game_id = agent.game_id
        game_data = self._get_agent_game_data_by_id(agent_game_id) if agent_game_id else None

        if not game_data:
            return

        # 读取原始Hakush.in角色数据文件（包含完整的Stats、Level、ExtraLevel）
        character_file = self.game_data_dir / "character" / f"{agent_game_id}.json"
        if not character_file.exists():
            return

        try:
            with open(character_file, 'r', encoding='utf-8') as f:
                char_data = json.load(f)

            # ===== 0. 读取元素和武器类型（用于显示和异常计算）=====
            element_data = char_data.get("ElementType", {})
            weapon_data = char_data.get("WeaponType", {})
            spelement_data = char_data.get("SpecialElementType", {})

            # 优先使用特殊元素（如雅的烈霜）
            if spelement_data and spelement_data.get("Title"):
                agent._element_cn = spelement_data["Title"]
            elif element_data and isinstance(element_data, dict):
                agent._element_cn = list(element_data.values())[0] if element_data else "未知"

            if weapon_data and isinstance(weapon_data, dict):
                agent._weapon_type_cn = list(weapon_data.values())[0] if weapon_data else "未知"

            # ===== 1. 解析基础属性 (Stats) =====
            stats_data = char_data.get("Stats", {})
            if not stats_data:
                return

            # 转换常量（根据官方指引）
            PERCENT_SCALING = 10000
            FLAT_SCALING = 100

            # 提取1级基础属性
            base_hp = stats_data.get("HpMax", 0)
            base_atk = stats_data.get("Attack", 0)
            base_def = stats_data.get("Defence", 0)

            # 提取成长系数（需要除以10000）
            hp_growth = stats_data.get("HpGrowth", 0) / PERCENT_SCALING
            atk_growth = stats_data.get("AttackGrowth", 0) / PERCENT_SCALING
            def_growth = stats_data.get("DefenceGrowth", 0) / PERCENT_SCALING

            # 提取固定属性
            impact = stats_data.get("BreakStun", 0)
            anom_mas = stats_data.get("ElementAbnormalPower", 0)
            anom_prof = stats_data.get("ElementMystery", 0)
            ener_regen = stats_data.get("SpRecover", 0) / FLAT_SCALING

            # ===== 2. 解析突破属性 (Level) =====
            level_data = char_data.get("Level", {})
            promotion_stats = []
            for i in range(1, 7):  # 6个突破等级
                level_info = level_data.get(str(i), {})
                promotion_stats.append({
                    'hp': level_info.get("HpMax", 0),
                    'atk': level_info.get("Attack", 0),
                    'def': level_info.get("Defence", 0),
                })

            # ===== 3. 解析核心属性 (ExtraLevel) =====
            # 核心技能的所有属性都是基础属性，直接累加到最终值
            extra_level_data = char_data.get("ExtraLevel", {})

            # 核心属性映射：核心技能属性ID -> (PropertyType, 缩放因子)
            # 注意：核心技能里的都是基础属性
            CORE_PROP_MAP = {
                '11001': ('hp_base', 1),       # 基础生命值
                '11101': ('hp_base', 1),       # 基础生命值 (变体)
                '11102': ('hp_percent', 1/100), # 生命值%
                '12001': ('atk_base', 1),      # 基础攻击力
                '12101': ('atk_base', 1),      # 基础攻击力 (变体)
                '12102': ('atk_percent', 1/100), # 攻击力%
                '13001': ('def_base', 1),      # 基础防御力
                '13101': ('def_base', 1),      # 基础防御力 (变体)
                '12201': ('impact', 1),        # 冲击力
                '20101': ('crit_rate', 1/100),  # 暴击率
                '20103': ('crit_rate', 1/100),  # 暴击率
                '20104': ('crit_rate', 1/100),  # 暴击率
                '21101': ('crit_dmg', 1/100),   # 暴击伤害
                '21103': ('crit_dmg', 1/100),   # 暴击伤害
                '23101': ('pen_', 1/100),       # 穿透率
                '23103': ('pen_', 1/100),       # 穿透率
                '30501': ('ener_regen', 1/100),  # 能量自动回复（除以100）
                '30503': ('ener_regen', 1/100),   # 能量自动回复%
                '31201': ('anom_prof', 1),        # 异常精通
                '31401': ('anom_mas', 1),         # 异常掌控
                '31403': ('anom_mas_', 1/100),    # 异常掌控%
            }

            # 存储每个核心等级的所有属性加成
            core_bonuses = []
            for i in range(1, 7):  # 6个核心等级
                extra_info = extra_level_data.get(str(i), {})
                extra_props = extra_info.get("Extra", {})

                bonuses = {}
                for prop_id, prop_data in extra_props.items():
                    prop_id = str(prop_id)
                    raw_value = prop_data.get('Value', 0)

                    if prop_id in CORE_PROP_MAP:
                        field_name, scale = CORE_PROP_MAP[prop_id]
                        bonuses[field_name] = raw_value * scale
                    else:
                        print(f"警告: 未知的核心属性 {prop_id} ({prop_data.get('Name', '')})")

                core_bonuses.append(bonuses)

            # ===== 4. 计算满级满突破的最终属性 =====
            # 根据官方指引公式：
            # 攻击力 = atk_base + promotionStats[promotion].atk + (level - 1) × atk_growth
            # 生命值 = hp_base + promotionStats[promotion].hp + (level - 1) × hp_growth
            # 防御力 = def_base + promotionStats[promotion].def + (level - 1) × def_growth

            level = agent.level
            promotion = agent.breakthrough - 1  # 突破等级从1开始，数组索引从0开始
            core = agent.core_skill - 1  # 核心等级从1开始，数组索引从0开始

            # 确保索引有效
            if promotion < 0 or promotion >= len(promotion_stats):
                promotion = len(promotion_stats) - 1
            if core < 0 or core >= len(core_bonuses):
                core = len(core_bonuses) - 1

            # 【核心技能加成说明】
            # ExtraLevel 中的数据是"达到该级时解锁的加成"，不是"每级都有的增量"
            # 例如妮可 ATK_BASE: Core1=0, Core2=25, Core3=25, Core4=50, Core5=50, Core6=75
            # 如果 core_skill=6，只取 Core6 的值 75，不是累加 0+25+25+50+50+75=225

            # 直接取当前核心等级的加成（不累加）
            current_core_bonus = core_bonuses[core]

            # 计算满级满突破属性
            hp_percent_bonus = current_core_bonus.get('hp_percent', 0)
            atk_percent_bonus = current_core_bonus.get('atk_percent', 0)
            final_hp = base_hp + promotion_stats[promotion]['hp'] + (level - 1) * hp_growth + current_core_bonus.get('hp_base', 0)
            final_hp += final_hp * hp_percent_bonus  # 百分比加成
            final_atk = base_atk + promotion_stats[promotion]['atk'] + (level - 1) * atk_growth + current_core_bonus.get('atk_base', 0)
            final_atk += final_atk * atk_percent_bonus  # 百分比加成
            final_def = base_def + promotion_stats[promotion]['def'] + (level - 1) * def_growth + current_core_bonus.get('def_base', 0)

            # 核心技能加成通过BUFF系统添加，这里不直接修改final_atk
            # final_atk保持为等级成长后的值（不含核心技能）

            # ===== 5. 设置到Agent对象的self_properties =====
            from optimizer.zzz_models.property_collection import PropertyCollection
            from optimizer.zzz_models.base import PropertyType

            agent.self_properties = PropertyCollection()

            # 添加基础属性（不含核心技能，核心技能加成单独添加）
            agent.self_properties.out_of_combat[PropertyType.HP_BASE] = base_hp + promotion_stats[promotion]['hp'] + (level - 1) * hp_growth
            agent.self_properties.out_of_combat[PropertyType.ATK_BASE] = base_atk + promotion_stats[promotion]['atk'] + (level - 1) * atk_growth
            agent.self_properties.out_of_combat[PropertyType.DEF_BASE] = base_def + promotion_stats[promotion]['def'] + (level - 1) * def_growth

            # 添加固定值属性（不含核心技能）
            agent.self_properties.out_of_combat[PropertyType.IMPACT] = impact
            agent.self_properties.out_of_combat[PropertyType.ANOM_MAS] = anom_mas
            agent.self_properties.out_of_combat[PropertyType.ANOM_PROF] = anom_prof

            # 添加核心技能加成（取当前核心等级的值，非累加）
            agent.self_properties.out_of_combat[PropertyType.ATK_BASE] += current_core_bonus.get('atk_base', 0)
            agent.self_properties.out_of_combat[PropertyType.HP_BASE] += current_core_bonus.get('hp_base', 0)
            agent.self_properties.out_of_combat[PropertyType.DEF_BASE] += current_core_bonus.get('def_base', 0)
            agent.self_properties.out_of_combat[PropertyType.IMPACT] += current_core_bonus.get('impact', 0)
            agent.self_properties.out_of_combat[PropertyType.ANOM_MAS] += current_core_bonus.get('anom_mas', 0)
            agent.self_properties.out_of_combat[PropertyType.ANOM_PROF] += current_core_bonus.get('anom_prof', 0)

            # 添加百分比加成
            atk_percent = current_core_bonus.get('atk_percent', 0)
            if atk_percent > 0:
                agent.self_properties.out_of_combat[PropertyType.ATK_] = atk_percent

            hp_percent = current_core_bonus.get('hp_percent', 0)
            if hp_percent > 0:
                agent.self_properties.out_of_combat[PropertyType.HP_] = hp_percent

            # 从 Stats 中读取暴击率和暴击伤害（Crit 和 CritDamage 存储为万分数，需要除以10000转为小数）
            base_crit = stats_data.get('Crit', 500) / 10000.0  # 500 / 10000 = 0.05 (5%)
            base_crit_dmg = stats_data.get('CritDamage', 5000) / 10000.0  # 5000 / 10000 = 0.50 (50%)

            # 添加核心技能暴击率加成（如果有的话）
            crit_rate_core = current_core_bonus.get('crit_rate', 0)
            if crit_rate_core > 0:
                agent.self_properties.out_of_combat[PropertyType.CRIT_] = base_crit + crit_rate_core
            else:
                agent.self_properties.out_of_combat[PropertyType.CRIT_] = base_crit

            # 添加核心技能暴击伤害加成（如果有的话）
            crit_dmg_core = current_core_bonus.get('crit_dmg', 0)
            if crit_dmg_core > 0:
                agent.self_properties.out_of_combat[PropertyType.CRIT_DMG_] = base_crit_dmg + crit_dmg_core
            else:
                agent.self_properties.out_of_combat[PropertyType.CRIT_DMG_] = base_crit_dmg

            # 添加核心技能穿透率加成（如果有的话）
            pen_core = current_core_bonus.get('pen_', 0)
            if pen_core > 0:
                agent.self_properties.out_of_combat[PropertyType.PEN_] = pen_core
            else:
                agent.self_properties.out_of_combat[PropertyType.PEN_] = 0.0

            # 能量自动回复（基础值 + 核心技能加成）
            agent.self_properties.out_of_combat[PropertyType.ENER_REGEN] = ener_regen + current_core_bonus.get('ener_regen', 0)

            # 存储原始数据供后续使用（ener_regen已放入self_properties）
            agent._raw_stats = {
                'hp_growth': hp_growth,
                'atk_growth': atk_growth,
                'def_growth': def_growth,
            }
            agent._promotion_stats = promotion_stats
            agent._core_bonuses = core_bonuses

            # ===== 6. 加载BUFF数据 =====
            buff_file = self.game_data_dir / "character_data_buff" / f"{agent_game_id}.json"
            if buff_file.exists():
                try:
                    with open(buff_file, 'r', encoding='utf-8') as f:
                        buff_data = json.load(f)

                    # 导入Buff类
                    from optimizer.zzz_models.buff import Buff, ConversionBuff

                    # 加载核心被动BUFF
                    if 'core_passive_buffs' in buff_data:
                        agent.core_passive_buffs = [
                            Buff.from_dict(buff) for buff in buff_data['core_passive_buffs']
                        ]

                    # 加载天赋BUFF
                    if 'talent_buffs' in buff_data:
                        agent.talent_buffs = [
                            Buff.from_dict(buff) for buff in buff_data['talent_buffs']
                        ]

                    # 加载转换类BUFF
                    if 'conversion_buffs' in buff_data:
                        agent.conversion_buffs = [
                            ConversionBuff.from_dict(buff) for buff in buff_data['conversion_buffs']
                        ]

                    # 加载潜能觉醒BUFF
                    if 'potential_buffs' in buff_data:
                        agent.potential_buffs = [
                            ConversionBuff.from_dict(buff) for buff in buff_data['potential_buffs']
                        ]

                except Exception as buff_e:
                    print(f"加载角色 {agent.game_id} 的BUFF数据失败: {buff_e}")

        except Exception as e:
            print(f"加载角色 {agent.game_id} 的详细属性失败: {e}")
            import traceback
            traceback.print_exc()

    def _load_agent_skill_set(self, agent: Agent) -> None:
        """加载角色技能集

        Args:
            agent: 角色对象
        """
        if self._agent_skill_sets and agent.name_cn in self._agent_skill_sets:
            agent.skill_set = self._agent_skill_sets[agent.name_cn]

    def _get_equipment_id_and_name(self, set_key: str) -> tuple[Optional[str], str]:
        """获取驱动盘套装ID和中文名称（支持多语言名称匹配）

        Args:
            set_key: 套装键（驼峰命名或任意语言的名称）

        Returns:
            (套装ID, 套装中文名称)
        """
        equipment_data = self.equipment_data

        # 将驼峰命名转换为空格分隔
        import re
        spaced_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', set_key)
        set_key_lower = set_key.lower().replace(" ", "").replace("'", "")

        for equip_id, equip_data in equipment_data.items():
            # 检查各语言名称
            for lang_key in ["EN", "CHS", "JA", "KO"]:
                if lang_key in equip_data and isinstance(equip_data[lang_key], dict):
                    lang_name = equip_data[lang_key].get("name", "")
                    lang_name_normalized = lang_name.lower().replace(" ", "").replace("'", "")

                    # 多种匹配方式
                    if (lang_name == set_key or
                        lang_name == spaced_key or
                        lang_name_normalized == set_key_lower):
                        cn_name = equip_data.get("CHS", {}).get("name", set_key)
                        return equip_id, cn_name

        return None, set_key

    def _get_wengine_game_data_by_key(self, key: str) -> Optional[Dict]:
        """根据键获取音擎游戏数据（支持多语言名称匹配）

        Args:
            key: 音擎键（驼峰命名或任意语言的名称）

        Returns:
            音擎游戏数据字典
        """
        weapon_data = self.weapon_data

        # 将驼峰命名转换为空格分隔
        import re
        spaced_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', key)
        key_lower = key.lower().replace(" ", "").replace("'", "")

        for wengine_id, wengine_data in weapon_data.items():
            # 检查各语言名称
            for lang_key in ["EN", "CHS", "JA", "KO"]:
                lang_name = wengine_data.get(lang_key, "")
                lang_name_normalized = lang_name.lower().replace(" ", "").replace("'", "")

                # 多种匹配方式
                if (lang_name == key or
                    lang_name == spaced_key or
                    lang_name_normalized == key_lower):
                    return wengine_data

        return None

    def _map_wengine_stat_name(self, stat_name: str) -> str:
        """将音擎副属性名称映射为标准键名

        Args:
            stat_name: 中文属性名（如"攻击力百分比"、"暴击率"）

        Returns:
            标准键名（如"atk_", "crit_"）
        """
        stat_map = {
            '攻击力百分比': 'atk_',
            '防御力百分比': 'def_',
            '生命值百分比': 'hp_',
            '暴击率': 'crit_',
            '暴击伤害': 'crit_dmg_',
            '闪能自动累积': 'ener_regen_',
            '异常精通': 'anom_prof',
            '穿透率': 'pen_',
            '穿透值': 'pen',
        }
        return stat_map.get(stat_name, 'unknown')

    @property
    def character_data(self) -> Dict:
        """获取角色基础数据"""
        if self._character_data is None:
            self.load_game_data()
        return self._character_data or {}

    @property
    def equipment_data(self) -> Dict:
        """获取驱动盘基础数据"""
        if self._equipment_data is None:
            self.load_game_data()
        return self._equipment_data or {}

    @property
    def weapon_data(self) -> Dict:
        """获取音擎基础数据"""
        if self._weapon_data is None:
            self.load_game_data()
        return self._weapon_data or {}

    @property
    def user_agents(self) -> List[Agent]:
        """获取用户角色列表"""
        if self._user_agents is None:
            raise ValueError("用户数据未加载，请先调用 load_user_data()")
        return self._user_agents

    @property
    def user_drive_disks(self) -> List[DriveDisk]:
        """获取用户驱动盘列表"""
        if self._user_drive_disks is None:
            raise ValueError("用户数据未加载，请先调用 load_user_data()")
        return self._user_drive_disks

    @property
    def user_wengines(self) -> List[WEngine]:
        """获取用户音擎列表"""
        if self._user_wengines is None:
            raise ValueError("用户数据未加载，请先调用 load_user_data()")
        return self._user_wengines

    def _preload_weapon_details(self) -> None:
        """预加载所有音擎详细数据到缓存

        ⚠️ 性能优化：一次性加载所有音擎数据，避免每次从存档加载时重复读取文件
        """
        if not self._weapon_data:
            return

        weapon_dir = self.game_data_dir / "weapon"
        weapon_buff_dir = self.game_data_dir / "weapon_data_buff"

        if not weapon_dir.exists():
            return

        loaded_count = 0

        # 遍历所有音擎ID
        for wengine_id in self._weapon_data.keys():
            # 加载音擎详细数据
            wengine_file = weapon_dir / f"{wengine_id}.json"
            if wengine_file.exists():
                try:
                    with open(wengine_file, 'r', encoding='utf-8') as f:
                        self._weapon_detail_cache[wengine_id] = json.load(f)
                    loaded_count += 1
                except Exception as e:
                    print(f"加载音擎 {wengine_id} 详细数据失败: {e}")

            # 加载音擎buff数据
            buff_file = weapon_buff_dir / f"{wengine_id}.json"
            if buff_file.exists():
                try:
                    with open(buff_file, 'r', encoding='utf-8') as f:
                        self._weapon_buff_cache[wengine_id] = json.load(f)
                except Exception as e:
                    print(f"加载音擎 {wengine_id} buff数据失败: {e}")

    def _preload_character_details(self) -> None:
        """预加载所有角色详细数据到缓存"""
        if not self._character_data:
            return

        character_dir = self.game_data_dir / "character"
        character_buff_dir = self.game_data_dir / "character_data_buff"

        if not character_dir.exists():
            return
        loaded_count = 0

        # 遍历所有角色ID
        for character_id in self._character_data.keys():
            # 加载角色详细数据
            character_file = character_dir / f"{character_id}.json"
            if character_file.exists():
                try:
                    with open(character_file, 'r', encoding='utf-8') as f:
                        self._character_detail_cache[character_id] = json.load(f)
                    loaded_count += 1
                except Exception as e:
                    print(f"加载角色 {character_id} 详细数据失败: {e}")

            # 加载角色buff数据
            buff_file = character_buff_dir / f"{character_id}.json"
            if buff_file.exists():
                try:
                    with open(buff_file, 'r', encoding='utf-8') as f:
                        self._character_buff_cache[character_id] = json.load(f)
                except Exception as e:
                    print(f"加载角色 {character_id} buff数据失败: {e}")

    def _preload_equipment_details(self) -> None:
        """预加载所有驱动盘详细数据到缓存"""
        if not self._equipment_data:
            return

        equipment_dir = self.game_data_dir / "equipment"
        equipment_buff_dir = self.game_data_dir / "equipment_data_buff"

        if not equipment_dir.exists():
            return

        print(f"预加载驱动盘详细数据...")
        loaded_count = 0

        # 遍历所有驱动盘ID
        for equipment_id in self._equipment_data.keys():
            # 加载驱动盘详细数据
            equipment_file = equipment_dir / f"{equipment_id}.json"
            if equipment_file.exists():
                try:
                    with open(equipment_file, 'r', encoding='utf-8') as f:
                        self._equipment_detail_cache[equipment_id] = json.load(f)
                    loaded_count += 1
                except Exception as e:
                    print(f"加载驱动盘 {equipment_id} 详细数据失败: {e}")

            # 加载驱动盘buff数据
            buff_file = equipment_buff_dir / f"{equipment_id}.json"
            if buff_file.exists():
                try:
                    with open(buff_file, 'r', encoding='utf-8') as f:
                        self._equipment_buff_cache[equipment_id] = json.load(f)
                except Exception as e:
                    print(f"加载驱动盘 {equipment_id} buff数据失败: {e}")

        print(f"预加载完成：{loaded_count} 个驱动盘详细数据")

    def _preload_csv_data(self) -> None:
        """预加载所有CSV数据到缓存"""
        from optimizer.services.csv_loader_service import CsvDataLoaderService

        csv_dir = self.game_data_dir / "csv"
        if not csv_dir.exists():
            return

        print(f"预加载CSV数据...")
        csv_loader = CsvDataLoaderService(csv_dir)

        # 加载代理人技能数据
        self._agent_skill_sets = csv_loader.load_agent_skills()
        print(f"  - 代理人技能: {len(self._agent_skill_sets)} 个")

        # 加载邦布属性数据
        self._bangboo_stats = csv_loader.load_bangboo_stats()
        print(f"  - 邦布属性: {len(self._bangboo_stats)} 个")

        # 加载邦布技能数据
        self._bangboo_skills = csv_loader.load_bangboo_skills()
        print(f"  - 邦布技能: {len(self._bangboo_skills)} 个")

        # 加载敌人属性数据
        self._enemies = csv_loader.load_enemies()
        print(f"  - 敌人属性: {len(self._enemies)} 个")

        # 加载异常条数据
        self._anomaly_bars = csv_loader.load_anomaly_bars()
        print(f"  - 异常条: {len(self._anomaly_bars)} 个")

        print(f"预加载完成：所有CSV数据")

    def _load_wengine_game_data(self, wengine: WEngine) -> None:
        """从缓存中加载音擎基础属性

        ⚠️ 性能优化：从预加载的缓存中获取数据，而不是每次读取文件

        Args:
            wengine: 音擎对象（已包含 wengine_id）
        """
        if not self._weapon_data:
            return

        # 从缓存中获取音擎详细数据
        wengine_raw = self._weapon_detail_cache.get(wengine.wengine_id)
        if not wengine_raw:
            print(f"警告: 缓存中未找到音擎 {wengine.wengine_id} 的详细数据")
            return

        try:
            # ===== 1. 解析基础属性（BaseProperty）=====
            base_property = wengine_raw.get("BaseProperty", {})
            wengine.base_atk = base_property.get("Value", 0)

            # ===== 2. 解析副属性（RandProperty）=====
            rand_property = wengine_raw.get("RandProperty", {})
            rand_stat_name = rand_property.get("Name2", "攻击力百分比")
            rand_stat_value = rand_property.get("Value", 0)
            rand_stat_format = rand_property.get("Format", "{0:0.#}")

            # 转换副属性类型和数值
            SCALING = 10000
            wengine.rand_stat_type = self._map_wengine_stat_name(rand_stat_name)

            # 如果格式包含%，需要除以10000转为小数
            if "%" in rand_stat_format:
                wengine.rand_stat = rand_stat_value / SCALING
            else:
                wengine.rand_stat = rand_stat_value

            # ===== 3. 解析等级成长数据（Level）=====
            level_data_raw = wengine_raw.get("Level", {})
            wengine.level_data = {}
            for lvl_str, lvl_info in level_data_raw.items():
                try:
                    from optimizer.zzz_models.wengine import WEngineLevelData
                    lvl = int(lvl_str)
                    wengine.level_data[lvl] = WEngineLevelData(
                        level=lvl,
                        exp=lvl_info.get("Exp", 0),
                        rate=lvl_info.get("Rate", 0),
                    )
                except (ValueError, KeyError):
                    continue

            # ===== 4. 从缓存加载天赋buff数据 =====
            buff_data = self._weapon_buff_cache.get(wengine.wengine_id)
            if buff_data:
                try:
                    from optimizer.zzz_models.wengine import WEngineTalent
                    wengine.talents = []
                    for talent_data in buff_data.get('talents', []):
                        talent = WEngineTalent(
                            level=talent_data.get('level', 1),
                            name=talent_data.get('name', ''),
                            description=talent_data.get('description', ''),
                            buffs=[]  # 暂不解析buff对象
                        )
                        wengine.talents.append(talent)
                except Exception as e:
                    print(f"解析音擎 {wengine.wengine_id} 的buff数据失败: {e}")

            # ===== 5. 计算当前等级的属性并缓存到 base_stats =====
            wengine.base_stats = wengine.get_stats_at_level(wengine.level, wengine.breakthrough)

        except Exception as e:
            print(f"加载音擎 {wengine.wengine_id} 的游戏数据失败: {e}")
            import traceback
            traceback.print_exc()


    def _map_wengine_stat_name(self, stat_name: str) -> Optional[PropertyType]:
        """映射音擎副属性名称到PropertyType

        Args:
            stat_name: 副属性名称（中文）

        Returns:
            PropertyType枚举，如果无法映射则返回None
        """
        stat_map = {
            '攻击力': PropertyType.ATK,
            '攻击力百分比': PropertyType.ATK_,
            '生命值': PropertyType.HP,
            '生命值百分比': PropertyType.HP_,
            '防御力': PropertyType.DEF,
            '防御力百分比': PropertyType.DEF_,
            '暴击率': PropertyType.CRIT_RATE_,
            '暴击伤害': PropertyType.CRIT_DMG_,
            '闪能自动累积': PropertyType.ENER_REGEN_,
            '异常精通': PropertyType.ANOM_PROF,
            '穿透率': PropertyType.PEN_,
            '穿透值': PropertyType.PEN,
        }
        return stat_map.get(stat_name)

    # ========== 游戏数据库查询方法 ==========

    def get_agent_skill_set(self, agent_game_id: str):
        """获取角色的技能集

        Args:
            agent_game_id: 游戏ID（如 "1061"）

        Returns:
            AgentSkillSet 对象，如果未找到返回 None
        """
        if not self._agent_skill_sets:
            return None
        return self._agent_skill_sets.get(agent_game_id)

    def get_agent_buffs(self, agent_game_id: str) -> Dict[str, List]:
        """获取角色的所有BUFF

        Args:
            agent_game_id: 游戏ID（如 "1061"）

        Returns:
            BUFF字典，包含：
            - core_passive_buffs: 核心被动BUFF
            - talent_buffs: 天赋BUFF
            - conversion_buffs: 转换类BUFF
            - potential_buffs: 潜能觉醒BUFF
        """
        if not self._character_buff_cache:
            return {}

        buff_data = self._character_buff_cache.get(agent_game_id)
        if not buff_data:
            return {}

        from optimizer.zzz_models.buff import Buff, ConversionBuff

        result = {}
        if 'core_passive_buffs' in buff_data:
            result['core_passive_buffs'] = [
                Buff.from_dict(buff) for buff in buff_data['core_passive_buffs']
            ]
        if 'talent_buffs' in buff_data:
            result['talent_buffs'] = [
                Buff.from_dict(buff) for buff in buff_data['talent_buffs']
            ]
        if 'conversion_buffs' in buff_data:
            result['conversion_buffs'] = [
                ConversionBuff.from_dict(buff) for buff in buff_data['conversion_buffs']
            ]
        if 'potential_buffs' in buff_data:
            result['potential_buffs'] = [
                ConversionBuff.from_dict(buff) for buff in buff_data['potential_buffs']
            ]

        return result

    def get_agent_base_stats(self, agent_game_id: str) -> Optional[Dict]:
        """获取角色的基础属性数据

        Args:
            agent_game_id: 游戏ID

        Returns:
            基础属性字典，包含：
            - base_hp, base_atk, base_def
            - hp_growth, atk_growth, def_growth
            - impact, anom_mas, anom_prof
            - promotion_stats, core_bonuses
        """
        if not self._character_detail_cache:
            return None

        char_data = self._character_detail_cache.get(agent_game_id)
        if not char_data:
            return None

        # 提取基础属性
        stats_data = char_data.get("Stats", {})
        if not stats_data:
            return None

        PERCENT_SCALING = 10000.0

        # 基础属性
        base_hp = stats_data.get("HpMax", {}).get("Value", 0)
        base_atk = stats_data.get("Attack", {}).get("Value", 0)
        base_def = stats_data.get("Defence", {}).get("Value", 0)

        # 成长属性
        hp_growth = stats_data.get("HpMaxGrowth", {}).get("Value", 0)
        atk_growth = stats_data.get("AttackGrowth", {}).get("Value", 0)
        def_growth = stats_data.get("DefenceGrowth", {}).get("Value", 0)

        # 其他属性
        impact = stats_data.get("Impact", {}).get("Value", 0)
        anom_mas = stats_data.get("AnomalyProficiency", {}).get("Value", 0)
        anom_prof = stats_data.get("AnomalyMastery", {}).get("Value", 0)
        ener_regen = stats_data.get("EnergyRegen", {}).get("Value", 0)

        # 突破属性
        promotion_stats = char_data.get("PromotionStats", [])

        # 解析核心属性
        extra_level_data = char_data.get("ExtraLevel", {})
        core_bonuses = []
        for i in range(1, 7):
            extra_info = extra_level_data.get(str(i), {})
            extra_props = extra_info.get("Extra", {})

            bonuses = {}
            for prop_id, prop_data in extra_props.items():
                prop_id = str(prop_id)
                value = prop_data.get('Value', 0)
                bonuses[prop_id] = value
            core_bonuses.append(bonuses)

        return {
            'base_hp': base_hp,
            'base_atk': base_atk,
            'base_def': base_def,
            'hp_growth': hp_growth,
            'atk_growth': atk_growth,
            'def_growth': def_growth,
            'impact': impact,
            'anom_mas': anom_mas,
            'anom_prof': anom_prof,
            'ener_regen': ener_regen,
            'promotion_stats': promotion_stats,
            'core_bonuses': core_bonuses,
        }

    def get_wengine_buffs(self, wengine_id: str) -> Optional[List]:
        """获取音擎的BUFF

        Args:
            wengine_id: 音擎ID

        Returns:
            BUFF列表，如果未找到返回 None
        """
        if not self._weapon_buff_cache:
            return None

        buff_data = self._weapon_buff_cache.get(wengine_id)
        if not buff_data:
            return None

        from optimizer.zzz_models.buff import Buff

        buffs = []
        if 'buffs' in buff_data:
            buffs = [Buff.from_dict(buff) for buff in buff_data['buffs']]

        return buffs

    def get_equipment_buffs(self, equipment_id: str, count: int) -> Dict[str, List]:
        """获取驱动盘套装的BUFF

        Args:
            equipment_id: 驱动盘套装ID
            count: 装备数量（2或4）

        Returns:
            BUFF字典，包含：
            - two_piece_buffs: 2件套BUFF
            - four_piece_buffs: 4件套BUFF
        """
        if not self._equipment_buff_cache:
            return {}

        buff_data = self._equipment_buff_cache.get(equipment_id)
        if not buff_data:
            return {}

        from optimizer.zzz_models.buff import Buff

        result = {}
        if 'two_piece_buffs' in buff_data:
            result['two_piece_buffs'] = [
                Buff.from_dict(buff) for buff in buff_data['two_piece_buffs']
            ]
        if 'four_piece_buffs' in buff_data:
            result['four_piece_buffs'] = [
                Buff.from_dict(buff) for buff in buff_data['four_piece_buffs']
            ]

        return result
