/**
 * FastEvaluator 伤害计算测试
 *
 * 验证 fast-evaluator.ts 的计算结果是否正确
 */

import { describe, it, expect } from 'vitest';
import { FastEvaluator } from '../src/optimizer/workers/fast-evaluator';
import { PROP_IDX } from '../src/optimizer/types/property-index';
import type {
  PrecomputedData,
  DiscData,
  FixedMultipliers,
  DefenseParams,
  PrecomputedSkillParams,
} from '../src/optimizer/types/precomputed';
import { EnemyStats } from '../src/model/enemy';

/**
 * 创建简单的测试驱动盘数据
 */
function createTestDisc(setIdx: number, stats: Partial<Record<number, number>> = {}): DiscData {
  const statsArray = new Float64Array(PROP_IDX.TOTAL_PROPS);
  for (const [idx, value] of Object.entries(stats)) {
    statsArray[Number(idx)] = value as number;
  }
  return {
    id: `test-disc-${setIdx}`,
    setIdx,
    stats: statsArray,
    effectiveScore: 100,
  };
}

/**
 * 创建测试用的预计算数据
 */
function createTestPrecomputed(overrides: Partial<{
  agentAtk: number;
  atkBase: number;
  critRate: number;
  critDmg: number;
  dmgBonus: number;
  anomalyProf: number;
  enemyDef: number;
  attackerLevel: number;
  skillRatio: number;
  skillElement: number;
  anomalyBuildup: number;
  isPenetration: boolean;
  specialAnomaly: { element: string; ratio: number } | null;
}> = {}): PrecomputedData {
  const {
    agentAtk = 0,
    atkBase = 1000,
    critRate = 0.5,
    critDmg = 0.5,
    dmgBonus = 0,
    anomalyProf = 100,
    enemyDef = 800,
    attackerLevel = 60,
    skillRatio = 1.0,
    skillElement = 200, // physical
    anomalyBuildup = 0,
    isPenetration = false,
    specialAnomaly = null,
  } = overrides;

  const agentStats = new Float64Array(PROP_IDX.TOTAL_PROPS);
  agentStats[PROP_IDX.ATK_BASE] = atkBase;
  agentStats[PROP_IDX.ATK] = agentAtk;
  agentStats[PROP_IDX.ATK_] = 0;
  agentStats[PROP_IDX.CRIT_] = critRate;
  agentStats[PROP_IDX.CRIT_DMG_] = critDmg;
  agentStats[PROP_IDX.DMG_] = dmgBonus;
  agentStats[PROP_IDX.ANOM_PROF] = anomalyProf;

  const levelBase = attackerLevel * 10 + 100; // 60 * 10 + 100 = 700

  const defenseParams: DefenseParams = {
    levelBase,
    enemyDef,
    baseDefRed: 0,
    baseDefIgn: 0,
  };

  const fixedMultipliers: FixedMultipliers = {
    resMult: 1.0,           // 无抗性
    dmgTakenMult: 1.0,      // 无易伤
    stunVulnMult: 1.0,      // 无失衡易伤
    distanceMult: 1.0,      // 无距离衰减
    levelMult: 1 + (attackerLevel - 1) / 59,  // 60级 = 2.0
    anomalyCritMult: 1.0,   // 无异常暴击
    anomalyDmgMult: 1.0,    // 无异常增伤
    defenseParams,
  };

  const skillsParams: PrecomputedSkillParams[] = [{
    ratio: skillRatio,
    element: skillElement,
    anomalyBuildup,
    tags: [],
    isPenetration,
  }];

  const enemyStats = new EnemyStats(
    100000, // hp
    enemyDef,
    60,     // level
    1000,   // stunMax
    true,   // canStun
    1,      // stunVulnerability
    false,  // isStunned
    {},     // elementResistances
    { physical: 720, fire: 600, ice: 600, electric: 600, ether: 600 },
    false   // hasCorruptionShield
  );

  return {
    agentStats,
    discsBySlot: [[], [], [], [], [], []],
    setBonuses: [],
    externalBuffStats: new Float64Array(PROP_IDX.TOTAL_PROPS),
    teammateConversionStats: new Float64Array(PROP_IDX.TOTAL_PROPS),
    selfConversionBuffs: [],
    fixedMultipliers,
    skillsParams,
    agentLevel: attackerLevel,
    setIdToIdx: {},
    activeDiskSets: [],
    enemyStats,
    specialAnomalyConfig: specialAnomaly,
  };
}

describe('FastEvaluator 伤害计算', () => {
  describe('常规直伤计算', () => {
    it('基础直伤公式验证：baseDamage * dmgBonus * critZone * defMult', () => {
      // 设置简单参数
      const precomputed = createTestPrecomputed({
        atkBase: 1000,
        agentAtk: 0,
        critRate: 0.5,
        critDmg: 0.5,
        dmgBonus: 0,
        skillRatio: 1.0,
        enemyDef: 800,
        attackerLevel: 60,
      });

      const evaluator = new FastEvaluator(precomputed);

      // 创建6个空驱动盘
      const discs = Array.from({ length: 6 }, (_, i) => createTestDisc(i));

      const result = evaluator.calculateDamageWithMultipliers(discs);

      // 手动计算期望值
      const finalAtk = 1000; // ATK_BASE * (1 + ATK_) + ATK = 1000 * 1 + 0
      const baseDamage = finalAtk * 1.0; // 1000
      const dmgBonus = 1; // 1 + 0
      const critZone = 1 + 0.5 * 0.5; // 1.25
      const levelBase = 60 * 10 + 100; // 700
      const defMult = levelBase / (800 + levelBase); // 700 / 1500 = 0.4667

      const expectedDamage = baseDamage * dmgBonus * critZone * defMult;
      // 1000 * 1 * 1.25 * 0.4667 = 583.33

      console.log('=== 常规直伤测试 ===');
      console.log('输入参数:');
      console.log(`  ATK_BASE: 1000, ATK: 0, ATK_: 0`);
      console.log(`  CRIT_: 0.5, CRIT_DMG_: 0.5`);
      console.log(`  DMG_: 0, skillRatio: 1.0`);
      console.log(`  enemyDef: 800, attackerLevel: 60`);
      console.log('');
      console.log('手动计算:');
      console.log(`  finalAtk = ${finalAtk}`);
      console.log(`  baseDamage = ${baseDamage}`);
      console.log(`  dmgBonus = ${dmgBonus}`);
      console.log(`  critZone = ${critZone}`);
      console.log(`  defMult = ${defMult.toFixed(4)}`);
      console.log(`  expectedDamage = ${expectedDamage.toFixed(2)}`);
      console.log('');
      console.log('FastEvaluator 结果:');
      console.log(`  damage = ${result.damage.toFixed(2)}`);
      console.log(`  multipliers = ${JSON.stringify(result.multipliers.map(m => m.toFixed(4)))}`);

      // 验证结果
      expect(result.damage).toBeCloseTo(expectedDamage, 1);
    });

    it('带驱动盘攻击力加成的直伤计算', () => {
      const precomputed = createTestPrecomputed({
        atkBase: 1000,
        agentAtk: 0,
        critRate: 0.5,
        critDmg: 0.5,
        dmgBonus: 0,
        skillRatio: 1.0,
        enemyDef: 800,
        attackerLevel: 60,
      });

      const evaluator = new FastEvaluator(precomputed);

      // 驱动盘提供 500 固定攻击力
      const discs = Array.from({ length: 6 }, (_, i) =>
        createTestDisc(i, { [PROP_IDX.ATK]: i === 0 ? 500 : 0 })
      );

      const result = evaluator.calculateDamageWithMultipliers(discs);

      // 手动计算
      const finalAtk = 1000 * 1 + 500; // 1500
      const baseDamage = finalAtk * 1.0;
      const dmgBonus = 1;
      const critZone = 1.25;
      const defMult = 700 / 1500;

      const expectedDamage = baseDamage * dmgBonus * critZone * defMult;
      // 1500 * 1 * 1.25 * 0.4667 = 875

      console.log('=== 带驱动盘攻击力测试 ===');
      console.log(`驱动盘 ATK: 500`);
      console.log(`期望 finalAtk: ${finalAtk}`);
      console.log(`期望 damage: ${expectedDamage.toFixed(2)}`);
      console.log(`实际 damage: ${result.damage.toFixed(2)}`);

      expect(result.damage).toBeCloseTo(expectedDamage, 1);
    });

    it('带驱动盘穿透的直伤计算', () => {
      const precomputed = createTestPrecomputed({
        atkBase: 1000,
        critRate: 0.5,
        critDmg: 0.5,
        skillRatio: 1.0,
        enemyDef: 800,
        attackerLevel: 60,
      });

      const evaluator = new FastEvaluator(precomputed);

      // 驱动盘提供 20% 穿透
      const discs = Array.from({ length: 6 }, (_, i) =>
        createTestDisc(i, { [PROP_IDX.PEN_]: i === 0 ? 0.2 : 0 })
      );

      const result = evaluator.calculateDamageWithMultipliers(discs);

      // 手动计算
      const finalAtk = 1000;
      const baseDamage = finalAtk * 1.0;
      const dmgBonus = 1;
      const critZone = 1.25;
      // 有 20% 穿透
      const effectiveDef = 800 * (1 - 0.2); // 640
      const defMult = 700 / (640 + 700); // 0.5224

      const expectedDamage = baseDamage * dmgBonus * critZone * defMult;

      console.log('=== 带穿透测试 ===');
      console.log(`驱动盘 PEN_: 20%`);
      console.log(`有效防御: ${effectiveDef}`);
      console.log(`防御乘区: ${defMult.toFixed(4)}`);
      console.log(`期望 damage: ${expectedDamage.toFixed(2)}`);
      console.log(`实际 damage: ${result.damage.toFixed(2)}`);

      expect(result.damage).toBeCloseTo(expectedDamage, 1);
    });
  });

  describe('贯穿伤害计算', () => {
    it('贯穿伤害应跳过防御区，使用贯穿力和贯穿增伤', () => {
      const precomputed = createTestPrecomputed({
        atkBase: 1000,
        critRate: 0.5,
        critDmg: 0.5,
        skillRatio: 1.0,
        enemyDef: 800,
        attackerLevel: 60,
        isPenetration: true,
      });

      // 设置贯穿力
      precomputed.agentStats[PROP_IDX.SHEER_FORCE] = 2000;
      precomputed.agentStats[PROP_IDX.SHEER_DMG_] = 0.3; // 30% 贯穿增伤

      const evaluator = new FastEvaluator(precomputed);
      const discs = Array.from({ length: 6 }, (_, i) => createTestDisc(i));

      const result = evaluator.calculateDamageWithMultipliers(discs);

      // 贯穿伤害 = 贯穿力 × 倍率 × 增伤 × 暴击 × 贯穿增伤（无防御区）
      const sheerForce = 2000;
      const baseDamage = sheerForce * 1.0;
      const dmgBonus = 1;
      const critZone = 1.25;
      const pierceBonus = 1 + 0.3;
      // 无防御区！

      const expectedDamage = baseDamage * dmgBonus * critZone * pierceBonus;
      // 2000 * 1 * 1.25 * 1.3 = 3250

      console.log('=== 贯穿伤害测试 ===');
      console.log(`贯穿力: ${sheerForce}`);
      console.log(`贯穿增伤: 30%`);
      console.log(`期望 damage (无防御区): ${expectedDamage.toFixed(2)}`);
      console.log(`实际 damage: ${result.damage.toFixed(2)}`);

      expect(result.damage).toBeCloseTo(expectedDamage, 1);
    });
  });

  describe('createFullResult 通用乘区应用', () => {
    it('应在最终结果中乘以通用乘区', () => {
      const precomputed = createTestPrecomputed({
        atkBase: 1000,
        critRate: 0.5,
        critDmg: 0.5,
        skillRatio: 1.0,
        enemyDef: 800,
        attackerLevel: 60,
      });

      // 设置通用乘区
      precomputed.fixedMultipliers.resMult = 0.9;      // 10% 抗性
      precomputed.fixedMultipliers.dmgTakenMult = 1.2; // 20% 易伤
      precomputed.fixedMultipliers.stunVulnMult = 1.1; // 10% 失衡易伤

      const evaluator = new FastEvaluator(precomputed);
      const discs = Array.from({ length: 6 }, (_, i) => createTestDisc(i));

      const variableResult = evaluator.calculateDamageWithMultipliers(discs);
      const fullResult = evaluator.createFullResult(discs, variableResult.damage, variableResult.multipliers);

      // 通用乘区 = resMult * dmgTakenMult * stunVulnMult
      const universalMult = 0.9 * 1.2 * 1.1; // 1.188

      console.log('=== 通用乘区测试 ===');
      console.log(`resMult: 0.9, dmgTakenMult: 1.2, stunVulnMult: 1.1`);
      console.log(`universalMult: ${universalMult.toFixed(4)}`);
      console.log(`变量伤害: ${variableResult.damage.toFixed(2)}`);
      console.log(`期望最终伤害: ${(variableResult.damage * universalMult).toFixed(2)}`);
      console.log(`实际最终伤害: ${fullResult.damage.toFixed(2)}`);

      expect(fullResult.damage).toBeCloseTo(variableResult.damage * universalMult, 1);
    });
  });
});

/**
 * FastEvaluator 手动验算对比
 */
describe('FastEvaluator 手动验算对比', () => {
  it('复杂直伤计算对比', () => {
    // === 设置相同的输入参数 ===
    const ATK_BASE = 1000;
    const ATK = 500;
    const ATK_ = 0.2;
    const CRIT_RATE = 0.5;
    const CRIT_DMG = 0.5;
    const DMG_BONUS = 0.3;
    const SKILL_RATIO = 2.0;
    const ENEMY_DEF = 800;
    const ATTACKER_LEVEL = 60;
    const PEN_RATE = 0.1;

    // === 手动计算 ===
    const levelBase = ATTACKER_LEVEL * 10 + 100; // 700
    const finalAtk = ATK_BASE * (1 + ATK_) + ATK; // 1000 * 1.2 + 500 = 1700
    const baseDamage = finalAtk * SKILL_RATIO; // 1700 * 2.0 = 3400
    const dmgBonus = 1 + DMG_BONUS; // 1.3
    const critZone = 1 + CRIT_RATE * CRIT_DMG; // 1.25
    const effectiveDef = ENEMY_DEF * (1 - PEN_RATE); // 800 * 0.9 = 720
    const defMult = levelBase / (effectiveDef + levelBase); // 700 / 1420 = 0.4930

    const manualDamage = baseDamage * dmgBonus * critZone * defMult;

    // === FastEvaluator 计算 ===
    const precomputed = createTestPrecomputed({
      atkBase: ATK_BASE,
      agentAtk: ATK,
      critRate: CRIT_RATE,
      critDmg: CRIT_DMG,
      dmgBonus: DMG_BONUS,
      skillRatio: SKILL_RATIO,
      enemyDef: ENEMY_DEF,
      attackerLevel: ATTACKER_LEVEL,
    });

    // 设置 ATK_
    precomputed.agentStats[PROP_IDX.ATK_] = ATK_;

    const evaluator = new FastEvaluator(precomputed);

    // 驱动盘提供穿透
    const discs = Array.from({ length: 6 }, (_, i) =>
      createTestDisc(i, { [PROP_IDX.PEN_]: i === 0 ? PEN_RATE : 0 })
    );

    const feResult = evaluator.calculateDamageWithMultipliers(discs);

    console.log('=== 复杂直伤测试 ===');
    console.log('输入参数:');
    console.log(`  ATK_BASE: ${ATK_BASE}, ATK: ${ATK}, ATK_: ${ATK_}`);
    console.log(`  CRIT_: ${CRIT_RATE}, CRIT_DMG_: ${CRIT_DMG}`);
    console.log(`  DMG_: ${DMG_BONUS}, PEN_: ${PEN_RATE}`);
    console.log(`  skillRatio: ${SKILL_RATIO}, enemyDef: ${ENEMY_DEF}`);
    console.log('');
    console.log('手动计算:');
    console.log(`  finalAtk: ${finalAtk}`);
    console.log(`  baseDamage: ${baseDamage}`);
    console.log(`  dmgBonus: ${dmgBonus}`);
    console.log(`  critZone: ${critZone}`);
    console.log(`  effectiveDef: ${effectiveDef}`);
    console.log(`  defMult: ${defMult.toFixed(4)}`);
    console.log(`  manualDamage: ${manualDamage.toFixed(2)}`);
    console.log('');
    console.log('FastEvaluator:');
    console.log(`  damage (不含通用乘区): ${feResult.damage.toFixed(2)}`);
    console.log(`  multipliers: ${JSON.stringify(feResult.multipliers.map(m => m.toFixed(4)))}`);

    expect(feResult.damage).toBeCloseTo(manualDamage, 1);
  });

  it('验证 multipliers 数组内容', () => {
    const ATK_BASE = 1000;
    const CRIT_ = 0.6;
    const CRIT_DMG_ = 0.8;
    const DMG_ = 0.5;
    const ANOM_PROF = 200;

    const precomputed = createTestPrecomputed({
      atkBase: ATK_BASE,
      critRate: CRIT_,
      critDmg: CRIT_DMG_,
      dmgBonus: DMG_,
      anomalyProf: ANOM_PROF,
      skillRatio: 1.0,
    });

    const evaluator = new FastEvaluator(precomputed);
    const discs = Array.from({ length: 6 }, (_, i) => createTestDisc(i));
    const result = evaluator.calculateDamageWithMultipliers(discs);

    // multipliers[0] = finalAtkAfterConv
    // multipliers[2] = anomalyProfMult = ANOM_PROF / 100
    // multipliers[4] = critZone = 1 + CRIT_ * CRIT_DMG_
    // multipliers[5] = dmgBonus = 1 + DMG_

    console.log('=== multipliers 验证 ===');
    console.log(`multipliers[0] (finalAtk): ${result.multipliers[0]}`);
    console.log(`multipliers[2] (anomalyProfMult): ${result.multipliers[2]} (期望 ${ANOM_PROF / 100})`);
    console.log(`multipliers[4] (critZone): ${result.multipliers[4]} (期望 ${1 + CRIT_ * CRIT_DMG_})`);
    console.log(`multipliers[5] (dmgBonus): ${result.multipliers[5]} (期望 ${1 + DMG_})`);

    expect(result.multipliers[0]).toBeCloseTo(ATK_BASE, 1); // finalAtk
    expect(result.multipliers[2]).toBeCloseTo(ANOM_PROF / 100, 4); // anomalyProfMult
    expect(result.multipliers[4]).toBeCloseTo(1 + CRIT_ * CRIT_DMG_, 4); // critZone
    expect(result.multipliers[5]).toBeCloseTo(1 + DMG_, 4); // dmgBonus
  });
});
