#!/usr/bin/env tsx
/**
 * Agent与装备属性合并测试脚本
 *
 * 验证Agent.getSelfProperties()方法是否正确合并装备属性
 */

import { PropertyCollection } from '../src/model/property-collection';
import { PropertyType } from '../src/model/base';

// 模拟Agent类（简化版）
class MockAgent {
  // 裸属性
  private _bareStats: PropertyCollection;
  
  constructor() {
    // 初始化裸属性
    this._bareStats = new PropertyCollection(
      new Map([
        [PropertyType.ATK_BASE, 805.7],
        [PropertyType.HP_BASE, 7673.7],
        [PropertyType.DEF_BASE, 606.6],
        [PropertyType.IMPACT, 86.0],
        [PropertyType.CRIT_, 0.05],
        [PropertyType.CRIT_DMG_, 0.50],
        [PropertyType.ANOM_PROF, 148.0],
        [PropertyType.ANOM_MAS, 116.0],
        [PropertyType.ENER_REGEN, 1.20],
      ])
    );
  }
  
  // 模拟获取裸属性
  getBareStats(): PropertyCollection {
    return this._bareStats;
  }
  
  // 模拟获取自身属性（裸属性 + 装备属性）
  getSelfProperties(equipmentStats?: PropertyCollection[]): PropertyCollection {
    // 1. 先获取裸属性
    const bareStats = this.getBareStats();
    
    // 2. 创建新的属性集合来存储自身属性
    const selfProps = new PropertyCollection();
    selfProps.add(bareStats);
    
    // 3. 如果提供了装备属性，合并到自身属性中
    if (equipmentStats) {
      for (const stats of equipmentStats) {
        selfProps.add(stats);
      }
    }
    
    return selfProps;
  }
}

console.log('=== Agent与装备属性合并测试 ===');
console.log('');

// 测试用例：验证Agent与装备属性合并
function testAgentEquipmentMerge() {
  console.log('📋 测试用例：Agent与装备属性合并');
  console.log(''.padEnd(50, '-'));
  
  // 1. 创建模拟Agent
  const agent = new MockAgent();
  
  // 2. 创建装备属性
  const equipmentProps: PropertyCollection[] = [];
  
  // 模拟音擎属性
  const weaponProps = new PropertyCollection(
    new Map([
      [PropertyType.CRIT_, 0.24], // 24%
      [PropertyType.ATK_BASE, 743.5],
    ])
  );
  equipmentProps.push(weaponProps);
  
  // 模拟驱动盘1属性
  const disk1Props = new PropertyCollection(
    new Map([
      [PropertyType.CRIT_, 0.048],
      [PropertyType.CRIT_DMG_, 0.144],
      [PropertyType.DEF_, 0.096],
      [PropertyType.ATK, 38.0],
      [PropertyType.HP, 2200.0],
    ])
  );
  equipmentProps.push(disk1Props);
  
  // 3. 调用getSelfProperties()方法
  const selfProps = agent.getSelfProperties(equipmentProps);
  
  // 4. 计算预期结果
  const expectedProps = new PropertyCollection();
  expectedProps.add(agent.getBareStats());
  for (const prop of equipmentProps) {
    expectedProps.add(prop);
  }
  
  // 5. 验证结果
  const expectedAtkBase = agent.getBareStats().getOutOfCombat(PropertyType.ATK_BASE) + weaponProps.getOutOfCombat(PropertyType.ATK_BASE);
  const expectedCrit = agent.getBareStats().getOutOfCombat(PropertyType.CRIT_) + weaponProps.getOutOfCombat(PropertyType.CRIT_) + disk1Props.getOutOfCombat(PropertyType.CRIT_);
  
  const actualAtkBase = selfProps.getOutOfCombat(PropertyType.ATK_BASE);
  const actualCrit = selfProps.getOutOfCombat(PropertyType.CRIT_);
  
  // 输出结果
  console.log(`📊 裸属性攻击力: ${agent.getBareStats().getOutOfCombat(PropertyType.ATK_BASE).toFixed(1)}`);
  console.log(`📊 音擎攻击力: ${weaponProps.getOutOfCombat(PropertyType.ATK_BASE).toFixed(1)}`);
  console.log(`📊 预期总攻击力: ${expectedAtkBase.toFixed(1)}`);
  console.log(`📊 实际总攻击力: ${actualAtkBase.toFixed(1)}`);
  console.log(`✅ 攻击力合并: ${Math.abs(actualAtkBase - expectedAtkBase) < 0.1 ? '正确 ✓' : '错误 ✗'}`);
  console.log('');
  
  console.log(`📊 裸属性暴击率: ${(agent.getBareStats().getOutOfCombat(PropertyType.CRIT_) * 100).toFixed(2)}%`);
  console.log(`📊 音擎暴击率: ${(weaponProps.getOutOfCombat(PropertyType.CRIT_) * 100).toFixed(2)}%`);
  console.log(`📊 驱动盘1暴击率: ${(disk1Props.getOutOfCombat(PropertyType.CRIT_) * 100).toFixed(2)}%`);
  console.log(`📊 预期总暴击率: ${(expectedCrit * 100).toFixed(2)}%`);
  console.log(`📊 实际总暴击率: ${(actualCrit * 100).toFixed(2)}%`);
  console.log(`✅ 暴击率合并: ${Math.abs(actualCrit - expectedCrit) < 0.0001 ? '正确 ✓' : '错误 ✗'}`);
  console.log('');
  
  // 输出完整的合并结果
  console.log('📊 合并后的属性集合:');
  console.log(selfProps.format(2));
  
  // 验证是否包含所有装备属性
  const allEquipmentProps = new PropertyCollection();
  for (const prop of equipmentProps) {
    allEquipmentProps.add(prop);
  }
  
  let allPropsMerged = true;
  for (const [propType, value] of allEquipmentProps.out_of_combat.entries()) {
    const mergedValue = selfProps.getOutOfCombat(propType);
    const bareValue = agent.getBareStats().getOutOfCombat(propType);
    const expectedMergedValue = bareValue + value;
    
    if (Math.abs(mergedValue - expectedMergedValue) >= 0.1) {
      allPropsMerged = false;
      console.log(`❌ 属性 ${PropertyType[propType]} 合并错误: 预期 ${expectedMergedValue.toFixed(1)}, 实际 ${mergedValue.toFixed(1)}`);
    }
  }
  
  console.log('');
  console.log(`📊 测试结果: ${allPropsMerged ? '全部属性合并正确 ✓' : '部分属性合并错误 ✗'}`);
  
  return allPropsMerged;
}

// 运行测试
function runTest() {
  console.log('=== Agent与装备属性合并测试 ===');
  console.log('');
  
  const result = testAgentEquipmentMerge();
  
  console.log(''.padEnd(50, '='));
  console.log('🎉 测试总结');
  console.log(''.padEnd(50, '='));
  
  if (result) {
    console.log('✅ Agent与装备属性合并算法正确！');
    process.exit(0);
  } else {
    console.log('❌ Agent与装备属性合并算法存在问题！');
    process.exit(1);
  }
}

// 开始测试
runTest();
