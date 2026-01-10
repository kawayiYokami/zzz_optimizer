"""存档管理界面"""
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QFileDialog, QFrame
from qfluentwidgets import ListWidget, PushButton, LineEdit, MessageBox


class SaveView(QFrame):
    """存档管理界面"""

    def __init__(self, facade):
        super().__init__()
        self.setObjectName("save_view")
        self.facade = facade
        self._init_ui()
        self._load_saves()

    def _init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)

        # 存档列表
        self.save_list = ListWidget()
        self.save_list.itemClicked.connect(self._on_save_selected)
        layout.addWidget(self.save_list)

        # 新建存档
        create_layout = QHBoxLayout()
        self.name_input = LineEdit()
        self.name_input.setPlaceholderText("输入存档名称")
        create_layout.addWidget(self.name_input)

        self.create_btn = PushButton("新建存档")
        self.create_btn.clicked.connect(self._on_create_save)
        create_layout.addWidget(self.create_btn)

        layout.addLayout(create_layout)

        # 操作按钮
        btn_layout = QHBoxLayout()

        self.switch_btn = PushButton("切换存档")
        self.switch_btn.clicked.connect(self._on_switch_save)
        btn_layout.addWidget(self.switch_btn)

        self.delete_btn = PushButton("删除存档")
        self.delete_btn.clicked.connect(self._on_delete_save)
        btn_layout.addWidget(self.delete_btn)

        self.import_btn = PushButton("导入扫描数据")
        self.import_btn.clicked.connect(self._on_import_scan)
        btn_layout.addWidget(self.import_btn)

        layout.addLayout(btn_layout)

    def _load_saves(self):
        """加载存档列表"""
        self.save_list.clear()
        saves = self.facade.get_saves()
        current = self.facade.get_current_save()

        for save in saves:
            item_text = f"{save} {'[当前]' if save == current else ''}"
            self.save_list.addItem(item_text)

    def _on_create_save(self):
        """创建新存档"""
        name = self.name_input.text().strip()
        if not name:
            return

        if self.facade.create_save(name):
            self.name_input.clear()
            self._load_saves()
            MessageBox("成功", f"存档 '{name}' 创建成功", self).exec()

    def _on_switch_save(self):
        """切换存档"""
        item = self.save_list.currentItem()
        if not item:
            return

        name = item.text().replace(" [当前]", "")
        if self.facade.switch_save(name):
            self._load_saves()

    def _on_delete_save(self):
        """删除存档"""
        item = self.save_list.currentItem()
        if not item:
            return

        name = item.text().replace(" [当前]", "")
        if self.facade.delete_save(name):
            self._load_saves()

    def _on_save_selected(self, item):
        """选择存档"""
        pass

    def _on_import_scan(self):
        """导入扫描数据"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择扫描数据文件", "", "JSON Files (*.json)"
        )
        if file_path:
            if self.facade.import_from_scan(file_path):
                MessageBox("成功", "数据导入成功", self).exec()
            else:
                MessageBox("失败", "数据导入失败", self).exec()
