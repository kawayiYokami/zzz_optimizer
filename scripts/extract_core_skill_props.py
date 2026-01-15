#!/usr/bin/env python3
"""提取所有角色核心技属性"""

import json
from pathlib import Path
from collections import defaultdict

def main():
    char_dir = Path("web/optimizer/public/game-data/character")
    
    # 收集所有 Prop 值
    all_props = defaultdict(set)  # prop_id -> set of (name, format)
    
    for json_file in char_dir.glob("*.json"):
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        char_name = data.get("Name", json_file.stem)
        extra_level = data.get("ExtraLevel", {})
        
        for level_key, level_data in extra_level.items():
            extra = level_data.get("Extra", {})
            for prop_key, prop_data in extra.items():
                prop_id = prop_data.get("Prop")
                name = prop_data.get("Name")
                fmt = prop_data.get("Format")
                value = prop_data.get("Value")
                
                if prop_id:
                    all_props[prop_id].add((name, fmt))
    
    # 输出结果
    print("=== 核心技属性 Prop ID 汇总 ===\n")
    for prop_id in sorted(all_props.keys()):
        names = all_props[prop_id]
        for name, fmt in names:
            print(f"Prop: {prop_id:5d} | Name: {name:12s} | Format: {fmt}")
    
    print(f"\n共 {len(all_props)} 种不同的 Prop ID")

if __name__ == "__main__":
    main()