#!/usr/bin/env python3
"""
Scan all JSON files in assets/inventory_data for keys in `in_combat_stats` 
or `out_of_combat_stats` that are not defined in web/optimizer/src/model/base.ts.
"""

import json
import re
from pathlib import Path
from collections import defaultdict

BASE_TS_PATH = Path("web/optimizer/src/model/base.ts")
DATA_DIR = Path("assets/inventory_data")

def get_valid_properties():
    """Extracts PropertyType keys from base.ts"""
    valid_props = set()
    try:
        with open(BASE_TS_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            # Find the PropertyType enum block
            match = re.search(r'export enum PropertyType \{([^}]+)\}', content, re.DOTALL)
            if match:
                enum_body = match.group(1)
                # Extract keys like HP_BASE, ATK_, etc.
                # Lines look like: HP_BASE = 11001, // ...
                keys = re.findall(r'^\s*([A-Z0-9_]+)\s*=', enum_body, re.MULTILINE)
                valid_props.update(keys)
    except Exception as e:
        print(f"Error reading base.ts: {e}")
    return valid_props

def scan_files(valid_props):
    """Scans JSON files for invalid properties"""
    invalid_props = defaultdict(list)
    
    # Directories to scan
    dirs_to_scan = [
        DATA_DIR / "character_data_buff",
        DATA_DIR / "equipment_data_buff",
        DATA_DIR / "weapon_data_buff"
    ]

    for d in dirs_to_scan:
        if not d.exists():
            continue
            
        for json_file in d.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # Handle list of buffs (character/weapon) or object with list (equipment)
                buffs = []
                if isinstance(data, list):
                    buffs = data
                elif isinstance(data, dict):
                    # Equipment file structure
                    if "two_piece_buffs" in data:
                        buffs.extend(data["two_piece_buffs"])
                    if "four_piece_buffs" in data:
                        buffs.extend(data["four_piece_buffs"])
                    # Weapon file structure might be a dict with specific keys or list
                    # If it's the new format, it's a list. If old, might be different.
                    # Assuming list for weapon_data_buff based on previous interactions
                    
                for buff in buffs:
                    if not isinstance(buff, dict):
                        continue
                        
                    stats_blocks = [buff.get("in_combat_stats", {}), buff.get("out_of_combat_stats", {})]
                    
                    for stats in stats_blocks:
                        if not stats:
                            continue
                        for key in stats.keys():
                            if key not in valid_props:
                                invalid_props[key].append(str(json_file))
                                
            except Exception as e:
                print(f"Error reading {json_file}: {e}")

    return invalid_props

def main():
    print("Extracting valid properties from base.ts...")
    valid_props = get_valid_properties()
    print(f"Found {len(valid_props)} valid properties.")
    
    print("\nScanning data files for unsupported properties...")
    invalid_props = scan_files(valid_props)
    
    if not invalid_props:
        print("\n✅ All properties are supported!")
    else:
        print(f"\n❌ Found {len(invalid_props)} unsupported properties:\n")
        for prop, files in sorted(invalid_props.items()):
            print(f"- {prop}:")
            # Show first 3 files
            for f in files[:3]:
                print(f"  - {f}")
            if len(files) > 3:
                print(f"  - ... and {len(files) - 3} more files")

if __name__ == "__main__":
    main()