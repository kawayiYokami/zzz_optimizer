#!/usr/bin/env python3
"""
提取武器 JSON 文件中的特效（Talents）描述文本
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


def extract_weapon_info(file_path: str):
    """提取武器文件中的特效信息"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    result = {
        "武器名称": data.get("Name", "未知"),
        "特效": []
    }

    # 提取特效（Talents）
    talents_data = data.get("Talents", {})
    for level, talent in sorted(talents_data.items(), key=lambda x: int(x[0])):
        result["特效"].append({
            "等级": level,
            "名称": talent.get("Name", ""),
            "描述": talent.get("Desc", ""),
        })

    return result


def print_weapon_info(info: dict):
    """打印武器信息"""
    print(f"\n{'='*60}")
    print(f"武器: {info['武器名称']}")
    print(f"{'='*60}\n")

    # 打印特效
    print("【特效】")
    print("-" * 40)
    for talent in info["特效"]:
        print(f"  [{talent['等级']}] {clean_text(talent['名称'])}")
        print(f"      效果: {clean_text(talent['描述'])}")
        print()


def main():
    import sys
    
    # 武器数据目录
    # 注意：路径从项目根目录开始
    weapon_dir = Path.cwd() / "web" / "optimizer" / "public" / "game-data" / "weapon"
    
    # 解析命令行参数
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        # 如果参数是纯数字，认为是武器ID
        if arg.isdigit():
            weapon_id = arg
            path = weapon_dir / f"{weapon_id}.json"
        else:
            path = Path(arg)
    else:
        # 默认 12001
        path = weapon_dir / "12001.json"
    
    if not path.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)
    
    # 提取并打印信息
    info = extract_weapon_info(str(path))
    print_weapon_info(info)


if __name__ == "__main__":
    main()