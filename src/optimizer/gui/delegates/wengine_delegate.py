import re
from PySide6.QtWidgets import QStyledItemDelegate, QStyle
from PySide6.QtGui import QColor, QPen, QBrush, QFont
from PySide6.QtCore import QSize, Qt, QRect


class WEngineDelegate(QStyledItemDelegate):
    """音擎列表委托，负责绘制每个音擎项目"""

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
        self.level_font.setPointSize(12)

        # 基础属性标题字体
        self.main_title_font = QFont()
        self.main_title_font.setFamilies(self.font_families)
        self.main_title_font.setPointSize(14)
        self.main_title_font.setBold(True)

        # 基础攻击力字体
        self.atk_font = QFont()
        self.atk_font.setFamilies(self.font_families)
        self.atk_font.setPointSize(12)

        # 副属性字体
        self.rand_font = QFont()
        self.rand_font.setFamilies(self.font_families)
        self.rand_font.setPointSize(12)

        # 音擎效果标题字体
        self.talent_title_font = QFont()
        self.talent_title_font.setFamilies(self.font_families)
        self.talent_title_font.setPointSize(14)
        self.talent_title_font.setBold(True)

        # 音擎效果描述字体
        self.talent_font = QFont()
        self.talent_font.setFamilies(self.font_families)
        self.talent_font.setPointSize(12)

        # 无音擎效果字体
        self.no_talent_font = QFont()
        self.no_talent_font.setFamilies(self.font_families)
        self.no_talent_font.setPointSize(12)

        # 装备状态字体
        self.status_font = QFont()
        self.status_font.setFamilies(self.font_families)
        self.status_font.setPointSize(12)

    def paint(self, painter, option, index):
        """绘制音擎项目"""
        # 保存绘制状态
        painter.save()

        # 获取音擎数据
        wengine = index.model().data(index, Qt.DisplayRole)
        if not wengine:
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
        icon_name = wengine.get('icon')
        if icon_name:
            pixmap = self.icon_manager.get_equipment_pixmap(icon_name)
            if pixmap:
                icon_rect = QRect(content_rect.left(), content_rect.top(), 80, 80)
                painter.drawPixmap(icon_rect, pixmap.scaled(
                    80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation
                ))

        # 绘制名称
        name = wengine.get('name', '未知音擎')
        name_rect = QRect(content_rect.left() + 90, content_rect.top(), 165, 30)
        painter.setPen(QColor(255, 255, 255))
        painter.setFont(self.name_font)
        painter.drawText(name_rect, Qt.AlignLeft | Qt.AlignVCenter, name)

        # 绘制等级和精炼星级
        level = wengine.get('level', 1)
        rarity = wengine.get('rarity', 2)
        refinement = wengine.get('refinement', 1)
        breakthrough = wengine.get('breakthrough', 0)

        # 计算最大等级
        max_level_map = {0: 10, 1: 20, 2: 30, 3: 40, 4: 50, 5: 60, 6: 60}
        max_level = max_level_map.get(breakthrough, 60)

        # 根据稀有度确定星星总数
        rarity_to_stars = {2: 2, 3: 3, 4: 5}
        total_stars = rarity_to_stars.get(rarity, 5)

        # 生成精炼星星显示
        stars = '★' * refinement + '☆' * (total_stars - refinement)

        level_text = f"Lv.{level}/{max_level} {stars}"
        level_rect = QRect(content_rect.left() + 90, content_rect.top() + 30, 165, 30)
        painter.setFont(self.level_font)
        painter.drawText(level_rect, Qt.AlignLeft | Qt.AlignVCenter, level_text)

        # 绘制基础属性标题
        main_title_rect = QRect(content_rect.left(), content_rect.top() + 90, 255, 25)
        painter.setFont(self.main_title_font)
        painter.drawText(main_title_rect, Qt.AlignLeft | Qt.AlignVCenter, "基础属性")

        # 绘制基础攻击力
        base_atk = wengine.get('base_atk', 0)
        atk_text = f"基础攻击力 {base_atk:.0f}"
        atk_rect = QRect(content_rect.left(), content_rect.top() + 115, 255, 25)
        painter.setFont(self.atk_font)
        painter.drawText(atk_rect, Qt.AlignLeft | Qt.AlignVCenter, atk_text)

        # 绘制副属性
        rand_stat_type = wengine.get('rand_stat_type', '')
        rand_stat_value = wengine.get('rand_stat_value', 0)
        rand_stat_is_percentage = wengine.get('rand_stat_is_percentage', False)
        sub_y = content_rect.top() + 140

        if rand_stat_type and rand_stat_value > 0:
            if rand_stat_is_percentage:
                rand_text = f"{rand_stat_type} {rand_stat_value*100:.1f}%"
            else:
                rand_text = f"{rand_stat_type} {rand_stat_value:.0f}"
            rand_rect = QRect(content_rect.left(), sub_y, 255, 25)
            painter.setFont(self.rand_font)
            painter.drawText(rand_rect, Qt.AlignLeft | Qt.AlignVCenter, rand_text)
            sub_y += 25

        # 绘制音擎效果标题
        talent_title_rect = QRect(content_rect.left(), sub_y, 255, 25)
        painter.setFont(self.talent_title_font)
        painter.drawText(talent_title_rect, Qt.AlignLeft | Qt.AlignVCenter, "音擎效果")

        # 绘制音擎效果描述
        talent_description = wengine.get('talent_description', '')
        if talent_description:
            clean_desc = re.sub(r'<[^>]+>', '', talent_description)
            # 增加音擎效果显示区域高度
            talent_rect = QRect(content_rect.left(), sub_y + 25, 255, 200)
            painter.setFont(self.talent_font)
            painter.drawText(talent_rect, Qt.AlignLeft | Qt.AlignTop | Qt.TextWordWrap, clean_desc)
            sub_y += 225
        else:
            no_talent_rect = QRect(content_rect.left(), sub_y + 25, 255, 25)
            painter.setFont(self.no_talent_font)
            painter.setPen(QColor(200, 200, 200))
            painter.drawText(no_talent_rect, Qt.AlignLeft | Qt.AlignVCenter, "无音擎效果")
            painter.setPen(QColor(255, 255, 255))
            sub_y += 50

        # 绘制装备状态
        if wengine.get('equipped_agent'):
            status_text = f"装备于: {wengine['equipped_agent']}"
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