# FastEvaluator.calculateDamageWithMultipliers 执行流程

源码位置：`web/optimizer/src/optimizer/workers/fast-evaluator.ts`

本文档描述 `FastEvaluator.calculateDamageWithMultipliers(discs)` **当前实现** 的执行步骤，以及关键变量/口径的含义。

## 输入 / 核心数据结构

- 输入：`discs: DiscData[6]`（已按位置 1..6 排好）
  - `disc.stats: Float64Array(TOTAL_PROPS)`：盘主词条+副词条汇总（不含套装效果）
  - `disc.isTargetSet: boolean`：是否为目标套装
  - `disc.setId: string`：套装 ID
  - `disc.setIdx: number`：套装索引（热路径计数用，已在 precomputed 阶段预编码）

- Worker 复用底座（在 `constructor` 里每个 worker 初始化一次）
  - `workerBaseStats = mergedStats + targetSetTwoPiece`
  - `workerMergedBuff = mergedBuff + targetSetFourPieceBuff`
  - `fixed = computeFixedMultipliers()`：抗性/等级/距离/异常暴击等固定项

- 热路径复用缓冲区
  - `accumulator: Float64Array(TOTAL_PROPS)`：每个组合复用的属性累加器（每次 eval 重置）
  - `otherSetCounts: Int8Array`：非目标套装 2pc 计数（索引为 `setIdx`）
  - `otherSetUsed: Int16Array(6)` + `otherSetUsedCount`：本组合中出现过的 setIdx 列表（最多 6 个）
  - `otherSetTwoPieceByIdx: Array<Float64Array|null>`：`setIdx -> 2pc 属性数组` 的映射（worker 初始化时构建）

## 执行步骤（按代码顺序）

### 1) 目标 4 件套门槛检查（不满足直接跳过）

- 如果存在 `targetSetId`：
  - 扫 6 个盘，统计 `disc.isTargetSet === true` 的数量
  - 若 `< 4`，直接 `return null`

### 2) 重置 accumulator 为 worker 底座

- 执行：`accumulator.set(workerBaseStats)`

此时 accumulator 的含义：
- 包含角色+武器+静态项 + 目标套装 2pc（已合在 `workerBaseStats`）
- 不包含：盘词条、普通 Buff、转换 Buff、非目标套装 2pc
- 仍是“局外三元组维度”的口径（例如 `HP_BASE/HP_/HP`、`ATK_BASE/ATK_/ATK` 等）

### 3) 累加 6 个盘属性 + 统计非目标套装数量

3.1 清空上一组合的套装计数（只清本组合用过的 setIdx）：

- 遍历 `otherSetUsed[0..otherSetUsedCount)`：
  - `otherSetCounts[setIdx] = 0`
- `otherSetUsedCount = 0`

3.2 遍历 6 个盘：

- 累加盘属性：
  - `for j in [0..TOTAL_PROPS): accumulator[j] += disc.stats[j]`

- 统计非目标套装出现次数：
  - 若 `!disc.isTargetSet`：
    - `setIdx = disc.setIdx`
    - 若 `otherSetCounts[setIdx] === 0`：将 `setIdx` 写入 `otherSetUsed[]`
    - `otherSetCounts[setIdx]++`

### 4) 应用非目标套装 2pc（out_of_combat）

- 遍历 `otherSetUsed[0..otherSetUsedCount)`：
  - 若 `otherSetCounts[setIdx] >= 2`：
    - `twoPiece = otherSetTwoPieceByIdx[setIdx]`
    - 若存在：`for j in [0..TOTAL_PROPS): accumulator[j] += twoPiece[j]`

说明：
- 目标套装 2pc 已经在步骤 2 的 `workerBaseStats` 里合过了；
- 这里仅补上“非目标套装”的 2pc。

### 5) 生成快照 1（局内基础面板，不含 Buff）

从 accumulator 的“三元组维度”计算 4 个面板值（局部变量）：

- `snapshot1Atk = ATK_BASE*(1+ATK_) + ATK`
- `snapshot1Hp  = HP_BASE*(1+HP_) + HP`
- `snapshot1Def = DEF_BASE*(1+DEF_) + DEF`
- `snapshot1Impact = IMPACT*(1+IMPACT_)`（冲击力没有 BASE）

重要约束：
- 快照值只保存在局部变量中，不写回三元组维度，避免口径混淆。

### 6) 生成快照 2（应用普通 Buff：mergedBuff + 目标 4pc buff）

6.1 普通 Buff 叠加到 accumulator（但跳过四大三元组维度）：

- 对 `i in [0..TOTAL_PROPS)`：
  - 跳过：
    - `HP_BASE/HP_/HP`
    - `ATK_BASE/ATK_/ATK`
    - `DEF_BASE/DEF_/DEF`
    - `IMPACT_/IMPACT`
  - 其余属性：`accumulator[i] += workerMergedBuff[i]`

6.2 对四大面板用快照公式应用（局部变量）：

- `snapshot2Atk = snapshot1Atk*(1 + workerMergedBuff[ATK_]) + workerMergedBuff[ATK]`
- `snapshot2Hp  = snapshot1Hp *(1 + workerMergedBuff[HP_])  + workerMergedBuff[HP]`
- `snapshot2Def = snapshot1Def*(1 + workerMergedBuff[DEF_]) + workerMergedBuff[DEF]`
- `snapshot2Impact = snapshot1Impact*(1 + workerMergedBuff[IMPACT_]) + workerMergedBuff[IMPACT]`

### 7) 生成快照 3（应用转换类 Buff；源取快照 2，不链式）

- 初始化：
  - `snapshot3Atk = snapshot2Atk`（hp/def/impact 同理）

- 对每个 `conv` in `conversionBuffs`：
  - `sourceValue = getFinalProp(conv.fromPropIdx, snapshot2Atk, snapshot2Hp, snapshot2Def, snapshot2Impact)`
    - 若来源是四大面板相关，则取快照 2 的面板值
    - 否则取 `accumulator[fromPropIdx]`
  - `effectiveValue = max(0, sourceValue - conv.threshold)`
  - `convertedValue = effectiveValue * conv.ratio`，若有 `maxValue` 则 clamp
  - 写入目标：
    - 若 `toPropIdx` 是 ATK/HP/DEF/IMPACT：加到 `snapshot3Xxx`
    - 否则：`accumulator[toPropIdx] += convertedValue`

### 8) 将“最终战斗面板值”写回 accumulator 的最终值维度

写回（用于后续乘区计算 + finalStats 导出）：

- `accumulator[ATK] = snapshot3Atk`
- `accumulator[HP]  = snapshot3Hp`
- `accumulator[DEF] = snapshot3Def`
- `accumulator[IMPACT] = snapshot3Impact`

注意：
- 三元组维度（如 `ATK_BASE/ATK_`）仍保留为局外三元组口径；
- `ATK/HP/DEF/IMPACT` 这 4 个槽位此时代表“快照3面板值”。

### 9) 防御区（defMult）

- `defRed = baseDefRed + workerMergedBuff[DEF_RED_] + accumulator[DEF_RED_]`
- `defIgn = baseDefIgn + workerMergedBuff[DEF_IGN_] + accumulator[DEF_IGN_]`
- `penRate = accumulator[PEN_]`
- `penValue = accumulator[PEN]`
- `baseDef = enemyDef * (has_corruption_shield ? 2 : 1)`
- `effectiveDef = max(0, baseDef*(1-defRed-defIgn)*(1-penRate) - penValue)`
- `defMult = levelBase / (effectiveDef + levelBase)`

### 10) 技能循环（计算“可变伤害”）

- `finalAtkAfterConv = snapshot3Atk`
- `critRate/critDmg` 从 accumulator 读取

对每个 `skillParams`：
- 计算增伤区 `dmgBonus = 1 + DMG_ + 元素增伤 + 技能标签增伤...`
- `critZone = 1 + critRate*critDmg`
- 直伤：
  - 贯穿技能：走 `SHEER_FORCE` 体系
  - 普通直伤：`finalAtkAfterConv * ratio * dmgBonus * critZone * defMult`
- 若 `anomalyBuildup > 0`：调用 `calculateAnomalyDamage(...)`
- 累加到 `totalVariableDamage`

### 11) 烈霜（星见雅）特殊处理（可选）

- 若 `specialAnomalyConfig.element === 'lieshuang'`：额外加 `calculateLieshuangDamage(...)`

### 12) 返回结果

返回（热路径）：
- `damage = totalVariableDamage`（通用乘区在 `createFullResult()` 再乘）
- `multipliers: number[6]`
- `snapshots: { snapshot1, snapshot2, snapshot3 }`（每个快照只含 `{atk,hp,def,impact}`）

## 关键口径说明

- 快照含义：
  - `snapshot1`：局内基础面板（不含 Buff）
  - `snapshot2`：应用普通 Buff 后的面板
  - `snapshot3`：应用转换 Buff 后的最终面板（worker 乘区计算使用）

- accumulator 含义：
  - 三元组维度 `*_BASE/*_/*` 保持为“局外三元组”（便于解释/调试）
  - 最终值槽位 `ATK/HP/DEF/IMPACT` 在步骤 8 被写成“快照3面板值”
