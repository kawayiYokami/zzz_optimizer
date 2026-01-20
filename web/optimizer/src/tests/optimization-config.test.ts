/**
 * 优化配置功能测试脚本
 *
 * 测试队伍优化配置的保存、加载和智能推荐功能
 */

import { Agent } from '../model/agent';
import { Team } from '../model/team';
import { WeaponType, ElementType, PropertyType, Rarity } from '../model/base';
import { CharacterAnalyzer } from '../services/character-analyzer.service';
import { PresetGenerator } from '../services/preset-generator.service';

// 模拟角色数据
function createMockAgent(
  id: string,
  name: string,
  weaponType: WeaponType,
  element: ElementType
): Agent {
  // 创建一个最小化的 Agent 实例用于测试
  const agent = new Agent(
    id,
    id,
    name,
    60,
    Rarity.S,
    element,
    weaponType
  );
  return agent;
}

// 测试用例
function runTests() {
  console.log('='.repeat(60));
  console.log('开始测试优化配置功能');
  console.log('='.repeat(60));

  // 测试1：强攻型角色推荐
  console.log('\n【测试1】强攻型角色推荐');
  const attackAgent = createMockAgent('test_attack', '艾莲', WeaponType.ATTACK, ElementType.ICE);
  const attackStats = CharacterAnalyzer.recommendEffectiveStats(attackAgent);
  console.log('角色类型:', CharacterAnalyzer.getCharacterTypeDescription(attackAgent));
  console.log('推荐理由:', CharacterAnalyzer.getRecommendationReason(attackAgent));
  console.log('推荐词条:', attackStats.map(s => PropertyType[s]).join(', '));

  // 验证推荐结果
  const expectedAttackStats = [
    PropertyType.CRIT_,
    PropertyType.CRIT_DMG_,
    PropertyType.ATK_,
    PropertyType.ICE_DMG_
  ];
  const attackTestPassed = expectedAttackStats.every(stat => attackStats.includes(stat));
  console.log('✓ 测试结果:', attackTestPassed ? '通过' : '失败');

  // 测试2：异常型角色推荐
  console.log('\n【测试2】异常型角色推荐');
  const anomalyAgent = createMockAgent('test_anomaly', '简', WeaponType.ANOMALY, ElementType.ELECTRIC);
  const anomalyStats = CharacterAnalyzer.recommendEffectiveStats(anomalyAgent);
  console.log('角色类型:', CharacterAnalyzer.getCharacterTypeDescription(anomalyAgent));
  console.log('推荐理由:', CharacterAnalyzer.getRecommendationReason(anomalyAgent));
  console.log('推荐词条:', anomalyStats.map(s => PropertyType[s]).join(', '));

  const expectedAnomalyStats = [
    PropertyType.ANOM_MAS_,
    PropertyType.ANOM_PROF,
    PropertyType.ELECTRIC_DMG_
  ];
  const anomalyTestPassed = expectedAnomalyStats.every(stat => anomalyStats.includes(stat));
  console.log('✓ 测试结果:', anomalyTestPassed ? '通过' : '失败');

  // 测试3：击破型角色推荐
  console.log('\n【测试3】击破型角色推荐');
  const stunAgent = createMockAgent('test_stun', '莱卡恩', WeaponType.STUN, ElementType.ETHER);
  const stunStats = CharacterAnalyzer.recommendEffectiveStats(stunAgent);
  console.log('角色类型:', CharacterAnalyzer.getCharacterTypeDescription(stunAgent));
  console.log('推荐理由:', CharacterAnalyzer.getRecommendationReason(stunAgent));
  console.log('推荐词条:', stunStats.map(s => PropertyType[s]).join(', '));

  const expectedStunStats = [
    PropertyType.IMPACT_,
    PropertyType.ATK_,
    PropertyType.ETHER_DMG_
  ];
  const stunTestPassed = expectedStunStats.every(stat => stunStats.includes(stat));
  console.log('✓ 测试结果:', stunTestPassed ? '通过' : '失败');

  // 测试4：支援型角色推荐
  console.log('\n【测试4】支援型角色推荐');
  const supportAgent = createMockAgent('test_support', '妮可', WeaponType.SUPPORT, ElementType.ETHER);
  const supportStats = CharacterAnalyzer.recommendEffectiveStats(supportAgent);
  console.log('角色类型:', CharacterAnalyzer.getCharacterTypeDescription(supportAgent));
  console.log('推荐理由:', CharacterAnalyzer.getRecommendationReason(supportAgent));
  console.log('推荐词条:', supportStats.map(s => PropertyType[s]).join(', '));

  const expectedSupportStats = [
    PropertyType.ENER_REGEN_,
    PropertyType.HP_,
    PropertyType.ETHER_DMG_
  ];
  const supportTestPassed = expectedSupportStats.every(stat => supportStats.includes(stat));
  console.log('✓ 测试结果:', supportTestPassed ? '通过' : '失败');

  // 测试5：防护型角色推荐
  console.log('\n【测试5】防护型角色推荐');
  const defenseAgent = createMockAgent('test_defense', '本', WeaponType.DEFENSE, ElementType.FIRE);
  const defenseStats = CharacterAnalyzer.recommendEffectiveStats(defenseAgent);
  console.log('角色类型:', CharacterAnalyzer.getCharacterTypeDescription(defenseAgent));
  console.log('推荐理由:', CharacterAnalyzer.getRecommendationReason(defenseAgent));
  console.log('推荐词条:', defenseStats.map(s => PropertyType[s]).join(', '));

  const expectedDefenseStats = [
    PropertyType.HP_,
    PropertyType.DEF_,
    PropertyType.IMPACT_,
    PropertyType.FIRE_DMG_
  ];
  const defenseTestPassed = expectedDefenseStats.every(stat => defenseStats.includes(stat));
  console.log('✓ 测试结果:', defenseTestPassed ? '通过' : '失败');

  // 测试6：队伍配置生成
  console.log('\n【测试6】队伍配置生成');
  const team = new Team([attackAgent], 'team_test', '测试队伍');
  const config = PresetGenerator.generateRecommendedConfig(team);

  console.log('队伍名称:', team.name);
  console.log('前台角色:', team.frontAgent.name_cn);
  console.log('生成配置:');
  console.log('  - 有效词条剪枝:', config.constraints.effectiveStatPruning?.enabled ? '启用' : '禁用');
  console.log('  - 有效词条数量:', config.constraints.effectiveStatPruning?.effectiveStats.length);
  console.log('  - 有效词条列表:', config.constraints.effectiveStatPruning?.effectiveStats.map(s => PropertyType[s]).join(', '));
  console.log('  - 技能选择:', config.selectedSkillKeys.length, '个');
  console.log('  - Buff选择:', config.disabledBuffIds.length, '个禁用');
  console.log('  - 敌人选择:', config.selectedEnemyId || '未选择');

  const configTestPassed =
    config.constraints.effectiveStatPruning?.enabled === true &&
    config.constraints.effectiveStatPruning.effectiveStats.length > 0;
  console.log('✓ 测试结果:', configTestPassed ? '通过' : '失败');

  // 测试7：配置来源描述
  console.log('\n【测试7】配置来源描述');
  const sourceDesc = PresetGenerator.getConfigSourceDescription(config, team);
  console.log('配置来源:', sourceDesc);
  const sourceTestPassed = sourceDesc.includes('智能推荐');
  console.log('✓ 测试结果:', sourceTestPassed ? '通过' : '失败');

  // 测试8：默认配置检测
  console.log('\n【测试8】默认配置检测');
  const defaultConfig = PresetGenerator.getDefaultConfig();
  const isDefault = PresetGenerator.isDefaultConfig(defaultConfig);
  console.log('默认配置检测:', isDefault ? '是默认配置' : '非默认配置');
  const defaultTestPassed = isDefault === true;
  console.log('✓ 测试结果:', defaultTestPassed ? '通过' : '失败');

  // 汇总结果
  console.log('\n' + '='.repeat(60));
  console.log('测试汇总');
  console.log('='.repeat(60));
  const allTests = [
    attackTestPassed,
    anomalyTestPassed,
    stunTestPassed,
    supportTestPassed,
    defenseTestPassed,
    configTestPassed,
    sourceTestPassed,
    defaultTestPassed
  ];
  const passedCount = allTests.filter(t => t).length;
  const totalCount = allTests.length;

  console.log(`通过: ${passedCount}/${totalCount}`);
  console.log(`失败: ${totalCount - passedCount}/${totalCount}`);

  if (passedCount === totalCount) {
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n❌ 部分测试失败，请检查实现');
  }
  console.log('='.repeat(60));
}

// 导出测试函数
export { runTests };

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
