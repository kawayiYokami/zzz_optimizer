"""角色浏览界面 - 上下结构布局"""
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                               QFrame, QLabel, QSizePolicy, QStackedWidget,
                               QTableWidgetItem, QHeaderView)
from PySide6.QtCore import Qt, Signal, QSize
from PySide6.QtGui import QPixmap
from qfluentwidgets import (PushButton, SubtitleLabel, ToolButton,
                            SimpleCardWidget, BodyLabel, CaptionLabel,
                            SingleDirectionScrollArea, TransparentToggleToolButton,
                            Pivot, StrongBodyLabel, FlowLayout,
                            TableWidget, FluentIcon)
from qfluentwidgets.components.settings.expand_setting_card import ExpandGroupSettingCard
from optimizer.gui.icon_manager import get_icon_manager


class AgentIconButton(TransparentToggleToolButton):
    """角色头像按钮"""

    clicked_with_data = Signal(dict)  # 点击时发送角色数据

    def __init__(self, agent_data: dict, icon_manager, parent=None):
        super().__init__(parent)
        self.agent_data = agent_data
        self.icon_manager = icon_manager
        self.setFixedSize(64, 64)
        self.setIconSize(self.size())
        self._update_icon()
        self.clicked.connect(self._on_clicked)

        # 设置工具提示
        self.setToolTip(agent_data.get('name_cn', '未知角色'))

    def _update_icon(self):
        """更新图标（拥有的显示彩色，未拥有的显示灰色）"""
        icon_name = self.agent_data.get('icon', '')
        owned = self.agent_data.get('owned', False)

        if owned:
            icon = self.icon_manager.get_agent_icon_circle(icon_name)
        else:
            icon = self.icon_manager.get_agent_icon_grayscale(icon_name)

        if icon:
            self.setIcon(icon)
        else:
            self.setIcon(self.icon_manager.get_default_icon())

    def _on_clicked(self):
        """点击时发送数据"""
        self.clicked_with_data.emit(self.agent_data)


class AutoResizeImageLabel(QLabel):
    """宽度自适应图片标签"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignTop | Qt.AlignHCenter)
        self._original_pixmap = None
        self.setSizePolicy(QSizePolicy.Ignored, QSizePolicy.MinimumExpanding)

    def setPixmap(self, pixmap):
        self._original_pixmap = pixmap
        self._update_pixmap()

    def resizeEvent(self, event):
        self._update_pixmap()
        super().resizeEvent(event)

    def _update_pixmap(self):
        if not self._original_pixmap or self._original_pixmap.isNull():
            return

        # 宽度撑满，保持比例
        w = self.width()
        if w <= 0: return

        scaled_pixmap = self._original_pixmap.scaledToWidth(w, Qt.SmoothTransformation)
        super().setPixmap(scaled_pixmap)
        # 调整高度以适应图片，这会触发布局更新（如果在这个label所在的scrollarea里）
        # 注意：不要在 paintEvent 里做这个，resizeEvent 里做通常是安全的
        if self.height() != scaled_pixmap.height():
             self.setFixedHeight(scaled_pixmap.height())


class AgentView(QFrame):
    """角色浏览界面 - 上下结构"""

    def __init__(self, facade):
        super().__init__()
        self.setObjectName("agent_view")
        self.facade = facade
        self.icon_manager = get_icon_manager()
        self.selected_agent = None  # 当前选中的角色数据
        self.selected_btn = None    # 当前选中的按钮
        self.agent_buttons = []  # 存储所有角色按钮
        self._init_ui()
        self._load_data()

    def _init_ui(self):
        """初始化UI - 上下结构"""
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(0)

        # ========== 上部：横向滚动的角色头像列表 ==========
        self.top_container = QWidget()
        top_layout = QVBoxLayout(self.top_container)
        top_layout.setContentsMargins(0, 0, 0, 0)
        top_layout.setSpacing(0)

        # 横向滚动区域（使用 SingleDirectionScrollArea 实现流畅水平滚动）
        self.scroll_area = SingleDirectionScrollArea(orient=Qt.Horizontal)
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setFixedHeight(100)
        self.scroll_area.setStyleSheet("QScrollArea{background: transparent; border: none}")
        self.scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)

        # 启用鼠标左键拖拽滚动
        try:
            from PySide6.QtWidgets import QScroller
            QScroller.grabGesture(self.scroll_area.viewport(), QScroller.LeftMouseButtonGesture)
        except ImportError:
            pass

        # 滚动内容容器
        self.scroll_content = QWidget()
        self.scroll_content.setStyleSheet("QWidget{background: transparent}")
        self.scroll_layout = QHBoxLayout(self.scroll_content)
        self.scroll_layout.setContentsMargins(10, 5, 10, 20)  # 底部边距增加到20，避免滚动条遮挡
        self.scroll_layout.setSpacing(0)
        self.scroll_layout.setAlignment(Qt.AlignLeft)

        self.scroll_area.setWidget(self.scroll_content)
        top_layout.addWidget(self.scroll_area)

        main_layout.addWidget(self.top_container)

        # ========== 下部：角色详情区域 ==========
        self.bottom_container = SimpleCardWidget()
        self.bottom_container.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.bottom_layout = QVBoxLayout(self.bottom_container)
        # 减小边距以便让图片更贴边，或者保持 consistent
        self.bottom_layout.setContentsMargins(0, 0, 0, 0)
        self.bottom_layout.setSpacing(0)

        # 初始显示空状态
        self._show_empty_state()

        main_layout.addWidget(self.bottom_container, 1)

    def _clear_bottom_layout(self):
        """清空下部布局"""
        while self.bottom_layout.count():
            item = self.bottom_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

    def _show_empty_state(self):
        """显示空状态 - 新建角色按钮"""
        self._clear_bottom_layout()

        # 居中容器
        center_widget = QWidget()
        center_layout = QVBoxLayout(center_widget)
        center_layout.setAlignment(Qt.AlignCenter)
        center_layout.setSpacing(20)

        # 提示文字
        hint_label = SubtitleLabel("请选择一个角色")
        hint_label.setAlignment(Qt.AlignCenter)
        center_layout.addWidget(hint_label)

        # 新建角色按钮（仅当选中未拥有的角色时才显示）
        self.create_btn = PushButton("新建角色")
        self.create_btn.setFixedWidth(200)
        self.create_btn.clicked.connect(self._on_create_agent)
        self.create_btn.setVisible(False)  # 默认隐藏
        center_layout.addWidget(self.create_btn, 0, Qt.AlignCenter)

        self.bottom_layout.addWidget(center_widget, 1)

    def _show_unowned_state(self, agent_data: dict):
        """显示未拥有角色状态 - 显示新建按钮"""
        self._clear_bottom_layout()

        # 居中容器
        center_widget = QWidget()
        center_layout = QVBoxLayout(center_widget)
        center_layout.setAlignment(Qt.AlignCenter)
        center_layout.setSpacing(20)

        # 角色名称
        name_label = SubtitleLabel(f"{agent_data.get('name_cn', '未知角色')} (未拥有)")
        name_label.setAlignment(Qt.AlignCenter)
        center_layout.addWidget(name_label)

        # 新建角色按钮
        create_btn = PushButton("新建满级角色")
        create_btn.setFixedWidth(200)
        create_btn.clicked.connect(lambda: self._on_create_agent_from_data(agent_data))
        center_layout.addWidget(create_btn, 0, Qt.AlignCenter)

        self.bottom_layout.addWidget(center_widget, 1)

    def _show_agent_detail(self, agent_data: dict):
        """显示角色详情"""
        self._clear_bottom_layout()

        # 获取详细信息
        agent_id = agent_data.get('agent_id')
        detail = self.facade.get_agent_detail(agent_id) if agent_id else None

        if not detail:
            self._show_empty_state()
            return

        # ===== 横向布局：左侧大图 + 右侧 Pivot 面板 =====
        content_layout = QHBoxLayout()
        content_layout.setContentsMargins(0, 0, 0, 0)
        content_layout.setSpacing(0)

        # --- 左侧：角色大图区域 (ScrollArea) ---
        left_scroll = SingleDirectionScrollArea(orient=Qt.Vertical)
        left_scroll.setWidgetResizable(True)
        left_scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")
        left_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)

        left_container = QWidget()
        left_container.setStyleSheet("background: transparent;")
        left_layout = QVBoxLayout(left_container)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setAlignment(Qt.AlignTop)

        # 图片 Label
        self.portrait_label = AutoResizeImageLabel()

        # 加载图片
        icon_name = detail.get('icon', '')
        pixmap = self.icon_manager.get_agent_pixmap(icon_name)
        if pixmap:
            self.portrait_label.setPixmap(pixmap)

        left_layout.addWidget(self.portrait_label)
        left_scroll.setWidget(left_container)

        # 左侧占据黄金分割比例 (1-0.618 ≈ 0.382)
        content_layout.addWidget(left_scroll, 382)

        # --- 右侧：StackedWidget + Pivot (底部) ---
        right_container = QWidget()
        right_layout = QVBoxLayout(right_container)
        right_layout.setContentsMargins(20, 20, 20, 20)
        right_layout.setSpacing(15)

        # StackedWidget 内容区
        self.stacked_widget = QStackedWidget(self)

        # 创建子页面
        self.page_profile = self._create_profile_page(agent_id)
        self.page_base = self._create_base_page(detail)
        self.page_skill = self._create_skill_page(agent_id)
        self.page_buff = self._create_buff_page(agent_id)
        self.page_equipment = self._create_equipment_page(detail)
        self.page_damage = self._create_placeholder_page("伤害数据开发中...")

        self.stacked_widget.addWidget(self.page_profile)
        self.stacked_widget.addWidget(self.page_base)
        self.stacked_widget.addWidget(self.page_skill)
        self.stacked_widget.addWidget(self.page_buff)
        self.stacked_widget.addWidget(self.page_equipment)
        self.stacked_widget.addWidget(self.page_damage)

        right_layout.addWidget(self.stacked_widget)

        # Pivot 导航 (底部)
        self.pivot = Pivot(self)
        self.pivot.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        # 设置 Pivot 字体样式：粗体，放大两倍 (假设原14px -> 28px)
        self.pivot.setStyleSheet("""
            PivotItem {
                font-size: 28px;
                font-weight: bold;
                padding: 10px 20px;
            }
        """)

        # 添加 Items
        self.pivot.addItem(routeKey="profile", text="个人情报", onClick=lambda: self.stacked_widget.setCurrentWidget(self.page_profile))
        self.pivot.addItem(routeKey="base", text="基础", onClick=lambda: self.stacked_widget.setCurrentWidget(self.page_base))
        self.pivot.addItem(routeKey="skill", text="技能", onClick=lambda: self.stacked_widget.setCurrentWidget(self.page_skill))
        self.pivot.addItem(routeKey="buff", text="Buff", onClick=lambda: self.stacked_widget.setCurrentWidget(self.page_buff))
        self.pivot.addItem(routeKey="equipment", text="装备", onClick=lambda: self.stacked_widget.setCurrentWidget(self.page_equipment))
        self.pivot.addItem(routeKey="damage", text="伤害", onClick=lambda: self.stacked_widget.setCurrentWidget(self.page_damage))

        self.pivot.setCurrentItem("profile")

        # 撑满宽度
        right_layout.addWidget(self.pivot)

        # 右侧占据黄金分割比例 (0.618)
        content_layout.addWidget(right_container, 618)

        # 添加到主布局
        content_widget = QWidget()
        content_widget.setLayout(content_layout)
        self.bottom_layout.addWidget(content_widget, 1)

    def _create_base_page(self, detail: dict) -> QWidget:
        """创建基础信息页面"""
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setAlignment(Qt.AlignTop)
        layout.setSpacing(15)
        layout.setContentsMargins(10, 15, 10, 15)

        # --- 顶部头部 ---
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)

        # 左上：名字和等级
        title_info = QVBoxLayout()
        name_label = StrongBodyLabel(detail.get('name_cn', '未知角色'))
        name_label.setStyleSheet("font-size: 64px; font-weight: bold;")

        # 显示等级、突破和影画
        level = detail.get('level', 1)
        breakthrough = detail.get('breakthrough', 0)
        cinema = detail.get('cinema', 0)
        level_text = f"等级 {level} / 60 MAX  |  突破 {breakthrough}  |  影画 {cinema}"
        level_label = CaptionLabel(level_text)
        level_label.setStyleSheet("font-size: 32px; font-style: italic;")

        title_info.addWidget(name_label)
        title_info.addWidget(level_label)

        header_layout.addLayout(title_info)
        header_layout.addStretch()

        # 右上：属性/职业 (Tags)
        tags_layout = QVBoxLayout()
        tags_layout.setAlignment(Qt.AlignRight | Qt.AlignTop)
        tags_layout.setSpacing(15)

        element = detail.get('element', '未知')
        weapon_type = detail.get('weapon_type', '未知')

        # Tag 样式 - 使用主题颜色
        tag_style = """
            QLabel {
                border-radius: 10px;
                padding: 10px 20px;
                font-size: 24px;
                font-weight: bold;
            }
        """

        element_label = QLabel(element)
        element_label.setStyleSheet(tag_style)
        element_label.setAlignment(Qt.AlignCenter)

        weapon_label = QLabel(weapon_type)
        weapon_label.setStyleSheet(tag_style)
        weapon_label.setAlignment(Qt.AlignCenter)

        tags_layout.addWidget(element_label)
        tags_layout.addWidget(weapon_label)

        header_layout.addLayout(tags_layout)

        layout.addWidget(header_widget)

        # --- 分割线 ---
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        layout.addWidget(line)

        # --- 属性列表 (双列) ---
        stats_widget = QWidget()
        stats_layout = QHBoxLayout(stats_widget)
        stats_layout.setContentsMargins(0, 10, 0, 10)
        stats_layout.setSpacing(40) # 左右列间距

        left_stats_layout = QVBoxLayout()
        left_stats_layout.setSpacing(12)

        right_stats_layout = QVBoxLayout()
        right_stats_layout.setSpacing(12)

        # 获取属性数据 (如果 stats 不存在，使用默认值)
        # Facade 已将 key 转为小写
        stats = detail.get('stats', {})

        # 格式化数值的辅助函数
        def fmt_int(val):
            return f"{int(val)}" if val is not None else "--"

        def fmt_pct(val):
            return f"{val:.1f}%" if val is not None else "--"

        def fmt_float(val):
            return f"{val:.2f}" if val is not None else "--"

        # 计算复合属性
        anom_mas = stats.get('element_abnormal_power', 0) + stats.get('anom_mas_', 0)
        anom_prof = stats.get('element_mystery', 0) + stats.get('anom_prof_', 0)

        left_items = [
            ("生命值", fmt_int(stats.get('hp'))),
            ("防御力", fmt_int(stats.get('def'))),
            ("暴击率", fmt_pct(stats.get('CRIT_RATE_', 0))),
            ("异常掌控", fmt_int(anom_mas)),
            ("穿透率", fmt_pct(stats.get('pen_ratio', 0))),
        ]

        right_items = [
            ("攻击力", fmt_int(stats.get('atk'))),
            ("冲击力", fmt_int(stats.get('break_stun'))),
            ("暴击伤害", fmt_pct(stats.get('CRIT_DMG_', 0))),
            ("异常精通", fmt_int(anom_prof)),
            ("能量自动回复", fmt_float(stats.get('ener_regen', 0))),
        ]

        def create_stat_row(name, value):
            row = QWidget()
            row_layout = QHBoxLayout(row)
            row_layout.setContentsMargins(0, 0, 0, 0)

            name_lbl = BodyLabel(name)
            name_lbl.setStyleSheet("font-weight: bold; font-size: 24px;")

            val_lbl = StrongBodyLabel(value)
            val_lbl.setStyleSheet("font-weight: bold; font-size: 36px;")

            row_layout.addWidget(name_lbl)
            row_layout.addStretch()
            row_layout.addWidget(val_lbl)
            return row

        for name, val in left_items:
            left_stats_layout.addWidget(create_stat_row(name, val))

        for name, val in right_items:
            right_stats_layout.addWidget(create_stat_row(name, val))

        stats_layout.addLayout(left_stats_layout, 1)
        stats_layout.addLayout(right_stats_layout, 1)

        layout.addWidget(stats_widget)

        layout.addStretch()

        return page

    def _create_profile_page(self, agent_id: str) -> QWidget:
        """创建个人信息页面"""
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setAlignment(Qt.AlignTop)
        layout.setSpacing(20)
        layout.setContentsMargins(10, 15, 10, 15)

        # 获取个人信息
        profile = self.facade.get_agent_profile(agent_id)

        if not profile:
            # 如果没有个人信息数据，显示占位文本
            layout.setAlignment(Qt.AlignCenter)
            label = SubtitleLabel("暂无个人信息")
            layout.addWidget(label)
            return page

        # 标题
        title = StrongBodyLabel("代理人档案")
        title.setStyleSheet("font-size: 48px; font-weight: bold;")
        layout.addWidget(title)

        # 分割线
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        layout.addWidget(line)

        # 基础信息 - 使用FlowLayout流式布局
        info_container = QWidget()
        info_flow = FlowLayout(info_container, needAni=False)
        info_flow.setContentsMargins(0, 10, 0, 10)
        info_flow.setVerticalSpacing(15)
        info_flow.setHorizontalSpacing(20)

        # 创建信息卡片的辅助函数
        def create_info_card(label_text: str, value_text: str) -> QWidget:
            card = SimpleCardWidget()
            card.setMinimumWidth(200)
            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(15, 10, 15, 10)
            card_layout.setSpacing(5)

            label = CaptionLabel(label_text)
            label.setStyleSheet("font-size: 14px;")

            value = BodyLabel(value_text)
            value.setStyleSheet("font-size: 20px; font-weight: bold;")

            card_layout.addWidget(label)
            card_layout.addWidget(value)
            return card

        # 基础信息卡片
        info_flow.addWidget(create_info_card("全名", profile.get('full_name', '未知')))
        info_flow.addWidget(create_info_card("性别", profile.get('gender', '未知')))
        info_flow.addWidget(create_info_card("生日", profile.get('birthday', '未知')))
        info_flow.addWidget(create_info_card("身高", profile.get('stature', '未知') + " cm"))
        info_flow.addWidget(create_info_card("阵营", profile.get('race', '未知')))

        layout.addWidget(info_container)

        # 个人简介 - 使用单向滚动区域
        if profile.get('profile_desc'):
            # 分割线
            line2 = QFrame()
            line2.setFrameShape(QFrame.HLine)
            line2.setFrameShadow(QFrame.Sunken)
            layout.addWidget(line2)

            desc_title = StrongBodyLabel("个人简介")
            desc_title.setStyleSheet("font-size: 32px; font-weight: bold;")
            layout.addWidget(desc_title)

            # 简介滚动区域 - 垂直滚动
            desc_scroll = SingleDirectionScrollArea(orient=Qt.Vertical)
            desc_scroll.setWidgetResizable(True)
            desc_scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")

            desc_container = QWidget()
            desc_container.setStyleSheet("background: transparent;")
            desc_container_layout = QVBoxLayout(desc_container)
            desc_container_layout.setContentsMargins(0, 0, 0, 0)

            desc_text = BodyLabel(profile.get('profile_desc'))
            desc_text.setStyleSheet("font-size: 18px; line-height: 1.6;")
            desc_text.setWordWrap(True)
            desc_container_layout.addWidget(desc_text)
            desc_container_layout.addStretch()

            desc_scroll.setWidget(desc_container)
            layout.addWidget(desc_scroll, 1)  # 让滚动区域占据剩余空间

        return page

    def _create_skill_page(self, agent_id: str) -> QWidget:
        """创建技能页面"""
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setAlignment(Qt.AlignTop)
        layout.setSpacing(20)
        layout.setContentsMargins(10, 15, 10, 15)

        # 获取技能数据
        skills_data = self.facade.get_agent_skills(agent_id)

        if not skills_data:
            layout.setAlignment(Qt.AlignCenter)
            label = SubtitleLabel("暂无技能数据")
            layout.addWidget(label)
            return page

        # 滚动区域
        scroll = SingleDirectionScrollArea(orient=Qt.Vertical)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")

        scroll_container = QWidget()
        scroll_container.setStyleSheet("background: transparent;")
        scroll_layout = QVBoxLayout(scroll_container)
        scroll_layout.setContentsMargins(0, 0, 20, 0)  # 右边距20px避免与滚动条重叠
        scroll_layout.setSpacing(15)

        # 获取技能数据
        levels = skills_data.get('levels', {})
        skill_details = skills_data.get('skill_details', [])

        # 按类型分组技能
        skill_groups = {
            'normal': {'name': '普通攻击', 'level': levels.get('normal', 1), 'skills': []},
            'special': {'name': '特殊技', 'level': levels.get('special', 1), 'skills': []},
            'dodge': {'name': '闪避反击', 'level': levels.get('dodge', 1), 'skills': []},
            'chain': {'name': '连携技', 'level': levels.get('chain', 1), 'skills': []},
            'assist': {'name': '支援技', 'level': levels.get('assist', 1), 'skills': []},
        }

        # 将技能详情分配到对应组
        for skill in skill_details:
            skill_name = skill['name']
            if '普通攻击' in skill_name or '强化普通攻击' in skill_name:
                skill_groups['normal']['skills'].append(skill)
            elif '特殊技' in skill_name or '强化特殊技' in skill_name:
                skill_groups['special']['skills'].append(skill)
            elif '闪避' in skill_name or '反击' in skill_name or '冲刺' in skill_name:
                skill_groups['dodge']['skills'].append(skill)
            elif '连携' in skill_name or '终结技' in skill_name:
                skill_groups['chain']['skills'].append(skill)
            else:
                skill_groups['assist']['skills'].append(skill)

        # 创建每个技能组
        for group_key, group_data in skill_groups.items():
            if not group_data['skills']:
                continue

            # 组标题（技能类型 + 等级）
            group_title = StrongBodyLabel(f"{group_data['name']} {group_data['level']}/12")
            group_title.setStyleSheet("font-size: 24px; font-weight: bold;")
            scroll_layout.addWidget(group_title)

            # 该组的所有技能卡片
            for skill in group_data['skills']:
                # 创建展开卡片（使用透明图标，内容留空）
                skill_card = ExpandGroupSettingCard(
                    FluentIcon.TRANSPARENT,  # 使用透明图标
                    skill['name'],
                    ""  # 内容留空，因为上面组标题已经显示了等级
                )

                skill_card.viewLayout.setContentsMargins(0, 0, 0, 0)
                skill_card.viewLayout.setSpacing(0)

                # 创建表格显示段数据
                if skill.get('segments'):
                    table = TableWidget()
                    table.setBorderVisible(True)
                    table.setBorderRadius(8)
                    table.setWordWrap(False)

                    segments = skill['segments']
                    table.setRowCount(len(segments))
                    table.setColumnCount(5)

                    table.setHorizontalHeaderLabels(['段', '伤害倍率', '失衡倍率', '能量回复', '异常积蓄'])
                    table.verticalHeader().hide()

                    for i, seg in enumerate(segments):
                        table.setItem(i, 0, QTableWidgetItem(seg['segment_name']))
                        table.setItem(i, 1, QTableWidgetItem(f"{seg['damage_ratio']:.1%}"))
                        table.setItem(i, 2, QTableWidgetItem(f"{seg['stun_ratio']:.1%}"))
                        table.setItem(i, 3, QTableWidgetItem(f"{seg['energy_recovery']:.1f}"))
                        table.setItem(i, 4, QTableWidgetItem(f"{seg['anomaly_buildup']:.1f}"))

                    table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)

                    row_height = 36
                    header_height = 36
                    table.setFixedHeight(header_height + row_height * len(segments) + 10)

                    skill_card.addGroupWidget(table)

                scroll_layout.addWidget(skill_card)

            # 组分割线
            line = QFrame()
            line.setFrameShape(QFrame.HLine)
            line.setFrameShadow(QFrame.Sunken)
            scroll_layout.addWidget(line)

        scroll_layout.addStretch()
        scroll.setWidget(scroll_container)
        layout.addWidget(scroll, 1)

        return page

    def _create_buff_page(self, agent_id: str) -> QWidget:
        """创建Buff页面 - 只显示局内buff"""
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setAlignment(Qt.AlignTop)
        layout.setSpacing(20)
        layout.setContentsMargins(10, 15, 10, 15)
        
        # 获取buff数据
        buffs_data = self.facade.get_agent_buffs(agent_id)
        
        if not buffs_data:
            layout.setAlignment(Qt.AlignCenter)
            label = SubtitleLabel("暂无Buff数据")
            layout.addWidget(label)
            return page
        
        # 滚动区域
        scroll = SingleDirectionScrollArea(orient=Qt.Vertical)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        
        scroll_container = QWidget()
        scroll_container.setStyleSheet("background: transparent;")
        scroll_layout = QVBoxLayout(scroll_container)
        scroll_layout.setContentsMargins(0, 0, 20, 0)  # 右边距避免滚动条重叠
        scroll_layout.setSpacing(10)
        
        # 只显示潜能buff（影画buff）
        potential_buffs = buffs_data.get('potential_buffs', [])
        
        if not potential_buffs:
            scroll_layout.addWidget(BodyLabel("暂无影画Buff"))
        else:
            # 每个buff创建一个简单卡片
            for buff in potential_buffs:
                # 只显示局内属性
                bonuses_parts = []
                for prop_name, value in buff.get('in_combat_stats', {}).items():
                    if prop_name.endswith('_'):
                        bonuses_parts.append(f"{prop_name[:-1]}: +{value:.1f}%")
                    else:
                        bonuses_parts.append(f"{prop_name}: +{value:.0f}")
                
                if not bonuses_parts:
                    continue  # 跳过没有局内属性的buff
                
                # 创建卡片
                buff_card = CardWidget()
                card_layout = QVBoxLayout(buff_card)
                card_layout.setContentsMargins(20, 15, 20, 15)
                card_layout.setSpacing(8)
                
                # Buff名称
                name_label = StrongBodyLabel(buff['name'])
                name_label.setStyleSheet("font-size: 18px; font-weight: bold;")
                card_layout.addWidget(name_label)
                
                # 加成数据
                bonuses_label = BodyLabel("  |  ".join(bonuses_parts))
                bonuses_label.setStyleSheet("font-size: 16px;")
                card_layout.addWidget(bonuses_label)
                
                # 描述
                if buff.get('description'):
                    desc_label = CaptionLabel(buff['description'])
                    desc_label.setStyleSheet("font-size: 14px;")
                    desc_label.setWordWrap(True)
                    card_layout.addWidget(desc_label)
                
                scroll_layout.addWidget(buff_card)
        
        scroll_layout.addStretch()
        scroll.setWidget(scroll_container)
        layout.addWidget(scroll, 1)
        
        return page
    
    def _create_equipment_page(self, detail: dict) -> QWidget:
        """创建装备页面"""
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setAlignment(Qt.AlignTop)
        layout.setSpacing(20)
        layout.setContentsMargins(10, 15, 10, 15)
        
        # 滚动区域
        scroll = SingleDirectionScrollArea(orient=Qt.Vertical)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        
        scroll_container = QWidget()
        scroll_container.setStyleSheet("background: transparent;")
        scroll_layout = QVBoxLayout(scroll_container)
        scroll_layout.setContentsMargins(0, 0, 20, 0)
        scroll_layout.setSpacing(15)
        
        # 使用FlowLayout显示装备卡片
        equipment_container = QWidget()
        equipment_flow = FlowLayout(equipment_container, needAni=False)
        equipment_flow.setContentsMargins(0, 0, 0, 0)
        equipment_flow.setVerticalSpacing(20)
        equipment_flow.setHorizontalSpacing(20)
        
        # 音擎卡片
        wengine_detail = detail.get('wengine_detail')
        if wengine_detail:
            wengine_card = self._create_wengine_card(wengine_detail)
            equipment_flow.addWidget(wengine_card)
        
        # 驱动盘卡片（6个位置）
        drive_disks = detail.get('drive_disks_detail', [])
        for i, disk in enumerate(drive_disks):
            if disk:
                disk_card = self._create_disk_card(disk, i + 1)
                equipment_flow.addWidget(disk_card)
        
        scroll_layout.addWidget(equipment_container)
        scroll_layout.addStretch()
        scroll.setWidget(scroll_container)
        layout.addWidget(scroll, 1)
        
        return page
    
    def _create_wengine_card(self, wengine: dict) -> QWidget:
        """创建音擎卡片"""
        card = CardWidget()
        card.setFixedSize(300, 400)
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(15, 15, 15, 15)
        card_layout.setSpacing(10)
        
        # 图标（待实现）
        icon_label = BodyLabel("🎮")  # 占位符
        icon_label.setStyleSheet("font-size: 48px;")
        icon_label.setAlignment(Qt.AlignCenter)
        card_layout.addWidget(icon_label)
        
        # 音擎名称
        name_label = StrongBodyLabel(wengine.get('name_cn', '未知音擎'))
        name_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        name_label.setAlignment(Qt.AlignCenter)
        card_layout.addWidget(name_label)
        
        # 等级和精炼
        level_text = f"Lv.{wengine.get('level', 1)} | 精炼{wengine.get('refinement', 1)}"
        level_label = CaptionLabel(level_text)
        level_label.setAlignment(Qt.AlignCenter)
        card_layout.addWidget(level_label)
        
        card_layout.addStretch()
        
        # 装备按钮
        equip_btn = PushButton("装备")
        equip_btn.setEnabled(False)  # 暂不实现功能
        card_layout.addWidget(equip_btn)
        
        return card
    
    def _create_disk_card(self, disk: dict, position: int) -> QWidget:
        """创建驱动盘卡片"""
        card = CardWidget()
        card.setFixedSize(300, 450)
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(15, 15, 15, 15)
        card_layout.setSpacing(8)
        
        # 图标（待实现）
        icon_label = BodyLabel("💿")  # 占位符
        icon_label.setStyleSheet("font-size: 48px;")
        icon_label.setAlignment(Qt.AlignCenter)
        card_layout.addWidget(icon_label)
        
        # 套装名 + 位置
        set_name = disk.get('set_name_cn', '未知套装')
        position_text = f"{set_name} ({position}号位)"
        name_label = StrongBodyLabel(position_text)
        name_label.setStyleSheet("font-size: 14px; font-weight: bold;")
        name_label.setAlignment(Qt.AlignCenter)
        name_label.setWordWrap(True)
        card_layout.addWidget(name_label)
        
        # 等级和星级
        level = disk.get('level', 0)
        rarity = disk.get('rarity', 2)
        level_text = f"Lv.{level} | {'★' * rarity}"
        level_label = CaptionLabel(level_text)
        level_label.setAlignment(Qt.AlignCenter)
        card_layout.addWidget(level_label)
        
        # 主属性
        main_stat = disk.get('main_stat', '未知')
        main_label = BodyLabel(f"主属性: {main_stat}")
        main_label.setStyleSheet("font-size: 13px; font-weight: bold;")
        card_layout.addWidget(main_label)
        
        # 副属性（4个词条）
        substats = disk.get('sub_stats', [])
        for substat in substats[:4]:
            stat_text = f"{substat.get('name', '?')}: +{substat.get('value', 0)}"
            stat_label = CaptionLabel(stat_text)
            stat_label.setStyleSheet("font-size: 12px;")
            card_layout.addWidget(stat_label)
        
        card_layout.addStretch()
        
        # 装备按钮
        equip_btn = PushButton("装备")
        equip_btn.setEnabled(False)  # 暂不实现功能
        card_layout.addWidget(equip_btn)
        
        return card
    
    def _create_placeholder_page(self, text: str) -> QWidget:
        """创建占位页面"""
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setAlignment(Qt.AlignCenter)
        label = SubtitleLabel(text)
        layout.addWidget(label)
        return page

    def _load_data(self):
        """加载角色数据"""
        # 清空现有按钮
        for btn in self.agent_buttons:
            btn.deleteLater()
        self.agent_buttons.clear()
        self.selected_btn = None

        # 获取所有游戏角色
        agents = self.facade.get_all_game_agents()

        for agent_data in agents:
            btn = AgentIconButton(agent_data, self.icon_manager)
            btn.clicked_with_data.connect(self._on_agent_clicked)
            self.scroll_layout.addWidget(btn)
            self.agent_buttons.append(btn)

        # 添加弹性空间保持左对齐
        self.scroll_layout.addStretch()

    def _on_agent_clicked(self, agent_data: dict):
        """角色被点击"""
        sender_btn = self.sender()

        # 更新按钮选中状态
        if self.selected_btn and self.selected_btn != sender_btn:
            self.selected_btn.setChecked(False)

        self.selected_btn = sender_btn
        if self.selected_btn:
            self.selected_btn.setChecked(True)

        self.selected_agent = agent_data

        if agent_data.get('owned', False):
            # 拥有的角色：显示详情
            self._show_agent_detail(agent_data)
        else:
            # 未拥有的角色：显示新建按钮
            self._show_unowned_state(agent_data)

    def _on_create_agent(self):
        """创建新角色（从空状态）"""
        if self.selected_agent:
            self._on_create_agent_from_data(self.selected_agent)

    def _on_create_agent_from_data(self, agent_data: dict):
        """从数据创建满级角色"""
        # TODO: 实现创建满级角色的逻辑
        # 需要调用 facade 创建角色，然后刷新界面
        print(f"创建角色: {agent_data.get('name_cn')}")

        # 暂时只刷新数据
        self._load_data()
        self._show_empty_state()

    def refresh(self):
        """刷新界面"""
        self._load_data()
        self._show_empty_state()