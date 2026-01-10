from PySide6.QtWidgets import QStyledItemDelegate, QStyle
from PySide6.QtGui import QColor, QPen, QBrush, QFont
from PySide6.QtCore import QSize, Qt, QRect


class DiskDelegate(QStyledItemDelegate):
    """驱动盘列表委托，负责绘制每个驱动盘项目"""

    def __init__(self, icon_manager, parent=None):
        super().__init__(parent)
        self.icon_manager = icon_manager
        # 使用 qfluentwidgets 默认字体列表
        self.font_families = ['Segoe UI', 'Microsoft YaHei', 'PingFang SC']

        # 初始化所有需要的字体对象
        self._init_fonts()

    def _init_fonts(self):
        """初始化所有字体对象"""
        # 名称字体
        self.name_font = QFont()
        self.name_font.setFamilies(self.font_families)
        self.name_font.setPointSize(15)
        self.name_font.setBold(True)

        # 等级字体
        self.level_font = QFont()
        self.level_font.setFamilies(self.font_families)
        self.level_font.setPointSize(14)

        # 主词条标题字体
        self.main_title_font = QFont()
        self.main_title_font.setFamilies(self.font_families)
        self.main_title_font.setPointSize(14)
        self.main_title_font.setBold(True)

        # 主词条值字体
        self.main_value_font = QFont()
        self.main_value_font.setFamilies(self.font_families)
        self.main_value_font.setPointSize(15)

        # 副词条标题字体
        self.sub_title_font = QFont()
        self.sub_title_font.setFamilies(self.font_families)
        self.sub_title_font.setPointSize(14)
        self.sub_title_font.setBold(True)

        # 副词条字体
        self.stat_font = QFont()
        self.stat_font.setFamilies(self.font_families)
        self.stat_font.setPointSize(14)

        # 强化次数字体
        self.rolls_font = QFont()
        self.rolls_font.setFamilies(self.font_families)
        self.rolls_font.setPointSize(12)

        # 装备状态字体
        self.status_font = QFont()
        self.status_font.setFamilies(self.font_families)
        self.status_font.setPointSize(12)

    def paint(self, painter, option, index):
        """绘制驱动盘项目"""
        # 保存绘制状态
        painter.save()

        # 获取驱动盘数据
        disk = index.model().data(index, Qt.DisplayRole)
        if not disk:
            painter.restore()
            return

        # 绘制背景
        if option.state & QStyle.State_Selected:
            # 选中状态：深蓝色背景
            painter.setPen(Qt.NoPen)
            painter.setBrush(QColor(0, 120, 215, 80))
        else:
            # 普通状态：半透明白色背景
            painter.setPen(Qt.NoPen)
            painter.setBrush(QColor(255, 255, 255, 10))
        painter.drawRoundedRect(option.rect, 5, 5)

        # 设置绘制区域（考虑边距）
        margin = 15
        content_rect = option.rect.adjusted(margin, margin, -margin, -margin)

        # 绘制图标 (80x80)
        icon_name = disk.get('icon')
        if icon_name:
            pixmap = self.icon_manager.get_equipment_pixmap(icon_name)
            if pixmap:
                icon_rect = QRect(content_rect.left(), content_rect.top(), 80, 80)
                painter.drawPixmap(icon_rect, pixmap.scaled(
                    80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation
                ))

        # 绘制名称
        set_name = disk.get('set_name_cn', '未知套装')
        position = disk.get('position', '?')
        name_text = f"{set_name}[{position}]"
        name_rect = QRect(content_rect.left() + 90, content_rect.top(), 165, 30)
        painter.setPen(QColor(255, 255, 255))
        painter.setFont(self.name_font)
        painter.drawText(name_rect, Qt.AlignLeft | Qt.AlignVCenter, name_text)

        # 绘制等级和星级
        level = disk.get('level', 0)
        rarity = disk.get('rarity', 2)
        level_text = f"Lv.{level} {'★' * rarity}"
        level_rect = QRect(content_rect.left() + 90, content_rect.top() + 30, 165, 30)
        painter.setFont(self.level_font)
        painter.drawText(level_rect, Qt.AlignLeft | Qt.AlignVCenter, level_text)

        # 绘制主词条标题
        main_title_rect = QRect(content_rect.left(), content_rect.top() + 90, 255, 25)
        painter.setFont(self.main_title_font)
        painter.drawText(main_title_rect, Qt.AlignLeft | Qt.AlignVCenter, "主词条")

        # 绘制主词条内容
        main_stat = disk.get('main_stat', '未知')
        main_value = disk.get('main_stat_value', 0)
        is_percentage = disk.get('main_stat_is_percentage', False)
        if is_percentage:
            main_text = f"{main_stat} {main_value*100:.1f}%"
        else:
            main_text = f"{main_stat} {main_value:.0f}"
        main_content_rect = QRect(content_rect.left(), content_rect.top() + 115, 255, 25)
        painter.setFont(self.main_value_font)
        painter.drawText(main_content_rect, Qt.AlignLeft | Qt.AlignVCenter, main_text)

        # 绘制副词条标题
        sub_title_rect = QRect(content_rect.left(), content_rect.top() + 150, 255, 25)
        painter.setFont(self.sub_title_font)
        painter.drawText(sub_title_rect, Qt.AlignLeft | Qt.AlignVCenter, "副词条")

        # 绘制副词条列表
        sub_stats = disk.get('sub_stats', [])
        sub_y = content_rect.top() + 175
        for sub in sub_stats[:4]:
            stat_name = sub.get('name', '?')
            stat_value = sub.get('value', 0)
            rolls = sub.get('rolls', 0)
            is_percentage = sub.get('is_percentage', False)

            if is_percentage:
                value_str = f"{stat_value*100:.1f}%"
            else:
                value_str = f"{stat_value:.0f}"

            # 副词条名称和值
            stat_text = f"{stat_name} {value_str}"
            stat_rect = QRect(content_rect.left(), sub_y, 180, 25)
            painter.setFont(self.stat_font)
            painter.drawText(stat_rect, Qt.AlignLeft | Qt.AlignVCenter, stat_text)

            # 强化次数
            if rolls > 1:
                rolls_text = f"+{rolls-1}"
                rolls_rect = QRect(content_rect.left() + 185, sub_y, 70, 25)
                painter.setFont(self.rolls_font)
                painter.setPen(QColor(200, 200, 200))
                painter.drawText(rolls_rect, Qt.AlignLeft | Qt.AlignVCenter, rolls_text)
                painter.setPen(QColor(255, 255, 255))

            sub_y += 25

        # 绘制装备状态
        if disk.get('equipped_agent'):
            status_text = f"装备于: {disk['equipped_agent']}"
        else:
            status_text = "未装备"
        status_rect = QRect(content_rect.left(), sub_y, 255, 25)
        painter.setFont(self.status_font)
        painter.setPen(QColor(200, 200, 200))
        painter.drawText(status_rect, Qt.AlignLeft | Qt.AlignVCenter, status_text)

        # 恢复绘制状态
        painter.restore()

    def sizeHint(self, option, index):
        """返回项目的大小"""
        return QSize(300, 450)