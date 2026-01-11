# 绝区零优化器 - Python项目转纯前端TypeScript实施计划

## 项目概述

将现有的Python游戏优化器项目（绝区零优化器）完全转换为纯前端TypeScript版本，使用Vue 3 + Vite + DaisyUI技术栈。

**现有Python项目特点：**
- 19个数据模型（Agent、WEngine、DriveDisk、CombatStats等）
- 15个业务服务（数据加载、伤害计算、战斗管理等）
- 完整的游戏数据JSON文件（角色、音擎、驱动盘）
- 存档管理系统（JSON文件存储）

**转换目标：**
- 纯前端实现，无需Python后端
- 所有计算逻辑在浏览器中完成
- 游戏数据作为静态资源加载
- 用户数据存储在localStorage

---

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **UI组件库**:
  - Reka UI - 无样式Vue组件库（提供组件逻辑和可访问性）
  - DaisyUI - Tailwind CSS组件样式库
- **构建工具**: Vite
- **开发语言**: TypeScript
- **状态管理**: Pinia
- **路由**: Vue Router
- **数据存储**:
  - 游戏数据: 静态资源 (public/game-data/)
  - 用户数据: localStorage
- **JSON编辑器**: @codemirror/lang-json (用于Debug页面)

---

## 项目目录结构

```
zzz-optimizer-frontend/
├── public/
│   └── game-data/                    # 游戏基础数据(从Python项目迁移)
│       ├── character/                # 角色JSON文件
│       ├── weapon/                   # 音擎JSON文件
│       ├── equipment/                # 驱动盘JSON文件
│       ├── character_data_buff/      # 角色Buff数据
│       ├── weapon_data_buff/         # 音擎Buff数据
│       ├── equipment_data_buff/      # 驱动盘套装Buff数据
│       └── csv/                      # 技能数据CSV
│
├── src/
│   ├── models/                       # 数据模型层(对应Python的zzz_models)
│   │   ├── base.ts                   # 基础枚举类型
│   │   ├── agent.ts                  # 角色模型
│   │   ├── wengine.ts                # 音擎模型
│   │   ├── drive-disk.ts             # 驱动盘模型
│   │   ├── combat-stats.ts           # 战斗属性模型
│   │   ├── buff.ts                   # Buff模型
│   │   ├── save-data.ts              # 存档数据模型
│   │   └── ...                       # 其他模型
│   │
│   ├── services/                     # 业务服务层(对应Python的services)
│   │   ├── data-loader.service.ts    # 数据加载服务
│   │   ├── agent.service.ts          # 角色服务
│   │   ├── damage-calculator.service.ts # 伤害计算服务
│   │   ├── battle.service.ts         # 战斗服务
│   │   └── ...                       # 其他服务
│   │
│   ├── stores/                       # Pinia状态管理
│   │   ├── game-data.store.ts        # 游戏数据Store
│   │   ├── save.store.ts             # 存档管理Store
│   │   ├── battle.store.ts           # 战斗状态Store
│   │   └── ui.store.ts               # UI状态Store
│   │
│   ├── views/                        # 页面组件
│   │   ├── DebugView.vue             # Debug页面(初期重点)
│   │   └── ...                       # 其他页面(后续)
│   │
│   ├── components/                   # 可复用组件
│   │   ├── debug/                    # Debug相关组件
│   │   │   ├── DataImportExport.vue  # 数据导入导出
│   │   │   ├── ApiTester.vue         # API测试面板
│   │   │   ├── DataInspector.vue     # 数据查看器
│   │   │   └── DamageCalculator.vue  # 伤害计算器
│   │   └── common/                   # 通用组件
│   │       ├── JsonEditor.vue        # JSON编辑器
│   │       └── DataTable.vue         # 数据表格
│   │
│   ├── utils/                        # 工具函数
│   │   ├── storage.ts                # localStorage封装
│   │   ├── json.ts                   # JSON处理
│   │   └── format.ts                 # 格式化工具
│   │
│   ├── App.vue
│   └── main.ts
```

---

## 关键模块设计

### 1. 数据模型层 (src/models/)

**核心设计原则：**
- 使用 TypeScript Class (需要方法和逻辑)
- 包含序列化/反序列化方法 (toJSON/fromJSON)
- 完整类型定义和枚举

**关键模型：**

#### 1.1 base.ts - 基础枚举
```typescript
export enum Rarity { S = 4, A = 3, B = 2 }
export enum ElementType { PHYSICAL = 200, FIRE = 201, ICE = 202, ... }
export enum WeaponType { ATTACK = 1, STUN = 2, ANOMALY = 3, ... }
export enum PropertyType {
  HP_BASE = 11001, ATK_BASE = 12001,
  CRIT_RATE = 20103, CRIT_DMG = 21103, ...
}
```

#### 1.2 agent.ts - 角色模型
```typescript
export class Agent {
  id: string;
  gameId: string;
  level: number;
  breakthrough: number;
  skills: AgentSkills;
  equippedWengine: string | null;
  equippedDriveDisks: (string | null)[];

  // 核心方法
  getCombatStats(context: OptimizerContext): CombatStats;
  toJSON(): object;
  static fromJSON(data: any): Agent;
}
```

#### 1.3 combat-stats.ts - 战斗属性
```typescript
export class CombatStats {
  baseAtk: number;  // 局内基础 = 局外最终
  atkPercent: number;  // 局内buff
  critRate: number;
  critDmg: number;

  getFinalAtk(): number;
  static fromPropertyCollections(collections: PropertyCollection[]): CombatStats;
}
```

#### 1.4 save-data.ts - 存档数据
```typescript
export class SaveData {
  name: string;
  agents: Map<string, Agent>;
  wengines: Map<string, WEngine>;
  driveDisks: Map<string, DriveDisk>;
  nextAgentId: number;  // 10001+
  nextWEngineId: number;  // 30001+
  nextDriveDiskId: number;  // 20001+

  toJSON(): object;
  static fromJSON(data: any): SaveData;
}
```

### 2. 服务层 (src/services/)

**核心设计原则：**
- 单例模式 (DataLoaderService)
- 静态方法集合 (DamageCalculatorService)
- 无状态服务

**关键服务：**

#### 2.1 data-loader.service.ts - 数据加载
```typescript
export class DataLoaderService {
  private static instance: DataLoaderService;
  private characterData: Map<string, any>;

  async initialize(): Promise<void>;  // 加载索引文件
  async getCharacterDetail(gameId: string): Promise<any>;  // 按需加载
  getCharacterInfo(gameId: string): any;  // 从缓存获取
}
```

#### 2.2 damage-calculator.service.ts - 伤害计算
```typescript
export class DamageCalculatorService {
  static calculateBaseDamage(attacker: CombatStats, skillRatio: number): number;
  static calculateDmgBonusMultiplier(attacker: CombatStats): number;
  static calculateCritMultiplier(attacker: CombatStats, isCrit: boolean): number;
  static calculateDirectDamage(
    attacker: CombatStats,
    enemy: EnemyStats,
    skillRatio: number,
    element: string
  ): { damageNoCrit, damageCrit, damageExpected, zones };
}
```

### 3. 状态管理 (src/stores/)

#### 3.1 game-data.store.ts - 游戏数据
```typescript
export const useGameDataStore = defineStore('gameData', () => {
  const isLoading = ref(false);
  const isInitialized = ref(false);

  const allCharacters = computed(() => dataLoader.getAllCharacters());

  async function initialize() { /* 加载游戏数据 */ }
  function getCharacterInfo(gameId: string) { /* ... */ }

  return { isLoading, isInitialized, allCharacters, initialize, getCharacterInfo };
});
```

#### 3.2 save.store.ts - 存档管理
```typescript
export const useSaveStore = defineStore('save', () => {
  const saves = ref<Map<string, SaveData>>(new Map());
  const currentSaveName = ref<string | null>(null);

  const currentSave = computed(() => saves.value.get(currentSaveName.value));
  const agents = computed(() => Array.from(currentSave.value?.agents.values() || []));

  function loadFromStorage() { /* localStorage读取 */ }
  function saveToStorage() { /* localStorage保存 */ }
  function createSave(name: string) { /* ... */ }
  function importFromScanData(data: any) { /* 导入JSON */ }
  function exportSaveData(): string { /* 导出JSON */ }

  return { saves, currentSave, agents, createSave, importFromScanData, exportSaveData };
});
```

### 4. Debug页面组件

#### 4.1 DebugView.vue - 主页面
- DaisyUI Tabs导航
- 4个Tab: 数据导入导出、API测试、数据查看、伤害计算

#### 4.2 DataImportExport.vue - 数据导入导出
- 文件上传控件 (input type="file")
- 导入按钮 → useSaveStore.importFromScanData()
- 导出按钮 → useSaveStore.exportSaveData() → 下载JSON

#### 4.3 ApiTester.vue - API测试
- 服务方法选择器
- 参数输入表单
- 调用按钮
- JSON格式化的响应展示

#### 4.4 DataInspector.vue - 数据查看器
- 数据类型选择 (角色/音擎/驱动盘)
- 数据表格展示
- 详情面板 (JSON格式化显示)
- 编辑功能 (可选)

#### 4.5 DamageCalculator.vue - 伤害计算测试
- 角色选择器
- 敌人选择器
- 技能倍率输入
- 计算按钮
- 结果展示:
  - 未暴击伤害、暴击伤害、期望伤害
  - 乘区详情表格 (基础伤害区、增伤区、暴击区、防御区、抗性区)

---

## 实施步骤

### Phase 1: 项目初始化和基础架构 (第1周)

**任务清单：**
1. ✅ 创建Vite + Vue 3 + TypeScript项目
2. ✅ 安装依赖:
   - 核心: `pinia`, `vue-router`
   - UI: `reka-ui`, `daisyui`, `tailwindcss`, `autoprefixer`, `postcss`
   - 工具: `@codemirror/lang-json`, `@vueuse/core`
3. ✅ 配置Tailwind和DaisyUI
4. ✅ 创建目录结构
5. ✅ 迁移游戏数据文件到 `public/game-data/`

**关键文件：**
- `package.json` - 依赖配置
- `vite.config.ts` - Vite配置
- `tailwind.config.js` - Tailwind + DaisyUI配置
- `tsconfig.json` - TypeScript严格模式配置

### Phase 2: 数据模型层开发 (第2-3周)

**任务清单：**
1. ✅ 实现 `src/models/base.ts` - 所有枚举类型
2. ✅ 实现 `src/models/property-collection.ts` - 属性集合
3. ✅ 实现 `src/models/combat-stats.ts` - 战斗属性计算
4. ✅ 实现 `src/models/buff.ts` - Buff系统
5. ✅ 实现 `src/models/agent.ts` - 角色模型
6. ✅ 实现 `src/models/wengine.ts` - 音擎模型
7. ✅ 实现 `src/models/drive-disk.ts` - 驱动盘模型
8. ✅ 实现 `src/models/save-data.ts` - 存档数据模型
9. ✅ 编写单元测试 (使用Vitest)

**关键文件：**
- `src/models/agent.ts` (300+ lines)
- `src/models/combat-stats.ts` (200+ lines)
- `src/models/save-data.ts` (150+ lines)

### Phase 3: 服务层开发 (第4-5周)

**任务清单：**
1. ✅ 实现 `src/services/data-loader.service.ts` - 游戏数据加载
2. ✅ 实现 `src/services/damage-calculator.service.ts` - 伤害计算
3. ✅ 实现 `src/services/agent.service.ts` - 角色服务
4. ✅ 实现 `src/services/wengine.service.ts` - 音擎服务
5. ✅ 实现 `src/services/drive-disk.service.ts` - 驱动盘服务
6. ✅ 实现 `src/utils/storage.ts` - localStorage封装
7. ✅ 编写服务集成测试

**关键文件：**
- `src/services/data-loader.service.ts` (250+ lines)
- `src/services/damage-calculator.service.ts` (400+ lines)

### Phase 4: 状态管理开发 (第6周)

**任务清单：**
1. ✅ 实现 `src/stores/game-data.store.ts` - 游戏数据Store
2. ✅ 实现 `src/stores/save.store.ts` - 存档管理Store
3. ✅ 实现 `src/stores/battle.store.ts` - 战斗状态Store
4. ✅ 集成测试: Store + Service层联调

**关键文件：**
- `src/stores/save.store.ts` (200+ lines)

### Phase 5: Debug页面开发 (第7-8周) **【初期重点】**

**任务清单：**
1. ✅ 实现 `src/components/common/JsonEditor.vue` - JSON编辑器组件
2. ✅ 实现 `src/components/debug/DataImportExport.vue` - 导入导出
3. ✅ 实现 `src/components/debug/DataInspector.vue` - 数据查看
4. ✅ 实现 `src/components/debug/ApiTester.vue` - API测试
5. ✅ 实现 `src/components/debug/DamageCalculator.vue` - 伤害计算器
6. ✅ 实现 `src/views/DebugView.vue` - 主页面集成
7. ✅ 路由配置和应用入口

**关键文件：**
- `src/views/DebugView.vue`
- `src/components/debug/DamageCalculator.vue` (最复杂组件)

### Phase 6: 测试和优化 (第9周)

**任务清单：**
1. ✅ E2E测试: 导入存档 → 查看数据 → 计算伤害 → 导出
2. ✅ 性能优化:
   - 大量JSON加载优化
   - 虚拟列表 (如果数据量大)
   - 计算缓存
3. ✅ 错误处理和边界情况
4. ✅ UI细节优化

---

## 数据迁移策略

### 游戏数据迁移

**源路径:** `E:\github\updown\assets\inventory_data\`
**目标路径:** `public/game-data/`

**迁移清单：**
- ✅ `character/` → `public/game-data/character/`
- ✅ `weapon/` → `public/game-data/weapon/`
- ✅ `equipment/` → `public/game-data/equipment/`
- ✅ `character_data_buff/` → `public/game-data/character_data_buff/`
- ✅ `weapon_data_buff/` → `public/game-data/weapon_data_buff/`
- ✅ `equipment_data_buff/` → `public/game-data/equipment_data_buff/`
- ✅ `csv/` → `public/game-data/csv/`

**注意事项：**
- 检查JSON格式正确性
- 确保文件编码为UTF-8
- 验证所有引用路径

### Python代码转TypeScript参考

| Python模块 | TypeScript对应 | 转换重点 |
|-----------|---------------|---------|
| `zzz_models/base.py` | `models/base.ts` | IntEnum → enum |
| `zzz_models/agent.py` | `models/agent.ts` | dataclass → class + constructor |
| `zzz_models/combat_stats.py` | `models/combat-stats.ts` | 属性计算逻辑 |
| `services/data_loader_service.py` | `services/data-loader.service.ts` | 文件IO → fetch API |
| `services/damage_calculator_service.py` | `services/damage-calculator.service.ts` | 静态方法保持一致 |
| `save_manager.py` | `stores/save.store.ts` | 文件存储 → localStorage |

---

## 验证方案

### 功能验证清单

**1. 数据加载验证**
- [ ] 启动应用后能成功加载游戏数据
- [ ] 能查看所有角色、音擎、驱动盘列表
- [ ] 按需加载角色详细数据正常工作
- [ ] 控制台无加载错误

**2. 存档管理验证**
- [ ] 能创建新存档
- [ ] 能切换存档
- [ ] 能删除存档
- [ ] localStorage正确保存存档数据
- [ ] 刷新页面后存档状态保持

**3. 数据导入导出验证**
- [ ] 能上传并导入Python版导出的JSON文件
- [ ] 导入后数据正确显示在数据查看器中
- [ ] 能导出当前存档为JSON
- [ ] 导出的JSON格式正确，能被Python版读取

**4. 数据查看器验证**
- [ ] 能查看所有导入的角色、音擎、驱动盘
- [ ] 数据表格正确显示关键信息
- [ ] JSON格式化显示正确
- [ ] 详情面板数据完整

**5. 伤害计算验证**
- [ ] 选择角色后能正确计算战斗属性
- [ ] 输入技能倍率后能计算伤害
- [ ] 伤害结果与Python版一致 (±1误差可接受)
- [ ] 乘区详情展示正确

**6. API测试验证**
- [ ] 能调用所有主要Service方法
- [ ] 参数输入正确
- [ ] 响应结果格式化显示
- [ ] 错误处理正常

### 性能验证

- [ ] 游戏数据加载时间 < 2秒
- [ ] 存档导入时间 < 1秒
- [ ] 伤害计算响应时间 < 100ms
- [ ] 页面渲染流畅，无卡顿

### 兼容性验证

- [ ] Chrome最新版
- [ ] Firefox最新版
- [ ] Edge最新版
- [ ] Safari最新版 (如有Mac)

---

## 关键技术决策

### 1. 为什么使用Class而不是Interface？

**数据模型使用Class：**
- ✅ 需要包含计算方法 (`getCombatStats()`, `getFinalAtk()`)
- ✅ 需要序列化逻辑 (`toJSON()`, `fromJSON()`)
- ✅ 需要构造函数处理默认值
- ✅ 更接近Python的dataclass概念

**纯数据传输使用Interface：**
- API响应类型
- Store的state类型
- Component Props类型

### 2. 游戏数据两阶段加载

**阶段1: 初始化加载索引文件**
- `character.json` (所有角色基础信息)
- `weapon.json` (所有音擎基础信息)
- `equipment.json` (所有驱动盘基础信息)

**阶段2: 按需加载详细数据**
- `character/{id}.json` (单个角色完整数据)
- 使用Promise缓存避免重复加载

**优势：**
- 启动快 (只加载索引)
- 减少初始加载体积
- 按需加载详细数据

### 3. localStorage存档结构

```json
{
  "saves": {
    "default": {
      "name": "default",
      "agents": { "10001": {...}, "10002": {...} },
      "wengines": { "30001": {...} },
      "driveDisks": { "20001": {...}, "20002": {...} },
      "nextAgentId": 10003,
      "nextWEngineId": 30002,
      "nextDriveDiskId": 20003
    }
  },
  "currentSave": "default",
  "version": "1.0.0"
}
```

**版本管理：**
- 添加 `version` 字段
- 加载时检查版本并执行迁移
- 向后兼容旧版本

### 4. 伤害计算性能优化

**乘区缓存：**
- `ZoneCollection` 对象缓存所有乘区
- 避免重复计算通用乘区

**属性计算懒加载：**
- `getFinalAtk()` 等方法按需计算
- 使用getter而非提前计算

### 5. TypeScript严格模式

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**优势：**
- 编译时捕获更多错误
- 更好的IDE提示
- 减少运行时错误

---

## 关键文件清单

**最关键的5个文件（核心骨架）：**
1. `src/models/agent.ts` - 角色模型核心逻辑
2. `src/models/combat-stats.ts` - 战斗属性计算工厂
3. `src/services/data-loader.service.ts` - 游戏数据加载服务
4. `src/services/damage-calculator.service.ts` - 伤害计算核心
5. `src/stores/save.store.ts` - 存档管理Store

**其他重要文件：**
- `src/models/base.ts` - 基础枚举定义
- `src/models/save-data.ts` - 存档数据模型
- `src/stores/game-data.store.ts` - 游戏数据Store
- `src/views/DebugView.vue` - Debug主页面
- `src/components/debug/DamageCalculator.vue` - 伤害计算器组件

---

## 后续扩展计划

本计划专注于**后端结构设计和Debug页面**，完成后可扩展：

**Phase 7: 用户界面开发 (未来)**
- 角色管理界面 (AgentView.vue)
- 装备管理界面 (EquipmentView.vue)
- 优化建议界面 (OptimizeView.vue)
- 存档管理界面 (SaveView.vue)

**Phase 8: 高级功能 (未来)**
- 装备优化算法
- 战斗模拟器
- 多角色配队分析
- 数据可视化图表

---

## 总结

本计划将Python游戏优化器完整转换为纯前端TypeScript版本，采用现代化的Vue 3 + Vite + DaisyUI技术栈。核心设计包括：

1. **完整的数据模型层** - 19个模型类，完整类型定义
2. **业务服务层** - 15个服务，分离业务逻辑
3. **Pinia状态管理** - 4个Store，响应式状态
4. **Debug页面** - 4个功能模块，完整调试能力

**优势：**
- ✅ 纯前端部署，无需服务器
- ✅ TypeScript类型安全
- ✅ 现代化UI框架
- ✅ 清晰的分层架构
- ✅ 完整的测试覆盖

**预计开发时间：** 8-9周

**预计代码量：** 约10000-12000行TypeScript代码
