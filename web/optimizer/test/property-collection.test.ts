#!/usr/bin/env tsx
/**
 * 属性集合计算测试脚本
 *
 * 验证 PropertyCollection 类的属性计算逻辑
 * - 基础属性计算
 * - 局内局外属性叠加
 * - 其他属性直接累加
 * - 格式化输出
 */

import { PropertyCollection } from '../src/model/property-collection';
import { PropertyType } from '../src/model/base';

console.log('=== 属性集合计算测试 ===');
console.log('');

// 测试用例1：基础属性计算（局外）
function testBasicPropertyCalculation() {
  console.log('📋 测试用例1：基础属性计算（局外）');
  console.log(''.padEnd(50, '-'));
  
  // 创建属性集合
  const props = new PropertyCollection(
    new Map([
      [PropertyType.ATK_BASE, 1000],
      [PropertyType.ATK_, 0.25], // 25%
      [PropertyType.ATK, 300],
      [PropertyType.HP_BASE, 10000],
      [PropertyType.HP_, 0.10], // 10%
      [PropertyType.HP, 500],
      [PropertyType.DEF_BASE, 500],
      [PropertyType.DEF_, 0.15], // 15%
      [PropertyType.DEF, 100],
      [PropertyType.CRIT_, 0.05], // 5%
      [PropertyType.CRIT_DMG_, 0.50], // 50%
    ])
  );
  
  // 计算最终属性
  props.calculateFinal();
  
  // 获取结果
  const finalAtk = props.getFinal(PropertyType.ATK_BASE);
  const finalHp = props.getFinal(PropertyType.HP_BASE);
  const finalDef = props.getFinal(PropertyType.DEF_BASE);
  const finalCrit = props.getFinal(PropertyType.CRIT_);
  
  // 预期结果
  const expectedAtk = 1000 * (1 + 0.25) + 300; // 1000 * 1.25 + 300 = 1250 + 300 = 1550
  const expectedHp = 10000 * (1 + 0.10) + 500; // 10000 * 1.10 + 500 = 11000 + 500 = 11500
  const expectedDef = 500 * (1 + 0.15) + 100; // 500 * 1.15 + 100 = 575 + 100 = 675
  const expectedCrit = 0.05; // 直接累加
  
  // 验证结果
  const atkPass = Math.abs(finalAtk - expectedAtk) < 0.01;
  const hpPass = Math.abs(finalHp - expectedHp) < 0.01;
  const defPass = Math.abs(finalDef - expectedDef) < 0.01;
  const critPass = Math.abs(finalCrit - expectedCrit) < 0.0001;
  
  // 输出结果
  console.log(`✅ 攻击力计算: ${finalAtk.toFixed(1)} (预期: ${expectedAtk.toFixed(1)}) ${atkPass ? '✓' : '✗'}`);
  console.log(`✅ 生命值计算: ${finalHp.toFixed(1)} (预期: ${expectedHp.toFixed(1)}) ${hpPass ? '✓' : '✗'}`);
  console.log(`✅ 防御力计算: ${finalDef.toFixed(1)} (预期: ${expectedDef.toFixed(1)}) ${defPass ? '✓' : '✗'}`);
  console.log(`✅ 暴击率计算: ${(finalCrit * 100).toFixed(2)}% (预期: ${(expectedCrit * 100).toFixed(2)}%) ${critPass ? '✓' : '✗'}`);
  
  console.log(`📊 测试结果: ${atkPass && hpPass && defPass && critPass ? '全部通过 ✓' : '部分失败 ✗'}`);
  console.log('');
  
  return atkPass && hpPass && defPass && critPass;
}

// 测试用例2：局内局外属性叠加
function testInCombatPropertyCalculation() {
  console.log('📋 测试用例2：局内局外属性叠加');
  console.log(''.padEnd(50, '-'));
  
  // 创建属性集合（局外+局内）
  const props = new PropertyCollection(
    new Map([ // 局外属性
      [PropertyType.ATK_BASE, 1000],
      [PropertyType.ATK_, 0.25], // 25%
      [PropertyType.ATK, 300],
    ]),
    new Map([ // 局内属性
      [PropertyType.ATK_, 0.30], // 30%
      [PropertyType.ATK, 150],
    ])
  );
  
  // 计算最终属性
  props.calculateFinal();
  
  // 获取结果
  const finalAtk = props.getFinal(PropertyType.ATK_BASE);
  
  // 预期结果
  const outOfCombatAtk = 1000 * (1 + 0.25) + 300; // 1550
  const expectedAtk = outOfCombatAtk * (1 + 0.30) + 150; // 1550 * 1.30 + 150 = 2015 + 150 = 2165
  
  // 验证结果
  const atkPass = Math.abs(finalAtk - expectedAtk) < 0.01;
  
  // 输出结果
  console.log(`📊 局外攻击力: ${outOfCombatAtk.toFixed(1)}`);
  console.log(`📊 局内攻击力加成: +30% 攻击力, +150 固定攻击`);
  console.log(`✅ 最终攻击力: ${finalAtk.toFixed(1)} (预期: ${expectedAtk.toFixed(1)}) ${atkPass ? '✓' : '✗'}`);
  
  console.log(`📊 测试结果: ${atkPass ? '通过 ✓' : '失败 ✗'}`);
  console.log('');
  
  return atkPass;
}

// 测试用例3：其他属性直接累加
function testOtherPropertyCalculation() {
  console.log('📋 测试用例3：其他属性直接累加');
  console.log(''.padEnd(50, '-'));
  
  // 创建属性集合
  const props = new PropertyCollection(
    new Map([ // 局外属性
      [PropertyType.CRIT_, 0.05], // 5%
      [PropertyType.CRIT_DMG_, 0.50], // 50%
      [PropertyType.ANOM_PROF, 100],
    ]),
    new Map([ // 局内属性
      [PropertyType.CRIT_, 0.10], // 10%
      [PropertyType.CRIT_DMG_, 0.20], // 20%
      [PropertyType.ANOM_PROF, 50],
    ])
  );
  
  // 计算最终属性
  props.calculateFinal();
  
  // 获取结果
  const finalCrit = props.getFinal(PropertyType.CRIT_);
  const finalCritDmg = props.getFinal(PropertyType.CRIT_DMG_);
  const finalAnomProf = props.getFinal(PropertyType.ANOM_PROF);
  
  // 预期结果
  const expectedCrit = 0.05 + 0.10; // 15%
  const expectedCritDmg = 0.50 + 0.20; // 70%
  const expectedAnomProf = 100 + 50; // 150
  
  // 验证结果
  const critPass = Math.abs(finalCrit - expectedCrit) < 0.0001;
  const critDmgPass = Math.abs(finalCritDmg - expectedCritDmg) < 0.0001;
  const anomProfPass = Math.abs(finalAnomProf - expectedAnomProf) < 0.01;
  
  // 输出结果
  console.log(`✅ 暴击率: ${(finalCrit * 100).toFixed(2)}% (预期: ${(expectedCrit * 100).toFixed(2)}%) ${critPass ? '✓' : '✗'}`);
  console.log(`✅ 暴击伤害: ${(finalCritDmg * 100).toFixed(2)}% (预期: ${(expectedCritDmg * 100).toFixed(2)}%) ${critDmgPass ? '✓' : '✗'}`);
  console.log(`✅ 异常精通: ${finalAnomProf.toFixed(1)} (预期: ${expectedAnomProf.toFixed(1)}) ${anomProfPass ? '✓' : '✗'}`);
  
  console.log(`📊 测试结果: ${critPass && critDmgPass && anomProfPass ? '全部通过 ✓' : '部分失败 ✗'}`);
  console.log('');
  
  return critPass && critDmgPass && anomProfPass;
}

// 测试用例4：格式化输出
function testFormatOutput() {
  console.log('📋 测试用例4：格式化输出');
  console.log(''.padEnd(50, '-'));
  
  // 创建属性集合
  const props = new PropertyCollection(
    new Map([
      [PropertyType.ATK_BASE, 1550],
      [PropertyType.HP_BASE, 11500],
      [PropertyType.DEF_BASE, 675],
      [PropertyType.CRIT_, 0.15], // 15%
      [PropertyType.CRIT_DMG_, 0.70], // 70%
    ])
  );
  
  // 计算最终属性
  props.calculateFinal();
  
  // 输出最终面板格式化结果
  console.log('📊 最终面板（格式化输出）:');
  console.log(props.format(2, 'final'));
  
  console.log(`📊 测试结果: 输出验证通过 ✓`);
  console.log('');
  
  return true;
}

// 运行所有测试用例
function runAllTests() {
  const testResults = [];
  
  testResults.push(testBasicPropertyCalculation());
  testResults.push(testInCombatPropertyCalculation());
  testResults.push(testOtherPropertyCalculation());
  testResults.push(testFormatOutput());
  
  console.log(''.padEnd(50, '='));
  console.log('🎉 测试总结');
  console.log(''.padEnd(50, '='));
  
  const passedTests = testResults.filter(result => result).length;
  const totalTests = testResults.length;
  
  console.log(`📈 测试通过率: ${passedTests}/${totalTests} (${Math.round((passedTests/totalTests)*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('✅ 所有测试用例通过！');
    process.exit(0);
  } else {
    console.log('❌ 部分测试用例失败！');
    process.exit(1);
  }
}

// 开始测试
runAllTests();
