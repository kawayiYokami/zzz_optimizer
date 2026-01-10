"""优化界面"""
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QFrame
from qfluentwidgets import ComboBox, PushButton, TextEdit, ProgressBar


class OptimizeView(QFrame):
    """优化界面"""

    def __init__(self, facade):
        super().__init__()
        self.setObjectName("optimize_view")
        self.facade = facade
        self._init_ui()

    def _init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)

        # 选择角色
        select_layout = QHBoxLayout()
        self.agent_combo = ComboBox()
        self.agent_combo.setPlaceholderText("选择角色")
        self._load_agents()
        select_layout.addWidget(self.agent_combo)

        self.optimize_btn = PushButton("开始优化")
        self.optimize_btn.clicked.connect(self._on_optimize)
        select_layout.addWidget(self.optimize_btn)

        layout.addLayout(select_layout)

        # 进度条
        self.progress = ProgressBar()
        layout.addWidget(self.progress)

        # 结果显示
        self.result_text = TextEdit()
        self.result_text.setReadOnly(True)
        self.result_text.setPlaceholderText("优化结果将显示在这里...")
        layout.addWidget(self.result_text)

    def _load_agents(self):
        """加载角色列表"""
        agents = self.facade.get_agents()
        self.agent_combo.clear()
        for agent in agents:
            self.agent_combo.addItem(agent['name_cn'], agent['id'])

    def _on_optimize(self):
        """执行优化"""
        agent_id = self.agent_combo.currentData()
        if not agent_id:
            return

        self.progress.setValue(0)
        self.result_text.setText("正在优化...")

        # TODO: 实现优化逻辑
        result = self.facade.optimize_equipment(agent_id)

        self.progress.setValue(100)
        if result:
            self.result_text.setText(f"优化完成！\n{result}")
        else:
            self.result_text.setText("优化失败或无可用结果")
