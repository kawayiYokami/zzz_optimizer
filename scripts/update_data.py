import os
import urllib.request
import json
import time
from urllib.error import HTTPError, URLError

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "web", "optimizer", "public", "game-data")

# URL -> Local Filename mapping
DATA_SOURCES = {
    "https://api.hakush.in/zzz/data/character.json": "character.json",
    "https://api.hakush.in/zzz/data/weapon.json": "weapon.json",
    "https://api.hakush.in/zzz/data/equipment.json": "equipment.json",
    "https://api.hakush.in/zzz/data/bangboo.json": "bangboo_index.json",
    "https://api.hakush.in/zzz/data/monster.json": "enemy_index.json",
}

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)
        # print(f"Created directory: {directory}")

def download_json(url, filepath, skip_if_exists=False):
    if skip_if_exists and os.path.exists(filepath):
        # print(f"Skipping existing file: {os.path.basename(filepath)}")
        return True

    print(f"Downloading: {url} -> {os.path.basename(filepath)}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = response.read()
            # Validate JSON before writing
            try:
                json_content = json.loads(data)
                # Write to file
                with open(filepath, 'wb') as f:
                    f.write(data)
                # print(f"Successfully updated {os.path.basename(filepath)}")
                return True
            except json.JSONDecodeError:
                print(f"Error: Invalid JSON received from {url}")
                return False
                
    except HTTPError as e:
        print(f"Download failed (HTTP {e.code}): {url}")
    except URLError as e:
        print(f"Download failed (URL Error): {url} {e.reason}")
    except Exception as e:
        print(f"Download failed: {url} {str(e)}")
    return False

def update_detailed_data(category_name, json_filename):
    """
    Update detailed data for a specific category.
    
    Args:
        category_name: The category name used in the API URL (e.g., 'character', 'weapon').
        json_filename: The local main JSON filename (e.g., 'character.json').
    """
    print(f"\n--- Updating detailed {category_name} data ---")
    
    main_json_path = os.path.join(DATA_DIR, json_filename)
    if not os.path.exists(main_json_path):
        print(f"Error: Main JSON file not found: {main_json_path}")
        return

    # Create subdirectory if it doesn't exist
    sub_dir = os.path.join(DATA_DIR, category_name)
    ensure_dir(sub_dir)

    with open(main_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    total = len(data)
    
    for item_id in data.keys():
        # URL format: https://api.hakush.in/zzz/data/chs/{category}/{id}.json
        url = f"https://api.hakush.in/zzz/data/chs/{category_name}/{item_id}.json"
        filepath = os.path.join(sub_dir, f"{item_id}.json")
        
        if download_json(url, filepath, skip_if_exists=True):
            count += 1
        
        # Add a small delay only if we actually downloaded something to avoid rate limits
        if not os.path.exists(filepath):
             time.sleep(0.2)

    print(f"Updated {count}/{total} detailed items for {category_name}")

def main():
    print(f"Starting data update...")
    print(f"Target directory: {DATA_DIR}")
    ensure_dir(DATA_DIR)

    # 1. Update Main JSONs
    print("\n--- Updating Main JSONs ---")
    success_count = 0
    for url, filename in DATA_SOURCES.items():
        filepath = os.path.join(DATA_DIR, filename)
        if download_json(url, filepath, skip_if_exists=False): # Always update main files
            success_count += 1
        time.sleep(0.5)

    print(f"Main data update complete. Updated {success_count}/{len(DATA_SOURCES)} files.")

    # 2. Update Detailed Data
    # Character
    update_detailed_data("character", "character.json")
    
    # Weapon
    update_detailed_data("weapon", "weapon.json")

    # Equipment (Drive Disks) - URL category might need verification, assuming 'equipment'
    # Check if 'equipment' directory exists or if we should use a different name
    update_detailed_data("equipment", "equipment.json")
    
    # Bangboo
    # Note: Detailed endpoints for bangboo (e.g. /data/chs/bangboo/{id}.json) do not exist.
    # All necessary data seems to be contained in the main bangboo.json file.
    # update_detailed_data("bangboo", "bangboo_index.json")

    # Monster (Enemy)
    # Note: Detailed endpoints for monster (e.g. /data/chs/monster/{id}.json) do not exist.
    # All necessary data seems to be contained in the main monster.json (enemy.json) file.
    # update_detailed_data("monster", "enemy_index.json")

if __name__ == "__main__":
    main()