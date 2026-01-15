# 重构 Agent 属性计算方法

## 目标
将 `_calculateSelfProperties()` 中混乱的 `propertyMapping` 拆分为三个清晰的方法。

## 重构方案

### 1. `getGrowthStats()` - 成长属性
返回需要等级成长公式计算的属性（HP/ATK/DEF + 突破加成）

```typescript
private getGrowthStats(): Map<PropertyType, number> {
  // 公式: Base + (Level - 1) * Growth / 10000 + 突破加成
  // HP_BASE, ATK_BASE, DEF_BASE
}
```

### 2. `getBaseStats()` - 固定属性
返回不随等级变化的基础属性

```typescript
private getBaseStats(): Map<PropertyType, number> {
  // IMPACT (BreakStun)
  // CRIT_ (Crit / 10000)
  // CRIT_DMG_ (CritDamage / 10000)
  // ANOM_MAS (ElementAbnormalPower)
  // ANOM_PROF (ElementMystery)
  // ENER_REGEN (SpRecover / 100)
  // PEN (PenDelta)
  // PEN_ (PenRate / 100)
}
```

### 3. `getCoreSkillStats()` - 核心技属性
保持现有实现不变

### 4. `_calculateSelfProperties()` - 简化
```typescript
private _calculateSelfProperties(): void {
  const growthStats = this.getGrowthStats();
  const baseStats = this.getBaseStats();
  const coreStats = this.getCoreSkillStats();
  
  // 合并到 self_properties.out_of_combat
  for (const [prop, value] of growthStats) {
    this.self_properties.out_of_combat.set(prop, value);
  }
  for (const [prop, value] of baseStats) {
    const current = this.self_properties.out_of_combat.get(prop) || 0;
    this.self_properties.out_of_combat.set(prop, current + value);
  }
  for (const [prop, value] of coreStats) {
    const current = this.self_properties.out_of_combat.get(prop) || 0;
    this.self_properties.out_of_combat.set(prop, current + value);
  }
}
```

## 待办事项

- [ ] 实现 `getGrowthStats()` 方法
- [ ] 实现 `getBaseStats()` 方法
- [ ] 简化 `_calculateSelfProperties()` 方法
- [ ] 删除 `propertyMapping` 常量
- [ ] 测试验证属性计算结果一致