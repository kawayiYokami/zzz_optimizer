import argparse
import json
import os
import re
from typing import Any, Iterable


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "web", "optimizer", "public", "game-data")

# Supported categories:
# - directory: DATA_DIR/<category>/*.json
# - index:     DATA_DIR/<category>.json
SUPPORTED_CATEGORIES = ("character", "weapon", "equipment")


TEST_PATTERN = re.compile(r"test", re.IGNORECASE)


def iter_strings(obj: Any) -> Iterable[str]:
    if obj is None:
        return
    if isinstance(obj, str):
        yield obj
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from iter_strings(k)
            yield from iter_strings(v)
        return
    if isinstance(obj, (list, tuple)):
        for v in obj:
            yield from iter_strings(v)
        return


def json_contains_test(obj: Any) -> bool:
    for s in iter_strings(obj):
        if TEST_PATTERN.search(s):
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Delete test-server JSONs containing 'Test' and remove them from the corresponding index json.\n"
            "Categories supported: character, weapon, equipment."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print what would be deleted/updated; do not write any changes.",
    )
    parser.add_argument(
        "--category",
        action="append",
        choices=SUPPORTED_CATEGORIES,
        help="Limit cleanup to one category. Can be provided multiple times. Default: all.",
    )
    parser.add_argument(
        "--scan-index",
        action="store_true",
        help="Also remove entries from index json whose value contains 'Test' (in addition to ids found in detailed files).",
    )
    args = parser.parse_args()

    categories = args.category or list(SUPPORTED_CATEGORIES)

    total_deleted_files = 0
    total_removed_from_index = 0
    all_removed_ids: list[str] = []

    for category in categories:
        detail_dir = os.path.join(DATA_DIR, category)
        index_path = os.path.join(DATA_DIR, f"{category}.json")

        if not os.path.isdir(detail_dir):
            print(f"[skip] directory not found: {os.path.relpath(detail_dir, PROJECT_ROOT)}")
            continue
        if not os.path.isfile(index_path):
            print(f"[skip] index not found: {os.path.relpath(index_path, PROJECT_ROOT)}")
            continue

        with open(index_path, "r", encoding="utf-8") as f:
            index = json.load(f)

        deleted_files = 0
        removed_ids: list[str] = []

        for name in os.listdir(detail_dir):
            if not name.endswith(".json"):
                continue
            path = os.path.join(detail_dir, name)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    obj = json.load(f)
            except Exception:
                # If a file is broken, skip it instead of deleting unexpectedly.
                continue

            # Prefer Id field; fallback to filename.
            item_id = str(obj.get("Id") or os.path.splitext(name)[0])

            if not json_contains_test(obj):
                continue

            removed_ids.append(item_id)
            if args.dry_run:
                print(f"[dry-run] delete {os.path.relpath(path, PROJECT_ROOT)}")
            else:
                os.remove(path)
            deleted_files += 1

        removed_from_index = 0
        for item_id in removed_ids:
            if item_id in index:
                removed_from_index += 1
                if args.dry_run:
                    print(f"[dry-run] remove id {item_id} from {os.path.relpath(index_path, PROJECT_ROOT)}")
                else:
                    del index[item_id]

        # Optional: also scan index content for "Test"
        if args.scan_index:
            for item_id in list(index.keys()):
                if json_contains_test(index.get(item_id)):
                    removed_from_index += 1
                    removed_ids.append(str(item_id))
                    if args.dry_run:
                        print(f"[dry-run] remove id {item_id} from {os.path.relpath(index_path, PROJECT_ROOT)} (matched in index)")
                    else:
                        del index[item_id]

        if not args.dry_run:
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump(index, f, ensure_ascii=False, indent=2)
                f.write("\n")

        total_deleted_files += deleted_files
        total_removed_from_index += removed_from_index
        all_removed_ids.extend(removed_ids)

        print(f"[{category}] matched test files: {deleted_files}")
        print(f"[{category}] removed from index: {removed_from_index}")

    print(f"matched test files (total): {total_deleted_files}")
    print(f"removed from indexes (total): {total_removed_from_index}")
    if all_removed_ids:
        # De-duplicate but preserve stable order
        seen = set()
        uniq: list[str] = []
        for x in all_removed_ids:
            if x in seen:
                continue
            seen.add(x)
            uniq.append(x)
        print(f"ids: {', '.join(uniq)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
