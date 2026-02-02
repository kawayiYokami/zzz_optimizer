/**
 * 快速评估器增量枚举测试
 *
 * 测试 4 组不同驱动盘组合，验证：
 * 1. 每组单独计算（全量模式）的结果
 * 2. 连续计算（增量模式）的结果
 * 3. 两者是否一致
 */

import { describe, it, expect } from 'vitest';
import { FastEvaluator } from './fast-evaluator';
import { PROP_IDX } from '../types/property-index';
import type { PrecomputedData, DiscData } from '../types/precomputed';
import { EnemyStats } from '../../model/enemy';

/**
 * 创建模拟的驱动盘数据
 */
function createMockDisc(
  id: string,
  setId: string,
  setIdx: number,
  isTargetSet: boolean,
  atkPercent: number,
  critRate: number
): DiscData {
  const stats = new Float64Array(PROP_IDX.TOTAL_PROPS);
  stats[PROP_IDX.ATK_] = atkPercent;
  stats[PROP_IDX.CRIT_] = critRate;
  return {
    id,
    stats,
    effectiveScore: 5,
    setId,
    setIdx,
    isTargetSet,
  };
}

/**
 * 创建模拟的预计算数据
 */
function createMockPrecomputed(): PrecomputedData {
  const mergedStats = new Float64Array(PROP_IDX.TOTAL_PROPS);
  mergedStats[PROP_IDX.ATK_BASE] = 1000;  // 基础攻击力
  mergedStats[PROP_IDX.ATK_] = 0.1;       // 10% 攻击加成
  mergedStats[PROP_IDX.CRIT_] = 0.05;     // 5% 暴击率
  mergedStats[PROP_IDX.CRIT_DMG_] = 0.5;  // 50% 暴击伤害

  const mergedBuff = new Float64Array(PROP_IDX.TOTAL_PROPS);
  mergedBuff[PROP_IDX.DMG_] = 0.2;        // 20% 增伤

  // 目标套装 ID
  const targetSetId = 'set_target';

  // 目标套装 2 件套效果：10% 攻击
  const targetSetTwoPiece = new Float64Array(PROP_IDX.TOTAL_PROPS);
  targetSetTwoPiece[PROP_IDX.ATK_] = 0.1;

  // 目标套装 4 件套 Buff：15% 增伤
  const targetSetFourPieceBuff = new Float64Array(PROP_IDX.TOTAL_PROPS);
  targetSetFourPieceBuff[PROP_IDX.DMG_] = 0.15;

  // 非目标套装 2 件套效果
  const otherSetTwoPiece: Record<string, Float64Array> = {
    'set_other': (() => {
      const arr = new Float64Array(PROP_IDX.TOTAL_PROPS);
      arr[PROP_IDX.CRIT_] = 0.08;  // 8% 暴击率
      return arr;
    })(),
  };

  // 4 组不同的驱动盘（每组 6 个）
  const discsBySlot: DiscData[][] = [];
  for (let slot = 0; slot < 6; slot++) {
    const slotDiscs: DiscData[] = [];

    // 每个槽位有 2 个不同的盘供选择
    // 盘 A：目标套装，5% ATK
    slotDiscs.push(createMockDisc(
      `disc_${slot}_A`,
      'set_target',
      0,
      true,
      0.05,
      0.02
    ));

    // 盘 B：其它套装，3% ATK + 5% CRIT
    slotDiscs.push(createMockDisc(
      `disc_${slot}_B`,
      'set_other',
      1,
      false,
      0.03,
      0.05
    ));

    discsBySlot.push(slotDiscs);
  }

  return {
    mergedStats,
    mergedBuff,
    conversionBuffs: [],
    discsBySlot,
    targetSetId,
    targetSetTwoPiece,
    targetSetFourPieceBuff,
    otherSetTwoPiece,
    fixedMultipliers: {
      distanceMult: 1,
      baseResRed: 0,
      baseDmgTakenInc: 0,
      stunVulnerability: 0,
      attackerLevel: 60,
      baseAnomalyCritRate: 0,
      baseAnomalyCritDmg: 0,
      baseAnomalyDmgBonus: 0,
      defenseParams: {
        levelBase: 700,
        enemyDef: 800,
        baseDefRed: 0,
        baseDefIgn: 0,
      },
    },
    skillsParams: [{
      ratio: 5.0,       // 500% 技能倍率
      element: 200,     // 物理
      anomalyBuildup: 0,
      tags: [1],        // normal
      isPenetration: false,
    }],
    agentLevel: 60,
    enemyStats: new EnemyStats(
      100000,
      800,
      60,
      1000,
      true,
      1,
      false,
      { physical: 0 },
      { physical: 720 },
      false
    ),
    specialAnomalyConfig: null,
    anomalyTotalRatioAtT: 0,
    disorderTotalRatioAtT: 0,
  };
}

function createMockPrecomputedMultiSkills(): PrecomputedData {
  const precomputed = createMockPrecomputed();

  // 追加技能类型增伤：normal +10%，chain +20%
  precomputed.mergedBuff[PROP_IDX.NORMAL_ATK_DMG_] = 0.1;
  precomputed.mergedBuff[PROP_IDX.CHAIN_ATK_DMG_] = 0.2;

  // 两个技能：normal(500%) + chain(200%)
  precomputed.skillsParams = [
    {
      ratio: 5.0,
      element: 200,
      anomalyBuildup: 0,
      tags: [1],
      isPenetration: false,
    },
    {
      ratio: 2.0,
      element: 200,
      anomalyBuildup: 0,
      tags: [3],
      isPenetration: false,
    },
  ];

  return precomputed;
}

describe('FastEvaluator 增量枚举测试', () => {

  it('应该对 4 组不同组合返回一致的伤害值', () => {
    const precomputed = createMockPrecomputed();
    const evaluator = new FastEvaluator(precomputed);

    // 定义 4 组不同的组合（用索引表示每个槽位选择哪个盘）
    // 组合 1：全选 A 盘（全目标套装）
    // 组合 2：slot5 选 B 盘
    // 组合 3：slot4, slot5 选 B 盘
    // 组合 4：slot3, slot4, slot5 选 B 盘
    const combinations = [
      [0, 0, 0, 0, 0, 0],  // 6 个目标套装（应该有效）
      [0, 0, 0, 0, 0, 1],  // 5 个目标套装 + 1 个其它（应该有效）
      [0, 0, 0, 0, 1, 1],  // 4 个目标套装 + 2 个其它（应该有效）
      [0, 0, 0, 1, 1, 1],  // 3 个目标套装 + 3 个其它（应该无效，<4 目标套）
    ];

    console.log('\n=== 测试 4 组不同驱动盘组合 ===\n');

    // 方法 A：每组单独计算（全量模式）
    const fullModeResults: (number | null)[] = [];
    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      const discs: DiscData[] = combo.map((idx, slot) =>
        precomputed.discsBySlot[slot][idx]
      );

      // 全量模式：begin + push all + calc
      evaluator.beginIncrementalSearch();
      for (const disc of discs) {
        evaluator.pushDiscIncremental(disc);
      }
      const result = evaluator.calculateDamageWithMultipliers(discs);
      fullModeResults.push(result?.damage ?? null);

      console.log(`组合 ${i + 1} [${combo.join(',')}]:`);
      console.log(`  全量模式 damage = ${result?.damage?.toFixed(2) ?? 'null (目标套装不足)'}`);
    }

    // 方法 B：连续增量计算
    // 从组合 1 开始，逐步变化到其他组合
    const incrementalResults: (number | null)[] = [];

    // 先计算组合 1
    evaluator.beginIncrementalSearch();
    let currentDiscs: DiscData[] = combinations[0].map((idx, slot) =>
      precomputed.discsBySlot[slot][idx]
    );
    for (const disc of currentDiscs) {
      evaluator.pushDiscIncremental(disc);
    }
    let result = evaluator.calculateDamageWithMultipliers(currentDiscs);
    incrementalResults.push(result?.damage ?? null);
    console.log(`\n增量模式 组合 1: damage = ${result?.damage?.toFixed(2) ?? 'null'}`);

    // 然后从组合 1 变化到组合 2、3、4
    for (let i = 1; i < combinations.length; i++) {
      const prevCombo = combinations[i - 1];
      const newCombo = combinations[i];
      const newDiscs: DiscData[] = newCombo.map((idx, slot) =>
        precomputed.discsBySlot[slot][idx]
      );

      // 找出需要变化的槽位，从后往前 pop 再从前往后 push
      for (let slot = 5; slot >= 0; slot--) {
        if (prevCombo[slot] !== newCombo[slot]) {
          const oldDisc = precomputed.discsBySlot[slot][prevCombo[slot]];
          evaluator.popDiscIncremental(oldDisc);
        }
      }
      for (let slot = 0; slot < 6; slot++) {
        if (prevCombo[slot] !== newCombo[slot]) {
          const newDisc = precomputed.discsBySlot[slot][newCombo[slot]];
          evaluator.pushDiscIncremental(newDisc);
        }
      }

      result = evaluator.calculateDamageWithMultipliers(newDiscs);
      incrementalResults.push(result?.damage ?? null);
      console.log(`增量模式 组合 ${i + 1}: damage = ${result?.damage?.toFixed(2) ?? 'null'}`);
    }

    // 比较两种方式的结果
    console.log('\n=== 结果对比 ===\n');
    for (let i = 0; i < combinations.length; i++) {
      const full = fullModeResults[i];
      const incr = incrementalResults[i];
      const match = full === incr || (full !== null && incr !== null && Math.abs(full - incr) < 0.01);
      console.log(`组合 ${i + 1}: 全量=${full?.toFixed(2) ?? 'null'}, 增量=${incr?.toFixed(2) ?? 'null'}, 匹配=${match ? '✓' : '✗'}`);
      expect(match).toBe(true);
    }
  });

  it('createFullResult 应该对多技能的 breakdown 做加总', () => {
    const precomputed = createMockPrecomputedMultiSkills();
    const evaluator = new FastEvaluator(precomputed);

    // 选择全 A（目标套装）组合
    const discs: DiscData[] = [];
    for (let slot = 0; slot < 6; slot++) {
      discs.push(precomputed.discsBySlot[slot][0]);
    }

    // 保证 evaluator 的累加器状态正确（createFullResult 会自己重置，但这里也走一遍完整路径）
    const res = evaluator.calculateDamageWithMultipliers(discs);
    expect(res).not.toBeNull();

    const full = evaluator.createFullResult(discs, res!.damage, res!.multipliers);

    // mock 数据下没有异常/紊乱/烈霜，damage 应等于 direct breakdown
    expect(Math.abs(full.breakdown.anomaly)).toBeLessThan(1e-9);
    expect(Math.abs(full.breakdown.disorder)).toBeLessThan(1e-9);
    expect(full.breakdown.lieshuang).toBeUndefined();
    expect(Math.abs(full.damage - full.breakdown.direct)).toBeLessThan(1e-6);

    // 手工期望值（只验证“加总口径正确”）
    // finalAtkAfterConv = 1000 * (1 + 0.1(merged) + 0.1(2pc) + 6*0.05(discs)) = 1500
    // critRate = 0.05 + 6*0.02 = 0.17, critDmg = 0.5 => critZone = 1.085
    // defMult = 700/(800+700) = 0.4666666667
    // dmgBonus:
    // - normal: 1 + (0.2+0.15) + 0.1 = 1.45
    // - chain:  1 + (0.2+0.15) + 0.2 = 1.55
    const finalAtkAfterConv = 1500;
    const critZone = 1 + 0.17 * 0.5;
    const defMult = 700 / (800 + 700);
    const dmgBonusNormal = 1 + 0.35 + 0.1;
    const dmgBonusChain = 1 + 0.35 + 0.2;
    const expected =
      finalAtkAfterConv * 5.0 * dmgBonusNormal * critZone * defMult +
      finalAtkAfterConv * 2.0 * dmgBonusChain * critZone * defMult;

    expect(Math.abs(full.damage - expected)).toBeLessThan(1e-6);
  });

  it('accumulator 在 pop 后应该正确恢复', () => {
    const precomputed = createMockPrecomputed();
    const evaluator = new FastEvaluator(precomputed);

    // 初始化
    evaluator.beginIncrementalSearch();
    const snapshotBefore = evaluator.getAccumulatorSnapshot();

    // push 一个盘
    const disc = precomputed.discsBySlot[0][0];
    evaluator.pushDiscIncremental(disc);
    const snapshotAfterPush = evaluator.getAccumulatorSnapshot();

    // 验证 push 后 ATK_ 增加了
    expect(snapshotAfterPush[PROP_IDX.ATK_]).toBeGreaterThan(snapshotBefore[PROP_IDX.ATK_]);

    // pop 这个盘
    evaluator.popDiscIncremental(disc);
    const snapshotAfterPop = evaluator.getAccumulatorSnapshot();

    // 验证 pop 后恢复到 push 之前
    console.log('\n=== accumulator 恢复测试 ===');
    console.log(`ATK_ before push: ${snapshotBefore[PROP_IDX.ATK_]}`);
    console.log(`ATK_ after push: ${snapshotAfterPush[PROP_IDX.ATK_]}`);
    console.log(`ATK_ after pop: ${snapshotAfterPop[PROP_IDX.ATK_]}`);

    expect(Math.abs(snapshotAfterPop[PROP_IDX.ATK_] - snapshotBefore[PROP_IDX.ATK_])).toBeLessThan(0.0001);
  });

  it('2pc 效果应该在 count 2->1 时正确撤销', () => {
    const precomputed = createMockPrecomputed();
    const evaluator = new FastEvaluator(precomputed);

    // 使用 "set_other" 套装的盘，测试 2pc 触发和撤销
    evaluator.beginIncrementalSearch();

    // 先 push 一个 set_other 盘（slot0 的 B 盘）
    const disc1 = precomputed.discsBySlot[0][1];  // set_other
    evaluator.pushDiscIncremental(disc1);
    const snapshotAfter1 = evaluator.getAccumulatorSnapshot();

    // 再 push 第二个 set_other 盘（slot1 的 B 盘）-> 触发 2pc
    const disc2 = precomputed.discsBySlot[1][1];  // set_other
    evaluator.pushDiscIncremental(disc2);
    const snapshotAfter2 = evaluator.getAccumulatorSnapshot();

    // 2pc 效果应该生效（CRIT_ 增加 0.08）
    const critDiff = snapshotAfter2[PROP_IDX.CRIT_] - snapshotAfter1[PROP_IDX.CRIT_];
    console.log('\n=== 2pc 触发/撤销测试 ===');
    console.log(`CRIT_ after 1 disc: ${snapshotAfter1[PROP_IDX.CRIT_]}`);
    console.log(`CRIT_ after 2 discs (2pc): ${snapshotAfter2[PROP_IDX.CRIT_]}`);
    console.log(`CRIT_ diff (should include disc2 + 2pc): ${critDiff.toFixed(4)}`);

    // disc2 的 CRIT_ = 0.05，2pc = 0.08，所以差应该是 0.13
    expect(Math.abs(critDiff - 0.13)).toBeLessThan(0.0001);

    // pop disc2 -> 撤销 2pc
    evaluator.popDiscIncremental(disc2);
    const snapshotAfterPop = evaluator.getAccumulatorSnapshot();
    console.log(`CRIT_ after pop disc2: ${snapshotAfterPop[PROP_IDX.CRIT_]}`);

    // 应该恢复到只有 disc1 的状态
    expect(Math.abs(snapshotAfterPop[PROP_IDX.CRIT_] - snapshotAfter1[PROP_IDX.CRIT_])).toBeLessThan(0.0001);
  });
});
