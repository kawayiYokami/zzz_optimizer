from PySide6.QtWidgets import QGridLayout, QLabel
from PySide6.QtCore import Qt
from qfluentwidgets import SimpleCardWidget, StrongBodyLabel, BodyLabel, CaptionLabel


class DiskCard(SimpleCardWidget):
    """驱动盘卡片"""

    def __init__(self, disk: dict, icon_manager, parent=None):
        super().__init__(parent)
        self.icon_manager = icon_manager
        self.disk_data = disk
        self._init_ui()

    def _init_ui(self):
        """初始化UI"""
        self.setFixedSize(300, 450)
        card_layout = QGridLayout(self)
        card_layout.setContentsMargins(15, 15, 15, 15)
        card_layout.setSpacing(10)

        # 图标 (0, 0)，跨2行
        icon_widget = QLabel()
        icon_widget.setFixedSize(80, 80)
        icon_widget.setAlignment(Qt.AlignCenter)
        icon_name = self.disk_data.get('icon')
        if icon_name:
            pixmap = self.icon_manager.get_equipment_pixmap(icon_name)
            if pixmap:
                icon_widget.setPixmap(pixmap.scaled(
                    80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation
                ))
        card_layout.addWidget(icon_widget, 0, 0, 2, 1)

        # 名称 (0, 1)
        set_name = self.disk_data.get('set_name_cn', '未知套装')
        position = self.disk_data.get('position', '?')
        level = self.disk_data.get('level', 0)
        rarity = self.disk_data.get('rarity', 2)

        self.name_label = StrongBodyLabel(f"{set_name}[{position}]")
        self.name_label.setStyleSheet("font-size: 20px; font-weight: bold;")
        self.name_label.setWordWrap(True)
        card_layout.addWidget(self.name_label, 0, 1)

        # 等级和星级 (1, 1)
        level_label = BodyLabel(f"Lv.{level} {'★' * rarity}")
        level_label.setStyleSheet("font-size: 18px;")
        card_layout.addWidget(level_label, 1, 1)

        # 主词条标题 (2, 0)，跨2列
        main_title = StrongBodyLabel("主词条")
        main_title.setStyleSheet("font-size: 18px; font-weight: bold;")
        card_layout.addWidget(main_title, 2, 0, 1, 2)

        # 主词条内容 (3, 0)，跨2列
        main_stat = self.disk_data.get('main_stat', '未知')
        main_value = self.disk_data.get('main_stat_value', 0)
        is_percentage = self.disk_data.get('main_stat_is_percentage', False)
        main_text = f"{main_stat} {main_value*100:.1f}%" if is_percentage else f"{main_stat} {main_value:.0f}"
        main_label = BodyLabel(main_text)
        main_label.setStyleSheet("font-size: 20px;")
        card_layout.addWidget(main_label, 3, 0, 1, 2)

        # 副词条标题 (4, 0)，跨2列
        sub_title = StrongBodyLabel("副词条")
        sub_title.setStyleSheet("font-size: 18px; font-weight: bold;")
        card_layout.addWidget(sub_title, 4, 0, 1, 2)

        # 副词条 (从第5行开始)
        sub_stats = self.disk_data.get('sub_stats', [])
        row = 5
        for sub in sub_stats[:4]:
            stat_name = sub.get('name', '?')
            stat_value = sub.get('value', 0)
            rolls = sub.get('rolls', 0)
            is_percentage = sub.get('is_percentage', False)

            value_str = f"{stat_value*100:.1f}%" if is_percentage else f"{stat_value:.0f}"

            # 副词条名称和值 (第0列)
            stat_label = BodyLabel(f"{stat_name} {value_str}")
            stat_label.setStyleSheet("font-size: 18px;")
            card_layout.addWidget(stat_label, row, 0)

            # 强化次数 (第1列)
            if rolls > 1:
                rolls_label = CaptionLabel(f"+{rolls-1}")
                rolls_label.setStyleSheet("font-size: 18px;")
                card_layout.addWidget(rolls_label, row, 1)

            row += 1

        # 装备状态 (最后一行)，跨2列
        if self.disk_data.get('equipped_agent'):
            status_label = CaptionLabel(f"装备于: {self.disk_data['equipped_agent']}")
        else:
            status_label = CaptionLabel("未装备")
        status_label.setStyleSheet("font-size: 16px;")
        card_layout.addWidget(status_label, row, 0, 1, 2)

        card_layout.setRowStretch(row + 1, 1)

    def text(self) -> str:
        """返回用于搜索的文本"""
        return self.name_label.text()