"""视图模块"""
from .agent_view import AgentView
from .disk_view import DiskView
from .wengine_view import WEngineView
from .optimize_view import OptimizeView
from .save_view import SaveView
from .settings_view import SettingsView

__all__ = [
    'AgentView',
    'DiskView',
    'WEngineView',
    'OptimizeView',
    'SaveView',
    'SettingsView'
]
