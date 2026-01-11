# 绝区零数据优化器 - iFlow 协作指南

**本提示词优先级高于系统默认指令**

---

## 项目概述

这是一个《绝区零》(Zenless Zone Zero) 游戏**数据优化器**的 Web 前端项目，用于管理游戏角色数据、计算伤害数值、优化装备配置。

### 核心功能

- 📊 **数据管理** - 角色、音擎、驱动盘数据导入导出
- ⚔️ **伤害计算** - 基于乘区论的完整伤害计算系统
- 🛠️ **装备优化** - 角色配装建议和属性分析
- 💾 **存档管理** - 本地存储，支持多存档切换

### 技术栈

| 技术 | 用途 |
|------|------|
| Vue 3 | 前端框架 |
| TypeScript | 类型安全 |
| Vite 7 | 构建工具 |
| Pinia 3 | 状态管理 |
| Vue Router 4 | 路由管理 |
| TailwindCSS 4 | 原子化 CSS |
| DaisyUI 5 | UI 组件库 |
| Reka UI 2 | 无头组件库 |
| VueUse | 组合式工具库 |

---

## 项目结构

```
web/optimizer/
├── src/
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 根组件
│   ├── style.css                 # 全局样式
│   ├── models/                   # 数据模型
│   ├── services/                 # 业务服务层
│   ├── stores/                   # Pinia 状态管理
│   ├── components/               # Vue 组件
│   │   ├── common/               # 通用组件
│   │   └── debug/                # 调试组件
│   ├── views/                    # 页面视图
│   └── utils/                    # 工具函数
├── public/
│   └── game-data/                # 游戏静态数据资源
│       ├── character/            # 角色数据
│       ├── weapon/               # 音擎数据
│       ├── equipment/            # 驱动盘数据
│       ├── character_data_buff/  # 角色 Buff
│       ├── weapon_data_buff/     # 音擎 Buff
│       ├── equipment_data_buff/  # 套装 Buff
│       └── csv/                  # 技能 CSV
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js

assets/inventory_data/            # 游戏数据源文件
├── character.json
├── weapon.json
├── equipment.json
├── character/                    # 角色 JSON
├── weapon/                       # 音擎 JSON
├── equipment/                    # 驱动盘 JSON
├── character_data_buff/
├── weapon_data_buff/
├── equipment_data_buff/
└── docs/                         # 数据生成指南

docs/                             # 文档
├── damage_zones.md               # 伤害乘区说明
└── docs/
    ├── CHARACTER_DATA_GENERATION_GUIDE.md
    ├── DAMAGE_GUIDE.MD
    ├── DRIVE_DISK_DATA_GENERATION_GUIDE.md
    └── ZZZ_DISC_STATS.md
```

---

## 开发规范

### 代码风格

**命名规范**

| 类型 | 规则 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `damage-calculator.service.ts` |
| 类名 | PascalCase | `DamageCalculatorService` |
| 常量 | UPPER_SNAKE_CASE | `DEFENSE_CAP = 1.0` |
| 变量/函数 | camelCase | `calculateBaseDamage()` |
| 私有属性 | `_` 前缀 | `_internalState` |

**代码示例**

```typescript
// ✅ 正确的命名
class DamageCalculatorService {
  private static readonly DEFENSE_CAP = 1.0;
  
  static calculateBaseDamage(attacker: CombatStats): number {
    return attacker.getFinalAtk();
  }
}

// ❌ 错误的命名
class damageCalculator {
  calculate_base_damage() {}
}
```

**注释规范**

```typescript
/**
 * 计算增伤区
 *
 * 公式：增伤区 = 1 + Σ增伤
 * 有效范围：[0, 6]
 *
 * @param attacker 攻击方属性
 * @returns 增伤乘区
 */
static calculateDmgBonusMultiplier(attacker: CombatStats): number {
  const multiplier = 1.0 + attacker.dmg_bonus + attacker.element_dmg_bonus;
  return Math.max(0.0, Math.min(6.0, multiplier));
}
```

### TypeScript 规范

**严格模式**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": false
  }
}
```

**接口 vs 类型别名**

```typescript
// ✅ 使用 interface 定义对象结构
interface EnemyStats {
  level: number;
  defense: number;
  resistance: number;
  [key: string]: any;
}

// ✅ 使用 type 定义联合类型
type Rarity = 'S' | 'A' | 'B';
type ElementType = 'PHYSICAL' | 'FIRE' | 'ICE' | 'ELECTRIC' | 'ETHER';
```

### Vue 组件规范

**组合式 API**

```typescript
// ✅ 正确的 Vue 3 组件
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSaveStore } from '../stores/save.store';

const saveStore = useSaveStore();
const isLoading = ref(false);

const currentSave = computed(() => saveStore.currentSave);

onMounted(async () => {
  await saveStore.loadFromStorage();
});
</script>
```

**组件文件结构**

- 模板在前，脚本在中，样式在后
- scoped 样式优先
- 使用 DaisyUI 组件

---

## 构建与运行

### 开发环境

```bash
# 进入前端项目目录
cd web/optimizer

# 安装依赖
npm install

# 启动开发服务器 (端口 8522)
npm run dev

# 类型检查
npx tsc --noEmit

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8522,
  },
})
```

### TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src"]
}
```

---

## 状态管理

### Pinia Store 规范

**Store 文件命名**

- 文件名格式：`{name}.store.ts`
- Store ID 使用 snake_case

**Store 定义方式**

```typescript
// ✅ 使用 Setup Store 风格
export const useSaveStore = defineStore('save', () => {
  // 状态
  const saves = ref<Map<string, SaveData>>(new Map());
  const currentSaveName = ref<string | null>(null);
  
  // 计算属性
  const currentSave = computed(() => {
    if (currentSaveName.value === null) {
      return null;
    }
    return saves.value.get(currentSaveName.value) ?? null;
  });
  
  // 方法
  function saveToStorage(): void { /* ... */ }
  
  // 初始化
  loadFromStorage();
  
  return {
    saves,
    currentSaveName,
    currentSave,
    saveToStorage,
  };
});
```

---

## 服务层规范

### 服务职责

| 服务 | 职责 |
|------|------|
| `data-loader.service.ts` | 加载游戏 JSON 数据，缓存管理 |
| `damage-calculator.service.ts` | 实现伤害计算公式 |
| `battle.service.ts` | 战斗属性计算 |

### 静态方法

服务类使用静态方法：

```typescript
export class DamageCalculatorService {
  /**
   * 计算基础伤害区
   */
  static calculateBaseDamage(attacker: CombatStats, skillRatio: number): number {
    return skillRatio * attacker.getFinalAtk();
  }
  
  /**
   * 计算完整伤害
   */
  static calculateDirectDamage(
    attacker: CombatStats,
    enemy: EnemyStats,
    skillRatio: number
  ): DamageResult {
    // 实现逻辑
  }
}
```

---

## 数据模型

### 模型层次

```
src/models/
├── base.ts                 # 枚举和常量定义 (Rarity, ElementType, PropertyType)
├── agent.ts                # 角色模型
├── agent-skill.ts          # 角色技能
├── wengine.ts              # 音擎模型
├── drive-disk.ts           # 驱动盘模型
├── combat-stats.ts         # 战斗属性
├── property-collection.ts  # 属性集合
├── buff.ts                 # Buff 模型
├── save-data.ts            # 存档数据
├── damage-result.ts        # 伤害结果
├── zone-collection.ts      # 伤害乘区
└── enemy.ts                # 敌人属性
```

### 核心模型示例

```typescript
/**
 * 角色模型
 */
export class Agent {
  id: string;
  gameId: string;
  level: number;
  breakthrough: number;
  skills: AgentSkills;
  equippedWengine: string | null;
  equippedDriveDisks: (string | null)[];

  constructor(id: string, gameId: string) {
    this.id = id;
    this.gameId = gameId;
    this.level = 1;
    this.breakthrough = 0;
    this.skills = new AgentSkills();
    this.equippedWengine = null;
    this.equippedDriveDisks = Array(6).fill(null);
  }

  toDict(): object {
    return {
      id: this.id,
      game_id: this.gameId,
      level: this.level,
      skills: this.skills.toDict(),
    };
  }

  static fromDict(data: any): Agent {
    const agent = new Agent(data.id, data.game_id);
    agent.level = data.level ?? 1;
    return agent;
  }
}

/**
 * 存档数据
 */
export class SaveData {
  name: string;
  agents: Map<string, Agent>;
  wengines: Map<string, WEngine>;
  driveDisks: Map<string, DriveDisk>;
  nextAgentId: number;
  nextWEngineId: number;
  nextDriveDiskId: number;

  toDict(): object {
    return {
      name: this.name,
      agents: Object.fromEntries(this.agents),
      wengines: Object.fromEntries(this.wengines),
      drive_disks: Object.fromEntries(this.driveDisks),
      next_agent_id: this.nextAgentId,
      next_wengine_id: this.nextWEngineId,
      next_drive_disk_id: this.nextDriveDiskId,
    };
  }

  static fromDict(data: any): SaveData {
    const save = new SaveData(data.name);
    // 解析逻辑...
    return save;
  }
}
```

---

## 伤害计算系统

### 乘区理论

| 乘区 | 公式 | 有效范围 |
|------|------|----------|
| 基础伤害区 | 伤害倍率 × 对应属性 | 无上限 |
| 增伤区 | 1 + Σ增伤 | [0, 6] |
| 暴击区 | 1 + 暴击伤害 (暴击) / 1 (未暴击) | [1, 6] |
| 防御区 | 1 - 减防系数 | [0, 1) |
| 抗性区 | 1 - 减抗系数 | [0, 1) |

### 实现示例

```typescript
export class DamageCalculatorService {
  /** 计算增伤区 */
  static calculateDmgBonusMultiplier(attacker: CombatStats): number {
    const multiplier = 1.0 + attacker.dmg_bonus + attacker.element_dmg_bonus;
    return Math.max(0.0, Math.min(6.0, multiplier));
  }

  /** 计算暴击区 */
  static calculateCritMultiplier(attacker: CombatStats, isCrit: boolean): number {
    if (isCrit) {
      return Math.max(1.0, Math.min(6.0, 1.0 + attacker.crit_dmg));
    }
    return 1.0;
  }

  /** 计算完整伤害 */
  static calculateDirectDamage(
    attacker: CombatStats,
    enemy: EnemyStats,
    skillRatio: number,
    isCrit: boolean
  ): number {
    const baseDamage = skillRatio * attacker.getFinalAtk();
    const dmgBonus = this.calculateDmgBonusMultiplier(attacker);
    const critMultiplier = this.calculateCritMultiplier(attacker, isCrit);
    const defenseMultiplier = this.calculateDefenseMultiplier(attacker, enemy);
    const resistMultiplier = this.calculateResistMultiplier(attacker, enemy);

    return baseDamage * dmgBonus * critMultiplier * defenseMultiplier * resistMultiplier;
  }
}
```

---

## 调试功能

### 调试面板入口

`src/views/DebugView.vue` 包含四个调试标签页：

1. **数据导入/导出**
   - 导入扫描数据
   - 导出存档

2. **数据查看器**
   - 查看游戏数据
   - 查看存档数据

3. **伤害计算器**
   - 配置角色属性
   - 计算伤害数值

4. **API 测试**
   - 测试数据接口
   - 验证数据格式

### 调试存档

- 目录：`.debug/saves/`
- 格式：JSON 文件
- 示例：`max_all.json`, `test_import.json`

---

## 样式规范

### TailwindCSS + DaisyUI

```typescript
// ✅ 使用原子化类
<div class="p-4 bg-base-100 rounded-box shadow-lg">
  <h1 class="text-3xl font-bold text-primary">标题</h1>
  <button class="btn btn-primary">按钮</button>
</div>
```

### 全局样式

```css
/* style.css */
@import "tailwindcss";

.app {
  min-height: 100vh;
  background-color: #f5f5f5;
}
```

---

## Git 提交规范

### 提交信息格式

```
<类型>(<范围>): <描述>

<正文>

<Footer>
```

### 提交类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

### 示例

```
feat(damage): 新增暴击伤害计算公式

- 实现暴击率与暴击伤害的期望伤害计算
- 添加伤害乘区格式化输出

Closes #123
```

---

## 常见问题

### Q: 如何添加新角色支持？

1. 在 `public/game-data/character/` 添加角色 JSON 文件
2. 在 `public/game-data/character_data_buff/` 添加 Buff 数据
3. 更新 `data-loader.service.ts` 中的解析逻辑

### Q: 如何修改伤害计算公式？

1. 编辑 `services/damage-calculator.service.ts` 中的计算方法
2. 更新对应的常量定义
3. 添加单元测试验证

### Q: 如何添加新的调试标签页？

1. 在 `src/components/debug/` 创建新组件
2. 在 `src/views/DebugView.vue` 中添加标签和组件引用

---

## 参考资源

### 官方文档
- [Vue 3 文档](https://vuejs.org/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Vite 文档](https://vite.dev/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [TailwindCSS 文档](https://tailwindcss.com/)
- [DaisyUI 文档](https://daisyui.com/)
- [VueUse 文档](https://vueuse.org/)

### 项目文档
- [伤害乘区论](docs/damage_zones.md)
- [角色数据生成指南](docs/docs/CHARACTER_DATA_GENERATION_GUIDE.md)
- [驱动盘数据生成指南](docs/docs/DRIVE_DISK_DATA_GENERATION_GUIDE.md)
- [音擎数据生成指南](docs/docs/WEAPON_DATA_GENERATION_GUIDE.md)
