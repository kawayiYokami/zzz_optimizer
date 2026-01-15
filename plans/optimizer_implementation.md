# 驱动盘优化器实现计划

## 1. 核心逻辑与数据结构
- [ ] 定义 `OptimizationRequest` 接口（Worker 的输入数据）。
    - 目标代理人快照（基础属性，非装备 Buff）。
    - 目标技能（倍率，数值成长）。
    - 敌人快照。
    - 候选音擎列表。
    - 候选驱动盘列表（按位置分组）。
    - 约束条件（各位置主词条筛选，套装筛选，**锁定位置**）。
    - 配置（保留前 N 个结果，Worker ID/总数）。
    - **外部 Buff**（序列化的来自队友/环境的 Buff 对象）。
- [ ] 定义 `OptimizationProgress` 接口（Worker 的进度更新）。
    - 已处理数量 (processedCount)。
    - 总组合数 (totalCombinations)。
    - 当前最优解 (currentBest)（可选）。
- [ ] 定义 `OptimizationResult` 接口（Worker 的输出结果）。
    - `OptimizationBuild` 列表（音擎 ID，驱动盘 ID 列表，最终伤害）。
- [ ] 创建 `OptimizerContext` 类/工具，用于准备和序列化主线程数据，使其适应 Worker 环境。
    - 需要从 `Agent` 提取"基础属性"，这样 Worker 就不需要依赖完整的 `Agent` 类（如果它有很重的依赖）。
    - 需要提取技能倍率。

## 2. Web Worker 实现 (`src/optimizer/workers/optimization.worker.ts`)
- [ ] **架构**：直接复用 `DamageCalculatorService` 以确保与 `BattleService` 的一致性。
- [ ] 实现消息处理器。
- [ ] 在 Worker 内部实现 `Evaluator` 类。
    - 引入主源码中的 `DamageCalculatorService`, `PropertyCollection`, `ZoneCollection`。
    - 重构一个"轻量级代理人"或者简单的 `PropertyCollection` 聚合器。
    - 实现 `calculateDamage(weapon, discs)` 方法：
        1. 从角色基础属性 + 被动 Buff 开始。
        2. 加上音擎属性 + 音擎 Buff。
        3. 加上驱动盘属性。
        4. 计算套装加成（统计套装数量，应用 2件套/4件套效果）。
        5. 计算最终属性（攻击力，暴击率等）。
        6. **关键**：调用 `DamageCalculatorService.calculateDirectDamageFromRatios`（或类似方法）获取最终数值。
- [ ] 实现排列组合循环。
    - 音擎 -> 驱动盘 (位置 1-6) 的嵌套循环。
    - 应用"主词条"筛选（跳过不符合约束的位置）。
    - **优化**：在循环前预先过滤列表。
    - 维护一个最小堆（优先队列）或排序列表，用于保存"前 N 个"结果。
- [ ] 实现分块/批处理，以便上报进度。

## 3. 优化器服务 (`src/optimizer/services/optimizer.service.ts`)
- [ ] 创建 `OptimizerService` 类。
    - `initializeWorkers(count: number)`：初始化 Worker。
    - `setTarget(agent, skill, enemy, externalBuffs)`：设置目标。
    - `setInventory(weapons, discs)`：设置库存。
    - `setConstraints(slotConfig, setConfig, pinnedSlots)`：设置约束。
    - `startOptimization()`：开始优化，返回处理进度事件的 Observable/Promise。
        - 分割搜索空间（例如：将 1 号位的候选分配给不同的 Worker，或按音擎分配）。
        - 向 Worker 发送消息。
        - 处理 `onmessage` 以聚合结果并发出进度。
        - 跟踪进度。
    - `cancelOptimization()`：取消优化。
    - `getWorkerStatus()`：返回当前状态（空闲，运行中等）。
- [ ] 实现"复制队伍"逻辑：
    - 服务应该持有一个分离的 `Team` 实例或 `Agent` 实例，在应用之前不响应全局 Store 的变化。

## 4. UI 实现 (`web/optimizer/src/views/OptimizerView.vue`)
- [ ] 创建主布局。
    - 左侧面板：角色/队伍选择 & 属性预览。
    - 中间面板：配置。
        - 目标技能选择器。
        - Buff 开关。
        - 音擎池选择器（全部，已拥有，筛选）。
        - 驱动盘筛选（各位置主词条）。
    - 底部/右侧面板：结果。
        - 顶级构建列表。
        - 与当前构建的对比。
        - "应用构建"按钮。
- [ ] 连接到 `OptimizerService`。
    - 显示带预估时间的进度条。
    - 随着结果产生实时渲染（或在结束后）。
    - 位置选择器上的"锁定"图标，用于锁定当前装备。

## 5. 集成
- [ ] 在主应用中注册新的服务/视图。