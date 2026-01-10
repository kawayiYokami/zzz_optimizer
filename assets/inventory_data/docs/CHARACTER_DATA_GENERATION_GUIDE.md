# 如何生成角色BUFF

## 📋 概述

本指南说明如何从原始角色数据（`assets/inventory_data/character/`）生成标准化的角色BUFF数据（`assets/inventory_data/character_data_buff/`）。

**重要说明**：
- ✅ **只生成角色自身的BUFF**：核心被动和天赋中的所有效果
- ✅ **不生成技能倍率数据**：技能的伤害倍率、失衡倍率等不需要
- ✅ **不生成基础属性**：等级成长、突破加成等不需要

---

## 🎯 数据结构说明

### 原始数据（assets/inventory_data/character/）

包含完整的角色信息：
- 基本信息（Id, Name, Rarity, WeaponType, ElementType等）
- 技能数据（Basic, Dodge, Special, Chain, Assist）
- 核心被动（Passive）
- 天赋（Talent）

### 生成数据（assets/inventory_data/character_data_buff/）

只包含：
- 角色基本信息（agent_id, name, code_name, rarity, weapon_type, element_type）
- 核心被动BUFF（core_passive_buffs）
- 天赋BUFF（talent_buffs）
- 转换类BUFF（conversion_buffs）- 核心被动和天赋中的转换类buff
- 潜能觉醒BUFF（potential_buffs）- 潜能觉醒中的buff（独立列表）

---

## 🔧 Buff模型结构

### 普通BUFF模型

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

### 转换类BUFF模型

**重要说明**：
- 转换类buff是特殊的机制，**不应该分局内局外**，它始终生效
- 用于记录属性之间的转换关系

```python
@dataclass
class ConversionBuff:
    id: str
    name: str
    description: str
    source: BuffSource  # CORE_PASSIVE, TALENT等

    # 转换相关
    from_property: PropertyType  # 源属性（如HP_BASE）
    to_property: PropertyType    # 目标属性（如PENETRATION）
    conversion_ratio: float      # 转换比例（如0.1）

    # 触发条件（如果有）
    trigger_conditions: str = ""  # 描述文本

    is_active: bool = True
```

**示例**（伊德海莉 - 生命转贯穿力）：
```json
{
  "conversion_buffs": [
    {
      "id": "1051_core_passive_1_1",
      "name": "核心被动-生命转贯穿力",
      "description": "伊德海莉会额外根据自身最大生命值提高贯穿力，每1点最大生命值将提高0.1点贯穿力。",
      "source": "CORE_PASSIVE",
      "from_property": "HP_BASE",
      "to_property": "PENETRATION",
      "conversion_ratio": 0.1,
      "trigger_conditions": "",
      "is_active": true
    }
  ]
}
```

---

## 🎯 BuffTarget（生效目标）解析规则

### BuffTarget字段说明

`target` 字段用于指定BUFF的生效目标，包含4个布尔值：
- `target_self`：对自身生效（默认true）
- `target_enemy`：对敌人生效（默认false）
- `target_teammate`：对队友生效（默认false）
- `target_bund`：对邦布生效（默认false）

### 判断规则

#### 1. 默认规则：仅自身生效

大多数角色BUFF只对自身生效，使用默认值：
```json
"target": {
  "target_self": true,
  "target_enemy": false,
  "target_teammate": false,
  "target_bund": false
}
```

**示例**（伊德海莉 - 暴击伤害提升）：
```json
{
  "id": "1051_talent_2_1",
  "name": "天赋-暴击伤害提升",
  "description": "伊德海莉的暴击伤害提升40%。",
  "source": "TALENT",
  "context": "OUT_OF_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "out_of_combat_stats": {
    "CRIT_DMG_": 40.0
  },
  "in_combat_stats": {}
}
```

#### 2. 队友生效BUFF

当BUFF描述中明确提到"全队角色"、"队友"等关键词时，设置 `target_teammate = true`：

**关键词识别**：
- "全队角色"
- "队友"
- "队伍中所有角色"

**示例**（星见雅 - 属性异常积蓄效率提升）：
```
触发[霜灼·破]时，使全队角色属性异常积蓄效率提升20%，持续10秒。
```

```json
{
  "id": "1091_talent_4",
  "name": "TALENT-属性异常积蓄效率提升",
  "description": "触发[霜灼·破]时，使全队角色属性异常积蓄效率提升20%，持续10秒。",
  "source": "TALENT",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": true,
    "target_bund": false
  },
  "in_combat_stats": {
    "ANOMALY_BUILDUP_": 20.0
  }
}
```

#### 3. 敌人生效BUFF（Debuff）

当BUFF描述中提到"敌人"、"目标"等关键词，且是负面效果时，设置 `target_enemy = true`：

**关键词识别**：
- "敌人防御降低"
- "目标受到的伤害提升"
- "降低敌人抗性"

**示例**（假设有减防效果）：
```
攻击命中敌人时，降低敌人防御力15%，持续8秒。
```

```json
{
  "id": "xxx_talent_x",
  "name": "天赋-减防",
  "description": "攻击命中敌人时，降低敌人防御力15%，持续8秒。",
  "source": "TALENT",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": true,
    "target_teammate": false,
    "target_bund": false
  },
  "in_combat_stats": {
    "DEF_RED_": 15.0
  }
}
```

#### 4. 自身+队友生效BUFF

当BUFF同时对自己和队友生效时，设置 `target_self = true` 和 `target_teammate = true`：

**示例**（假设有共享增益）：
```
进入战场时，星见雅和全队角色暴击率提升15%。
```

```json
{
  "id": "xxx_talent_x",
  "name": "天赋-暴击率提升",
  "description": "进入战场时，星见雅和全队角色暴击率提升15%。",
  "source": "TALENT",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": true,
    "target_bund": false
  },
  "in_combat_stats": {
    "CRIT_RATE_": 15.0
  }
}
```

### 转换类BUFF的target

**重要说明**：转换类BUFF（ConversionBuff）没有 `target` 字段，因为转换效果通常只对自身生效。

---

## ⚔️ 核心被动解析规则

### 核心被动特点

核心被动是角色的核心机制，通常包含：
- **基础属性加成**（ExtraProperty字段）→ **不是BUFF！**
- 文字描述的增益效果（Desc字段）→ **这才是BUFF！**
- 生命值/能量/属性等特殊机制
- 条件触发的增益效果
- 队伍协同效果

### ⚠️ 重要：基础属性加成不是BUFF

**核心被动中的 `ExtraProperty` 字段是基础属性加成，不是BUFF！**

**示例**（伊德海莉 - 核心被动）：
```json
"ExtraProperty": {
  "121": {  // ATK（攻击力）
    "Target": 123,
    "Value": 3000  // 30%
  },
  "111": {  // HP（生命值）
    "Target": 123,
    "Value": 1000  // 10%
  }
}
```

**这些值不应该生成BUFF！** 基础属性加成是直接提升角色面板的属性，不是BUFF效果。

**只生成文字描述中的效果**（Desc字段的内容），例如：
- "攻击造成的伤害最多提升50%" → 生成BUFF
- "暴击伤害提升30%" → 生成BUFF
- "受到的伤害降低25%" → 生成BUFF

**示例**（伊德海莉 - 拾梦空想）：
```
伊德海莉会额外根据自身最大生命值提高贯穿力，每1点最大生命值将提高0.1点贯穿力；
伊德海莉发动招式造成的冰属性伤害均为贯穿伤害，无视敌人防御，使用贯穿力作为招式伤害倍率；
伊德海莉进入战场时即可恢复60闪能，在勘域模式中此效果180秒内最多触发一次，
伊德海莉的当前生命值百分比越低，招式造成的伤害越高；
当伊德海莉生命值低于50%时，获得的增益效果达到最大值，攻击造成的伤害最多提升50%，
伊德海莉生命值重新回到50%后，最大值增益效果仍会持续5秒；
伊德海莉通过招式命中获得喧响值降低，伊德海莉生命值降低时，获得喧响值，每降低1%生命值会获得10点喧响值。
```

### 解析规则

#### 1. 识别转换类BUFF

转换类BUFF的特征：
- "每X点A属性提高Y点B属性"
- "A属性转换为B属性"
- "根据A属性提升B属性"

**示例**（伊德海莉）：
```
伊德海莉会额外根据自身最大生命值提高贯穿力，每1点最大生命值将提高0.1点贯穿力。
```

**生成数据**：
```json
{
  "id": "1051_core_passive_1_1",
  "name": "核心被动-生命转贯穿力",
  "description": "伊德海莉会额外根据自身最大生命值提高贯穿力，每1点最大生命值将提高0.1点贯穿力。",
  "source": "CORE_PASSIVE",
  "from_property": "HP_BASE",
  "to_property": "PENETRATION",
  "conversion_ratio": 0.1,
  "trigger_conditions": "",
  "is_active": true
}
```

#### 2. 识别所有独立的BUFF效果

核心被动通常包含多个独立的效果，需要分别解析：

**效果1**：生命值低于50%时，攻击造成的伤害提升
```json
{
  "id": "1051_core_passive_1_1",
  "name": "核心被动-低血量伤害提升",
  "description": "当伊德海莉生命值低于50%时，获得的增益效果达到最大值，攻击造成的伤害最多提升50%。",
  "source": "CORE_PASSIVE",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": "生命值低于50%时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "COMMON_DMG_": 50.0
  }
}
```

**效果2**：队伍中存在[击破]或[支援]角色时，暴击伤害提升
```json
{
  "id": "1051_core_passive_1_2",
  "name": "核心被动-暴击伤害提升",
  "description": "队伍中存在[击破]或[支援]角色时触发：伊德海莉生命值低于50%时，暴击伤害提升30%。",
  "source": "CORE_PASSIVE",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": "队伍中存在击破或支援角色，且生命值低于50%时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "CRIT_DMG_": 30.0
  }
}
```

**效果3**：队伍中存在[击破]或[支援]角色时，受到的伤害降低
```json
{
  "id": "1051_core_passive_1_3",
  "name": "核心被动-伤害降低",
  "description": "队伍中存在[击破]或[支援]角色时触发：伊德海莉生命值低于50%时，受到的伤害降低25%。",
  "source": "CORE_PASSIVE",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": "队伍中存在击破或支援角色，且生命值低于50%时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "DAMAGE_TAKEN_RED_": 25.0
  }
}
```

**效果4**：处于[以太帷幕·涌泉]中时，最大生命值提升
```json
{
  "id": "1051_core_passive_1_4",
  "name": "核心被动-以太帷幕生命提升",
  "description": "处于[以太帷幕·涌泉]中时，伊德海莉的最大生命值额外提升5%。",
  "source": "CORE_PASSIVE",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": "处于以太帷幕·涌泉中时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "HP_": 5.0
  }
}
```

#### 2. 特殊机制处理

**贯穿力机制**：
- "每1点最大生命值将提高0.1点贯穿力" → 这是特殊的属性转换，暂时不生成BUFF
- "冰属性伤害均为贯穿伤害，无视敌人防御" → 这是伤害机制，暂时不生成BUFF

**能量回复机制**：
- "进入战场时即可恢复60闪能" → 这是能量回复机制，暂时不生成BUFF
- "每降低1%生命值会获得10点喧响值" → 这是特殊资源获取机制，暂时不生成BUFF

---

## ⚔️ 天赋解析规则

### 天赋特点

天赋通常包含6个效果，每个效果可能是：
- 属性加成（暴击伤害、攻击力等）
- 技能等级提升
- 特殊机制增强
- 条件触发的增益

**示例**（伊德海莉 - 何人于此遐思）：
```
伊德海莉的暴击伤害提升40%；成功触发[溯寒]或[追碾]后，持续回复闪能，每秒回复0.5点，最多30秒，重复触发时刷新持续时间。
```

### 解析规则

#### 1. 识别所有独立的BUFF效果

**效果1**：暴击伤害提升
```json
{
  "id": "1051_talent_2_1",
  "name": "天赋-暴击伤害提升",
  "description": "伊德海莉的暴击伤害提升40%。",
  "source": "TALENT",
  "context": "OUT_OF_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": [],
  "out_of_combat_stats": {
    "CRIT_DMG_": 40.0
  },
  "in_combat_stats": {}
}
```

**效果2**：触发[溯寒]或[追碾]后，持续回复闪能
```json
{
  "id": "1051_talent_2_2",
  "name": "天赋-闪能回复",
  "description": "成功触发[溯寒]或[追碾]后，持续回复闪能，每秒回复0.5点，最多30秒。",
  "source": "TALENT",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": "触发溯寒或追碾后",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "ENER_REGEN_": 0.5
  }
}
```

#### 2. 技能等级提升

技能等级提升的效果通常不需要生成BUFF，因为这是技能倍率的提升，不是属性加成。

**示例**：
```
[普通攻击]、[闪避]、[支援技]、[特殊技]、[连携技] 技能等级+2
```

**处理方式**：
- 不生成BUFF
- 可以在备注中记录

#### 3. 特殊机制增强

有些天赋会增强核心被动中的特殊机制，需要解析为BUFF。

**示例**（伊德海莉 - 在静默中盛放）：
```
[核心被动：拾梦空想]中，生命值降低时，伊德海莉获得的喧响值增加10%；
处于[以太帷幕·涌泉]中时，伊德海莉的最大生命值额外提升5%。
```

**效果1**：喧响值增加
```json
{
  "id": "1051_talent_4_1",
  "name": "天赋-喧响值增加",
  "description": "生命值降低时，伊德海莉获得的喧响值增加10%。",
  "source": "TALENT",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": "生命值降低时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "FEVER_GAIN_": 10.0
  }
}
```

**效果2**：以太帷幕最大生命值提升
```json
{
  "id": "1051_talent_4_2",
  "name": "天赋-以太帷幕生命提升",
  "description": "处于[以太帷幕·涌泉]中时，伊德海莉的最大生命值额外提升5%。",
  "source": "TALENT",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 1,
  "stack_mode": "full_only",
  "trigger_conditions": "处于以太帷幕·涌泉中时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "HP_": 5.0
  }
}
```

---

## ⚔️ 潜能觉醒解析规则

### 潜能觉醒特点

潜能觉醒是角色的特殊强化系统，通常包含：
- 基于特定属性的转换效果
- 条件触发的增益效果
- 有上限的转换效果

**示例**（柏妮思 - 沸点派对）：
```
当柏妮思的初始能量自动回复大于等于1.8点时，超过的部分每拥有0.1点初始能量自动回复，异常掌控额外提升1点，造成的伤害提升1%，异常掌控最多提升25点，造成的伤害最多提升20%；[核心被动：燃油特调]中触发[余烬]的间隔降低至1.35秒。
```

### 解析规则

#### 1. 识别转换类BUFF

潜能觉醒中的转换类BUFF特征：
- "每X点A属性，B属性提升Y点/Z%"
- 有上限限制

**示例**（柏妮思 - 能量转异常掌控）：
```
每0.1点初始能量自动回复，异常掌控额外提升1点，最多提升25点。
```

**生成数据**：
```json
{
  "id": "1171_potential_1_1",
  "name": "潜能觉醒-能量转异常掌控",
  "description": "每0.1点初始能量自动回复，异常掌控额外提升1点，最多提升25点。",
  "source": "POTENTIAL",
  "from_property": "ENER_REGEN_BASE",
  "to_property": "ANOM_MAS",
  "conversion_ratio": 10.0,
  "trigger_conditions": "初始能量自动回复大于等于1.8点时",
  "is_active": true
}
```

**示例**（柏妮思 - 能量转伤害）：
```
每0.1点初始能量自动回复，造成的伤害提升1%，最多提升20%。
```

**生成数据**：
```json
{
  "id": "1171_potential_1_2",
  "name": "潜能觉醒-能量转伤害",
  "description": "每0.1点初始能量自动回复，造成的伤害提升1%，最多提升20%。",
  "source": "POTENTIAL",
  "from_property": "ENER_REGEN_BASE",
  "to_property": "COMMON_DMG",
  "conversion_ratio": 10.0,
  "trigger_conditions": "初始能量自动回复大于等于1.8点时",
  "is_active": true
}
```

#### 2. 特殊机制处理

**不生成BUFF的特殊机制**：
- "触发[余烬]的间隔降低至1.35秒" → 这是特殊机制，暂时不生成BUFF

#### 3. 潜能等级

潜能觉醒有6个等级，每个等级的转换比例不同：
- Level 1: 0.1点能量回复 → 1点异常掌控，1%伤害
- Level 2: 0.1点能量回复 → 1点异常掌控，1%伤害
- Level 3: 0.1点能量回复 → 1.3点异常掌控，1.25%伤害
- Level 4: 0.1点能量回复 → 1.6点异常掌控，1.5%伤害
- Level 5: 0.1点能量回复 → 2点异常掌控，1.75%伤害
- Level 6: 0.1点能量回复 → 2.5点异常掌控，2%伤害

**处理方式**：
- ✅ 只生成最高等级（Level 6）的BUFF
- ✅ 使用最高等级的数值（如Level 6的2.5点异常掌控，2%伤害）

---

## ⚠️ 重要规则：只生成满级数值

**核心被动BUFF**：
- 核心被动通常有6-7个等级（Level 1-6/7）
- ✅ 只生成最高等级（Level 6或Level 7）的BUFF
- ✅ 使用最高等级的数值

**示例**（派派 - 核心被动）：
- Level 1: 每层动力提升2%物理异常积蓄效率
- Level 2: 每层动力提升2.3%物理异常积蓄效率
- Level 3: 每层动力提升2.6%物理异常积蓄效率
- Level 4: 每层动力提升3%物理异常积蓄效率
- Level 5: 每层动力提升3.3%物理异常积蓄效率
- Level 6: 每层动力提升3.6%物理异常积蓄效率
- Level 7: 每层动力提升4%物理异常积蓄效率

**生成数据**（只生成Level 7）：
```json
{
  "id": "1281_core_passive_7_1",
  "name": "核心被动-动力积蓄效率",
  "description": "每拥有一层[动力]，派派的物理异常积蓄效率提升4%。",
  "source": "CORE_PASSIVE",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 20,
  "stack_mode": "linear",
  "base_value": 4.0,
  "full_stack_bonus": null,
  "trigger_conditions": "在强化特殊技或终结技中发动旋转斩击命中敌人时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "PHYSICAL_ANOMALY_BUILDUP_": 4.0
  }
}
```

**天赋BUFF**：
- 天赋通常有6个等级（Level 1-6）
- ✅ 只生成最高等级（Level 6）的BUFF
- ✅ 使用最高等级的数值

**示例**（派派 - 天赋）：
- Level 1: 下砸伤害提升10%，每层动力额外提升1%
- Level 2: 下砸伤害提升10%，每层动力额外提升1%
- ...
- Level 6: 下砸伤害提升10%，每层动力额外提升1%

**生成数据**（只生成Level 6）：
```json
{
  "id": "1281_talent_6_1",
  "name": "天赋-下砸伤害提升",
  "description": "在[特殊技：有亿点重]、[强化特殊技：非常重]和[终结技]中发动下砸攻击命中敌人时，招式造成的物理伤害提升10%，每拥有1层[动力]，该增益效果额外提升1%。",
  "source": "TALENT",
  "context": "IN_COMBAT",
  "target": {
    "target_self": true,
    "target_enemy": false,
    "target_teammate": false,
    "target_bund": false
  },
  "max_stacks": 30,
  "stack_mode": "linear",
  "base_value": 10.0,
  "full_stack_bonus": null,
  "trigger_conditions": "在特殊技、强化特殊技或终结技中发动下砸攻击命中敌人时",
  "out_of_combat_stats": {},
  "in_combat_stats": {
    "PHYSICAL_DMG_": 10.0
  }
}
```

**潜能觉醒BUFF**：
- 潜能觉醒有6个等级（Level 1-6）
- ✅ 只生成最高等级（Level 6）的BUFF
- ✅ 使用最高等级的数值

---

## 📊 完整属性类型映射表

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
| 通用伤害 | `COMMON_DMG_` | 通用伤害加成（未指定类型时使用） |

### 属性异常伤害加成

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 强击伤害 | `IMPACT_DMG_` | 强击异常伤害加成 |
| 凛冽伤害 | `FREEZE_DMG_` | 凛冽异常伤害加成 |

### 特殊伤害加成

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 贯穿伤害 | `PENETRATION_DMG_` | 贯穿伤害加成 |
| 异常伤害 | `ANOMALY_DMG_` | 异常伤害加成 |

### Debuff属性

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 敌人防御降低% | `DEF_RED_` | 降低敌人防御力（减防） |
| 敌人抗性降低% | `ENEMY_RES_RED_` | 降低敌人属性抗性 |
| 受到的伤害降低% | `DAMAGE_TAKEN_RED_` | 降低自身受到的伤害 |

### 特殊属性

| 描述 | PropertyType | 说明 |
|-----|-------------|------|
| 喧响值获取 | `FEVER_GAIN_` | 喧响值获取加成 |
| 技能等级 | `SKILL_LEVEL_` | 技能等级提升 |

---

## 🎨 多效果处理

当一个核心被动或天赋包含多个独立的加成时，**应该将这些加成放在同一个buff的 `in_combat_stats` 里**。

### 错误示例

```json
{
  "buffs": [
    {
      "in_combat_stats": {
        "CRIT_DMG_": 30.0
      }
    },
    {
      "in_combat_stats": {
        "DAMAGE_TAKEN_RED_": 25.0
      }
    }
  ]
}
```

### 正确示例

```json
{
  "buffs": [
    {
      "in_combat_stats": {
        "CRIT_DMG_": 30.0,
        "DAMAGE_TAKEN_RED_": 25.0
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
"队伍中存在[击破]或[支援]角色时触发：伊德海莉生命值低于50%时"
```

**映射**：
```json
"trigger_conditions": "队伍中存在击破或支援角色，且生命值低于50%时"
```

---

## 📊 完整示例

### 原始数据 (1051.json)

```json
{
  "Id": 1051,
  "Name": "伊德海莉",
  "CodeName": "Yidhari",
  "Rarity": 4,
  "WeaponType": {"6": "命破"},
  "ElementType": {"202": "冰属性"},
  "Passive": {
    "Level": {
      "1051501": {
        "Level": 1,
        "Id": 1051501,
        "Name": [
          "核心被动：拾梦空想",
          "额外能力：完形叙事"
        ],
        "Desc": [
          "伊德海莉会额外根据自身最大生命值提高贯穿力，每1点最大生命值将提高0.1点贯穿力；\n伊德海莉发动招式造成的<color=#98EFF0>冰属性伤害</color>均为贯穿伤害，无视敌人防御，使用贯穿力作为招式伤害倍率；伊德海莉进入战场时即可恢复60闪能，在勘域模式中此效果180秒内最多触发一次，\n伊德海莉的当前生命值百分比越低，招式造成的伤害越高；\n当伊德海莉生命值低于50%时，获得的增益效果达到最大值，攻击造成的伤害最多提升<color=#2BAD00>50%</color>，伊德海莉生命值重新回到50%后，最大值增益效果仍会持续5秒；\n伊德海莉通过招式命中获得喧响值降低，伊德海莉生命值降低时，获得喧响值，每降低1%生命值会获得10点喧响值。",
          "队伍中存在<color=#FFFFFF>[击破]</color>角色或<color=#FFFFFF>[支援]</color>角色时触发：\n伊德海莉生命值低于50%时，暴击伤害提升30%，受到的伤害降低25%；\n伊德海莉处于<color=#FFFFFF>[以太帷幕·涌泉]</color>中时，额外获得以下效果：\n伊德海莉的<color=#FFFFFF>[普通攻击：霜寒拥覆]</color>第三段蓄力攻击、<color=#FFFFFF>[强化特殊技：极寒重碾]</color>的招式结束后，将召唤寒冰触手进行攻击，造成额外伤害，每12秒最多触发1次；\n发动上述招式视为发动<color=#FFFFFF>[强化特殊技]</color>，伤害倍率跟随强化特殊技的技能等级提升。"
        ]
      }
    }
  },
  "Talent": {
    "2": {
      "Level": 2,
      "Name": "何人于此遐思",
      "Desc": "伊德海莉的暴击伤害提升40%；成功触发<color=#FFFFFF>[溯寒]</color>或<color=#FFFFFF>[追碾]</color>后，持续回复闪能，每秒回复0.5点，最多30秒，重复触发时刷新持续时间。"
    }
  }
}
```

### 生成数据 (1051.json)

```json
{
  "agent_id": "1051",
  "name": "伊德海莉",
  "code_name": "Yidhari",
  "rarity": 4,
  "weapon_type": "命破",
  "element_type": "冰属性",
  "core_passive_buffs": [
    {
      "id": "1051_core_passive_1_1",
      "name": "核心被动-低血量伤害提升",
      "description": "当伊德海莉生命值低于50%时，获得的增益效果达到最大值，攻击造成的伤害最多提升50%。",
      "source": "CORE_PASSIVE",
      "context": "IN_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "stack_mode": "full_only",
      "trigger_conditions": "生命值低于50%时",
      "out_of_combat_stats": {},
      "in_combat_stats": {
        "COMMON_DMG_": 50.0
      }
    },
    {
      "id": "1051_core_passive_1_2",
      "name": "核心被动-暴击伤害提升",
      "description": "队伍中存在[击破]或[支援]角色时触发：伊德海莉生命值低于50%时，暴击伤害提升30%，受到的伤害降低25%。",
      "source": "CORE_PASSIVE",
      "context": "IN_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "stack_mode": "full_only",
      "trigger_conditions": "队伍中存在击破或支援角色，且生命值低于50%时",
      "out_of_combat_stats": {},
      "in_combat_stats": {
        "CRIT_DMG_": 30.0,
        "DAMAGE_TAKEN_RED_": 25.0
      }
    },
    {
      "id": "1051_core_passive_1_3",
      "name": "核心被动-以太帷幕生命提升",
      "description": "处于[以太帷幕·涌泉]中时，伊德海莉的最大生命值额外提升5%。",
      "source": "CORE_PASSIVE",
      "context": "IN_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "stack_mode": "full_only",
      "trigger_conditions": "处于以太帷幕·涌泉中时",
      "out_of_combat_stats": {},
      "in_combat_stats": {
        "HP_": 5.0
      }
    }
  ],
  "talent_buffs": [
    {
      "id": "1051_talent_2_1",
      "name": "天赋-暴击伤害提升",
      "description": "伊德海莉的暴击伤害提升40%。",
      "source": "TALENT",
      "context": "OUT_OF_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "stack_mode": "full_only",
      "trigger_conditions": [],
      "out_of_combat_stats": {
        "CRIT_DMG_": 40.0
      },
      "in_combat_stats": {}
    },
    {
      "id": "1051_talent_2_2",
      "name": "天赋-闪能回复",
      "description": "成功触发[溯寒]或[追碾]后，持续回复闪能，每秒回复0.5点，最多30秒。",
      "source": "TALENT",
      "context": "IN_COMBAT",
      "target": {
        "target_self": true,
        "target_enemy": false,
        "target_teammate": false,
        "target_bund": false
      },
      "max_stacks": 1,
      "stack_mode": "full_only",
      "trigger_conditions": "触发溯寒或追碾后",
      "out_of_combat_stats": {},
      "in_combat_stats": {
        "ENER_REGEN_": 0.5
      }
    }
  ],
  "potential_buffs": []
}
```

### 潜能觉醒示例 (1171.json)

```json
{
  "agent_id": "1171",
  "name": "柏妮思",
  "code_name": "Burnice",
  "rarity": 4,
  "weapon_type": "异常",
  "element_type": "火属性",
  "core_passive_buffs": [],
  "talent_buffs": [],
  "conversion_buffs": [],
  "potential_buffs": [
    {
      "id": "1171_potential_6_1",
      "name": "潜能觉醒-能量转异常掌控",
      "description": "每0.1点初始能量自动回复，异常掌控额外提升2.5点，最多提升25点。",
      "source": "POTENTIAL",
      "from_property": "ENER_REGEN_BASE",
      "to_property": "ANOM_MAS",
      "conversion_ratio": 10.0,
      "trigger_conditions": "初始能量自动回复大于等于1.8点时",
      "is_active": true
    },
    {
      "id": "1171_potential_6_2",
      "name": "潜能觉醒-能量转伤害",
      "description": "每0.1点初始能量自动回复，造成的伤害提升2%，最多提升20%。",
      "source": "POTENTIAL",
      "from_property": "ENER_REGEN_BASE",
      "to_property": "COMMON_DMG",
      "conversion_ratio": 10.0,
      "trigger_conditions": "初始能量自动回复大于等于1.8点时",
      "is_active": true
    }
  ]
}
```

---

## ⚠️ 注意事项

### 1. 只生成属性加成BUFF

**不生成**：
- ❌ 技能倍率数据（伤害倍率、失衡倍率等）
- ❌ 技能等级提升（技能等级+2等）
- ❌ 特殊机制（贯穿力、喧响值等）
- ❌ 能量回复机制（进入战场恢复闪能等）

**只生成**：
- ✅ 基础属性加成（攻击力、生命值、暴击率等）
- ✅ 元素伤害加成
- ✅ 技能伤害加成
- ✅ Debuff（受到的伤害降低等）
- ✅ 能量自动回复

### 2. 属性类型必须使用PropertyType枚举值

**错误示例**:
```json
"in_combat_stats": {
  "CRIT_RATE_": 40.0,    // ❌ 错误！应该是CRIT_DMG_
  "DMG_": 50.0           // ❌ 错误！应该是COMMON_DMG_
}
```

**正确示例**:
```json
"in_combat_stats": {
  "CRIT_DMG_": 40.0,     // ✅ 正确
  "COMMON_DMG_": 50.0    // ✅ 正确
}
```

### 3. trigger_conditions是描述文本

**错误示例**:
```json
"trigger_conditions": ["HP_BELOW_50", "TEAM_BREAK_SUPPORT"]  // ❌ 错误！这是枚举值
```

**正确示例**:
```json
"trigger_conditions": "队伍中存在击破或支援角色，且生命值低于50%时"  // ✅ 正确：描述文本
```

### 4. 多个效果放在同一个buff

当一个核心被动或天赋包含多个独立的加成时，应该将这些加成放在同一个buff的 `in_combat_stats` 里。

**错误示例**:
```json
"buffs": [
  {
    "in_combat_stats": {
      "CRIT_DMG_": 30.0
    }
  },
  {
    "in_combat_stats": {
      "DAMAGE_TAKEN_RED_": 25.0
    }
  }
]
```

**正确示例**:
```json
"buffs": [
  {
    "in_combat_stats": {
      "CRIT_DMG_": 30.0,
      "DAMAGE_TAKEN_RED_": 25.0
    }
  }
]
```

### 5. 区分OUT_OF_COMBAT和IN_COMBAT

**OUT_OF_COMBAT**：
- 永久生效的属性加成（如暴击伤害提升40%）
- 不需要触发条件

**IN_COMBAT**：
- 需要触发条件的效果（如生命值低于50%时）
- 有持续时间的效果

### 6. 特殊机制不生成BUFF

**不生成BUFF的特殊机制**：
- 贯穿力机制（每1点最大生命值提高0.1点贯穿力）
- 贯穿伤害（冰属性伤害均为贯穿伤害）
- 能量回复机制（进入战场恢复60闪能）
- 喧响值获取机制（每降低1%生命值获得10点喧响值）
- 技能等级提升（技能等级+2）

---

## ✅ 验证清单

生成后的数据必须满足：

- [ ] 不包含技能倍率数据
- [ ] 不包含技能等级提升
- [ ] 不包含特殊机制（贯穿力、喧响值等）
- [ ] 所有属性类型使用正确的PropertyType枚举值
- [ ] `trigger_conditions` 是描述文本，不是枚举值
- [ ] 多个效果放在同一个buff的stats里
- [ ] 正确区分OUT_OF_COMBAT和IN_COMBAT
- [ ] 数值提取正确（百分比和点数区分）
- [ ] **所有buff都包含 `target` 字段**
- [ ] **根据BUFF描述正确设置 `target` 的四个布尔值**
- [ ] **转换类BUFF（ConversionBuff）不需要 `target` 字段**

---

## 📚 附录

### PropertyType枚举值参考

详见 `src/zzz_od/application/optimizer/zzz_models/base.py`

### 使用方法

```python
from zzz_od.application.optimizer.zzz_models.buff import Buff, BuffTarget
from zzz_od.application.optimizer.zzz_models.base import PropertyType, BuffSource, BuffContext

# 创建核心被动BUFF
core_passive_buff = Buff(
    id="1051_core_passive_1_1",
    name="核心被动-低血量伤害提升",
    description="当伊德海莉生命值低于50%时，获得的增益效果达到最大值，攻击造成的伤害最多提升50%。",
    source=BuffSource.CORE_PASSIVE,
    context=BuffContext.IN_COMBAT,
    target=BuffTarget(  # 默认值，可以省略
        target_self=True,
        target_enemy=False,
        target_teammate=False,
        target_bund=False
    ),
    max_stacks=1,
    stack_mode="full_only",
    trigger_conditions="生命值低于50%时",
    out_of_combat_stats={},
    in_combat_stats={
        PropertyType.COMMON_DMG: 50.0
    }
)

# 创建天赋BUFF（默认target，可以省略）
talent_buff = Buff(
    id="1051_talent_2_1",
    name="天赋-暴击伤害提升",
    description="伊德海莉的暴击伤害提升40%。",
    source=BuffSource.TALENT,
    context=BuffContext.OUT_OF_COMBAT,
    # target=BuffTarget()  # 默认值，可以省略
    max_stacks=1,
    stack_mode="full_only",
    trigger_conditions=[],
    out_of_combat_stats={
        PropertyType.CRIT_DMG: 40.0
    },
    in_combat_stats={}
)

# 创建队友生效BUFF
teammate_buff = Buff(
    id="1091_talent_4",
    name="TALENT-属性异常积蓄效率提升",
    description": "触发[霜灼·破]时，使全队角色属性异常积蓄效率提升20%，持续10秒。",
    source=BuffSource.TALENT,
    context=BuffContext.IN_COMBAT,
    target=BuffTarget(  # 对队友生效
        target_self=True,
        target_enemy=False,
        target_teammate=True,
        target_bund=False
    ),
    max_stacks=1,
    stack_mode="full_only",
    trigger_conditions="触发霜灼·破时",
    out_of_combat_stats={},
    in_combat_stats={
        PropertyType.ANOMALY_BUILDUP: 20.0
    }
)
```