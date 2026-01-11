#!/usr/bin/env python3
"""
提取角色 JSON 文件中的影画（天赋）、潜能、核心技描述文本
"""

import json
import re
from pathlib import Path


def strip_color_tags(text: str) -> str:
    """去除颜色标签 <color=...>...</color>"""
    return re.sub(r'<color=[^>]*>([^<]*)</color>', r'\1', text)


def clean_text(text: str) -> str:
    """清理文本中的所有颜色标签"""
    return strip_color_tags(text)


def extract_character_info(file_path: str):
    """提取角色文件中的影画、潜能、核心技信息"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    result = {
        "角色名称": data.get("Name", "未知"),
        "影画（天赋）": [],
        "潜能": [],
        "核心技": []
    }

    # 提取影画（Talent）
    talent_data = data.get("Talent", {})
    for level, talent in sorted(talent_data.items(), key=lambda x: int(x[0])):
        result["影画（天赋）"].append({
            "等级": level,
            "名称": talent.get("Name", ""),
            "描述": talent.get("Desc", ""),
            "额外描述": talent.get("Desc2", "")
        })

    # 提取潜能（Potential）
    potential_data = data.get("Potential", [])
    if potential_data:
        for pot in potential_data:
            result["潜能"].append({
                "名称": pot.get("Name", ""),
                "描述": pot.get("Desc", "")
            })
    else:
        # 检查 PotentialDetail
        potential_detail = data.get("PotentialDetail", {})
        if potential_detail:
            for key, pot in potential_detail.items():
                result["潜能"].append({
                    "名称": pot.get("Name", ""),
                    "描述": pot.get("Desc", "")
                })

    # 提取核心技（Passive）
    passive_data = data.get("Passive", {})
    level_data = passive_data.get("Level", {})
    # 取最高等级的核心技
    if level_data:
        max_level = max(int(k) for k in level_data.keys())
        core_skill = level_data.get(str(max_level), {})
        names = core_skill.get("Name", [])
        descs = core_skill.get("Desc", [])
        
        # 核心被动和额外能力
        if isinstance(names, list) and isinstance(descs, list):
            for name, desc in zip(names, descs):
                result["核心技"].append({
                    "名称": name,
                    "描述": desc
                })

    return result


def print_character_info(info: dict):
    """打印角色信息"""
    print(f"\n{'='*60}")
    print(f"角色: {info['角色名称']}")
    print(f"{'='*60}\n")

    # 打印影画
    print("【影画（天赋）】")
    print("-" * 40)
    for talent in info["影画（天赋）"]:
        print(f"  [{talent['等级']}] {clean_text(talent['名称'])}")
        print(f"      效果: {clean_text(talent['描述'])}")
        print(f"      描述: {clean_text(talent['额外描述'])}")
        print()

    # 打印潜能
    print("\n【潜能】")
    print("-" * 40)
    if info["潜能"]:
        for pot in info["潜能"]:
            print(f"  • {clean_text(pot['名称'])}: {clean_text(pot['描述'])}")
    else:
        print("  (此角色暂无潜能数据)")

    # 打印核心技
    print("\n【核心技】")
    print("-" * 40)
    if info["核心技"]:
        for core in info["核心技"]:
            print(f"  • {clean_text(core['名称'])}")
            print(f"    {clean_text(core['描述'])}")
    else:
        print("  (此角色暂无核心技数据)")


def main():
    import sys
    
    # 角色数据目录
    char_dir = Path.cwd() / r"assets\inventory_data\character"
    
    # 解析命令行参数
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        # 如果参数是纯数字，认为是角色ID
        if arg.isdigit():
            char_id = arg
            path = char_dir / f"{char_id}.json"
        else:
            path = Path(arg)
    else:
        # 默认1011（安比）
        path = char_dir / "1011.json"
    
    if not path.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)
    
    # 提取并打印信息
    info = extract_character_info(str(path))
    print_character_info(info)


if __name__ == "__main__":
    main()
