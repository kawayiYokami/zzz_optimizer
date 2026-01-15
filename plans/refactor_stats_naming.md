# 属性快照机制重命名重构计划 (修正版 v2)

## 1. 核心目标
重构 `PropertyCollection` 类，使其明确区分“数据源容器”和“业务快照对象”两个概念，准确表达游戏中的“战斗锁定机制”。

**核心理念：**
1.  **数据层**：保留 `out_of_combat` (局外词条) 和 `in_combat` (局内词条) 的原始命名，因为它们准确描述了**数据来源**（是来自装备/被动，还是来自战斗Buff）。
2.  **业务层**：显式引入两个快照对象，分别命名为 **`TownStats` (城镇面板)** 和 **`BattleStats` (战斗面板)**。

## 2. 现有问题
当前的 `PropertyCollection` 混淆了“数据存储”和“状态计算”。AI 无法理解 `toCombatStats()` 方法实际上是一次**不可逆的快照结算**。

## 3. 重构方案

### A. 引入明确的快照类型定义 (Type Definition)

不再依赖通用的 `PropertyCollection` 来模糊表达，而是定义两个明确的接口/类型：

```typescript
// 1. 城镇面板（进图前的状态）
// 对应游戏逻辑：此时可以随意更换装备，面板实时变化
interface TownStats extends PropertyCollection {
  // 特征：out_of_combat 包含大量数据，in_combat 为空
}

// 2. 战斗面板（进图后的快照）
// 对应游戏逻辑：out_of_combat 已经被结算并锁定，成为了 battle_base
interface BattleStats extends PropertyCollection {
  // 特征：
  // - base: 结算后的锁定白值 (来自 TownStats 的计算结果)
  // - in_combat: 战斗中新增的 Buff 词条 (4件套, 技能Buff)
}
```

### B. 重命名计算方法 (Method Renaming)

将 `toCombatStats` 和 `toFinalStats` 改名为更具业务含义的名称：

| 原方法名 | 新方法名 | 语义解释 |
|---|---|---|
| `toCombatStats()` | **`computeBattleBase()`** | **结算/锁定**：将局外词条结算为战斗内的**不可变基准值 (Base)**。这是进图瞬间发生的快照动作。 |
| `toFinalStats()` | **`computeFinalStats()`** | **实时计算**：基于锁定的 Base，加上实时变动的 Buff，计算当前最终面板。 |

### C. 显式区分修饰符容器 (Modifier Containers)

在 `PropertyCollection` 内部，将属性存储容器改名，以区分“静态修饰符”和“动态修饰符”：

- `out_of_combat` -> **`static_modifiers`** (静态修饰符/局外词条)
  - 来源：角色成长、音擎、驱动盘2件套+副词条
  - 特性：进图即锁定，成为计算 Base 的原料。

- `in_combat` -> **`dynamic_modifiers`** (动态修饰符/局内词条)
  - 来源：驱动盘4件套、技能Buff、深渊Buff
  - 特性：战斗中实时增减，直接作用于 Base。

## 4. 执行步骤

### 第一阶段：内部字段重构 (Internal Refactor)
1.  修改 `PropertyCollection.ts`:
    - 将 `out_of_combat` 标记为 `@deprecated`，新增 `static_modifiers` 指向它。
    - 将 `in_combat` 标记为 `@deprecated`，新增 `dynamic_modifiers` 指向它。
    - 逐步替换内部实现。

### 第二阶段：方法语义化 (Semantic Methods)
1.  在 `PropertyCollection` 中新增 `computeBattleBase()` 方法（逻辑同 `toCombatStats`）。
2.  在 `PropertyCollection` 中新增 `computeFinalStats()` 方法（逻辑同 `toFinalStats`）。
3.  更新 `Agent.ts` 和 `BattleService.ts` 使用新方法。

### 第三阶段：AI 提示词规范 (System Prompt)
在项目文档中明确：
> "Panel Calculation Flow: 
> 1. **Static Modifiers** (Gear/Town) -> `computeBattleBase()` -> **Locked Battle Base**
> 2. **Locked Battle Base** + **Dynamic Modifiers** (Buffs) -> `computeFinalStats()` -> **Real-time Stats**"

## 5. 预期效果
AI 将不再困惑于“局内属性为什么不是 Buff”，因为它会看到 `dynamic_modifiers` 这个名字，明确知道这是动态叠加的 Buff。同时，`computeBattleBase` 的命名清楚地表明了这是一个“计算基准值”的过程，隐含了“锁定”的意味。