"""优化器GUI应用启动入口"""
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(src_path))

from optimizer.gui import run_gui

if __name__ == "__main__":
    run_gui()
