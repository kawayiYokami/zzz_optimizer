import re
from PySide6.QtWidgets import QVBoxLayout, QHBoxLayout, QLabel
from PySide6.QtCore import Qt
from qfluentwidgets import SimpleCardWidget, StrongBodyLabel, BodyLabel, CaptionLabel


class WEngineCard(SimpleCardWidget):
    """音擎卡片"""

    def __init__(self, wengine: dict, icon_manager, parent=None):
        super().__init__(parent)
        self.icon_manager = icon_manager
        self.wengine_data = wengine
        self._init_ui()

    def _init_ui(self):
        """初始化UI"""
        self.setFixedSize(300, 450)
        card_layout = QVBoxLayout(self)
        card_layout.setContentsMargins(15, 15, 15, 15)
        card_layout.setSpacing(10)

        # 图标和名称信息
        header_layout = QHBoxLayout()
        header_layout.setSpacing(10)

        # 图标
        icon_widget = QLabel()
        icon_widget.setFixedSize(80, 80)
        icon_widget.setAlignment(Qt.AlignCenter)
        icon_name = self.wengine_data.get('icon')
        if icon_name:
            pixmap = self.icon_manager.get_equipment_pixmap(icon_name)
            if pixmap:
                icon_widget.setPixmap(pixmap.scaled(
                    80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation
                ))
        header_layout.addWidget(icon_widget)

        # 名字 等级 星级 精炼
        info_layout = QVBoxLayout()
        info_layout.setSpacing(5)

        name = self.wengine_data.get('name', '未知音擎')
        level = self.wengine_data.get('level', 1)
        rarity = self.wengine_data.get('rarity', 2)
        refinement = self.wengine_data.get('refinement', 1)
        breakthrough = self.wengine_data.get('breakthrough', 0)

        self.name_label = StrongBodyLabel(name)
        self.name_label.setStyleSheet("font-size: 20px; font-weight: bold;")
        self.name_label.setWordWrap(True)
        info_layout.addWidget(self.name_label)

        # 计算最大等级
        max_level_map = {0: 10, 1: 20, 2: 30, 3: 40, 4: 50, 5: 60, 6: 60}
        max_level = max_level_map.get(breakthrough, 60)

        # 根据稀有度确定星星总数
        rarity_to_stars = {2: 2, 3: 3, 4: 5}
        total_stars = rarity_to_stars.get(rarity, 5)

        # 生成精炼星星显示
        stars = '★' * refinement + '☆' * (total_stars - refinement)

        level_label = BodyLabel(f"Lv.{level}/{max_level} {stars}")
        level_label.setStyleSheet("font-size: 18px;")
        info_layout.addWidget(level_label)

        info_layout.addStretch()
        header_layout.addLayout(info_layout)
        card_layout.addLayout(header_layout)

        # 主词条
        main_title = StrongBodyLabel("基础属性")
        main_title.setStyleSheet("font-size: 18px; font-weight: bold;")
        card_layout.addWidget(main_title)

        # 基础攻击力
        base_atk = self.wengine_data.get('base_atk', 0)
        atk_label = BodyLabel(f"基础攻击力 {base_atk:.0f}")
        atk_label.setStyleSheet("font-size: 20px;")
        card_layout.addWidget(atk_label)

        # 副属性
        rand_stat_type = self.wengine_data.get('rand_stat_type', '')
        rand_stat_value = self.wengine_data.get('rand_stat_value', 0)
        rand_stat_is_percentage = self.wengine_data.get('rand_stat_is_percentage', False)
        if rand_stat_type and rand_stat_value > 0:
            if rand_stat_is_percentage:
                rand_text = f"{rand_stat_type} {rand_stat_value*100:.1f}%"
            else:
                rand_text = f"{rand_stat_type} {rand_stat_value:.0f}"
            rand_label = BodyLabel(rand_text)
            rand_label.setStyleSheet("font-size: 20px;")
            card_layout.addWidget(rand_label)

        # 音擎效果
        talent_title = StrongBodyLabel("音擎效果")
        talent_title.setStyleSheet("font-size: 18px; font-weight: bold;")
        card_layout.addWidget(talent_title)

        talent_description = self.wengine_data.get('talent_description', '')
        if talent_description:
            clean_desc = re.sub(r'<[^>]+>', '', talent_description)
            talent_label = BodyLabel(clean_desc)
            talent_label.setStyleSheet("font-size: 16px;")
            talent_label.setWordWrap(True)
            card_layout.addWidget(talent_label)
        else:
            no_talent_label = CaptionLabel("无音擎效果")
            no_talent_label.setStyleSheet("font-size: 16px;")
            card_layout.addWidget(no_talent_label)

        card_layout.addStretch()

        # 装备状态
        if self.wengine_data.get('equipped_agent'):
            status_label = CaptionLabel(f"装备于: {self.wengine_data['equipped_agent']}")
        else:
            status_label = CaptionLabel("未装备")
        status_label.setStyleSheet("font-size: 16px;")
        card_layout.addWidget(status_label)

    def text(self) -> str:
        """返回用于搜索的文本"""
        return self.name_label.text()