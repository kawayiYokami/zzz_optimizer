"""设置界面"""
from PySide6.QtWidgets import QWidget, QVBoxLayout, QFrame
from qfluentwidgets import (SettingCardGroup, OptionsSettingCard, FluentIcon,
                            qconfig, Theme, setTheme)


class SettingsView(QFrame):
    """设置界面"""

    def __init__(self, facade):
        super().__init__()
        self.setObjectName("settings_view")
        self.facade = facade
        self._init_ui()

    def _init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)

        # 主题设置组
        theme_group = SettingCardGroup("主题设置", self)

        self.theme_card = OptionsSettingCard(
            qconfig.themeMode,
            FluentIcon.BRUSH,
            "应用主题",
            "选择应用的主题颜色",
            texts=["浅色", "深色", "跟随系统"]
        )
        self.theme_card.optionChanged.connect(lambda config: setTheme(config.value))
        theme_group.addSettingCard(self.theme_card)

        layout.addWidget(theme_group)

        layout.addStretch(1)
