#!/usr/bin/env python3
"""
提取驱动盘 JSON 文件中的套装效果（2件、4件）描述文本
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


def extract_equipment_info(file_path: str):
    """提取驱动盘文件中的套装效果信息"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return {
        "套装名称": data.get("Name", "未知"),
        "2件套效果": data.get("Desc2", ""),
        "4件套效果": data.get("Desc4", "")
    }


def print_equipment_info(info: dict):
    """打印驱动盘信息"""
    print(f"\n{'='*60}")
    print(f"套装: {info['套装名称']}")
    print(f"{'='*60}\n")

    print("【2件套效果】")
    print("-" * 40)
    print(f"  {clean_text(info['2件套效果'])}")
    print()

    print("【4件套效果】")
    print("-" * 40)
    print(f"  {clean_text(info['4件套效果'])}")
    print()


def main():
    import sys
    
    # 驱动盘数据目录
    equipment_dir = Path.cwd() / "web" / "optimizer" / "public" / "game-data" / "equipment"
    
    # 解析命令行参数
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        # 如果参数是纯数字，认为是驱动盘ID
        if arg.isdigit():
            path = equipment_dir / f"{arg}.json"
        else:
            path = Path(arg)
    else:
        # 默认 31000
        path = equipment_dir / "31000.json"
    
    if not path.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)
    
    # 提取并打印信息
    info = extract_equipment_info(str(path))
    print_equipment_info(info)


if __name__ == "__main__":
    main()
