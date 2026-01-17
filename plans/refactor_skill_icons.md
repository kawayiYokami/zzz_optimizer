# 计划：为角色详情卡片添加技能图标

## 1. 目标

将 `AgentInfoCard.vue` 组件中“技能等级”部分的文字标签（如“普攻”、“闪避”）替换为对应的图形化图标，以提升视觉效果和信息密度。

## 2. 文件修改清单

-   `web/optimizer/src/services/icon.service.ts`
-   `web/optimizer/src/components/business/AgentInfoCard.vue`

## 3. 详细步骤

### 步骤 3.1: 增强 `icon.service.ts`

**目的**: 遵循单一职责原则，将获取技能图标的逻辑封装到 `IconService` 中。

**操作**: 在 `IconService` 类中添加一个新的公共方法 `getSkillIconUrl(skillType: string)`.

```typescript
// 在 icon.service.ts 中添加以下方法

  /**
   * 获取技能图标
   * @param skillType 技能类型 (e.g., 'normal', 'dodge')
   */
  public getSkillIconUrl(skillType: string): string {
    const skillIconMap: Record<string, string> = {
      normal: 'Icon_Normal',
      dodge: 'Icon_Evade',
      assist: 'Icon_Switch',
      special: 'Icon_SpecialReady',
      chain: 'Icon_UltimateReady',
    };
    const filename = skillIconMap[skillType.toLowerCase()];
    if (filename) {
      return `${ASSETS_BASE_URL}/${filename}.webp`;
    }
    return ''; // 如果找不到匹配项，返回空字符串
  }
```

### 步骤 3.2: 修改 `AgentInfoCard.vue`

**目的**: 使用 `IconService` 的新方法来显示技能图标，替换原有的文字标签。

**操作**: 在模板的“Buff & 技能”标签页中，修改 `v-for` 循环，用 `<img>` 替换 `<span>`。

**修改前**:
```html
<div v-for="(level, key) in agent.skills.toDict()" :key="key" class="flex flex-col items-center gap-2 bg-base-200 p-3 rounded-lg min-w-[80px]">
    <span class="text-xs opacity-60">{{ getSkillLabel(String(key)) }}</span>
    <div class="radial-progress text-primary text-sm font-bold" :style="`--value:${(level/12)*100}; --size:3rem;`">{{ level }}</div>
</div>
```

**修改后**:
```html
<div v-for="(level, key) in agent.skills.toDict()" :key="key" class="flex flex-col items-center gap-2 bg-base-200 p-3 rounded-lg min-w-[80px]">
    <div class="w-8 h-8 p-1 opacity-80 group-hover:opacity-100 transition-opacity">
      <img :src="iconService.getSkillIconUrl(String(key))" :alt="getSkillLabel(String(key))" class="w-full h-full object-contain" />
    </div>
    <div class="radial-progress text-primary text-sm font-bold" :style="`--value:${(level/12)*100}; --size:3rem;`">{{ level }}</div>
</div>
```

## 4. 交互流程

```mermaid
graph TD
    A[AgentInfoCard.vue] -->|调用 getSkillIconUrl('normal')| B(icon.service.ts);
    B -->|使用内部 Map 查找| C{skillIconMap};
    C -->|返回 'Icon_Normal'| B;
    B -->|返回 '/game-data/icons/Icon_Normal.webp'| A;
    A -->|渲染| D(img src='/game-data/icons/Icon_Normal.webp');
```

## 5. 预期结果

`AgentInfoCard` 的“技能等级”部分将不再显示文字，而是显示对应的技能图标，下方依然是表示等级的圆形进度条。

---

请您审阅此计划。如果同意，我将切换至“代码”模式并执行这些修改。