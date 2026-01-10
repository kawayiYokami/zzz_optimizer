# 优化器设计文档（以现有代码为准）

本文档描述 `web/optimizer` 中“快速优化器（Fast Optimizer）”的真实数据流、数据结构与职责边界。

目标：让阅读者不需要猜测，就能回答这些问题：
- 优化器到底在算什么？（期望伤害/贡献口径）
- “预计算”到底预计算了哪些？哪些绝不能预计算？
- `mergedStats` 是什么？为什么 UI 上叫“最终属性”会误导？
- Buff/套装/转换在优化器里如何处理？哪些地方最容易混淆/出错？

本文档以“现状实现”为主，并在需要时用“规则/约束/注意事项”的方式说明为什么要这样做，便于对照实现与规则是否一致。

---

## 1. 范围与约束

### 1.1 目标

快速优化器的目标是：在非常大的驱动盘组合空间内（6 槽位的组合）快速找到 TopN 结果，核心手段是：
- 把“与驱动盘组合无关”的内容尽可能在主线程预处理成 `PrecomputedData`
- Worker 内用 `Float64Array` 做累加与计算，避免对象创建、Map 查找、频繁分配

对应代码入口：
- 预计算/组装请求：`web/optimizer/src/optimizer/services/optimizer-context.ts` `OptimizerContext.buildFastRequest`
- Worker：`web/optimizer/src/optimizer/workers/fast-optimization.worker.ts`
- 热路径计算：`web/optimizer/src/optimizer/workers/fast-evaluator.ts`

### 1.2 不可破坏的性能约束（热路径）

Worker 的组合遍历循环（多重 for）是绝对热路径：
- 不能在热路径创建对象（包括 Map/数组临时对象、字符串拼接）
- 不能做复杂逻辑判断（大量分支/深层函数调用）
- 尽量用预先计算好的常量与数组索引

因此“预计算”的核心价值是：把复杂对象模型（Agent/Buff/DriveDisk/WEngine）转换为可序列化、可快速访问的数据。

---

## 2. 时序：点下“开始优化”之后发生什么

### 2.1 UI → 优化器服务（OptimizerService）

入口：`web/optimizer/src/optimizer/services/optimizer.service.ts`

当 UI 触发“开始优化”（快速模式）时，会调用：
- `OptimizerService.startFastOptimization(options)`

`options` 包含（与 UI 面板/表单绑定）：
- `agent / weapon / enemy / discs`
- `skills`（技能倍率/积蓄等；用于计算目标技能的伤害贡献口径）
- `constraints`（目标套装、主词条过滤、锁定槽位、剪枝配置等）
- `externalBuffs`（队友等外部 buff）
- `buffStatusMap`（优化器面板的 buff 开关，用于过滤/启用）

### 2.2 调度器：预处理并生成 baseRequest（OptimizerContext）

调度器职责：把运行时对象（Agent/Buff/DriveDisk/WEngine/Enemy）转换成 Worker 友好的 `PrecomputedData`。

入口：
- `OptimizerContext.buildFastRequest(...)`：`web/optimizer/src/optimizer/services/optimizer-context.ts`

输出：
- `baseRequest: FastOptimizationRequest`（注意：此时 `workerId/totalWorkers` 还未填）

### 2.3 计算总组合数（用于进度分母）

`OptimizerService.startFastOptimization` 在创建 `baseRequest` 后，会计算全量组合数：
- `this.totalCombinations = calculateFastTotalCombinations(baseRequest)`

实现：
- `OptimizerService.calculateFastTotalCombinations(request)`：把 6 个槽位的候选盘数量相乘。

注意：
- 这里的“全量组合数”不考虑目标套装 >=4 的过滤（过滤发生在 Worker 内部）。

### 2.4 分发：对每个 Worker 构造 workerRequest 并 postMessage

`OptimizerService.startFastOptimization` 会对每个 worker 构造请求：

```
workerRequest = {
  ...baseRequest,
  workerId: i,
  totalWorkers: workerCount,
  estimatedTotal: options.estimatedTotal
}
worker.postMessage(workerRequest)
```

此处的关键点是：
- 所有 worker 共享同一份 `precomputed`（同一个 baseRequest 复制出来）
- 仅靠 `workerId/totalWorkers` 来切片组合空间

### 2.5 Worker：执行组合遍历与 TopN

主线程会构建一个 `FastOptimizationRequest`，核心字段是 `precomputed`：
- `FastOptimizationRequest`：`web/optimizer/src/optimizer/types/precomputed.ts`
- `PrecomputedData`：同文件

Worker 接收后：
- 创建 `FastEvaluator(precomputed)`
- 遍历 `discsBySlot` 的组合（会按 workerId 做切片）
- 对每个组合调用 `evaluator.calculateDamageWithMultipliers(discArray)`
- 用 TopN 最小堆保存结果

主线程会构建一个 `FastOptimizationRequest`，核心字段是 `precomputed`：
- `FastOptimizationRequest`：`web/optimizer/src/optimizer/types/precomputed.ts`
- `PrecomputedData`：同文件

Worker 接收后：
- 创建 `FastEvaluator(precomputed)`
- 遍历 `discsBySlot` 的组合
- 对每个组合调用 `evaluator.calculateDamageWithMultipliers(discArray)`
- 用 TopN 最小堆保存结果

#### 2.1.1 多 Worker 切片算法（现有实现）

当前 Worker 的“组合空间切片”不是对全量组合做线性索引取模，而是对 **第 1 层循环（slot0）做区间切片**：

- 代码：`web/optimizer/src/optimizer/workers/fast-optimization.worker.ts`
- 关键变量：
  - `slot0Count = discsBySlot[0].length`
  - `workerId`：当前 worker 的编号（从 0 开始）
  - `totalWorkers`：worker 总数

切片公式（整数下取整）：

```
startIdx = floor(slot0Count * workerId / totalWorkers)
endIdx   = floor(slot0Count * (workerId + 1) / totalWorkers)
```

每个 worker 只遍历：

```
for i0 in [startIdx, endIdx)
  for i1 in [0, slot1Count)
    for i2 in [0, slot2Count)
      ...
```

性质：
- 每个 `i0` 只会被一个 worker 覆盖（区间不重叠），因此每个组合也只会被一个 worker 处理一次。
- 负载均衡的前提是：各 `i0` 下的内部组合数是均匀的（在本实现里每个 i0 的内部组合数都相同：`slot1Count*...*slot5Count`），所以按 slot0 均分是成立的。
- 缺点/注意点：如果未来引入“按 i0 的不同而变化的内部过滤/剪枝”导致不同 i0 的实际工作量差异很大，这种切片会产生 worker 间负载不均。

与“全量组合数”的关系：
- Worker 内部仍会计算 `totalCombinations = Π(slotKCount)` 用于进度/估时显示；
- 但单个 worker 实际负责的组合数约为：

```
(endIdx - startIdx) * slot1Count * slot2Count * slot3Count * slot4Count * slot5Count
```

对应代码：
- `web/optimizer/src/optimizer/workers/fast-optimization.worker.ts`

### 2.6 Worker 内：组合计算的核心流程（FastEvaluator）

`FastEvaluator.calculateDamageWithMultipliers(discs)` 的核心流程（按代码结构）：
1) 可选：检查目标套装数量是否 >=4（不满足则组合直接跳过）
2) `accumulator.set(mergedStats)`：把预计算底座复制到累加器
3) 累加 6 张盘的 `disc.stats`，并统计非目标套装的 set count
4) 应用非目标套装的 2 件套（从 `otherSetTwoPiece` 取）
5) 应用转换类 buff（`conversionBuffs`，在每个组合上运行时应用）
6) 用固定乘区 + 可变乘区计算直伤/异常/紊乱/特殊异常，并汇总

对应代码：
- `web/optimizer/src/optimizer/workers/fast-evaluator.ts`

---

## 3. 关键数据结构（PrecomputedData / 调度器输出）

### 3.1 `PrecomputedData.mergedStats`

类型：`Float64Array`

用途（现状）：
- Worker 每个组合计算时把它当作“可复用底座”复制到 `accumulator` 的初始值

注意：
- 这不是“最终属性”，也不是文档意义的“快照3最终战斗属性”。
- 它是优化器内部的“预计算底座”，后续还会叠加：盘词条、2 件套、转换等。

当前 UI 调试面板已将其命名为：
- “预计算底座属性（不含驱动盘）”

相关实现：
- `OptimizerContext.buildFastRequest` 创建并填充 `mergedStats`
- `FastEvaluator` 在每个组合开始时把 `mergedStats` 复制到 `accumulator`

#### 3.1.1 `mergedStats` 的设计口径（应然）

`mergedStats` 在设计上应当是“静态底座”，只允许包含 **局外静态属性**：

- 角色基础属性（局外）：`agent.getCharacterBaseStats().out_of_combat`
- 武器基础属性（局外）：`weapon.getBaseStats().out_of_combat`
- 目标 2 件套属性（局外静态属性）：`targetSetDisc.getSetBuff(TWO_PIECE).out_of_combat`

明确禁止（应然约束）：
- 禁止把任何 `in_combat` 合入 `mergedStats`（静态底座不可能有局内属性）
- 禁止把 4 件套属性/4 件套 Buff 预合并为静态（4 件套属于局内触发态）
- 禁止把普通 Buff 预合并为静态（普通 Buff 属于局内）
- 禁止把转换 Buff 的“结果”预合并为静态（转换依赖最终属性）

实现方式建议（与口径匹配）：
- 先把上述来源合并成一个 `PropertyCollection`（只操作 out_of_combat）
- 最后一次性把 `out_of_combat` 写入 Float64Array：

```ts
for (const [prop, value] of merged.out_of_combat.entries()) {
  addToPropArray(mergedStats, prop, value);
}
```

#### 3.1.2 `mergedStats` 的当前实现（代码即文档）

代码位置：`web/optimizer/src/optimizer/services/optimizer-context.ts`，`OptimizerContext.buildFastRequest(...)`

当前版本（以代码为准）`mergedStats` 的构建规则：

- 仅合并 `out_of_combat`：
  - 角色基础：`agent.getCharacterBaseStats().out_of_combat`
  - 武器基础：`weapon.getBaseStats().out_of_combat`
  - 目标套装 2 件套：`targetSetDisc.getSetBuff(TWO_PIECE).out_of_combat`
- 不合并任何 `in_combat`
- 不预合并 4 件套属性/4 件套 Buff
- 不预合并普通 Buff（普通 Buff 仅用于开关过滤；转换类 buff 仅做规则预处理进入 `conversionBuffs`）
- `otherSetTwoPiece[setId]` 仅包含该套装 2 件套的 `out_of_combat`

对应实现位置：
- `web/optimizer/src/optimizer/services/optimizer-context.ts`：`OptimizerContext.buildFastRequest`

---

（此处仅维护现状。）

#### 3.1.3 `mergedStats` 在 Worker 端的使用方式（每组合的底座拷贝）

代码位置：`web/optimizer/src/optimizer/workers/fast-evaluator.ts`

每个组合开始计算时，FastEvaluator 会执行：

```
this.accumulator.set(mergedStats);
```

语义：
- `accumulator` 是可复用的 `Float64Array`（避免分配）
- `.set(mergedStats)` 是一次性内存拷贝，把预计算底座复制到累加器
- 后续每个组合都在 `accumulator` 上“就地累加”盘词条、2 件套、转换等

这一步是性能关键点：
- 使得“每个组合”无需从 0 构建属性，只需从 `mergedStats` 起步做增量。

### 3.2 `PrecomputedData.discsBySlot`

类型：`DiscData[][]`（按 6 个槽位分组）

每个 `DiscData` 包含：
- `stats: Float64Array`：盘的词条（主+副），不含套装效果
- `effectiveScore: number`：用于剪枝/排序的分数
- `setId / isTargetSet`：用于套装判断

Worker 遍历组合时，核心就是从每个 slot 选一个 disc。

### 3.3 `PrecomputedData.otherSetTwoPiece`

类型：`Record<string, Float64Array>`

用途：
- 当某个“非目标套装”在组合中出现 >=2 件时，FastEvaluator 会把该套装的 2 件套属性数组累加进 `accumulator`。

### 3.4 `PrecomputedData.conversionBuffs`

类型：`ConversionBuffData[]`

语义（必须明确）：
- 这是“转换规则的预处理”（索引化/数值化），不是把转换结果提前算进 `mergedStats`。
- 转换计算依赖转换源属性的最终值，因此必须在每个组合上运行时应用。

### 3.5 `PrecomputedData.fixedMultipliers`

类型：`FixedMultipliers`

用途：
- 预计算“与盘无关”的乘区（抗性区、承伤区、失衡易伤区、等级区等）
- 减少热路径上的计算

---

## 4. Buff 在优化器里的处理口径（现状）

这里是最容易发生“静态/局内、Buff/属性、转换/普通”混淆的地方。

### 4.1 Buff 的数据结构（运行时对象）

`Buff`（运行时模型）常见字段：
- `out_of_combat_stats?: Map<PropertyType, number>`
- `in_combat_stats?: Map<PropertyType, number>`
- `conversion?: { from_property, to_property, conversion_ratio, ... }`
- `is_active` + `trigger_conditions` 等

### 4.2 Buff 的开关过滤（buffStatusMap）

优化器面板上的“Buff 开关”会通过 `buffStatusMap` 传入 `buildFastRequest`。

在 `OptimizerContext.buildFastRequest` 内：
- 遍历 `allBuffs`
- 对每个 buff 读取 `buffStatusMap.get(buff.id)?.isActive` 决定是否纳入

因此：**优化器“实际使用的 buff 集合”应以 `buildFastRequest` 内的过滤结果为准**。

补充说明（分工口径）：
- UI 负责“是否应该出现在开关列表里”的筛选（例如：前台/后台、target、自身/队友适用范围等）。
- 调度器不再重复做这类语义过滤，只按 `buffStatusMap` 做启用/禁用。
- 这样可以保证：优化器的输入口径以 UI 为唯一来源，避免“UI 一套过滤、调度器又一套过滤”导致口径分叉。

### 4.2.1 Agent.getAllBuffs 的“隐式注入”与优化器口径

`Agent.getAllBuffs()/getAllBuffsSync()` 在默认行为下会隐式追加：
- 音擎 Buff（通过 `wengine.getActiveBuffs()`）
- 已装备驱动盘的 4 件套 Buff（通过统计 `equipped_drive_disks` 的套装数量并注入 `disk.set_buffs`）

这在“角色面板/战斗模拟”语境下可能合理，但在优化器/调度器语境下会造成输入混淆：
- 优化器会把“装备态 4 件套 Buff”当作可复用输入，从而污染 `mergedStats` 或导致 Buff 双计。

因此当前调度器实现改为显式关闭 4 件套注入：

```ts
agent.getAllBuffsSync({
  includeWengineBuffs: true,
  includeDriveDisk4pcBuffs: false,
})
```

并且不再从 `weapon.getActiveBuffs()` 单独拉取，避免武器 Buff 双计。

### 4.3 普通 Buff vs 转换 Buff

优化器口径按 `docs/damage_system.md` 的快照链条拆分为三层输入：

- `mergedStats`：局外静态属性底座（不含驱动盘组合、也不含任何 Buff）
  - 只允许包含：角色白值 + 音擎静态属性 + 目标两件套静态属性
- `mergedBuff`：普通 Buff 的合并结果（只参与快照2，不可写入 `mergedStats`）
  - 只允许包含：所有启用的普通 Buff 的 `in_combat_stats` 叠加后的结果
- `conversionBuffs`：转换 Buff 规则列表（只参与快照3；源属性取快照2，不链式）

因此：
- “普通 Buff”不能预合并进 `mergedStats`，必须单独合并为 `mergedBuff` 并在 Worker 内应用
- “转换 Buff”也不能预合并为数值，只能预处理为规则并在 Worker 内运行时计算

### 4.4 套装（2 件套 vs 4 件套）

在伤害系统文档中（`docs/damage_system.md`）的口径是：
- 2 件套：静态属性（更接近“局外/静态”）
- 4 件套：局内 Buff（触发态）

而在当前优化器实现里，存在“目标套装 2+4 预合并”的逻辑（详见 `OptimizerContext.buildFastRequest` 的目标套装预合并部分）。

注意事项：
- 如果把“需要触发的 4 件套 buff”当作静态直接预合并，会导致数值偏差
- 但如果优化器本身把“4 件套作为默认常驻触发”作为简化假设，也必须在文档/注释明确，否则会被误读为 bug

---

## 5. 异常/紊乱的口径（优化器口径）

优化器把“异常伤害倍率”和“紊乱伤害倍率”视为与“技能倍率”同级的 **固定倍率输入**：
- 倍率只依赖异常类型与时间参数（以及默认持续时间参数），与本次驱动盘组合无关
- 因此可以在主线程预计算为常量后下发给 Worker，避免在热路径重复做 tick 离散化与表公式计算

建议在 `PrecomputedData` 中以两个字段表达：
- `anomalyTotalRatioAtT`：异常在固定时间点/窗口 `T` 下的总倍率（已离散化 tick；一次型异常直接使用一次倍率）
- `disorderTotalRatioAtT`：紊乱在同一 `T` 下的一次性总倍率（按表公式用 `T` 计算得到）

Worker 的职责应当是：
- 计算异常触发期望（`clamp01(accumulate / threshold)`）
- 把上述倍率乘以异常适用乘区，得到“异常伤害贡献/紊乱伤害贡献”

---

## 6. 调试面板（必须与优化器同源）

调试面板的意义应该是：
- 展示“优化器真实使用的输入（mergedStats / buffs / conversionBuffs / fixedMultipliers）”
- 展示“FastEvaluator 的真实输出（accumulator / multipliers / damage breakdown）”

一旦调试面板自己去 `agent.getAllBuffsSync()`/`weapon.getActiveBuffs()` 再组一份 buff 列表，就会分叉为另一条链路，导致：
- 面板显示正确但优化器仍错
- 或面板显示错但优化器其实对

因此应当让 `OptimizerContext.buildFastRequest`（唯一真相）直接返回 debug 信息，供面板展示。

---

## 7. 注意事项清单（便于对照实现）

以下项目属于“容易误解/容易写错”的点，建议在实现与评审时重点核对：

1) Buff 来源重复/混淆风险
   - `Agent.getAllBuffsSync()` 会追加武器 Buff 和驱动盘 4 件套 Buff（见 `agent.ts`）。
   - 如果在优化器里又单独从 `weapon.getActiveBuffs()` 拉一次，会重复。

2) “优化器面板的 Buff 开关”与 “Agent 内部自动注入的 4 件套 Buff”
   - 如果开关系统把 4 件套也作为可开关项，但优化器预计算又把目标 4 件套静态合入，可能出现“双计/难以解释”的现象。

3) teammateConversionBuffs 直接算结果合入 mergedStats 的前提非常强
   - 只有当 teammateStats 真的是“不会随本次组合变化的固定快照”时才成立。
   - 否则这一步会把依赖关系提前固定，导致错误。

4) 目标套装“2+4 预合并”与文档口径冲突
   - 如果 4 件套在本项目视为“局内触发态 Buff”，则不应当无条件预合并为静态属性。
   - 如果优化器为了性能/简化确实要把 4 件套当常驻，则必须将其作为“优化器假设”写清楚，并在 UI 上标注。

5) 异常/紊乱的统一口径
   - fast-evaluator 与 battle.service 的紊乱倍率实现目前不一致（简化 vs 表公式）。
   - 需要明确“优化器使用哪种口径”（否则无法解释差异）。

---

## 8. 对照检查建议

你可以按以下顺序对照检查：
1) 先确立：优化器是否把 4 件套视为“常驻触发”还是“可开关触发态”
2) 再检查：`mergedStats` 到底应包含哪些来源（严格列清单）
3) 再检查：普通 buff 合并与开关过滤是否只在一个地方发生（唯一真相）
4) 最后再收敛：异常/紊乱的口径是“简化”还是“精确”
