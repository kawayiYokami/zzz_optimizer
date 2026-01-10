"""主窗口"""
import sys
import ctypes
from PySide6.QtCore import Qt, qInstallMessageHandler
from PySide6.QtWidgets import QApplication
from qfluentwidgets import (MSFluentWindow, NavigationItemPosition, FluentIcon,
                            setTheme, setThemeColor, Theme)
from optimizer.gui.views.agent_view import AgentView
from optimizer.gui.views.disk_view import DiskView
from optimizer.gui.views.wengine_view import WEngineView
from optimizer.gui.views.optimize_view import OptimizeView
from optimizer.gui.views.save_view import SaveView
from optimizer.gui.views.settings_view import SettingsView
from optimizer.optimizer_facade import OptimizerFacade
from optimizer.gui.icon_manager import get_icon_manager


class MainWindow(MSFluentWindow):
    """主窗口"""

    def __init__(self):
        super().__init__()
        self.facade = OptimizerFacade()

        # 预加载图标
        icon_manager = get_icon_manager()
        icon_manager.preload_icons()

        self._init_window()
        self._init_navigation()

    def _init_window(self):
        """初始化窗口"""
        self.setWindowTitle("优化器")
        self.resize(1200, 800)

    def _init_navigation(self):
        """初始化导航栏"""
        # 上部导航 - 浏览功能
        self.agent_view = AgentView(self.facade)
        self.disk_view = DiskView(self.facade)
        self.wengine_view = WEngineView(self.facade)
        self.optimize_view = OptimizeView(self.facade)

        self.addSubInterface(self.agent_view, FluentIcon.PEOPLE, "角色")
        self.addSubInterface(self.disk_view, FluentIcon.ALBUM, "驱动盘")
        self.addSubInterface(self.wengine_view, FluentIcon.GAME, "音擎")
        self.addSubInterface(self.optimize_view, FluentIcon.SPEED_HIGH, "优化")

        # 底部导航 - 管理功能
        self.save_view = SaveView(self.facade)
        self.settings_view = SettingsView(self.facade)

        self.addSubInterface(
            self.save_view, FluentIcon.SAVE, "存档",
            position=NavigationItemPosition.BOTTOM
        )
        self.addSubInterface(
            self.settings_view, FluentIcon.SETTING, "设置",
            position=NavigationItemPosition.BOTTOM
        )


def filter_message(msg_type, msg_log_context, msg_string):
    """过滤掉DPI警告消息"""
    # 过滤掉DPI相关的警告消息
    if "SetProcessDpiAwarenessContext" in msg_string:
        return
    # 其他消息正常输出
    print(msg_string)


def run_gui():
    """启动GUI"""
    # 安装消息处理器，过滤DPI警告
    qInstallMessageHandler(filter_message)

    # 在Windows上设置DPI awareness，避免与调试器冲突
    if sys.platform == 'win32':
        try:
            # 尝试使用Windows 8.1+的API
            ctypes.windll.shcore.SetProcessDpiAwareness(1)  # PROCESS_SYSTEM_DPI_AWARE
        except:
            try:
                # 回退到Windows Vista/7/8的API
                ctypes.windll.user32.SetProcessDPIAware()
            except:
                pass

    app = QApplication([])

    # 设置主题和主题色
    setTheme(Theme.DARK)
    setThemeColor('#F3D600')

    window = MainWindow()
    window.show()
    app.exec()
