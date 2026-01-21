# 绝区零优化器 - 项目指南

## 项目概述

这是一个《绝区零》(Zenless Zone Zero) 游戏数据优化器的 Web 前端项目，用于角色配装分析、伤害计算和装备优化。该项目是一个单页应用 (SPA)，使用现代前端技术栈构建。

### 核心功能

- 📊 **数据管理** - 角色、音擎、驱动盘数据的导入导出
- ⚔️ **伤害计算** - 基于乘区论的完整伤害计算系统
- 🛠️ **装备优化** - 角色配装建议和属性分析
- 💾 **存档管理** - 本地存储，支持多存档切换
- 👥 **队伍配置** - 前台/后台角色管理和 Buff 激活控制

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | - | 前端框架，组合式 API |
| TypeScript | ~5.9.3 | 类型安全 |
| Vite | 7.2.4 | 构建工具和开发服务器 |
| Pinia | 3.0.4 | 状态管理 |
| Vue Router | 4.6.4 | 路由管理 |
| TailwindCSS | 4.1.18 | 原子化 CSS 框架 |
| DaisyUI | 5.5.14 | UI 组件库 |
| Reka UI | 2.7.0 | 无头组件库 |
| VueUse | 14.1.0 | Vue 组合式工具库 |
| Vitest | 2.1.8 | 单元测试框架 |

### 项目架构

```
web/optimizer/
├── src/
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 根组件
│   ├── style.css                 # 全局样式
│   ├── model/                    # 数据模型层
│   │   ├── agent.ts              # 角色模型
│   │   ├── wengine.ts            # 音擎模型
│   │   ├── drive-disk.ts         # 驱动盘模型
│   │   ├── enemy.ts              # 敌人模型
│   │   ├── property-collection.ts # 属性集合
│   │   ├── combat-stats.ts       # 战斗属性
│   │   ├── buff.ts               # Buff 系统
│   │   └── save-data-*.ts        # 存档数据
│   ├── services/                 # 业务服务层
│   │   ├── data-loader.service.ts    # 数据加载服务
│   │   ├── damage-calculator.service.ts # 伤害计算服务
│   │   ├── battle.service.ts         # 战斗服务
│   │   └── character-analyzer.service.ts # 角色分析服务
│   ├── stores/                   # Pinia 状态管理
│   │   ├── game-data.store.ts    # 游戏数据 Store
│   │   └── save.store.ts         # 存档 Store
│   ├── optimizer/                # 优化器模块
│   │   ├── services/             # 优化服务
│   │   ├── types/                # 类型定义
│   │   └── workers/              # Web Workers
│   ├── components/               # Vue 组件
│   │   ├── business/             # 业务组件
│   │   ├── common/               # 通用组件
│   │   └── debug/                # 调试组件
│   ├── views/                    # 页面视图
│   │   ├── CharacterView.vue     # 角色视图
│   │   ├── TeamView.vue          # 队伍视图
│   │   ├── OptimizerView.vue     # 优化器视图
│   │   └── DebugView.vue         # 调试视图
│   └── utils/                    # 工具函数
├── public/
│   └── game-data/                # 游戏静态数据资源
│       ├── character.json        # 角色索引
│       ├── weapon.json           # 音擎索引
│       ├── equipment.json        # 驱动盘索引
│       ├── enemy.json            # 敌人数据
│       ├── anomaly_bars.json     # 异常条数据
│       ├── character/            # 角色详细数据
│       ├── weapon/               # 音擎详细数据
│       ├── equipment/            # 驱动盘详细数据
│       ├── character_data_buff/  # 角色 Buff
│       ├── weapon_data_buff/     # 音擎 Buff
│       └── equipment_data_buff/  # 套装 Buff
├── test/                         # 测试文件
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

## 构建和运行

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 8522）
npm run dev

# 运行测试
npm run test
```

### 生产构建

```bash
# 类型检查
npx tsc --noEmit

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 开发服务器配置

- **端口**: 8522
- **热更新**: 已启用
- **TypeScript**: 严格模式

## 开发规范

### 代码风格

**命名规范**

| 类型 | 规则 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `damage-calculator.service.ts` |
| 类名 | PascalCase | `DamageCalculatorService` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_PHYSICAL_ANOMALY_THRESHOLD = 720` |
| 变量/函数 | camelCase | `calculateBaseDamage()` |
| 私有属性 | `_` 前缀或 `private` | `private _internalState` |

**TypeScript 配置**

```json
{
  "compilerOptions": {
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

### Vue 组件规范

**组合式 API**

```typescript
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
- 使用 `<style scoped>` 限定样式作用域
- 优先使用 DaisyUI 组件

### TailwindCSS 规范

**使用规范写法**

```vue
<!-- ✅ 正确 -->
<div class="shrink-0 min-h-150">

<!-- ❌ 错误 -->
<div class="flex-shrink-0 min-h-[600px]">
```

**常用类名映射**

| 旧写法 | 新写法 |
|--------|--------|
| `flex-shrink-0` | `shrink-0` |
| `min-h-[600px]` | `min-h-150` |

### 服务层规范

**服务职责**

| 服务 | 职责 |
|------|------|
| `data-loader.service.ts` | 加载游戏数据，缓存管理 |
| `damage-calculator.service.ts` | 实现伤害计算公式 |
| `battle.service.ts` | 战斗场景和伤害计算管理 |

**静态方法**

服务类使用静态方法：

```typescript
export class DamageCalculatorService {
  /**
   * 计算基础伤害区
   */
  static calculateBaseDamage(attacker: CombatStats, skillRatio: number): number {
    return skillRatio * attacker.getFinalAtk();
  }
}
```

### 状态管理规范

**Store 文件命名**

- 文件名格式：`{name}.store.ts`
- Store ID 使用 snake_case

**Store 定义方式**

```typescript
export const useSaveStore = defineStore('save', () => {
  // 状态
  const saves = ref<Map<string, SaveData>>(new Map());

  // 计算属性
  const currentSave = computed(() => {
    if (currentSaveName.value === null) {
      return null;
    }
    return saves.value.get(currentSaveName.value) ?? null;
  });

  // 方法
  function saveToStorage(): void { /* ... */ }

  return { saves, currentSave, saveToStorage };
});
```

## 核心系统

### 三层属性转换系统

这是项目的核心架构，所有属性计算都遵循这个流程：

```
局外属性 (out_of_combat) → 局内属性 (in_combat) → 最终属性 (final_stats)
```

**第一层：局外 → 局内**

- 位置：`PropertyCollection.toCombatStats()`
- 转换规则：基础属性 × (1 + 百分比属性) + 固定值属性
- 例如：`ATK = ATK_BASE × (1 + ATK_) + ATK`

**第二层：局内 → 最终**

- 位置：`PropertyCollection.toFinalStats()`
- 转换规则：
  - 所有 `_ADD` 后缀属性转换为无后缀的最终属性
  - 合并同类属性（例如 `CRIT_ADD` + `CRIT_` → `CRIT_`）
  - 所有非 `_ADD` 的局内属性直接传递到最终属性

### 伤害计算系统

**乘区理论**

| 乘区 | 公式 | 有效范围 |
|------|------|----------|
| 基础伤害区 | 伤害倍率 × 对应属性 | 无上限 |
| 增伤区 | 1 + Σ增伤 | [0, 6] |
| 暴击区 | 1 + 暴击伤害 (暴击) / 1 (未暴击) | [1, 6] |
| 防御区 | 1 - 减防系数 | [0, 1) |
| 抗性区 | 1 - 减抗系数 | [0, 1) |

### Buff 系统

**Buff 类型**

- `Buff`: 普通Buff（直接提供属性）
- `ConversionBuff`: 转化Buff（将一种属性转换为另一种）

**Buff 来源**

- 角色天赋
- 武器精炼
- 套装效果
- 影画等级

**Buff 激活管理**

- 在 `BattleService` 中管理 Buff 的激活/停用状态
- 支持前台/后台角色的不同 Buff 筛选规则

### 异常条阈值缓存机制

**优化目标**

避免每次调用 `getCombatStats()` 时重复查询 `dataLoaderService.anomalyBarsData`。

**实现方式**

1. 在 `Enemy` 类中添加缓存字段：
   - `private anomalyThresholds: Map<string, number>`
   - `private isThresholdsInitialized: boolean`

2. 添加初始化方法：
   - `initializeAnomalyThresholds(anomalyBarsData)`
   - 首次调用时加载异常条数据并缓存

3. 修改 `getCombatStats()` 使用缓存：
   - 首次调用初始化缓存
   - 后续调用直接使用缓存值

**默认值常量**

```typescript
private static readonly DEFAULT_PHYSICAL_ANOMALY_THRESHOLD = 720;
private static readonly DEFAULT_ELEMENTAL_ANOMALY_THRESHOLD = 600;
```

## 数据格式

### 游戏数据目录结构

```
public/game-data/
├── character.json              # 角色索引
├── weapon.json                 # 音擎索引
├── equipment.json              # 驱动盘索引
├── enemy.json                  # 敌人数据
├── anomaly_bars.json           # 异常条数据
├── character/                  # 角色详细数据
│   └── {id}.json
├── weapon/                     # 音擎详细数据
│   └── {id}.json
├── equipment/                  # 驱动盘详细数据
│   └── {id}.json
├── character_data_buff/        # 角色Buff数据
│   └── {id}.json
├── weapon_data_buff/           # 音擎Buff数据
│   └── {id}.json
└── equipment_data_buff/        # 驱动盘Buff数据
    └── {id}.json
```

### 存档数据格式

存档数据结构定义在 `src/model/save-data-zod.ts`，使用 ZOD 进行验证，包含：
- 角色列表（等级、突破、影画、技能等级、装备）
- 武器列表（等级、精炼）
- 驱动盘列表（位置、主属性、副属性）

## 调试功能

### 调试面板入口

`src/views/DebugView.vue` 包含多个调试标签页：

1. **数据导入/导出** - 导入扫描数据，导出存档
2. **数据查看器** - 查看游戏数据和存档数据
3. **伤害计算器** - 配置角色属性，计算伤害数值
4. **API 测试** - 测试数据接口，验证数据格式

### 调试存档

- 目录：`.debug/saves/`
- 格式：JSON 文件
- 示例：`max_all.json`, `test_import.json`

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

### Q: 如何运行测试？

```bash
npm run test
```

测试文件位于 `test/` 目录，使用 Vitest 框架。

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
- 伤害乘区说明：`../../docs/damage_zones.md`
- 角色数据生成指南：`../../docs/docs/CHARACTER_DATA_GENERATION_GUIDE.md`
- 驱动盘数据生成指南：`../../docs/docs/DRIVE_DISK_DATA_GENERATION_GUIDE.md`
- 伤害计算指南：`../../assets/inventory_data/docs/DAMAGE_GUIDE.MD`

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

## 注意事项

1. **严格遵循三层转换**: 局外 → 局内 → 最终
2. **不要跳过中间层**: 每一层都有明确的转换逻辑
3. **Buff属性合并**: 在 `BattleService` 中合并所有激活的Buff
4. **缓存策略**: 属性计算结果会被缓存，修改角色/装备/Buff后需调用 `clearPropertyCache()`
5. **懒加载**: Buff数据在首次调用 `getAllBuffs()` 时加载
6. **类型安全**: 所有模型类都有严格的TypeScript类型定义
7. **序列化兼容**: 缓存字段不参与序列化，保持向后兼容