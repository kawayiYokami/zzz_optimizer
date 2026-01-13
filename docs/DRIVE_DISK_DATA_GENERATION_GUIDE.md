# 驱动盘 BUFF 数据生成指南

## 📋 概述

本指南说明如何从原始驱动盘数据（`assets/inventory_data/equipment/`）生成标准化的驱动盘BUFF数据（`assets/inventory_data/equipment_data_buff/`）。

**核心原则**：
1.  **只生成套装效果**：仅提取2件套和4件套效果中**能直接影响伤害数值**的增益/减益效果。
2.  **区分局内/局外**：
    *   **2件套**：视为**局外永久生效**的属性，写入 `out_of_combat_stats`。
    *   **4件套**：视为**局内条件触发**的属性，写入 `in_combat_stats`。
3.  **触发条件文本化**：4件套的触发条件、持续时间等只需在 `trigger_conditions` 字段写文本描述，不生成枚举。
4.  **合并属性**：如果同一效果（2件套或4件套）提升多个属性，应放在同一个BUFF对象的 `stats` 字段中。

---

## 🔧 数据模型

所有BUFF统一使用与角色、武器相同的标准结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | str | 唯一ID (e.g., `31000_2pc_1`) |
| `name` | str | 中文名称 (e.g., "啄木鸟电音-2件套") |
| `description` | str | 原始描述文本 |
| `source` | str | `DRIVE_DISK_2PC` 或 `DRIVE_DISK_4PC` |
| `is_permanent` | bool | **核心字段**：`true`代表局外永久生效，`false`代表局内触发 |
| `target` | obj | 生效目标对象，详见下文 |
| `in_combat_stats` | dict | **局内生效**属性 `{PropertyType: value}` |
| `out_of_combat_stats`| dict | **局外生效**属性 `{PropertyType: value}` |
| `trigger_conditions` | str | 触发条件描述文本 (4件套效果) |
| `max_stacks` | int | 最大层数 (默认1) |
| `stack_mode` | str | `linear` (线性叠加), `full_only` (仅满层生效) |

#### 生效目标 (`BuffTarget`)

| 字段 | 默认 | 判定规则 |
|---|---|---|
| `target_self` | `true` | 绝大多数情况为真 |
| `target_teammate`| `false` | 描述包含 "全队"、"队友" 时设为 `true` |
| `target_enemy` | `false` | 描述包含 "敌人防御降低"、"受到的伤害提升" 时设为 `true` |
| `target_bund` | `false` | 描述明确提及对邦布生效时设为 `true` |

---

## 📝 解析规则

### 1. 2件套效果 (`source: DRIVE_DISK_2PC`)

- **定位**：通常是无条件的属性加成。
- **is_permanent**: 设为 `true`。
- **stats**: 将效果数值写入 `out_of_combat_stats`。
- **trigger_conditions**: 留空字符串 `""`。

**示例** (`31000.json` - 啄木鸟电音):
> "暴击率+8%。"

**生成Buff**:
```json
{
  "id": "31000_2pc_1",
  "name": "啄木鸟电音-2件套",
  "description": "暴击率+8%",
  "source": "DRIVE_DISK_2PC",
  "is_permanent": true,
  "target": { "target_self": true },
  "out_of_combat_stats": {
    "CRIT_": 8.0
  },
  "in_combat_stats": {},
  "trigger_conditions": ""
}
```

### 2. 4件套效果 (`source: DRIVE_DISK_4PC`)

- **定位**：通常是有条件的、在战斗中触发的效果。
- **is_permanent**: 设为 `false`。
- **stats**: 将效果数值写入 `in_combat_stats`。
- **trigger_conditions**: 填写完整的触发条件文本描述。

**示例** (`31000.json` - 啄木鸟电音):
> "[普通攻击]、[闪避反击]或[强化特殊技]命中敌人并触发暴击时，分别为装备者提供1层增益效果，每层增益效果使装备者的攻击力提升9%，持续6秒，不同招式分别结算持续时间。"

**生成Buff**:
```json
{
  "id": "31000_4pc_1",
  "name": "啄木鸟电音-4件套",
  "description": "...",
  "source": "DRIVE_DISK_4PC",
  "is_permanent": false,
  "target": { "target_self": true },
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "ATK_": 9.0
  },
  "trigger_conditions": "[普通攻击]、[闪避反击]或[强化特殊技]命中敌人并触发暴击时",
  "max_stacks": 3 
}
```
*(注：此处层数根据描述推断，具体层数需根据游戏内实际机制确认)*

---

## 📊 属性映射表 (PropertyType)

> **重要**：属性Key必须匹配 `web/optimizer/src/model/base.ts` 中的 `PropertyType` 枚举。

(此部分与 `CHARACTER_DATA_GENERATION_GUIDE.md` 完全一致，此处为简略版，生成时请参考完整版)

| 描述 | PropertyType |
|---|---|
| 攻击力% | `ATK_` |
| 暴击率 | `CRIT_` |
| 暴击伤害 | `CRIT_DMG_` |
| 火属性伤害 | `FIRE_DMG_` |
| 终结技伤害 | `ULTIMATE_ATK_DMG_` |
| 敌人防御降低% | `DEF_RED_` |
| ... (更多属性) | ... |

---

## ✅ 验证清单

1.  [ ] **ID唯一性**：确保每个套装的buff `id` 不重复 (格式: `{setId}_{2pc/4pc}_{index}`)。
2.  [ ] **2件套**：`is_permanent` 为 `true`，属性在 `out_of_combat_stats`。
3.  [ ] **4件套**：`is_permanent` 为 `false`，属性在 `in_combat_stats`。
4.  [ ] **Target正确**：光环/Debuff效果正确设置了 `target_teammate` 或 `target_enemy`。
5.  [ ] **触发条件文本化**：4件套的 `trigger_conditions` 是完整的描述性文本。
6.  [ ] **枚举准确**：所有属性Key均使用了正确的 `PropertyType` 枚举值。
7.  [ ] **合并属性**：同一效果的多个属性加成合并在同一个 `stats` 对象内。