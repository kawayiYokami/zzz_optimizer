"""音擎浏览界面 - Model/View架构"""
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QFrame, QListView
from PySide6.QtCore import Qt
from qfluentwidgets import PushButton, SearchLineEdit, ComboBox
from optimizer.gui.icon_manager import get_icon_manager
from optimizer.gui.models.wengine_list_model import WEngineListModel
from optimizer.gui.delegates.wengine_delegate import WEngineDelegate


class WEngineView(QFrame):
    """音擎浏览界面"""

    def __init__(self, facade):
        super().__init__()
        self.setObjectName("wengine_view")
        self.facade = facade
        self.icon_manager = get_icon_manager()
        self.all_wengines = []
        self._is_loaded = False

        # 实例化模型和委托
        self.model = WEngineListModel()
        self.delegate = WEngineDelegate(self.icon_manager)

        self._init_ui()

    def _init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)

        # 顶部工具栏
        toolbar = QHBoxLayout()
        self.search_box = SearchLineEdit()
        self.search_box.setPlaceholderText("搜索音擎...")
        self.search_box.textChanged.connect(self._on_search)
        toolbar.addWidget(self.search_box)

        self.filter_combo = ComboBox()
        self.filter_combo.addItems(["全部", "已装备", "未装备"])
        self.filter_combo.currentTextChanged.connect(self._load_data)
        toolbar.addWidget(self.filter_combo)

        self.refresh_btn = PushButton("刷新")
        self.refresh_btn.clicked.connect(self._load_data)
        toolbar.addWidget(self.refresh_btn)

        layout.addLayout(toolbar)

        # 创建 QListView
        self.list_view = QListView(self)
        self.list_view.setModel(self.model)
        self.list_view.setItemDelegate(self.delegate)

        # 配置 QListView 以模拟卡片网格布局
        self.list_view.setViewMode(QListView.ViewMode.IconMode)
        self.list_view.setFlow(QListView.Flow.LeftToRight)
        self.list_view.setWrapping(True)
        self.list_view.setResizeMode(QListView.ResizeMode.Adjust)
        self.list_view.setMovement(QListView.Movement.Static)
        self.list_view.setSpacing(20)
        self.list_view.setStyleSheet("QListView { border: none; background: transparent; }")

        layout.addWidget(self.list_view, 1)

    def _load_data(self):
        """加载音擎数据"""
        filter_text = self.filter_combo.currentText()
        equipped = None if filter_text == "全部" else (filter_text == "已装备")

        wengines = self.facade.get_wengines(equipped)
        self.all_wengines = wengines

        # 应用筛选
        self._apply_filters()

    def _apply_filters(self):
        """应用搜索和筛选条件"""
        search_text = self.search_box.text().lower()

        # 根据搜索词筛选
        if search_text:
            filtered_wengines = [
                wengine for wengine in self.all_wengines
                if search_text in wengine.get('name', '').lower()
            ]
        else:
            filtered_wengines = self.all_wengines

        # 更新模型数据
        self.model.update_data(filtered_wengines)

    def _on_search(self, text):
        """搜索过滤"""
        self._apply_filters()

    def showEvent(self, event):
        """视图显示时触发延迟加载"""
        super().showEvent(event)
        if not self._is_loaded:
            self._load_data()
            self._is_loaded = True