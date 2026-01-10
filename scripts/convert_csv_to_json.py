#!/usr/bin/env python3
"""
游戏数据同步脚本
从 assets/inventory_data (爬虫原始数据) 读取所有数据
处理后输出到 web/optimizer/public/game-data (前端使用数据)

使用场景：
1. 初次部署时同步所有数据
2. 爬虫更新后重新同步数据
3. 数据格式变更后批量转换
"""
import csv
import json
import shutil
from pathlib import Path
from typing import Dict, Any


def convert_bangboo_to_json(csv_path: Path) -> Dict[str, Any]:
    """将邦布属性CSV转换为JSON索引数据"""
    bangboo_data = {}

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            bangboo_id = row.get('ID', '').strip()
            name_cn = row.get('中文名称', '').strip()

            # 跳过空ID或测试数据
            if not bangboo_id or not name_cn:
                continue

            bangboo_data[bangboo_id] = {
                'id': bangboo_id,
                'CHS': name_cn,
                'EN': '',  # CSV中没有英文名
                'base_hp': float(row.get('生命值', 0) or 0),
                'hp_growth': float(row.get('生命值每级成长', 0) or 0),
                'base_atk': float(row.get('攻击力', 0) or 0),
                'atk_growth': float(row.get('攻击力每级成长', 0) or 0),
                'impact': float(row.get('冲击力', 0) or 0),
                'anomaly_mastery': float(row.get('异常掌控', 0) or 0),
                'base_def': float(row.get('防御力', 0) or 0),
                'def_growth': float(row.get('防御力每级成长', 0) or 0),
                'crit_rate': float(row.get('暴击率', 0) or 0),
                'crit_dmg': float(row.get('暴击伤害', 0) or 0),
                'level_60_hp': float(row.get('60级生命值', 0) or 0),
                'level_60_atk': float(row.get('60级攻击力', 0) or 0),
                'level_60_def': float(row.get('60级防御力', 0) or 0),
            }

    return bangboo_data


def convert_enemy_to_json(csv_path: Path) -> Dict[str, Any]:
    """将敌人属性CSV转换为JSON索引数据（完整字段）"""
    enemy_data = {}

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            enemy_id = row.get('ID', '').strip()
            full_name = row.get('完整名称', '').strip()

            if not enemy_id:
                continue

            can_stun_str = row.get('能否失衡', 'True').strip()
            can_stun = can_stun_str.lower() == 'true'

            enemy_data[enemy_id] = {
                'id': enemy_id,
                'full_name': full_name,
                'CHS': full_name,
                'EN': row.get('FullName', '').strip(),
                'code_name': row.get('CodeName', '').strip(),
                'index_id': row.get('IndexID', '').strip(),
                # 基础属性
                'hp': safe_float(row.get('生命值', 0)),
                'atk': safe_float(row.get('攻击力', 0)),
                'defense': safe_float(row.get('防御力', 0)),
                'crit_dmg': safe_float(row.get('暴击伤害', 0)),
                # 失衡相关
                'stun_max': safe_float(row.get('失衡值上限', 0)),
                'can_stun': can_stun,
                'stun_auto_recovery': safe_float(row.get('失衡值自动回复', 0)),
                'stun_auto_recovery_delay': safe_float(row.get('失衡值自动回复时限', 0)),
                'base_stun_recovery_speed': safe_float(row.get('基础失衡恢复速度', 0)),
                'default_stun_recovery_time': safe_float(row.get('默认失衡恢复时间', 0)),
                'stun_vulnerability_multiplier': safe_float(row.get('失衡易伤倍率', 0)),
                'chain_attack_count': int(safe_float(row.get('可连携次数', 0))),
                'base_poise_level': int(safe_float(row.get('初始抗打断等级', 0))),
                'freeze_time_resistance': safe_float(row.get('冻结时间抵抗', 0)),
                # 伤害抗性
                'ice_dmg_resistance': safe_float(row.get('冰伤害抗性', 0)),
                'fire_dmg_resistance': safe_float(row.get('火伤害抗性', 0)),
                'electric_dmg_resistance': safe_float(row.get('电伤害抗性', 0)),
                'physical_dmg_resistance': safe_float(row.get('物理伤害抗性', 0)),
                'ether_dmg_resistance': safe_float(row.get('以太伤害抗性', 0)),
                # 异常抗性
                'ice_anomaly_resistance': safe_float(row.get('冰异常抗性', 0)),
                'fire_anomaly_resistance': safe_float(row.get('火异常抗性', 0)),
                'electric_anomaly_resistance': safe_float(row.get('电异常抗性', 0)),
                'physical_anomaly_resistance': safe_float(row.get('物理异常抗性', 0)),
                'ether_anomaly_resistance': safe_float(row.get('以太异常抗性', 0)),
                # 失衡抗性
                'ice_stun_resistance': safe_float(row.get('冰失衡抗性', 0)),
                'fire_stun_resistance': safe_float(row.get('火失衡抗性', 0)),
                'electric_stun_resistance': safe_float(row.get('电失衡抗性', 0)),
                'physical_stun_resistance': safe_float(row.get('物理失衡抗性', 0)),
                'ether_stun_resistance': safe_float(row.get('以太失衡抗性', 0)),
                # 异常条ID
                'ice_anomaly_bar': row.get('冰异常条', '').strip(),
                'fire_anomaly_bar': row.get('火异常条', '').strip(),
                'electric_anomaly_bar': row.get('电异常条', '').strip(),
                'physical_anomaly_bar': row.get('物理异常条', '').strip(),
                'ether_anomaly_bar': row.get('以太异常条', '').strip(),
                # 其他
                'base_buildup_coefficient': safe_float(row.get('基础积蓄上限提升系数', 0)),
                'energy_orb_drop': safe_float(row.get('能量球掉落', 0)),
                'tags': row.get('标签列表', '').strip(),
                # 70级属性
                'level_70_max_hp': safe_float(row.get('70级最大生命值', 0)),
                'level_70_max_atk': safe_float(row.get('70级最大攻击力', 0)),
                'level_70_max_stun': safe_float(row.get('70级最大失衡值上限', 0)),
                'level_60_plus_defense': safe_float(row.get('60级及以上防御力', 0)),
            }

    return enemy_data


def safe_float(value, default=0.0) -> float:
    """安全地转换为浮点数"""
    if value is None or value == '':
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def convert_agent_skills_to_json(csv_path: Path) -> Dict[str, Any]:
    """将代理人技能CSV转换为JSON数据"""
    skills_data = {}

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            agent_name = row.get('代理人', '').strip()
            skill_name = row.get('技能', '').strip()

            if not agent_name or not skill_name:
                continue

            # 使用 "代理人_技能_段" 作为key
            stage = row.get('段', '').strip()
            key = f"{agent_name}_{skill_name}"
            if stage:
                key += f"_{stage}"

            skills_data[key] = {
                'agent_name': agent_name,
                'skill_name': skill_name,
                'stage': stage,
                'dmg_ratio': safe_float(row.get('伤害倍率', 0)),
                'dmg_ratio_growth': safe_float(row.get('伤害倍率成长', 0)),
                'stun_ratio': safe_float(row.get('失衡倍率', 0)),
                'stun_ratio_growth': safe_float(row.get('失衡倍率成长', 0)),
                'energy_recovery': safe_float(row.get('能量回复', 0)),
                'anomaly_buildup': safe_float(row.get('异常积蓄', 0)),
                'decibel_recovery': safe_float(row.get('喧响值回复', 0)),
                'flash_energy': safe_float(row.get('闪能累积', 0)),
                'corruption_shield': safe_float(row.get('秽盾削减值', 0)),
                'skill_type': row.get('技能类型', '').strip(),
                'attack_type': row.get('攻击类型', '').strip(),
                'energy_extra_cost': safe_float(row.get('能量额外消耗', 0)),
                'special_energy': row.get('特殊能量', '').strip(),
                'distance_decay': row.get('距离衰减', '').strip(),
            }

    return skills_data


def convert_bangboo_skills_to_json(csv_path: Path) -> Dict[str, Any]:
    """将邦布技能CSV转换为JSON数据"""
    skills_data = {}

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('名称', '').strip()
            skill_name = row.get('技能', '').strip()

            if not name or not skill_name:
                continue

            # 使用 "邦布名_技能名" 作为key
            key = f"{name}_{skill_name}"

            skills_data[key] = {
                'bangboo_name': name,
                'skill_name': skill_name,
                'dmg_ratio': safe_float(row.get('伤害倍率', 0)),
                'dmg_ratio_growth': safe_float(row.get('伤害倍率成长', 0)),
                'stun_ratio': safe_float(row.get('失衡倍率', 0)),
                'stun_ratio_growth': safe_float(row.get('失衡倍率成长', 0)),
                'anomaly_buildup': safe_float(row.get('异常积蓄', 0)),
            }

    return skills_data


def convert_anomaly_bars_to_json(csv_path: Path) -> Dict[str, Any]:
    """将异常条CSV转换为JSON数据"""
    anomaly_data = {}

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            bar_id = row.get('异常条ID', '').strip()

            if not bar_id:
                continue

            # 读取10次积蓄值需求
            buildup_requirements = []
            for i in range(1, 11):
                req = safe_float(row.get(f'积蓄值需求{i}', 0))
                buildup_requirements.append(req)

            anomaly_data[bar_id] = {
                'id': bar_id,
                'element': row.get('属性', '').strip(),
                'anomaly_id': row.get('对应异常ID', '').strip(),
                'note': row.get('备注', '').strip(),
                'anomaly_cd': safe_float(row.get('异常CD', 0)),
                'buildup_requirements': buildup_requirements,
            }

    return anomaly_data


def copy_directory(src: Path, dst: Path, description: str):
    """复制整个目录"""
    if src.exists():
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        file_count = len(list(dst.rglob('*'))) if dst.is_dir() else 1
        print(f"  ✓ {description}: {file_count} 个文件")
    else:
        print(f"  ✗ {description}: 源目录不存在 ({src})")


def copy_file(src: Path, dst: Path, description: str):
    """复制单个文件"""
    if src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"  ✓ {description}")
    else:
        print(f"  ✗ {description}: 源文件不存在 ({src})")


def save_json(data: Dict[str, Any], output_path: Path, description: str):
    """保存JSON文件"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {description}: {len(data)} 项")


def main():
    # 路径配置
    root_dir = Path(__file__).parent.parent
    source_dir = root_dir / 'assets' / 'inventory_data'
    target_dir = root_dir / 'web' / 'optimizer' / 'public' / 'game-data'

    print("=" * 70)
    print("游戏数据同步脚本")
    print("=" * 70)
    print(f"源目录: {source_dir}")
    print(f"目标目录: {target_dir}")
    print()

    # 确保目标目录存在
    target_dir.mkdir(parents=True, exist_ok=True)

    # ==================== 1. 复制JSON索引文件 ====================
    print("[1/4] 复制JSON索引文件...")
    copy_file(source_dir / 'character.json', target_dir / 'character.json', '角色索引')
    copy_file(source_dir / 'weapon.json', target_dir / 'weapon.json', '音擎索引')
    copy_file(source_dir / 'equipment.json', target_dir / 'equipment.json', '驱动盘索引')
    print()

    # ==================== 2. 转换CSV为JSON ====================
    print("[2/4] 转换CSV为JSON...")

    # 邦布数据
    bangboo_csv = source_dir / 'csv' / '邦布属性.csv'
    if bangboo_csv.exists():
        bangboo_data = convert_bangboo_to_json(bangboo_csv)
        save_json(bangboo_data, target_dir / 'bangboo.json', '邦布索引')
    else:
        print(f"  ✗ 邦布索引: CSV文件不存在")

    # 敌人数据
    enemy_csv = source_dir / 'csv' / '敌人属性.csv'
    if enemy_csv.exists():
        enemy_data = convert_enemy_to_json(enemy_csv)
        save_json(enemy_data, target_dir / 'enemy.json', '敌人索引')
    else:
        print(f"  ✗ 敌人索引: CSV文件不存在")

    # 代理人技能数据
    agent_skills_csv = source_dir / 'csv' / '代理人技能数据.csv'
    if agent_skills_csv.exists():
        agent_skills_data = convert_agent_skills_to_json(agent_skills_csv)
        save_json(agent_skills_data, target_dir / 'agent_skills.json', '代理人技能数据')
    else:
        print(f"  ✗ 代理人技能数据: CSV文件不存在")

    # 邦布技能数据
    bangboo_skills_csv = source_dir / 'csv' / '邦布技能.csv'
    if bangboo_skills_csv.exists():
        bangboo_skills_data = convert_bangboo_skills_to_json(bangboo_skills_csv)
        save_json(bangboo_skills_data, target_dir / 'bangboo_skills.json', '邦布技能数据')
    else:
        print(f"  ✗ 邦布技能数据: CSV文件不存在")

    # 异常条数据
    anomaly_bars_csv = source_dir / 'csv' / '异常条.csv'
    if anomaly_bars_csv.exists():
        anomaly_bars_data = convert_anomaly_bars_to_json(anomaly_bars_csv)
        save_json(anomaly_bars_data, target_dir / 'anomaly_bars.json', '异常条数据')
    else:
        print(f"  ✗ 异常条数据: CSV文件不存在")
    print()

    # ==================== 3. 复制详细数据目录 ====================
    print("[3/4] 复制详细数据目录...")
    copy_directory(source_dir / 'character', target_dir / 'character', '角色详细数据')
    copy_directory(source_dir / 'weapon', target_dir / 'weapon', '音擎详细数据')
    copy_directory(source_dir / 'equipment', target_dir / 'equipment', '驱动盘详细数据')
    copy_directory(source_dir / 'character_data_buff', target_dir / 'character_data_buff', '角色Buff数据')
    copy_directory(source_dir / 'weapon_data_buff', target_dir / 'weapon_data_buff', '音擎Buff数据')
    copy_directory(source_dir / 'equipment_data_buff', target_dir / 'equipment_data_buff', '驱动盘Buff数据')
    print()

    # ==================== 4. 复制CSV数据（保留原始数据） ====================
    print("[4/4] 复制CSV数据...")
    copy_directory(source_dir / 'csv', target_dir / 'csv', 'CSV原始数据')
    print()

    # ==================== 完成 ====================
    print("=" * 70)
    print("✓ 数据同步完成！")
    print("=" * 70)
    print(f"\n前端数据目录: {target_dir}")
    print("\n提示: 爬虫更新数据后，重新运行此脚本即可同步到前端")


if __name__ == '__main__':
    main()
