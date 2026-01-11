# 驱动盘数据生成指南

## 📋 概述

本指南说明如何从原始驱动盘数据（`assets/inventory_data/equipment/`）生成标准化的驱动盘数据（`assets/inventory_data/equipment_data/`）。

**重要说明**：
- ✅ **只生成套装效果buff**：2件套和4件套的效果
- ✅ **2件套效果**：通常是局外属性加成（OUT_OF_COMBAT）
- ✅ **4件套效果**：通常是局内属性加成（IN_COMBAT）
- ✅ **trigger_conditions**：应该是描述文本，不是枚举值

---

## 🎯 数据结构说明

### 原始数据（assets/inventory_data/equipment/）

包含完整的驱动盘套装信息：
- 套装ID、名称
- 2件套效果描述
- 4件套效果描述

### 生成数据（assets/inventory_data/equipment_data/）

包含：
- 套装基本信息（set_id, name, name_cn）
- 2件套效果（two_piece_effect + two_piece_buffs）
- 4件套效果（four_piece_effect + four_piece_buffs）

---

## 🔧 Buff模型结构

```python
@dataclass
class Buff:
    id: str
    name: str
    description: str
    source: BuffSource
    context: BuffContext
    target: BuffTarget  # 生效目标（默认仅自身）

    out_of_combat_stats: Dict[PropertyType, float] = field(default_factory=dict)
    in_combat_stats: Dict[PropertyType, float] = field(default_factory=dict)

    trigger_conditions: list = field(default_factory=list)
    max_stacks: int = 1
    stack_mode: str = "linear"
    base_value: Optional[float] = None
    full_stack_bonus: Optional[float] = None

    is_active: bool = True
```

**BuffTarget 结构**：
```python
class BuffTarget:
    def __init__(
        self,
        target_self: bool = True,      # 对自身生效
        target_enemy: bool = False,    # 对敌人生效
        target_teammate: bool = False, # 对队友生效
        target_bund: bool = False,     # 对邦布生效
    )
```

**默认值**：
- 驱动盘BUFF默认只对装备者自身生效：`target_self = true, target_enemy = false, target_teammate = false, target_bund = false`

**注意事项**：
- 驱动盘BUFF通常只对装备者自身生效
- 如果套装效果提到"全队角色"，则设置 `target_teammate = true`
- 如果套装效果提到"敌人防御降低"，则设置 `target_enemy = true`

---

## ⚔️ 套装效果解析规则

### 2件套效果

**特点**：
- 通常是局外属性加成（OUT_OF_COMBAT）
- 没有触发条件
- 直接提供属性加成

**常见效果类型**：
- 元素伤害加成（火、冰、电、物理、以太）
- 穿透率加成
- 暴击率加成
- 暴击伤害加成
- 攻击力加成
- 生命值加成
- 防御力加成
- 异常掌控加成
- 能量自动回复加成

**示例**（炎狱重金属）：
```
火属性伤害+10%。
```

**生成数据**：
```json
{
  "two_piece_effect": "火属性伤害+10%。",
  "two_piece_buffs": [
    {
      "id": "炎狱重金属_2pc",
      "name": "炎狱重金属 2件套",
      "description": "火属性伤害+10%。",
      "source": "DRIVE_DISK_2PC",
      "context": "OUT_OF_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "trigger_conditions": [],
      "out_of_combat_stats": {
        "FIRE_DMG_": 10.0
      },
      "in_combat_stats": {}
    }
  ]
}
```

### 4件套效果

**特点**：
- 通常是局内属性加成（IN_COMBAT）
- 可能有触发条件
- 可能有持续时间
- 可能有层数叠加

**常见效果类型**：
- 特定技能伤害加成（终结技、连携技、普通攻击等）
- 条件属性加成（命中异常状态敌人时、发动特定技能时）
- 暴击率/暴击伤害提升
- 攻击力提升
- 能量回复

**示例**（河豚电音）：
```
[终结技]造成的伤害提升20%；发动[终结技]时，装备者的攻击力提升15%，持续12秒。
```

**生成数据**：
```json
{
  "four_piece_effect": "[终结技]造成的伤害提升20%；发动[终结技]时，装备者的攻击力提升15%，持续12秒。",
  "four_piece_buffs": [
    {
      "id": "puffer_electro_4pc_ultimate_attack",
      "name": "河豚电音 4件套",
      "description": "[终结技]造成的伤害提升20%；发动[终结技]时，装备者的攻击力提升15%，持续12秒。",
      "source": "DRIVE_DISK_4PC",
      "context": "IN_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "trigger_conditions": "发动终结技时",
      "out_of_combat_stats": {},
      "in_combat_stats": {
        "ULTIMATE_ATK_DMG_": 20.0,
        "ATK_": 15.0
      }
    }
  ]
}
```

---

## 📊 完整属性类型映射表

### 元素伤害加成

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 火属性伤害 | `FIRE_DMG_` | 火属性伤害加成 |
| 冰属性伤害 | `ICE_DMG_` | 冰属性伤害加成 |
| 电属性伤害 | `ELECTRIC_DMG_` | 电属性伤害加成 |
| 物理伤害 | `PHYSICAL_DMG_` | 物理伤害加成 |
| 以太伤害 | `ETHER_DMG_` | 以太伤害加成 |

### 技能伤害加成

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 普通攻击伤害 | `NORMAL_ATK_DMG_` | 普通攻击造成的伤害加成 |
| 强化特殊技伤害 | `ENHANCED_SPECIAL_DMG_` | 强化特殊技造成的伤害加成 |
| 连携技伤害 | `CHAIN_ATK_DMG_` | 连携技造成的伤害加成 |
| 终结技伤害 | `ULTIMATE_ATK_DMG_` | 终结技造成的伤害加成 |
| 冲刺攻击伤害 | `DASH_ATK_DMG_` | 冲刺攻击造成的伤害加成 |
| 闪避反击伤害 | `DODGE_COUNTER_DMG_` | 闪避反击造成的伤害加成 |
| 追加攻击伤害 | `ADDL_ATK_DMG_` | 追加攻击造成的伤害加成 |
| 特殊技伤害 | `SPECIAL_ATK_DMG_` | 特殊技造成的伤害加成 |

### 基础属性加成

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 攻击力% | `ATK_` | 攻击力百分比加成 |
| 生命值% | `HP_` | 生命值百分比加成 |
| 防御力% | `DEF_` | 防御力百分比加成 |
| 暴击率 | `CRIT_` | 暴击率加成 |
| 暴击伤害 | `CRIT_DMG_` | 暴击伤害加成 |
| 穿透率 | `PEN_` | 穿透率加成 |
| 异常掌控% | `ANOM_MAS_` | 异常掌控百分比加成 |
| 能量自动回复 | `ENER_REGEN_` | 能量自动回复加成 |
| 能量回复效率 | `ENER_EFF_` | 能量回复效率加成 |

### 属性异常伤害加成

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 强击伤害 | `IMPACT_DMG_` | 强击异常伤害加成 |
| 凛冽伤害 | `FREEZE_DMG_` | 凛冽异常伤害加成 |

### 特殊伤害加成

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 通用伤害 | `COMMON_DMG_` | 通用伤害加成（未指定类型时使用） |

---

## 🎨 多效果处理

当一个4件套效果包含多个独立的加成时，**应该将这些加成放在同一个buff的 `in_combat_stats` 里**。

### 错误示例

```json
{
  "four_piece_buffs": [
    {
      "in_combat_stats": {
        "ULTIMATE_ATK_DMG_": 20.0
      }
    },
    {
      "in_combat_stats": {
        "ATK_": 15.0
      }
    }
  ]
}
```

### 正确示例

```json
{
  "four_piece_buffs": [
    {
      "in_combat_stats": {
        "ULTIMATE_ATK_DMG_": 20.0,
        "ATK_": 15.0
      }
    }
  ]
}
```

---

## 📐 Trigger Conditions（触发条件）

**重要说明**：
- `trigger_conditions` 应该是**描述性文本**，不是枚举值
- 暂时不实现trigger_conditions的逻辑判断
- 仅用于记录效果的触发条件，方便后续理解和扩展

**示例**：
```
"攻击命中处于[灼烧]状态下的敌人时"
```

**映射**：
```json
"trigger_conditions": "攻击命中处于灼烧状态下的敌人时"
```

---

## 📊 完整示例

### 原始数据 (32200.json)

```json
{
  "Id": 32200,
  "Name": "炎狱重金属",
  "TwoPieceEffect": "火属性伤害+10%。",
  "FourPieceEffect": "攻击命中处于[灼烧]状态下的敌人时，装备者的暴击率提升28%，持续8秒。"
}
```

### 生成数据 (32200.json)

```json
{
  "set_id": "炎狱重金属",
  "name": "炎狱重金属",
  "name_cn": "炎狱重金属",
  "two_piece_effect": "火属性伤害+10%。",
  "four_piece_effect": "攻击命中处于[灼烧]状态下的敌人时，装备者的暴击率提升28%，持续8秒。",
  "two_piece_buffs": [
    {
      "id": "炎狱重金属_2pc",
      "name": "炎狱重金属 2件套",
      "description": "火属性伤害+10%。",
      "source": "DRIVE_DISK_2PC",
      "context": "OUT_OF_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "trigger_conditions": [],
      "out_of_combat_stats": {
        "FIRE_DMG_": 10.0
      },
      "in_combat_stats": {}
    }
  ],
  "four_piece_buffs": [
    {
      "id": "炎狱重金属_4pc_single",
      "name": "炎狱重金属 4件套",
      "description": "攻击命中处于[灼烧]状态下的敌人时，装备者的暴击率提升28%，持续8秒。",
      "source": "DRIVE_DISK_4PC",
      "context": "IN_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "trigger_conditions": "攻击命中处于灼烧状态下的敌人时",
      "out_of_combat_stats": {},
      "in_combat_stats": {
        "CRIT_": 28.0
      }
    }
  ]
}
```

### 河豚电音示例 (31100.json)

```json
{
  "set_id": "puffer_electro",
  "name": "河豚电音",
  "name_cn": "河豚电音",
  "two_piece_effect": "穿透率+8%。",
  "four_piece_effect": "[终结技]造成的伤害提升20%；发动[终结技]时，装备者的攻击力提升15%，持续12秒。",
  "two_piece_buffs": [
    {
      "id": "puffer_electro_2pc",
      "name": "河豚电音 2件套",
      "description": "穿透率+8%。",
      "source": "DRIVE_DISK_2PC",
      "context": "OUT_OF_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "trigger_conditions": [],
      "out_of_combat_stats": {
        "PEN_": 8.0
      },
      "in_combat_stats": {}
    }
  ],
  "four_piece_buffs": [
    {
      "id": "puffer_electro_4pc_ultimate_attack",
      "name": "河豚电音 4件套",
      "description": "[终结技]造成的伤害提升20%；发动[终结技]时，装备者的攻击力提升15%，持续12秒。",
      "source": "DRIVE_DISK_4PC",
      "context": "IN_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "trigger_conditions": "发动终结技时",
      "out_of_combat_stats": {},
      "in_combat_stats": {
        "ULTIMATE_ATK_DMG_": 20.0,
        "ATK_": 15.0
      }
    }
  ]
}
```

---

## ⚠️ 注意事项

### 1. 2件套效果必须正确映射

**错误示例**:
```json
"out_of_combat_stats": {}  // ❌ 错误！火属性伤害+10%没有体现
```

**正确示例**:
```json
"out_of_combat_stats": {
  "FIRE_DMG_": 10.0  // ✅ 正确
}
```

### 2. 属性类型必须使用PropertyType枚举值

**错误示例**:
```json
"in_combat_stats": {
  "CRIT_RATE_": 28.0,    // ❌ 错误！应该是CRIT_
  "PEN_RATIO_": 8.0,     // ❌ 错误！应该是PEN_
  "DMG_": 20.0           // ❌ 错误！应该是ULTIMATE_ATK_DMG_
}
```

**正确示例**:
```json
"in_combat_stats": {
  "CRIT_": 28.0,         // ✅ 正确
  "PEN_": 8.0,           // ✅ 正确
  "ULTIMATE_ATK_DMG_": 20.0  // ✅ 正确
}
```

### 3. trigger_conditions是描述文本

**错误示例**:
```json
"trigger_conditions": ["ULTIMATE_ATTACK"]  // ❌ 错误！这是枚举值
```

**正确示例**:
```json
"trigger_conditions": "发动终结技时"  // ✅ 正确：描述文本
```

### 4. 多个效果放在同一个buff

当一个4件套效果包含多个独立的加成时，应该将这些加成放在同一个buff的 `in_combat_stats` 里。

**错误示例**:
```json
"four_piece_buffs": [
  {
    "in_combat_stats": {
      "ULTIMATE_ATK_DMG_": 20.0
    }
  },
  {
    "in_combat_stats": {
      "ATK_": 15.0
    }
  }
]
```

**正确示例**:
```json
"four_piece_buffs": [
  {
    "in_combat_stats": {
      "ULTIMATE_ATK_DMG_": 20.0,
      "ATK_": 15.0
    }
  }
]
```

### 5. 2件套效果通常是OUT_OF_COMBAT

**错误示例**:
```json
"context": "IN_COMBAT"  // ❌ 错误！2件套通常是局外属性
```

**正确示例**:
```json
"context": "OUT_OF_COMBAT"  // ✅ 正确
```

### 6. 4件套效果通常是IN_COMBAT

**错误示例**:
```json
"context": "OUT_OF_COMBAT"  // ❌ 错误！4件套通常是局内属性
```

**正确示例**:
```json
"context": "IN_COMBAT"  // ✅ 正确
```

---

## ✅ 验证清单

生成后的数据必须满足：

- [ ] 2件套效果正确映射到 `out_of_combat_stats`
- [ ] 4件套效果正确映射到 `in_combat_stats`
- [ ] 所有属性类型使用正确的PropertyType枚举值
- [ ] `trigger_conditions` 是描述文本，不是枚举值
- [ ] 多个效果放在同一个buff的stats里
- [ ] 2件套的context是OUT_OF_COMBAT
- [ ] 4件套的context是IN_COMBAT
- [ ] 数值提取正确（百分比和点数区分）

---

## 📚 附录

### PropertyType枚举值参考

详见 `src/zzz_od/application/optimizer/zzz_models/base.py`

### 使用方法

```python
from zzz_od.application.optimizer.zzz_models.buff import Buff

# 创建2件套buff
two_piece_buff = Buff(
    id="炎狱重金属_2pc",
    name="炎狱重金属 2件套",
    description="火属性伤害+10%。",
    source=BuffSource.DRIVE_DISK_2PC,
    context=BuffContext.OUT_OF_COMBAT,
    max_stacks=1,
    trigger_conditions=[],
    out_of_combat_stats={
        PropertyType.FIRE_DMG: 10.0
    },
    in_combat_stats={}
)

# 创建4件套buff
four_piece_buff = Buff(
    id="炎狱重金属_4pc_single",
    name="炎狱重金属 4件套",
    description="攻击命中处于灼烧状态下的敌人时，装备者的暴击率提升28%，持续8秒。",
    source=BuffSource.DRIVE_DISK_4PC,
    context=BuffContext.IN_COMBAT,
    max_stacks=1,
    trigger_conditions="攻击命中处于灼烧状态下的敌人时",
    out_of_combat_stats={},
    in_combat_stats={
        PropertyType.CRIT: 28.0
    }
)
```