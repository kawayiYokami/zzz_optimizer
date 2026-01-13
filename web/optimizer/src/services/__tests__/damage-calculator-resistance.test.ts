/**
 * 元素特定抗性和异常积累抗性测试
 * 
 * 测试目标：
 * 1. 验证元素特定抗性削弱（FIRE_RES_RED_等）
 * 2. 验证元素特定抗性无视（FIRE_RES_IGN_等）
 * 3. 验证元素特定异常积累抗性（FIRE_ANOM_BUILDUP_RES_等）
 * 4. 验证通用和特定属性的叠加逻辑
 */

import { DamageCalculatorService } from '../damage-calculator.service';
import { PropertyCollection } from '../../model/property-collection';
import { PropertyType, ElementType } from '../../model/base';
import { EnemyStats } from '../../model/enemy';
import { ZoneCollection } from '../../model/zone-collection';

/**
 * 测试辅助函数：创建基础属性集合
 */
function createBasicPropertyCollection(): PropertyCollection {
  const props = new PropertyCollection();
  props.in_combat.set(PropertyType.ATK_BASE, 2500); // 基础攻击力
  props.in_combat.set(PropertyType.CRIT_, 0.5); // 50% 暴击率
  props.in_combat.set(PropertyType.CRIT_DMG_, 1.0); // 100% 暴击伤害
  return props;
}

/**
 * 测试辅助函数：创建基础敌人属性
 */
function createBasicEnemyStats(fireResistance: number = 0.1): EnemyStats {
  return new EnemyStats(
    100000, // HP
    600,    // 防御力
    60,     // 等级
    1000,   // 失衡值上限
    true,   // 可以失衡
    0.5,    // 失衡易伤倍率
    false,  // 未失衡
    {
      fire: fireResistance,      // 火属性抗性 10%
      ice: 0.1,
      electric: 0.1,
      physical: 0.1,
      ether: 0.1,
    },
    {
      fire: 600,
      ice: 600,
      electric: 600,
      physical: 720,
      ether: 600,
    },
    false
  );
}

/**
 * 测试1: 验证元素特定抗性削弱（FIRE_RES_RED_）
 */
function testFireResistanceReduction() {
  console.log('\n=== 测试1: 元素特定抗性削弱 ===');
  
  // 场景1: 没有任何抗性削弱
  const props1 = createBasicPropertyCollection();
  const enemy1 = createBasicEnemyStats(0.1); // 10% 火抗
  const zones1 = DamageCalculatorService.updateAllZones(props1, enemy1, 'fire');
  
  console.log('\n场景1: 无抗性削弱');
  console.log(`  敌人火抗: ${(enemy1.getResistance('fire') * 100).toFixed(1)}%`);
  console.log(`  抗性区: ${zones1.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.1).toFixed(4)} (1 - 火抗10%)`);
  
  // 场景2: 添加通用抗性削弱 15%
  const props2 = createBasicPropertyCollection();
  props2.in_combat.set(PropertyType.ENEMY_RES_RED_, 0.15);
  const enemy2 = createBasicEnemyStats(0.1);
  const zones2 = DamageCalculatorService.updateAllZones(props2, enemy2, 'fire');
  
  console.log('\n场景2: 通用抗性削弱 15%');
  console.log(`  ENEMY_RES_RED_: 15%`);
  console.log(`  抗性区: ${zones2.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.1 + 0.15).toFixed(4)} (1 - 火抗10% + 通用削弱15%)`);
  
  // 场景3: 添加火属性特定抗性削弱 20%
  const props3 = createBasicPropertyCollection();
  props3.in_combat.set(PropertyType.FIRE_RES_RED_, 0.20);
  const enemy3 = createBasicEnemyStats(0.1);
  const zones3 = DamageCalculatorService.updateAllZones(props3, enemy3, 'fire');
  
  console.log('\n场景3: 火属性特定抗性削弱 20%');
  console.log(`  FIRE_RES_RED_: 20%`);
  console.log(`  抗性区: ${zones3.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.1 + 0.20).toFixed(4)} (1 - 火抗10% + 火削弱20%)`);
  
  // 场景4: 通用抗性削弱 15% + 火属性特定抗性削弱 20%（叠加测试）
  const props4 = createBasicPropertyCollection();
  props4.in_combat.set(PropertyType.ENEMY_RES_RED_, 0.15);
  props4.in_combat.set(PropertyType.FIRE_RES_RED_, 0.20);
  const enemy4 = createBasicEnemyStats(0.1);
  const zones4 = DamageCalculatorService.updateAllZones(props4, enemy4, 'fire');
  
  console.log('\n场景4: 通用削弱15% + 火削弱20%（叠加）');
  console.log(`  ENEMY_RES_RED_: 15%`);
  console.log(`  FIRE_RES_RED_: 20%`);
  console.log(`  抗性区: ${zones4.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.1 + 0.15 + 0.20).toFixed(4)} (1 - 火抗10% + 通用15% + 火削弱20%)`);
  
  // 验证结果
  const epsilon = 0.0001;
  const test1Pass = Math.abs(zones1.res_mult - 0.9) < epsilon;
  const test2Pass = Math.abs(zones2.res_mult - 1.05) < epsilon;
  const test3Pass = Math.abs(zones3.res_mult - 1.10) < epsilon;
  const test4Pass = Math.abs(zones4.res_mult - 1.25) < epsilon;
  
  console.log('\n测试结果:');
  console.log(`  场景1 ${test1Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景2 ${test2Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景3 ${test3Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景4 ${test4Pass ? '✓ 通过' : '✗ 失败'}`);
  
  return test1Pass && test2Pass && test3Pass && test4Pass;
}

/**
 * 测试2: 验证元素特定抗性无视（FIRE_RES_IGN_）
 */
function testFireResistanceIgnore() {
  console.log('\n=== 测试2: 元素特定抗性无视 ===');
  
  // 场景1: 添加通用抗性无视 10%
  const props1 = createBasicPropertyCollection();
  props1.in_combat.set(PropertyType.RES_IGN_, 0.10);
  const enemy1 = createBasicEnemyStats(0.15); // 15% 火抗
  const zones1 = DamageCalculatorService.updateAllZones(props1, enemy1, 'fire');
  
  console.log('\n场景1: 通用抗性无视 10%');
  console.log(`  敌人火抗: ${(enemy1.getResistance('fire') * 100).toFixed(1)}%`);
  console.log(`  RES_IGN_: 10%`);
  console.log(`  抗性区: ${zones1.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.15 + 0.10).toFixed(4)} (1 - 火抗15% + 通用无视10%)`);
  
  // 场景2: 添加火属性特定抗性无视 12%
  const props2 = createBasicPropertyCollection();
  props2.in_combat.set(PropertyType.FIRE_RES_IGN_, 0.12);
  const enemy2 = createBasicEnemyStats(0.15);
  const zones2 = DamageCalculatorService.updateAllZones(props2, enemy2, 'fire');
  
  console.log('\n场景2: 火属性特定抗性无视 12%');
  console.log(`  FIRE_RES_IGN_: 12%`);
  console.log(`  抗性区: ${zones2.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.15 + 0.12).toFixed(4)} (1 - 火抗15% + 火无视12%)`);
  
  // 场景3: 通用无视10% + 火属性特定无视12%（叠加测试）
  const props3 = createBasicPropertyCollection();
  props3.in_combat.set(PropertyType.RES_IGN_, 0.10);
  props3.in_combat.set(PropertyType.FIRE_RES_IGN_, 0.12);
  const enemy3 = createBasicEnemyStats(0.15);
  const zones3 = DamageCalculatorService.updateAllZones(props3, enemy3, 'fire');
  
  console.log('\n场景3: 通用无视10% + 火无视12%（叠加）');
  console.log(`  RES_IGN_: 10%`);
  console.log(`  FIRE_RES_IGN_: 12%`);
  console.log(`  抗性区: ${zones3.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.15 + 0.10 + 0.12).toFixed(4)} (1 - 火抗15% + 通用10% + 火无视12%)`);
  
  // 场景4: 混合削弱和无视
  const props4 = createBasicPropertyCollection();
  props4.in_combat.set(PropertyType.ENEMY_RES_RED_, 0.08); // 通用削弱8%
  props4.in_combat.set(PropertyType.FIRE_RES_RED_, 0.10);  // 火削弱10%
  props4.in_combat.set(PropertyType.RES_IGN_, 0.05);        // 通用无视5%
  props4.in_combat.set(PropertyType.FIRE_RES_IGN_, 0.07);   // 火无视7%
  const enemy4 = createBasicEnemyStats(0.20); // 20% 火抗
  const zones4 = DamageCalculatorService.updateAllZones(props4, enemy4, 'fire');
  
  console.log('\n场景4: 混合削弱和无视');
  console.log(`  敌人火抗: 20%`);
  console.log(`  ENEMY_RES_RED_: 8%, FIRE_RES_RED_: 10%`);
  console.log(`  RES_IGN_: 5%, FIRE_RES_IGN_: 7%`);
  console.log(`  抗性区: ${zones4.res_mult.toFixed(4)}`);
  console.log(`  预期抗性区: ${(1 - 0.20 + 0.08 + 0.10 + 0.05 + 0.07).toFixed(4)} (1 - 火抗20% + 削弱18% + 无视12%)`);
  
  // 验证结果
  const epsilon = 0.0001;
  const test1Pass = Math.abs(zones1.res_mult - 0.95) < epsilon;
  const test2Pass = Math.abs(zones2.res_mult - 0.97) < epsilon;
  const test3Pass = Math.abs(zones3.res_mult - 1.07) < epsilon;
  const test4Pass = Math.abs(zones4.res_mult - 1.10) < epsilon;
  
  console.log('\n测试结果:');
  console.log(`  场景1 ${test1Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景2 ${test2Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景3 ${test3Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景4 ${test4Pass ? '✓ 通过' : '✗ 失败'}`);
  
  return test1Pass && test2Pass && test3Pass && test4Pass;
}

/**
 * 测试3: 验证元素特定异常积累抗性（FIRE_ANOM_BUILDUP_RES_）
 */
function testFireAnomalyBuildupResistance() {
  console.log('\n=== 测试3: 元素特定异常积累抗性 ===');
  
  // 场景1: 无异常积累抗性
  const props1 = createBasicPropertyCollection();
  props1.in_combat.set(PropertyType.ANOM_BUILDUP_, 30); // 30% 异常积蓄效率（以百分数形式存储）
  const enemy1 = createBasicEnemyStats();
  const zones1 = DamageCalculatorService.updateAllZones(props1, enemy1, 'fire');
  
  console.log('\n场景1: 无异常积累抗性');
  console.log(`  ANOM_BUILDUP_: 30%`);
  console.log(`  积蓄区: ${zones1.accumulate_zone.toFixed(4)}`);
  console.log(`  预期积蓄区: ${((1 + 0.30) * 1.0).toFixed(4)} ((1 + 积蓄效率30%) × (1 - 抗性0%))`);
  
  // 场景2: 添加通用异常积累抗性 15%
  const props2 = createBasicPropertyCollection();
  props2.in_combat.set(PropertyType.ANOM_BUILDUP_, 30);
  props2.in_combat.set(PropertyType.ANOM_BUILDUP_RES_, 0.15); // 敌人有15%通用异常积累抗性
  const enemy2 = createBasicEnemyStats();
  const zones2 = DamageCalculatorService.updateAllZones(props2, enemy2, 'fire');
  
  console.log('\n场景2: 通用异常积累抗性 15%');
  console.log(`  ANOM_BUILDUP_: 30%`);
  console.log(`  ANOM_BUILDUP_RES_: 15%`);
  console.log(`  积蓄区: ${zones2.accumulate_zone.toFixed(4)}`);
  console.log(`  预期积蓄区: ${((1 + 0.30) * (1 - 0.15)).toFixed(4)} ((1 + 30%) × (1 - 通用抗性15%))`);
  
  // 场景3: 添加火属性特定异常积累抗性 20%
  const props3 = createBasicPropertyCollection();
  props3.in_combat.set(PropertyType.ANOM_BUILDUP_, 30);
  props3.in_combat.set(PropertyType.FIRE_ANOM_BUILDUP_RES_, 0.20);
  const enemy3 = createBasicEnemyStats();
  const zones3 = DamageCalculatorService.updateAllZones(props3, enemy3, 'fire');
  
  console.log('\n场景3: 火属性特定异常积累抗性 20%');
  console.log(`  ANOM_BUILDUP_: 30%`);
  console.log(`  FIRE_ANOM_BUILDUP_RES_: 20%`);
  console.log(`  积蓄区: ${zones3.accumulate_zone.toFixed(4)}`);
  console.log(`  预期积蓄区: ${((1 + 0.30) * (1 - 0.20)).toFixed(4)} ((1 + 30%) × (1 - 火抗性20%))`);
  
  // 场景4: 通用抗性15% + 火属性特定抗性20%（叠加测试）
  const props4 = createBasicPropertyCollection();
  props4.in_combat.set(PropertyType.ANOM_BUILDUP_, 30);
  props4.in_combat.set(PropertyType.ANOM_BUILDUP_RES_, 0.15);
  props4.in_combat.set(PropertyType.FIRE_ANOM_BUILDUP_RES_, 0.20);
  const enemy4 = createBasicEnemyStats();
  const zones4 = DamageCalculatorService.updateAllZones(props4, enemy4, 'fire');
  
  console.log('\n场景4: 通用抗性15% + 火抗性20%（叠加）');
  console.log(`  ANOM_BUILDUP_: 30%`);
  console.log(`  ANOM_BUILDUP_RES_: 15%`);
  console.log(`  FIRE_ANOM_BUILDUP_RES_: 20%`);
  console.log(`  积蓄区: ${zones4.accumulate_zone.toFixed(4)}`);
  console.log(`  预期积蓄区: ${((1 + 0.30) * (1 - 0.15 - 0.20)).toFixed(4)} ((1 + 30%) × (1 - 通用15% - 火20%))`);
  
  // 场景5: 添加火属性特定积蓄效率
  const props5 = createBasicPropertyCollection();
  props5.in_combat.set(PropertyType.ANOM_BUILDUP_, 30);
  props5.in_combat.set(PropertyType.FIRE_ANOMALY_BUILDUP_, 25); // 火属性特定积蓄效率 25%
  props5.in_combat.set(PropertyType.ANOM_BUILDUP_RES_, 0.10);
  props5.in_combat.set(PropertyType.FIRE_ANOM_BUILDUP_RES_, 0.15);
  const enemy5 = createBasicEnemyStats();
  const zones5 = DamageCalculatorService.updateAllZones(props5, enemy5, 'fire');
  
  console.log('\n场景5: 包含特定积蓄效率');
  console.log(`  ANOM_BUILDUP_: 30%, FIRE_ANOMALY_BUILDUP_: 25%`);
  console.log(`  ANOM_BUILDUP_RES_: 10%, FIRE_ANOM_BUILDUP_RES_: 15%`);
  console.log(`  积蓄区: ${zones5.accumulate_zone.toFixed(4)}`);
  console.log(`  预期积蓄区: ${((1 + 0.30 + 0.25) * (1 - 0.10 - 0.15)).toFixed(4)} ((1 + 通用30% + 火25%) × (1 - 通用10% - 火15%))`);
  
  // 验证结果
  const epsilon = 0.0001;
  const test1Pass = Math.abs(zones1.accumulate_zone - 1.30) < epsilon;
  const test2Pass = Math.abs(zones2.accumulate_zone - 1.105) < epsilon;
  const test3Pass = Math.abs(zones3.accumulate_zone - 1.04) < epsilon;
  const test4Pass = Math.abs(zones4.accumulate_zone - 0.845) < epsilon;
  const test5Pass = Math.abs(zones5.accumulate_zone - 1.1625) < epsilon;
  
  console.log('\n测试结果:');
  console.log(`  场景1 ${test1Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景2 ${test2Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景3 ${test3Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景4 ${test4Pass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  场景5 ${test5Pass ? '✓ 通过' : '✗ 失败'}`);
  
  return test1Pass && test2Pass && test3Pass && test4Pass && test5Pass;
}

/**
 * 测试4: 跨元素验证（确保火属性的设置不影响冰属性）
 */
function testCrossElementIsolation() {
  console.log('\n=== 测试4: 跨元素隔离验证 ===');
  
  // 场景: 设置火属性特定抗性削弱，测试冰元素伤害
  const props = createBasicPropertyCollection();
  props.in_combat.set(PropertyType.FIRE_RES_RED_, 0.20); // 火属性特定抗性削弱
  props.in_combat.set(PropertyType.FIRE_RES_IGN_, 0.15); // 火属性特定抗性无视
  
  const enemy = new EnemyStats(
    100000,
    600,
    60,
    1000,
    true,
    0.5,
    false,
    {
      fire: 0.10,  // 火抗 10%
      ice: 0.15,   // 冰抗 15%
      electric: 0.1,
      physical: 0.1,
      ether: 0.1,
    },
    {
      fire: 600,
      ice: 600,
      electric: 600,
      physical: 720,
      ether: 600,
    },
    false
  );
  
  const fireZones = DamageCalculatorService.updateAllZones(props, enemy, 'fire');
  const iceZones = DamageCalculatorService.updateAllZones(props, enemy, 'ice');
  
  console.log('\n火元素伤害（有火特定抗性削弱和无视）:');
  console.log(`  敌人火抗: 10%`);
  console.log(`  FIRE_RES_RED_: 20%, FIRE_RES_IGN_: 15%`);
  console.log(`  抗性区: ${fireZones.res_mult.toFixed(4)}`);
  console.log(`  预期: ${(1 - 0.10 + 0.20 + 0.15).toFixed(4)}`);
  
  console.log('\n冰元素伤害（火特定设置不应影响）:');
  console.log(`  敌人冰抗: 15%`);
  console.log(`  FIRE_RES_RED_: 20%, FIRE_RES_IGN_: 15% (应该不影响冰)`);
  console.log(`  抗性区: ${iceZones.res_mult.toFixed(4)}`);
  console.log(`  预期: ${(1 - 0.15).toFixed(4)} (仅减去冰抗，不受火特定设置影响)`);
  
  // 验证结果
  const epsilon = 0.0001;
  const firePass = Math.abs(fireZones.res_mult - 1.25) < epsilon;
  const icePass = Math.abs(iceZones.res_mult - 0.85) < epsilon;
  
  console.log('\n测试结果:');
  console.log(`  火元素 ${firePass ? '✓ 通过' : '✗ 失败'}`);
  console.log(`  冰元素 ${icePass ? '✓ 通过' : '✗ 失败'}`);
  
  return firePass && icePass;
}

/**
 * 主测试函数
 */
function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   元素特定抗性和异常积累抗性功能测试                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results: Array<{ name: string; passed: boolean }> = [];
  
  try {
    results.push({
      name: '测试1: 元素特定抗性削弱',
      passed: testFireResistanceReduction()
    });
  } catch (error) {
    console.error('\n测试1发生错误:', error);
    results.push({ name: '测试1: 元素特定抗性削弱', passed: false });
  }
  
  try {
    results.push({
      name: '测试2: 元素特定抗性无视',
      passed: testFireResistanceIgnore()
    });
  } catch (error) {
    console.error('\n测试2发生错误:', error);
    results.push({ name: '测试2: 元素特定抗性无视', passed: false });
  }
  
  try {
    results.push({
      name: '测试3: 元素特定异常积累抗性',
      passed: testFireAnomalyBuildupResistance()
    });
  } catch (error) {
    console.error('\n测试3发生错误:', error);
    results.push({ name: '测试3: 元素特定异常积累抗性', passed: false });
  }
  
  try {
    results.push({
      name: '测试4: 跨元素隔离验证',
      passed: testCrossElementIsolation()
    });
  } catch (error) {
    console.error('\n测试4发生错误:', error);
    results.push({ name: '测试4: 跨元素隔离验证', passed: false });
  }
  
  // 输出总结
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   测试总结                                                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  let passedCount = 0;
  results.forEach(result => {
    const status = result.passed ? '✓ 通过' : '✗ 失败';
    console.log(`  ${result.name}: ${status}`);
    if (result.passed) passedCount++;
  });
  
  console.log(`\n总计: ${passedCount}/${results.length} 测试通过`);
  
  if (passedCount === results.length) {
    console.log('\n🎉 所有测试通过！新的元素特定抗性功能工作正常。');
    return true;
  } else {
    console.log('\n⚠️  部分测试失败，请检查实现逻辑。');
    return false;
  }
}

// 执行测试
runAllTests();