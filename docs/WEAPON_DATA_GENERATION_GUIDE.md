# 武器 BUFF 数据生成指南

## 📋 概述

本指南说明如何从原始武器数据（`assets/inventory_data/weapon/`）生成标准化的武器BUFF数据（`assets/inventory_data/weapon_data_buff/`）。

**核心原则**：
1.  **只生成特效BUFF**：仅提取天赋（Talents）中**能直接影响伤害数值**的增益/减益效果。基础属性由程序动态计算，不在此处生成。
2.  **全部为局内BUFF**：所有武器特效都视为**局内条件触发**的属性，写入 `in_combat_stats`。
3.  **为每个精炼等级生成**：武器的同一个天赋效果，需要根据其1至5级（或更高）的描述，**为每个等级都生成一条独立的BUFF数据**。
4.  **触发条件文本化**：效果的触发条件、持续时间等只需在 `trigger_conditions` 字段写文本描述，不生成枚举。
5.  **拆分独立效果**：如果一个天赋等级的描述包含多个独立触发的效果（如一个自身增益和一个敌人减益），应拆分为多个BUFF对象。

---

## 🔧 数据模型

所有BUFF统一使用与角色、驱动盘相同的标准结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | str | 唯一ID (e.g., `12001_talent_1_1`) |
| `name` | str | 中文名称 (e.g., "月相-望-精1-伤害提升") |
| `description` | str | 原始描述文本 |
| `source` | str | `WENGINE_TALENT` |
| `is_permanent` | bool | **固定为 `false`**，因为武器特效都是局内触发 |
| `target` | obj | 生效目标对象，详见下文 |
| `in_combat_stats` | dict | **局内生效**属性 `{PropertyType: value}` |
| `out_of_combat_stats`| dict | **固定为空** `{}` |
| `trigger_conditions` | str | 触发条件描述文本 |
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

### 1. 遍历所有精炼等级 (Talents 1-5)

原始数据中的 `Talents` 字段是一个对象，key为精炼等级（"1", "2", "3", "4", "5"）。**必须为其中的每一个等级都生成对应的BUFF数据**。

**示例** (`12001.json` - 「月相」-望):
```json
"Talents": {
  "1": {
    "Name": "满月",
    "Desc": "<color=#FFFFFF>[普通攻击]</color>...造成的伤害提升<color=#2BAD00>12%</color>。"
  },
  "2": {
    "Name": "满月",
    "Desc": "<color=#FFFFFF>[普通攻击]</color>...造成的伤害提升<color=#2BAD00>14%</color>。"
  },
  // ...直到等级5
}
```

### 2. 生成每个等级的BUFF

- **is_permanent**: 固定为 `false`。
- **stats**: 将效果数值写入 `in_combat_stats`。
- **ID**: ID中要包含武器ID和天赋等级，格式建议为 `{weapon_id}_talent_{talent_level}_{effect_index}`。
- **合并同类属性**：如果一个效果同时提升多个技能伤害（如“普攻、重击伤害提升”），应将它们合并到同一个BUFF对象的 `in_combat_stats` 中。

**示例** (`12001.json` - 「月相」-望 - 精炼1级和2级):

**精炼1级 Buff**:
```json
{
  "id": "12001_talent_1_1",
  "name": "月相-望-精1-多技能伤害提升",
  "description": "[普通攻击]、[冲刺攻击]、[闪避反击]造成的伤害提升12%",
  "source": "WENGINE_TALENT",
  "is_permanent": false,
  "target": { "target_self": true },
  "in_combat_stats": {
    "NORMAL_ATK_DMG_": 12.0,
    "DASH_ATK_DMG_": 12.0,
    "DODGE_COUNTER_DMG_": 12.0
  },
  "out_of_combat_stats": {},
  "trigger_conditions": "" 
}
```

**精炼2级 Buff**:
```json
{
  "id": "12001_talent_2_1",
  "name": "月相-望-精2-多技能伤害提升",
  "description": "[普通攻击]、[冲刺攻击]、[闪避反击]造成的伤害提升14%",
  "source": "WENGINE_TALENT",
  "is_permanent": false,
  "target": { "target_self": true },
  "in_combat_stats": {
    "NORMAL_ATK_DMG_": 14.0,
    "DASH_ATK_DMG_": 14.0,
    "DODGE_COUNTER_DMG_": 14.0
  },
  "out_of_combat_stats": {},
  "trigger_conditions": ""
}
```
*(后续还应有精炼3, 4, 5的BUFF...)*

### 3. 处理复杂效果

如果天赋描述包含多个独立效果，应为每个效果创建单独的BUFF，即使它们在同一个精炼等级下。

**示例** (某武器精炼1级):
> "发动终结技时，全队攻击力提升10%，持续10秒。并使场上所有敌人的防御力降低15%，持续8秒。"

**应生成两个Buff**:
1.  **全队攻击力提升 (Buff)**:
    - `target`: `{ "target_self": true, "target_teammate": true }`
    - `in_combat_stats`: `{ "ATK_": 10.0 }`
    - `trigger_conditions`: "发动终结技时"
2.  **敌人防御降低 (Debuff)**:
    - `target`: `{ "target_self": true, "target_enemy": true }`
    - `in_combat_stats`: `{ "DEF_RED_": 15.0 }`
    - `trigger_conditions`: "发动终结技时"

---

## 📊 属性映射表 (PropertyType)

> **重要**：属性Key必须匹配 `web/optimizer/src/model/base.ts` 中的 `PropertyType` 枚举。

(此部分与 `CHARACTER_DATA_GENERATION_GUIDE.md` 完全一致，此处为简略版，生成时请参考完整版)

| 描述 | PropertyType |
|---|---|
| 攻击力% | `ATK_` |
| 暴击率 | `CRIT_` |
| 暴击伤害 | `CRIT_DMG_` |
| 普通攻击伤害 | `NORMAL_ATK_DMG_` |
| 终结技伤害 | `ULTIMATE_ATK_DMG_` |
| 敌人防御降低% | `DEF_RED_` |
| ... (更多属性) | ... |

---

## ✅ 验证清单

1.  [ ] **ID唯一性**：确保每个BUFF的 `id` 在文件内唯一 (格式: `{weapon_id}_talent_{level}_{index}`)。
2.  [ ] **全等级覆盖**：确认 `Talents` 对象中的**每一个等级**都已生成对应的BUFF。
3.  [ ] **均为局内BUFF**：`is_permanent` 必须为 `false`，属性必须在 `in_combat_stats`。
4.  [ ] **Target正确**：光环/Debuff效果正确设置了 `target_teammate` 或 `target_enemy`。
5.  [ ] **拆分与合并**：独立效果已拆分为多个BUFF，同效果的多技能加成已合并到同一个 `stats` 对象。
6.  [ ] **触发条件文本化**：`trigger_conditions` 是完整的描述性文本。
7.  [ ] **枚举准确**：所有属性Key均使用了正确的 `PropertyType` 枚举值。