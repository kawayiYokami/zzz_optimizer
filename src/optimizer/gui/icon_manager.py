"""图标管理器"""
from pathlib import Path
from PySide6.QtGui import QIcon, QPixmap, QImage
from PySide6.QtCore import Qt
from typing import Optional


class IconManager:
    """图标管理器 - 管理角色、驱动盘、音擎等图标"""

    def __init__(self, icon_dir: str = "assets/inventory_data/icons"):
        self.icon_dir = Path(icon_dir)
        self._cache = {}
        # ⚠️ 图标文件路径映射（预加载优化）
        self._icon_path_map = {}
        self._preloaded = False

    def preload_icons(self):
        """预加载所有图标文件路径到映射表

        ⚠️ 性能优化：一次性扫描图标目录，建立名称到路径的映射，
        避免每次获取图标时都进行文件系统检查
        """
        if self._preloaded:
            return

        if not self.icon_dir.exists():
            print(f"警告: 图标目录不存在: {self.icon_dir}")
            return

        print(f"预加载图标文件...")
        count = 0

        # 扫描所有支持的图标文件
        for ext in [".webp", ".png", ".jpg"]:
            for icon_file in self.icon_dir.glob(f"*{ext}"):
                # 提取图标名称（不含扩展名）
                icon_name = icon_file.stem
                # 只保存第一个找到的文件（优先级：webp > png > jpg）
                if icon_name not in self._icon_path_map:
                    self._icon_path_map[icon_name] = icon_file
                    count += 1

        self._preloaded = True
        print(f"预加载完成：{count} 个图标文件")

    def _get_icon_path(self, icon_name: str) -> Optional[Path]:
        """获取图标文件路径

        Args:
            icon_name: 图标名称

        Returns:
            图标文件路径或None
        """
        if not icon_name:
            return None

        # 如果未预加载，先预加载
        if not self._preloaded:
            self.preload_icons()

        # 从映射表中获取路径
        return self._icon_path_map.get(icon_name)

    def get_agent_pixmap(self, icon_name: str) -> Optional[QPixmap]:
        """获取角色大头像原始 Pixmap (用于展示大图)

        Args:
            icon_name: 图标名称，如 "IconRole09"

        Returns:
            QPixmap 或 None
        """
        if not icon_name:
            return None

        # 从预加载的映射表中获取路径
        icon_path = self._get_icon_path(icon_name)
        if not icon_path:
            return None

        cache_key = f"{str(icon_path)}_pixmap"
        if cache_key not in self._cache:
            pixmap = QPixmap(str(icon_path))
            if not pixmap.isNull():
                self._cache[cache_key] = pixmap
            else:
                self._cache[cache_key] = None
        return self._cache.get(cache_key)

    def get_agent_icon(self, icon_name: str) -> Optional[QIcon]:
        """获取角色大头像

        Args:
            icon_name: 图标名称，如 "IconRole09"

        Returns:
            QIcon 或 None
        """
        pixmap = self.get_agent_pixmap(icon_name)
        if pixmap:
            cache_key = f"{icon_name}_icon"
            if cache_key not in self._cache:
                self._cache[cache_key] = QIcon(pixmap)
            return self._cache.get(cache_key)
        return None

    def get_agent_icon_circle(self, icon_name: str) -> Optional[QIcon]:
        """获取角色小头像（自动将 IconRole09 转换为 IconRoleCircle09）

        Args:
            icon_name: 大头像名称，如 "IconRole09"

        Returns:
            QIcon 或 None
        """
        if not icon_name:
            return None

        # 如果是 IconRoleXX 格式，转换为 IconRoleCircleXX
        if icon_name.startswith("IconRole") and not icon_name.startswith("IconRoleCircle"):
            parts = icon_name.split("IconRole")
            if len(parts) == 2 and parts[1]:
                circle_name = f"IconRoleCircle{parts[1]}"
                return self.get_agent_icon(circle_name)

        # 如果已经是 IconRoleCircleXX 格式，直接返回
        return self.get_agent_icon(icon_name)

    def get_agent_icon_grayscale(self, icon_name: str) -> Optional[QIcon]:
        """获取角色小头像的灰度版本（保留透明通道）

        Args:
            icon_name: 图标名称，如 "IconRole09"

        Returns:
            灰度 QIcon 或 None
        """
        if not icon_name:
            return None

        # 先尝试获取圆形头像
        circle_icon_name = icon_name
        if icon_name.startswith("IconRole") and not icon_name.startswith("IconRoleCircle"):
            parts = icon_name.split("IconRole")
            if len(parts) == 2 and parts[1]:
                circle_icon_name = f"IconRoleCircle{parts[1]}"

        # 从预加载的映射表中获取路径
        icon_path = self._get_icon_path(circle_icon_name)
        if not icon_path:
            return None

        cache_key = f"{icon_path}_grayscale"
        if cache_key not in self._cache:
            # 加载图片
            image = QImage(str(icon_path))
            if not image.isNull():
                # 确保图片格式为 ARGB32 以保留透明通道
                if image.format() != QImage.Format_ARGB32:
                    image = image.convertToFormat(QImage.Format_ARGB32)

                # 逐像素转换为灰度，保留 Alpha 通道
                for y in range(image.height()):
                    for x in range(image.width()):
                        pixel = image.pixel(x, y)
                        # 提取 ARGB 分量
                        alpha = (pixel >> 24) & 0xFF
                        red = (pixel >> 16) & 0xFF
                        green = (pixel >> 8) & 0xFF
                        blue = pixel & 0xFF
                        # 计算灰度值
                        gray = int(0.299 * red + 0.587 * green + 0.114 * blue)
                        # 重新组合像素，保留原始 alpha
                        new_pixel = (alpha << 24) | (gray << 16) | (gray << 8) | gray
                        image.setPixel(x, y, new_pixel)

                pixmap = QPixmap.fromImage(image)
                self._cache[cache_key] = QIcon(pixmap)

        return self._cache.get(cache_key)
    
    def get_equipment_pixmap(self, icon_name: str) -> Optional[QPixmap]:
        """获取装备图标（驱动盘/音擎）

        Args:
            icon_name: 图标名称

        Returns:
            QPixmap 或 None
        """
        if not icon_name:
            return None

        # 从预加载的映射表中获取路径
        icon_path = self._get_icon_path(icon_name)
        if not icon_path:
            return None

        cache_key = f"{str(icon_path)}_pixmap"
        if cache_key not in self._cache:
            pixmap = QPixmap(str(icon_path))
            if not pixmap.isNull():
                self._cache[cache_key] = pixmap
            else:
                self._cache[cache_key] = None
        return self._cache.get(cache_key)

    def get_equipment_icon(self, icon_name: str) -> Optional[QIcon]:
        """获取装备图标
        
        Args:
            icon_name: 图标名称
            
        Returns:
            QIcon 或 None
        """
        pixmap = self.get_equipment_pixmap(icon_name)
        if pixmap:
            cache_key = f"{icon_name}_icon"
            if cache_key not in self._cache:
                self._cache[cache_key] = QIcon(pixmap)
            return self._cache.get(cache_key)
        return None

    def get_default_icon(self) -> QIcon:
        """获取默认图标"""
        return QIcon(':/qfluentwidgets/images/logo.png')

# 全局单例
_icon_manager = None


def get_icon_manager() -> IconManager:
    """获取图标管理器单例"""
    global _icon_manager
    if _icon_manager is None:
        _icon_manager = IconManager()
    return _icon_manager
