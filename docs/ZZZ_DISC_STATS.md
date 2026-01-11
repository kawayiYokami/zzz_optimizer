# 绝区零驱动盘词条数值完整指南

## 目录
1. [驱动盘基础信息](#驱动盘基础信息)
2. [主词条数值](#主词条数值)
3. [副词条数值](#副词条数值)
4. [副词条强化机制](#副词条强化机制)
5. [套装效果](#套装效果)
6. [槽位限制](#槽位限制)
7. [等级计算公式](#等级计算公式)
8. [实用计算示例](#实用计算示例)
9. [属性键名映射](#属性键名映射)

---

## 驱动盘基础信息

### 稀有度分类

| 稀有度代码 | 最大等级 | 副词条数量 | 副词条强化上限 |
|------------|----------|------------|----------------|
| B          | 9        | 4条        | 5次            |
| A          | 12       | 4条        | 5次            |
| S          | 15       | 4条        | 5次            |

### 槽位说明

| 槽位 | 位置   | 主词条类型               |
|------|--------|--------------------------|
| 1    | 生命位 | 生命值为主               |
| 2    | 攻击位 | 攻击力为主               |
| 3    | 防御位 | 防御力为主               |
| 4    | 暴击位 | 暴击相关属性             |
| 5    | 伤害位 | 伤害/穿透相关属性        |
| 6    | 异常位 | 异常/冲击/能量相关属性   |

---

## 主词条数值

### 主词条数值表（满级）

| 主词条类型           | B级 (9级) | A级 (12级) | S级 (15级) |
|----------------------|-----------|------------|------------|
| **百分比属性**       |           |            |            |
| 攻击力%              | 10%       | 20%        | 30%        |
| 生命值%              | 10%       | 20%        | 30%        |
| 防御力%              | 16%       | 32%        | 48%        |
| 暴击率%              | 8%        | 16%        | 24%        |
| 暴击伤害%            | 16%       | 32%        | 48%        |
| 穿透率%              | 8%        | 16%        | 24%        |
| 元素伤害%            | 10%       | 20%        | 30%        |
| 异常精通%            | 10%       | 20%        | 30%        |
| 冲击力%              | 6%        | 12%        | 18%        |
| 能量恢复%            | 20%       | 40%        | 60%        |
| **数值属性**         |           |            |            |
| 生命值               | 734       | 1468       | 2200       |
| 攻击力               | 104       | 212        | 316        |
| 防御力               | 60        | 124        | 184        |
| 异常掌控             | 32        | 60         | 92         |

### 元素伤害类型映射

所有元素伤害%的满级数值相同：

| 元素   | 伤害类型键名       | B级 | A级 | S级 |
|--------|--------------------|-----|-----|-----|
| 火     | fire_dmg_          | 10% | 20% | 30% |
| 冰     | ice_dmg_           | 10% | 20% | 30% |
| 电     | electric_dmg_      | 10% | 20% | 30% |
| 物理   | physical_dmg_      | 10% | 20% | 30% |
| 以太   | ether_dmg_         | 10% | 20% | 30% |

---

## 副词条数值

### 副词条基础数值表（每次强化）

| 副词条类型           | B级每次 | A级每次 | S级每次 |
|---------------------|---------|---------|---------|
| **数值属性**        |         |         |         |
| 生命值              | 39      | 79      | 112     |
| 攻击力              | 7       | 15      | 19      |
| 防御力              | 5       | 10      | 15      |
| 穿透值              | 3       | 6       | 9       |
| 异常掌控            | 3       | 6       | 9       |
| **百分比属性**      |         |         |         |
| 生命值%             | 1%      | 2%      | 3%      |
| 攻击力%             | 1%      | 2%      | 3%      |
| 防御力%             | 1.6%    | 3.2%    | 4.8%    |
| 暴击率%             | 0.8%    | 1.6%    | 2.4%    |
| 暴击伤害%           | 1.6%    | 3.2%    | 4.8%    |

---

## 副词条强化机制

### 强化次数规则

| 稀有度 | 初始副词条数 | 强化后副词条数 | 额外强化次数范围 |
|--------|-------------|----------------|-----------------|
| B      | 4条         | 4条            | 0-1次           |
| A      | 4条         | 4条            | 0-1次           |
| S      | 4条         | 4条            | 0-1次           |

**注意**：所有稀有度的驱动盘初始都是4条副词条，强化不会增加副词条数量，只会提升已有副词条的数值。

### 强化流程
1. 驱动盘有4条固定的副词条类型
2. 每次强化随机选择1条副词条进行提升
3. 同一条副词条可以被强化多次
4. 强化次数不影响最终数值上限

### 副词条最大数值计算

```typescript
// 计算单条副词条的最大值
function getDiscSubStatMaxValue(rarity, subStatKey) {
  const baseValue = subStatBaseValues[subStatKey][rarity]
  const maxRolls = 1  // 最大额外强化次数
  return baseValue * (1 + maxRolls)
}

// 示例：B级暴击率%最大值为 0.8% × (1 + 1) = 1.6%
// 示例：S级暴击率%最大值为 2.4% × (1 + 1) = 4.8%
```

---

## 套装效果

### 套装2件套效果表

| 套装名称         | 属性类型   | 数值   | 说明       |
|------------------|------------|--------|------------|
| 星之声           | 攻击力%    | 10%    | -          |
| 刃与歌           | 暴击伤害%  | 16%    | -          |
| 混沌爵士         | 异常掌控   | 30     | -          |
| 混沌金属         | 以太伤害%  | 10%    | -          |
| 锋齿金属         | 物理伤害%  | 10%    | -          |
| 自由蓝调         | 异常掌控   | 30     | -          |
| 激素朋克         | 攻击力%    | 10%    | -          |
| 炼狱金属         | 火元素伤害%| 10%    | -          |
| 巅峰之王         | 失衡增加%  | 6%     | -          |
| 月光摇篮曲       | 能量恢复%  | 20%    | -          |
| 法厄同的旋律     | 异常精通%  | 8%     | -          |
| 极地金属         | 冰元素伤害%| 10%    | -          |
| 原始朋克         | 护盾%      | 15%    | -          |
| 河豚电击         | 穿透率%    | 8%     | -          |
| 暗影和声         | 伤害%      | 15%    | -          |
| 光耀咏叹调       | 以太伤害%  | 10%    | -          |
| 震星迪斯科       | 冲击力%    | 6%     | -          |
| 灵魂摇滚         | 防御力%    | 16%    | -          |
| 摇摆爵士         | 能量恢复%  | 20%    | -          |
| 雷暴金属         | 雷元素伤害%| 10%    | -          |
| 白水谣           | 物理伤害%  | 10%    | -          |
| 啄木鸟电击       | 暴击率%    | 8%     | -          |
| 云葵故事         | 生命值%    | 10%    | -          |

---

## 槽位限制

### 各槽位主词条限制

| 槽位 | 允许的主词条类型                                       |
|------|-------------------------------------------------------|
| 1    | 生命值 (hp)                                            |
| 2    | 攻击力 (atk)                                           |
| 3    | 防御力 (def)                                           |
| 4    | 生命值%、攻击力%、防御力%、暴击率%、暴击伤害%、异常掌控 |
| 5    | 生命值%、攻击力%、防御力%、穿透率%、元素伤害%           |
| 6    | 生命值%、攻击力%、防御力%、异常精通%、冲击力%、能量恢复% |

### 各槽位副词条限制

所有槽位的副词条类型相同：

| 副词条分类 | 包含的属性键名                     |
|------------|-----------------------------------|
| 数值属性   | hp, atk, def, pen, anomProf       |
| 百分比属性 | hp_, atk_, def_, crit_, crit_dmg_ |

---

## 等级计算公式

### 主词条等级公式

```typescript
// 核心公式
function getDiscMainStatVal(maxVal, maxLevel, level) {
  return maxVal * (0.25 + (0.75 * level) / maxLevel)
}

// 参数说明：
// - maxVal: 该稀有度该主词条的满级数值
// - maxLevel: 该稀有度的最大等级 (B=9, A=12, S=15)
// - level: 当前等级 (0-maxLevel)
```

### 公式说明

- **0级时**：数值为满级的25%
- **线性增长**：从0级到满级按线性比例增长
- **满级时**：数值为100%

### 主词条成长示例（以S级30%攻击力%为例）

| 当前等级 | 数值     | 计算过程                    |
|----------|----------|-----------------------------|
| 0        | 7.5%     | 30% × 0.25                  |
| 3        | 13.5%    | 30% × (0.25 + 0.75×3/15)    |
| 5        | 18.75%   | 30% × (0.25 + 0.75×5/15)    |
| 7.5      | 23.125%  | 30% × (0.25 + 0.75×7.5/15)  |
| 10       | 30%      | 30% × (0.25 + 0.75×10/15)   |
| 15       | 30%      | 30% × (0.25 + 0.75×15/15)   |

### 各等级数值比例表

| 等级占比 | 数值比例 | 说明       |
|----------|----------|------------|
| 0/15     | 25%      | 初始值     |
| 3/15     | 40%      | 20%进度    |
| 7.5/15   | 62.5%    | 50%进度    |
| 11.25/15 | 81.25%   | 75%进度    |
| 15/15    | 100%     | 满级值     |

---

## 实用计算示例

### 示例1：S级攻击力%驱动盘（槽位4）

```typescript
// 已知条件
const maxVal = 0.30      // 30%
const maxLevel = 15
const currentLevel = 10

// 计算
const value = maxVal * (0.25 + (0.75 * currentLevel) / maxLevel)
// = 0.30 * (0.25 + 0.75 * 10 / 15)
// = 0.30 * 0.75
// = 0.225 = 22.5%
```

### 示例2：A级暴击率驱动盘（槽位4）

```typescript
// 已知条件
const maxVal = 0.16      // 16%
const maxLevel = 12
const currentLevel = 8

// 计算
const value = maxVal * (0.25 + (0.75 * currentLevel) / maxLevel)
// = 0.16 * (0.25 + 0.75 * 8 / 12)
// = 0.16 * 0.75
// = 0.12 = 12%
```

### 示例3：B级生命值驱动盘（槽位1）

```typescript
// 已知条件
const maxVal = 734       // 生命值
const maxLevel = 9
const currentLevel = 5

// 计算
const value = maxVal * (0.25 + (0.75 * currentLevel) / maxLevel)
// = 734 * (0.25 + 0.75 * 5 / 9)
// = 734 * 0.6667
// ≈ 490
```

### 示例4：S级副词条强化（暴击伤害%）

```typescript
// 单次强化值
const singleRoll = 0.048  // 4.8%

// 强化4次（同一条副词条）
const totalValue = singleRoll * 4
// = 0.192 = 19.2%
```

### 示例5：A级副词条强化（攻击力）

```typescript
// 单次强化值
const singleRoll = 15

// 强化3次（同一条副词条）
const totalValue = singleRoll * 3
// = 45
```

### 示例6：完整驱动盘计算

```typescript
function calculateDiscStats(disc) {
  const result = {}

  // 计算主词条
  result.mainStat = getDiscMainStatVal(
    disc.mainStatMaxVal,
    disc.maxLevel,
    disc.currentLevel
  )

  // 计算副词条总和
  result.subStats = {}
  for (const [key, rolls] of Object.entries(disc.subStats)) {
    const baseValue = subStatBaseValues[key][disc.rarity]
    result.subStats[key] = baseValue * rolls
  }

  // 添加套装效果
  if (disc.setCount >= 2) {
    result.setBonus = setBonuses[disc.setName]
  }

  return result
}

// 使用示例
const myDisc = {
  rarity: 'S',
  maxLevel: 15,
  currentLevel: 15,
  mainStatMaxVal: 0.30,  // 攻击力%
  subStats: { crit_: 4, crit_dmg_: 2 },
  setName: '激素朋克',
  setCount: 2,
}

const stats = calculateDiscStats(myDisc)
// 结果：
// { mainStat: 0.30, subStats: { crit_: 0.096, crit_dmg_: 0.096 }, setBonus: { atk_: 0.10 } }
```

---

## 属性键名映射

### 主词条键名

| 显示名称       | 键名       | 值类型 | B级    | A级    | S级    |
|----------------|------------|--------|--------|--------|--------|
| 攻击力%        | atk_       | 百分比 | 0.10   | 0.20   | 0.30   |
| 生命值%        | hp_        | 百分比 | 0.10   | 0.20   | 0.30   |
| 防御力%        | def_       | 百分比 | 0.16   | 0.32   | 0.48   |
| 暴击率%        | crit_      | 百分比 | 0.08   | 0.16   | 0.24   |
| 暴击伤害%      | crit_dmg_  | 百分比 | 0.16   | 0.32   | 0.48   |
| 穿透率%        | pen_       | 百分比 | 0.08   | 0.16   | 0.24   |
| 攻击力         | atk        | 数值   | 104    | 212    | 316    |
| 生命值         | hp         | 数值   | 734    | 1468   | 2200   |
| 防御力         | def        | 数值   | 60     | 124    | 184    |
| 异常掌控       | anomProf   | 数值   | 32     | 60     | 92     |
| 火元素伤害%    | fire_dmg_  | 百分比 | 0.10   | 0.20   | 0.30   |
| 冰元素伤害%    | ice_dmg_   | 百分比 | 0.10   | 0.20   | 0.30   |
| 电元素伤害%    | electric_dmg_ | 百分比 | 0.10   | 0.20   | 0.30   |
| 物理伤害%      | physical_dmg_ | 百分比 | 0.10   | 0.20   | 0.30   |
| 以太伤害%      | ether_dmg_ | 百分比 | 0.10   | 0.20   | 0.30   |
| 异常精通%      | anomMas_   | 百分比 | 0.10   | 0.20   | 0.30   |
| 冲击力%        | impact_    | 百分比 | 0.06   | 0.12   | 0.18   |
| 能量恢复%      | enerRegen_ | 百分比 | 0.20   | 0.40   | 0.60   |

### 副词条键名

| 显示名称       | 键名       | 值类型 | B级    | A级    | S级    |
|----------------|------------|--------|--------|--------|--------|
| 攻击力         | atk        | 数值   | 7      | 15     | 19     |
| 生命值         | hp         | 数值   | 39     | 79     | 112    |
| 防御力         | def        | 数值   | 5      | 10     | 15     |
| 穿透值         | pen        | 数值   | 3      | 6      | 9      |
| 异常掌控       | anomProf   | 数值   | 3      | 6      | 9      |
| 攻击力%        | atk_       | 百分比 | 0.01   | 0.02   | 0.03   |
| 生命值%        | hp_        | 百分比 | 0.01   | 0.02   | 0.03   |
| 防御力%        | def_       | 百分比 | 0.016  | 0.032  | 0.048  |
| 暴击率%        | crit_      | 百分比 | 0.008  | 0.016  | 0.024  |
| 暴击伤害%      | crit_dmg_  | 百分比 | 0.016  | 0.032  | 0.048  |

### 套装效果键名

| 套装名称         | 属性键名     | 值类型 | 数值   |
|------------------|--------------|--------|--------|
| 星之声           | atk_         | 百分比 | 0.10   |
| 刃与歌           | crit_dmg_    | 百分比 | 0.16   |
| 混沌爵士         | anomProf     | 数值   | 30     |
| 混沌金属         | ether_dmg_   | 百分比 | 0.10   |
| 锋齿金属         | physical_dmg_ | 百分比 | 0.10   |
| 自由蓝调         | anomProf     | 数值   | 30     |
| 激素朋克         | atk_         | 百分比 | 0.10   |
| 炼狱金属         | fire_dmg_    | 百分比 | 0.10   |
| 巅峰之王         | breakStun_   | 百分比 | 0.06   |
| 月光摇篮曲       | enerRegen_   | 百分比 | 0.20   |
| 法厄同的旋律     | anomMas_     | 百分比 | 0.08   |
| 极地金属         | ice_dmg_     | 百分比 | 0.10   |
| 原始朋克         | shield_      | 百分比 | 0.15   |
| 河豚电击         | pen_         | 百分比 | 0.08   |
| 暗影和声         | dmg_         | 百分比 | 0.15   |
| 光耀咏叹调       | ether_dmg_   | 百分比 | 0.10   |
| 震星迪斯科       | impact_      | 百分比 | 0.06   |
| 灵魂摇滚         | def_         | 百分比 | 0.16   |
| 摇摆爵士         | enerRegen_   | 百分比 | 0.20   |
| 雷暴金属         | electric_dmg_ | 百分比 | 0.10   |
| 白水谣           | physical_dmg_ | 百分比 | 0.10   |
| 啄木鸟电击       | crit_        | 百分比 | 0.08   |
| 云葵故事         | hp_          | 百分比 | 0.10   |

---

## 实现建议

### 1. 数据结构设计

```typescript
// 驱动盘数据结构
interface Disc {
  id: string
  name: string
  rarity: 'B' | 'A' | 'S'
  setName: string
  level: number
  mainStat: {
    key: string
    maxVal: number
    currentVal: number
  }
  subStats: {
    [key: string]: {
      baseVal: number
      rolls: number
      currentVal: number
    }
  }
  slot: 1 | 2 | 3 | 4 | 5 | 6
}

// 主词条数据结构
interface MainStatData {
  [rarity: string]: {
    [statKey: string]: number
  }
}

// 副词条数据结构
interface SubStatData {
  [rarity: string]: {
    [statKey: string]: number
  }
}

// 套装效果数据结构
interface SetBonusData {
  [setName: string]: {
    2pc: {
      key: string
      val: number
    }
  }
}
```

### 2. 等级计算实现

```typescript
function getMainStatValue(maxVal, maxLevel, currentLevel) {
  return maxVal * (0.25 + (0.75 * currentLevel) / maxLevel)
}

function getDiscMaxLevel(rarity) {
  const maxLevelMap = { B: 9, A: 12, S: 15 }
  return maxLevelMap[rarity]
}
```

### 3. 副词条计算实现

```typescript
function getSubStatValue(baseVal, rolls) {
  return baseVal * rolls
}

function getMaxSubStatValue(rarity, statKey) {
  const baseVal = subStatData[rarity][statKey]
  const maxRolls = 1
  return baseVal * (1 + maxRolls)
}
```

### 4. 套装效果计算

```typescript
function getSetBonus(setName, pieceCount) {
  if (pieceCount < 2) return null
  return setBonusData[setName]?.2pc || null
}
```

### 5. 总属性计算

```typescript
function calculateTotalStats(discs) {
  const total = {
    hp: 0, atk: 0, def: 0,
    hp_: 0, atk_: 0, def_: 0,
    crit_: 0, crit_dmg_: 0,
    pen_: 0, dmg_: 0,
    // ... 其他属性
  }

  for (const disc of discs) {
    // 加上主词条
    total[disc.mainStat.key] += disc.mainStat.currentVal

    // 加上副词条
    for (const [key, subStat] of Object.entries(disc.subStats)) {
      total[key] += subStat.currentVal
    }

    // 加上套装效果
    const setBonus = getSetBonus(disc.setName, getSetCount(discs, disc.setName))
    if (setBonus) {
      total[setBonus.key] += setBonus.val
    }
  }

  return total
}
```

### 6. 优化建议

#### 主词条选择优先级

| 槽位 | 推荐选择         | 适用场景               |
|------|------------------|------------------------|
| 1    | 生命值           | 所有角色               |
| 2    | 攻击力           | 输出角色               |
| 3    | 防御力           | 防护型角色             |
| 4    | 暴击率/暴击伤害  | 输出角色优先           |
| 5    | 对应元素伤害%    | 元素输出角色           |
| 6    | 异常精通%        | 异常角色               |

#### 副词条优先级

| 优先级 | 输出角色         | 辅助角色         | 异常角色         |
|--------|------------------|------------------|------------------|
| 1      | 暴击率%          | 生命值%          | 异常掌控         |
| 2      | 暴击伤害%        | 生命值           | 异常精通%        |
| 3      | 攻击力%          | 能量恢复%        | 攻击力%          |
| 4      | 攻击力           | 异常掌控         | 攻击力           |
| 5      | 元素伤害%        | -                | 元素伤害%        |

---

**文档版本**: 1.0
**最后更新**: 2026-01-07
**适用范围**: 任何需要实现绝区零驱动盘系统的项目