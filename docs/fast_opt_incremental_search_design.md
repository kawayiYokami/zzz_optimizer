# 快速优化器：增量枚举设计方案（完整）

本文档给出一个“完整但不写细节代码”的设计方案，用于将当前快速优化器从“每个组合全量重算”
升级为“按槽位增量更新 + 回滚”的枚举方式，以显著降低热路径的重复计算。

相关代码入口：
- Worker：`web/optimizer/src/optimizer/workers/fast-optimization.worker.ts`
- 评估器：`web/optimizer/src/optimizer/workers/fast-evaluator.ts`
- 预计算：`web/optimizer/src/optimizer/services/optimizer-context.ts`
- 类型：`web/optimizer/src/optimizer/types/precomputed.ts`

## 1. 背景与问题

当前枚举方式为 6 重循环（slot0..slot5），在每个叶子组合上调用：
- `FastEvaluator.calculateDamageWithMultipliers(discs)`

该函数内部会在每个组合上执行一套“从头构建状态”的流程，例如：
- `accumulator.set(workerBaseStats)`
- 叠加 6 张盘 `stats`
- 统计并应用非目标套装 2pc
- 应用普通 Buff / 转换 Buff
- 技能循环计算伤害

虽然在枚举时“内层只换了一张盘”，但依然会重复做前 1..5 张盘的加法和套装计数。
在组合数量达到 1e8 量级时，这部分重复会成为主要瓶颈。

## 2. 目标

1) 将“每个叶子组合全量重算”的逻辑，替换为“进入/退出一层槽位时做增量更新与回滚”。
2) 结果口径保持一致：同一输入下 TopN 结果应与现有实现一致（允许浮点微小误差）。
3) 剪枝逻辑保持一致（effectiveScore 的上界剪枝 + TopN 阈值剪枝）。
4) 为进一步性能优化留接口（例如：懒加载 fullResult、减少 finalStats 拷贝等）。

## 3. 核心思想：DFS/显式栈枚举 + 状态可回滚

将“枚举组合”抽象为深度为 6 的搜索树：
- depth=0 选 slot0 的某一张盘
- depth=1 选 slot1 的某一张盘
- ...
- depth=5 选 slot5 的某一张盘（叶子）

每进入一层（选择一个盘）：
- 将该盘对状态的影响 **增量叠加** 到共享状态

每退出一层（换下一张盘前）：
- 将该盘对状态的影响 **回滚**（撤销叠加）

这样，当只更换 slot5 的盘时：
- 只做 “+disc5 -> 计算 -> -disc5”
- 不再重复做前 0..4 的盘加法与套装判断

枚举的实现形式可以是：
- 递归 DFS（代码更直观）
- 显式栈/状态机（通常更快，但实现更复杂）

本方案优先保证正确性与可维护性：先实现 DFS 版本，通过 profile 验证收益后再决定是否转为显式栈。

## 4. 状态定义（必须可回滚）

以下状态在一次 worker 运行期间复用（每次“组合叶子评估”都共享同一份状态）：

### 4.1 属性累加器：accumulator

- `accumulator: Float64Array(TOTAL_PROPS)`
- 初始值：在开始枚举前执行一次
  - `accumulator = workerBaseStats`（等价于 `accumulator.set(workerBaseStats)`）
- 增量更新：
  - 进入一层时：`accumulator += disc.stats`
  - 退出一层时：`accumulator -= disc.stats`

注意：
- accumulator 的三元组维度（ATK_BASE/ATK_/ATK 等）仍属于“局外三元组口径”。
- 最终面板（快照3的 ATK/HP/DEF/IMPACT）可在叶子评估阶段写回其最终值槽位（与当前一致）。

### 4.2 套装计数与 2pc 应用：otherSetCounts + 2pc 差分回滚

目标：非目标套装 2pc 的属性加成应当只在 count>=2 时生效，且可回滚。

状态：
- `otherSetCounts[setIdx]: Int8`（仅统计非目标套装）
- `twoPieceByIdx[setIdx]: Float64Array|null`（2pc 属性数组映射）

增量更新规则（进入一层 add disc）：
- 若 `disc.isTargetSet`：不计入非目标计数
- 否则：
  - `c0 = otherSetCounts[setIdx]`
  - `c1 = c0 + 1`
  - `otherSetCounts[setIdx] = c1`
  - 若 `c0 == 1 && c1 == 2`：触发 2pc
    - `accumulator += twoPieceByIdx[setIdx]`（若存在）

回滚规则（退出一层 remove disc）：
- 若 `disc.isTargetSet`：不计入非目标计数
- 否则：
  - `c1 = otherSetCounts[setIdx]`
  - `c0 = c1 - 1`
  - `otherSetCounts[setIdx] = c0`
  - 若 `c1 == 2 && c0 == 1`：取消 2pc
    - `accumulator -= twoPieceByIdx[setIdx]`（若存在）

这样可以完全消除“叶子组合时再遍历 otherSetUsed 并统一加 2pc”的步骤。

### 4.3 目标套装计数：targetSetCount

用于目标 4pc 门槛（>=4）判断。

状态：
- `targetSetCount: number`

增量更新：
- 进入一层：若 `disc.isTargetSet` 则 `targetSetCount++`
- 退出一层：若 `disc.isTargetSet` 则 `targetSetCount--`

叶子判断：
- depth==6 时，若 `targetSetId` 存在且 `targetSetCount < 4`，则跳过评估。

可选增强（中途剪枝）：
- 若剩余槽位全部选目标套装也无法达到 4，则可在中途提前剪枝。

### 4.4 剪枝分数：effectiveScore 的前缀和

用于保留当前剪枝策略（上界剪枝）。

状态：
- `scorePrefix[depth]: number` 或 `currentScore: number`

增量更新：
- add disc：`currentScore += disc.effectiveScore`
- remove disc：`currentScore -= disc.effectiveScore`

上界判断：
- 在进入下一层前，使用 “当前分数 + 剩余槽位最大可能分数上界” 与阈值比较，决定是否剪枝。

## 5. 叶子评估：从“全量重算”拆为“基于状态评估”

为了让 DFS 增量枚举真正生效，需要把评估器拆分为两类职责：

1) 状态构建（盘 + 2pc + 计数）应在 worker 的 DFS 中完成
2) 伤害评估只读取当前状态（accumulator + 固定项 + buffs + conversions + skills）

### 5.1 评估器接口设计（概念）

- `beginSearch()`：初始化一次
  - `accumulator.set(workerBaseStats)`
  - `clearCounts()`
  - `targetSetCount = 0`

- `pushDisc(slot: number, disc: DiscData)`：
  - `accumulator += disc.stats`
  - `update 2pc counts + apply/remove 2pc delta (if crossing 1<->2)`
  - `update targetSetCount`

- `popDisc(slot: number, disc: DiscData)`：
  - `accumulator -= disc.stats`
  - `update 2pc counts + apply/remove 2pc delta (if crossing 2<->1)`
  - `update targetSetCount`

- `evaluateLeaf()`：
  - 若目标套装门槛不满足，返回 null
  - 基于 accumulator 计算 snapshot1/snapshot2/snapshot3
  - 应用 workerMergedBuff（普通 buff）与 conversionBuffs（转换 buff）
  - 技能循环算出 damage + multipliers (+ snapshots)

### 5.2 snapshot/buff/conversion 的口径保持不变

叶子评估阶段的 snapshot 逻辑与当前一致：
- snapshot1：从 accumulator 的三元组维度计算（不含 buff）
- snapshot2：应用普通 buff（workerMergedBuff）
- snapshot3：应用转换 buff（conversionBuffs，源取 snapshot2）
- 在评估时将 snapshot3 的 ATK/HP/DEF/IMPACT 写回 accumulator 的最终值槽位

注意：
- 任何“会随盘变化”的东西必须在叶子评估阶段使用 accumulator 的当前值计算，不能提前固化。

## 6. TopN 维护与最终输出

TopN 维护策略不变：
- 热路径只维护最小堆，存入：
  - `damage`
  - `discIndices[6]`
  - `multipliers[6]`

最终输出（TopN -> full build）：
- 仍可用 `createFullResult(discs, ...)` 重新跑一次，用于生成：
  - `finalStats`（完整 Float64Array 快照）
  - `breakdown` / `setInfo` 等 UI 需要的丰富信息

未来可选优化（不属于本次方案必须实现）：
- lazy-eval：列表阶段只输出简版，点击某 build 再 `eval` 单次生成 fullResult

## 7. 并行 Worker 与消息协议

并行策略不变：
- 主线程把 `FastOptimizationRequest` 广播到 N 个 worker
- 每个 worker 负责其 stride（组合空间划分）

增量枚举引入后，“stride” 的实现方式需要重新定义：
- 方案 A：仍使用“线性索引 -> 组合解码”的方式分片（实现较复杂）
- 方案 B：保留原 6 重循环的分片策略，只在每个 worker 内部把“叶子评估”改为增量（实现简单）

推荐方案 B：
- 仍由 worker 控制 slot0..slot5 的循环边界/步长
- 但在每一层循环进入/退出时调用 push/pop，避免每次叶子都从头构建 accumulator

## 8. 复杂度与预期收益

当前实现每个组合的核心成本：
- 盘累加：6 * TOTAL_PROPS 的加法
- 2pc：额外的套装统计/应用

增量枚举后：
- 盘累加变成“每次只对发生变化的那一层做一次 add/sub”
- 对 slot5 的连续变化，slot0..slot4 的加法不再重复

预期收益取决于 TOTAL_PROPS 与技能循环成本占比，但通常能显著降低热路径常数。

## 9. 正确性校验（设计级）

为确保增量实现不引入口径偏差，建议的验证方式：
- 对固定一组 discs（以及若干随机组合）：
  - 旧实现 `calculateDamageWithMultipliers(discs)`
  - 新实现 “beginSearch + push 6 discs + evaluateLeaf”
  - 对比：
    - damage
    - multipliers
    - snapshots（若需要）
    - finalStats（若写回一致）

并确保：
- 2pc 在 count 从 1->2 / 2->1 时的 add/sub 行为严格匹配。

