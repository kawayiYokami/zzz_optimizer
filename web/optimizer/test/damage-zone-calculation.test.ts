#!/usr/bin/env tsx
/**
 * 伤害乘区计算测试脚本
 *
 * 验证 DamageCalculatorService 中各个乘区的计算逻辑
 * - 暴击区
 * - 防御区
 * - 抗性区
 * - 异常积蓄区
 * - 异常精通区
 * - 异常增伤区
 * - 异常暴击区
 * - 等级区
 */

import { DamageCalculatorService } from '../src/services/damage-calculator.service';
import { ZoneCollection } from '../src/model/zone-collection';
import { PropertyCollection } from '../src/model/property-collection';
import { EnemyStats } from '../src/model/enemy';
import { PropertyType } from '../src/model/base';

console.log('=== 伤害乘区计算测试 ===');
console.log('');

// 创建测试用的属性集合
function createTestPropertyCollection(): PropertyCollection {
  // 属性需要放在 inCombat 中，因为 toFinalStats 只处理局内属性
  return new PropertyCollection(
    new Map(), // out_of_combat (空)
    new Map([  // in_combat
      [PropertyType.CRIT_, 0.50], // 50% 暴击率
      [PropertyType.CRIT_DMG_, 1.50], // 150% 暴击伤害
      [PropertyType.DEF_RED_, 0.20], // 20% 防御降低
      [PropertyType.DEF_IGN_, 0.10], // 10% 无视防御
      [PropertyType.PEN_, 0.15], // 15% 穿透率
      [PropertyType.PEN, 200], // 200 穿透值
      [PropertyType.ENEMY_RES_RED_, 0.30], // 30% 抗性削弱
      [PropertyType.RES_IGN_, 0.20], // 20% 无视抗性
      [PropertyType.ANOM_BUILDUP_, 50], // 50% 异常积蓄效率
      [PropertyType.PHYSICAL_ANOMALY_BUILDUP_, 30], // 30% 物理异常积蓄效率
      [PropertyType.ANOM_BUILDUP_RES_, 0.10], // 10% 敌人异常积蓄抗性
      [PropertyType.PHYSICAL_ANOM_BUILDUP_RES_, 0.05], // 5% 敌人物理异常积蓄抗性
      [PropertyType.ANOM_PROF, 150], // 150 异常精通
      [PropertyType.ANOMALY_DMG_, 0.50], // 50% 异常伤害加成
      [PropertyType.ANOM_CRIT_, 0.40], // 40% 异常暴击率
      [PropertyType.ANOM_CRIT_DMG_, 1.00], // 100% 异常暴击伤害
      [PropertyType.DAZE_RED_, 0.30], // 30% 失衡易伤
    ])
  );
}

// 创建测试用的敌人属性
function createTestEnemyStats(): EnemyStats {
  return new EnemyStats(
    100000, // hp
    800, // defense
    60, // level
    1000, // stun_max
    true, // can_stun
    0.50, // stun_vulnerability (50% 失衡易伤)
    true, // is_stunned
    {
      ice: 0.0,
      fire: 0.0,
      electric: 0.0,
      physical: 0.20, // 20% 物理抗性
      ether: 0.0,
    },
    {
      ice: 600.0,
      fire: 600.0,
      electric: 600.0,
      physical: 720.0,
      ether: 600.0,
    },
    false // has_corruption_shield
  );
}

// 测试暴击区计算
function testCritZone() {
  console.log('📋 测试用例1：暴击区计算');
  console.log(''.padEnd(50, '-'));

  const props = createTestPropertyCollection();
  const zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);

  const critZone = DamageCalculatorService.calculateCritZone(zones);
  console.log(`暴击率: ${(zones.getFinal(PropertyType.CRIT_) * 100).toFixed(1)}%`);
  console.log(`暴击伤害: ${(zones.getFinal(PropertyType.CRIT_DMG_) * 100).toFixed(1)}%`);
  console.log(`暴击区: ${critZone.toFixed(4)}`);
  
  // 验证：暴击区 = 1 + 0.50 * 1.50 = 1.75
  const expected = 1 + 0.50 * 1.50;
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(critZone - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试防御区计算
function testDefenseMultiplier() {
  console.log('📋 测试用例2：防御区计算');
  console.log(''.padEnd(50, '-'));

  const props = createTestPropertyCollection();
  const zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  const enemy = createTestEnemyStats();
  const attackerLevel = 60;

  const defMult = DamageCalculatorService.calculateDefenseMultiplier(zones, enemy, attackerLevel);
  console.log(`敌人基础防御: ${enemy.defense}`);
  console.log(`防御降低: ${(zones.getFinal(PropertyType.DEF_RED_) * 100).toFixed(1)}%`);
  console.log(`无视防御: ${(zones.getFinal(PropertyType.DEF_IGN_) * 100).toFixed(1)}%`);
  console.log(`穿透率: ${(zones.getFinal(PropertyType.PEN_) * 100).toFixed(1)}%`);
  console.log(`穿透值: ${zones.getFinal(PropertyType.PEN)}`);
  console.log(`防御区: ${defMult.toFixed(4)}`);
  
  // 手动计算验证
  const level_coef = attackerLevel * 10 + 100; // 700
  const defRed = zones.getFinal(PropertyType.DEF_RED_);
  const defIgn = zones.getFinal(PropertyType.DEF_IGN_);
  const penRate = zones.getFinal(PropertyType.PEN_);
  const penValue = zones.getFinal(PropertyType.PEN);
  const effective_def = Math.max(0, enemy.defense * (1 - defRed - defIgn) * (1 - penRate) - penValue);
  const expected = level_coef / (effective_def + level_coef);
  
  console.log(`有效防御: ${effective_def.toFixed(2)}`);
  console.log(`等级基数: ${level_coef}`);
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(defMult - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试抗性区计算
function testResistanceMultiplier() {
  console.log('📋 测试用例3：抗性区计算');
  console.log(''.padEnd(50, '-'));

  const props = createTestPropertyCollection();
  const zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  const enemy = createTestEnemyStats();
  const element = 'physical';

  const resMult = DamageCalculatorService.calculateResistanceMultiplier(zones, enemy, element);
  console.log(`敌人基础抗性: ${(enemy.getResistance(element) * 100).toFixed(1)}%`);
  console.log(`抗性削弱: ${(zones.getFinal(PropertyType.ENEMY_RES_RED_) * 100).toFixed(1)}%`);
  console.log(`无视抗性: ${(zones.getFinal(PropertyType.RES_IGN_) * 100).toFixed(1)}%`);
  console.log(`抗性区: ${resMult.toFixed(4)}`);
  
  // 验证：抗性区 = 1 - 0.20 + 0.30 + 0.20 = 1.30
  const expected = 1 - 0.20 + 0.30 + 0.20;
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(resMult - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试异常积蓄区计算
function testAnomalyBuildupZone() {
  console.log('📋 测试用例4：异常积蓄区计算');
  console.log(''.padEnd(50, '-'));

  const props = createTestPropertyCollection();
  const zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  const element = 'physical';

  const buildupZone = DamageCalculatorService.calculateAnomalyBuildupZone(zones, element);
  console.log(`通用积蓄效率: ${zones.getFinal(PropertyType.ANOM_BUILDUP_)}%`);
  console.log(`物理积蓄效率: ${zones.getFinal(PropertyType.PHYSICAL_ANOMALY_BUILDUP_)}%`);
  console.log(`敌人积蓄抗性: ${(zones.getFinal(PropertyType.ANOM_BUILDUP_RES_) * 100).toFixed(1)}%`);
  console.log(`敌人物理积蓄抗性: ${(zones.getFinal(PropertyType.PHYSICAL_ANOM_BUILDUP_RES_) * 100).toFixed(1)}%`);
  console.log(`异常积蓄区: ${buildupZone.toFixed(4)}`);
  
  // 验证：积蓄效率 = (1 + 0.50 + 0.30) * (1 - 0.10 - 0.05) = 1.80 * 0.85 = 1.53
  const expected = (1 + 0.50 + 0.30) * (1 - 0.10 - 0.05);
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(buildupZone - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试异常精通区计算
function testAnomalyProfMultiplier() {
  console.log('📋 测试用例5：异常精通区计算');
  console.log(''.padEnd(50, '-'));

  const props = createTestPropertyCollection();
  const zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);

  const profMult = DamageCalculatorService.calculateAnomalyProfMultiplier(zones);
  console.log(`异常精通: ${zones.getFinal(PropertyType.ANOM_PROF)}`);
  console.log(`异常精通区: ${profMult.toFixed(4)}`);
  
  // 验证：异常精通区 = 150 / 100 = 1.50
  const expected = 150 / 100;
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(profMult - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试异常增伤区计算
function testAnomalyDmgMultiplier() {
  console.log('📋 测试用例6：异常增伤区计算');
  console.log(''.padEnd(50, '-'));

  const props = createTestPropertyCollection();
  const zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);

  const dmgMult = DamageCalculatorService.calculateAnomalyDmgMultiplier(zones);
  console.log(`异常伤害加成: ${(zones.getFinal(PropertyType.ANOMALY_DMG_) * 100).toFixed(1)}%`);
  console.log(`异常增伤区: ${dmgMult.toFixed(4)}`);
  
  // 验证：异常增伤区 = 1 + 0.50 = 1.50
  const expected = 1 + 0.50;
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(dmgMult - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试异常暴击区计算
function testAnomalyCritMultiplier() {
  console.log('📋 测试用例7：异常暴击区计算');
  console.log(''.padEnd(50, '-'));

  const props = createTestPropertyCollection();
  const zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);

  const critMult = DamageCalculatorService.calculateAnomalyCritMultiplier(zones);
  console.log(`异常暴击率: ${(zones.getFinal(PropertyType.ANOM_CRIT_) * 100).toFixed(1)}%`);
  console.log(`异常暴击伤害: ${(zones.getFinal(PropertyType.ANOM_CRIT_DMG_) * 100).toFixed(1)}%`);
  console.log(`异常暴击区: ${critMult.toFixed(4)}`);
  
  // 验证：异常暴击区 = 1 + 0.40 * 1.00 = 1.40
  const expected = 1 + 0.40 * 1.00;
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(critMult - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试等级区计算
function testLevelMultiplier() {
  console.log('📋 测试用例8：等级区计算');
  console.log(''.padEnd(50, '-'));

  const level = 60;
  const levelMult = DamageCalculatorService.calculateLevelMultiplier(level);
  console.log(`攻击方等级: ${level}`);
  console.log(`等级区: ${levelMult.toFixed(4)}`);
  
  // 验证：等级区 = trunc(1 + 1/59 * 59, 4) = trunc(2, 4) = 2
  const expected = Math.trunc((1 + (1 / 59) * (level - 1)) * 10000) / 10000;
  console.log(`预期结果: ${expected.toFixed(4)}`);
  console.log(`测试结果: ${Math.abs(levelMult - expected) < 0.0001 ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
}

// 测试有效范围限制
function testRangeLimits() {
  console.log('📋 测试用例9：有效范围限制');
  console.log(''.padEnd(50, '-'));

  // 测试暴击区上限
  let props = new PropertyCollection(new Map(), new Map([
    [PropertyType.CRIT_, 1.50], // 150% 暴击率（超出上限）
    [PropertyType.CRIT_DMG_, 6.00], // 600% 暴击伤害（超出上限）
  ]));
  let zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  let critZone = DamageCalculatorService.calculateCritZone(zones);
  console.log(`暴击区上限测试: ${critZone.toFixed(4)} (预期: 6.0000) ${critZone <= 6 ? '✅' : '❌'}`);

  // 测试异常精通区上限
  props = new PropertyCollection(new Map(), new Map([
    [PropertyType.ANOM_PROF, 1500], // 1500 异常精通（超出上限）
  ]));
  zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  let profMult = DamageCalculatorService.calculateAnomalyProfMultiplier(zones);
  console.log(`异常精通区上限测试: ${profMult.toFixed(4)} (预期: 10.0000) ${profMult <= 10 ? '✅' : '❌'}`);

  // 测试异常增伤区上限
  props = new PropertyCollection(new Map(), new Map([
    [PropertyType.ANOMALY_DMG_, 5.00], // 500% 异常伤害加成（超出上限）
  ]));
  zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  let dmgMult = DamageCalculatorService.calculateAnomalyDmgMultiplier(zones);
  console.log(`异常增伤区上限测试: ${dmgMult.toFixed(4)} (预期: 3.0000) ${dmgMult <= 3 ? '✅' : '❌'}`);

  // 测试异常暴击区下限和上限
  props = new PropertyCollection(new Map(), new Map([
    [PropertyType.ANOM_CRIT_, 0.00], // 0% 异常暴击率
    [PropertyType.ANOM_CRIT_DMG_, 0.00], // 0% 异常暴击伤害
  ]));
  zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  let critMult = DamageCalculatorService.calculateAnomalyCritMultiplier(zones);
  console.log(`异常暴击区下限测试: ${critMult.toFixed(4)} (预期: 1.0000) ${critMult >= 1 ? '✅' : '❌'}`);

  props = new PropertyCollection(new Map(), new Map([
    [PropertyType.ANOM_CRIT_, 1.00], // 100% 异常暴击率
    [PropertyType.ANOM_CRIT_DMG_, 3.00], // 300% 异常暴击伤害
  ]));
  zones = new ZoneCollection();
  zones.updateFromPropertyCollection(props);
  critMult = DamageCalculatorService.calculateAnomalyCritMultiplier(zones);
  console.log(`异常暴击区上限测试: ${critMult.toFixed(4)} (预期: 3.0000) ${critMult <= 3 ? '✅' : '❌'}`);

  console.log('');
}

// 运行所有测试
function runAllTests() {
  testCritZone();
  testDefenseMultiplier();
  testResistanceMultiplier();
  testAnomalyBuildupZone();
  testAnomalyProfMultiplier();
  testAnomalyDmgMultiplier();
  testAnomalyCritMultiplier();
  testLevelMultiplier();
  testRangeLimits();

  console.log('=== 所有测试完成 ===');
}

runAllTests();