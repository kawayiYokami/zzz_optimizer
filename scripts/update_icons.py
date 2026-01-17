import os
import json
import urllib.request
import time
from urllib.error import HTTPError, URLError

# 配置部分
BASE_URL = "https://api.hakush.in/zzz/UI/"
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ICONS_DIR = os.path.join(PROJECT_ROOT, "web", "optimizer", "public", "game-data", "icons")

# 需要下载的静态图标列表
STATIC_ICONS = [
    # 技能图标
    "Icon_Normal.webp",
    "Icon_Evade.webp",
    "Icon_SpecialReady.webp",
    "Icon_UltimateReady.webp",
    "Icon_Switch.webp",
    "Icon_CoreSkill.webp",
    # 属性图标
    "IconPhysical.webp",
    "IconFire.webp",
    "IconIce.webp",
    "IconElectric.webp",
    "IconEther.webp",
    # 邦布 (暂时硬编码示例，如果找到规律后续添加)
    # "BangbooGarageRole07.webp", 
]

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"创建目录: {directory}")

def download_file(url, filepath):
    if os.path.exists(filepath):
        # print(f"文件已存在，跳过: {os.path.basename(filepath)}")
        return True
    
    print(f"正在下载: {url} -> {os.path.basename(filepath)}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
            out_file.write(response.read())
        time.sleep(0.1) # 稍微暂停避免请求过快
        return True
    except HTTPError as e:
        print(f"下载失败 (HTTP {e.code}): {url}")
    except URLError as e:
        print(f"下载失败 (URL Error): {url} {e.reason}")
    except Exception as e:
        print(f"下载失败: {url} {str(e)}")
    return False

def process_character_icons(data):
    count = 0
    for char_id, char_info in data.items():
        icon_code = char_info.get("icon")
        if icon_code:
            # 大头像
            filename = f"{icon_code}.webp"
            url = f"{BASE_URL}{filename}"
            if download_file(url, os.path.join(ICONS_DIR, filename)):
                count += 1
            
            # 小头像 (IconRolexx -> IconRoleCropxx)
            if "IconRole" in icon_code:
                crop_code = icon_code.replace("IconRole", "IconRoleCrop")
                crop_filename = f"{crop_code}.webp"
                crop_url = f"{BASE_URL}{crop_filename}"
                if download_file(crop_url, os.path.join(ICONS_DIR, crop_filename)):
                    count += 1
    return count

def process_weapon_icons(data):
    count = 0
    for weapon_id, weapon_info in data.items():
        icon_code = weapon_info.get("icon")
        if icon_code:
            filename = f"{icon_code}.webp"
            url = f"{BASE_URL}{filename}"
            if download_file(url, os.path.join(ICONS_DIR, filename)):
                count += 1
    return count

def process_equipment_icons(data):
    count = 0
    for equip_id, equip_info in data.items():
        # 路径类似: UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitWhiteWaterBallad.png
        icon_path = equip_info.get("icon")
        if icon_path:
            # 提取文件名 (不带扩展名)
            basename = os.path.basename(icon_path)
            name_without_ext = os.path.splitext(basename)[0]
            
            filename = f"{name_without_ext}.webp"
            url = f"{BASE_URL}{filename}"
            if download_file(url, os.path.join(ICONS_DIR, filename)):
                count += 1
    return count

def process_enemy_icons(data):
    count = 0
    for enemy_id, enemy_info in data.items():
        # 优先使用 icon 字段
        icon_path = enemy_info.get("icon")
        code_name = enemy_info.get("code_name")
        
        filename = None
        
        if icon_path:
            # 提取文件名
            basename = os.path.basename(icon_path)
            name_without_ext = os.path.splitext(basename)[0]
            filename = f"{name_without_ext}.webp"
        elif code_name:
             filename = f"{code_name}.webp"

        if filename:
            url = f"{BASE_URL}{filename}"
            if download_file(url, os.path.join(ICONS_DIR, filename)):
                count += 1
    return count

def process_bangboo_icons(data):
    count = 0
    for bangboo_id, bangboo_info in data.items():
        icon_path = bangboo_info.get("icon")
        if icon_path:
             # 提取文件名
            basename = os.path.basename(icon_path)
            name_without_ext = os.path.splitext(basename)[0]
            filename = f"{name_without_ext}.webp"
            
            url = f"{BASE_URL}{filename}"
            if download_file(url, os.path.join(ICONS_DIR, filename)):
                count += 1
    return count

def main():
    print(f"开始更新图标...")
    print(f"目标目录: {ICONS_DIR}")
    ensure_dir(ICONS_DIR)

    # 1. 下载静态图标
    print("\n--- 处理静态图标 ---")
    for filename in STATIC_ICONS:
        url = f"{BASE_URL}{filename}"
        download_file(url, os.path.join(ICONS_DIR, filename))

    # 2. 处理 Character
    print("\n--- 处理角色图标 ---")
    char_path = os.path.join(PROJECT_ROOT, "web/optimizer/public/game-data/character.json")
    if os.path.exists(char_path):
        with open(char_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            process_character_icons(data)
    else:
        print(f"未找到文件: {char_path}")

    # 3. 处理 Weapon
    print("\n--- 处理音擎图标 ---")
    weapon_path = os.path.join(PROJECT_ROOT, "web/optimizer/public/game-data/weapon.json")
    if os.path.exists(weapon_path):
        with open(weapon_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            process_weapon_icons(data)
    else:
        print(f"未找到文件: {weapon_path}")

    # 4. 处理 Equipment (Drive Disk)
    print("\n--- 处理驱动盘图标 ---")
    equip_path = os.path.join(PROJECT_ROOT, "web/optimizer/public/game-data/equipment.json")
    if os.path.exists(equip_path):
        with open(equip_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            process_equipment_icons(data)
    else:
        print(f"未找到文件: {equip_path}")

    # 5. 处理 Enemy
    print("\n--- 处理敌人图标 ---")
    enemy_path = os.path.join(PROJECT_ROOT, "web/optimizer/public/game-data/enemy_index.json")
    if os.path.exists(enemy_path):
        with open(enemy_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            process_enemy_icons(data)
    else:
        print(f"未找到文件: {enemy_path}")

    # 6. 处理 Bangboo
    print("\n--- 处理邦布图标 ---")
    bangboo_path = os.path.join(PROJECT_ROOT, "web/optimizer/public/game-data/bangboo_index.json")
    if os.path.exists(bangboo_path):
        with open(bangboo_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            process_bangboo_icons(data)
    else:
        print(f"未找到文件: {bangboo_path}")

    print("\n图标更新完成!")

if __name__ == "__main__":
    main()