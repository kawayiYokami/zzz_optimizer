#!/usr/bin/env python3
"""
提取角色数据库中所有核心技能属性的名称
"""

import json
import os
from pathlib import Path
from collections import defaultdict

# 角色数据目录
CHARACTER_DIR = Path("public/game-data/character")

# 收集所有核心技能属性名称
core_skill_names = set()
name_to_count = defaultdict(int)
name_to_props = defaultdict(list)

# 遍历所有角色 JSON 文件
for char_file in CHARACTER_DIR.glob("*.json"):
    try:
        with open(char_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 获取角色名称
        char_name = data.get('Name', char_file.stem)
        
        # 遍历所有核心技能等级
        if 'ExtraLevel' in data:
            for level_key, level_data in data['ExtraLevel'].items():
                if 'Extra' in level_data:
                    for prop_key, prop_data in level_data['Extra'].items():
                        name = prop_data.get('Name', '')
                        if name:
                            core_skill_names.add(name)
                            name_to_count[name] += 1
                            name_to_props[name].append({
                                'character': char_name,
                                'level': level_key,
                                'prop_id': prop_data.get('Prop'),
                                'value': prop_data.get('Value'),
                                'format': prop_data.get('Format')
                            })
    except Exception as e:
        print(f"Error processing {char_file}: {e}")

# 输出结果
print("=" * 60)
print(f"找到 {len(core_skill_names)} 个不同的核心技能属性名称")
print("=" * 60)

# 按出现次数排序
sorted_names = sorted(name_to_count.items(), key=lambda x: x[1], reverse=True)

print("\n属性名称统计（按出现次数排序）：")
print("-" * 60)
for name, count in sorted_names:
    print(f"{name}: {count} 次")

print("\n" + "=" * 60)
print("详细属性信息：")
print("=" * 60)

for name, count in sorted_names:
    print(f"\n{name} (出现 {count} 次):")
    for prop in name_to_props[name]:
        print(f"  - {prop['character']}: Lv.{prop['level']}, Prop ID={prop['prop_id']}, Value={prop['value']}, Format={prop['format']}")

print("\n" + "=" * 60)
print(f"所有属性名称列表：")
print("=" * 60)
for name in sorted(core_skill_names):
    print(f"  '{name}'")