import { describe, it, expect } from 'vitest';
import { DriveDisk } from '../src/model/drive-disk';
import { PropertyType, StatValue } from '../src/model/base';

describe('DriveDisk.getEffectiveStatCounts', () => {
  it('应该正确计算物理伤害主词条的分数（10分）', () => {
    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.PHYSICAL_DMG_,
      new StatValue(0.30, true),
      new Map()
    );
    const effectiveStats = [PropertyType.PHYSICAL_DMG_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(10);
  });

  it('应该正确计算暴击率主词条的分数（10分）', () => {
    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.CRIT_,
      new StatValue(0.24, true),
      new Map()
    );
    const effectiveStats = [PropertyType.CRIT_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(10);
  });

  it('应该正确计算攻击%主词条的分数（10分）', () => {
    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ATK_,
      new StatValue(0.30, true),
      new Map()
    );
    const effectiveStats = [PropertyType.ATK_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(10);
  });

  it('应该正确计算副词条的分数（每条1分）', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.CRIT_, new StatValue(2, false)); // 2条暴击率
    subStats.set(PropertyType.CRIT_DMG_, new StatValue(3, false)); // 3条暴击伤害

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ATK_,
      new StatValue(0.30, true),
      subStats
    );
    const effectiveStats = [PropertyType.CRIT_, PropertyType.CRIT_DMG_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(5); // 2 + 3
  });

  it('应该正确计算固定值副词条的分数（每3条1分）', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.ATK, new StatValue(6, false)); // 6条攻击力（固定值）
    subStats.set(PropertyType.HP, new StatValue(3, false)); // 3条生命值（固定值）

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ATK_,
      new StatValue(0.30, true),
      subStats
    );
    const effectiveStats = [PropertyType.ATK_, PropertyType.HP_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(13); // 主词条10 + 6/3 + 3/3 = 10 + 2 + 1
  });

  it('应该忽略不在有效词条列表中的属性', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.CRIT_, new StatValue(5, false)); // 5条暴击率
    subStats.set(PropertyType.DEF_, new StatValue(3, false)); // 3条防御%（不在有效词条中）

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ATK_,
      new StatValue(0.30, true),
      subStats
    );
    const effectiveStats = [PropertyType.CRIT_]; // 只关心暴击率

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(5); // 只有暴击率被计算
  });

  it('应该同时计算主词条和副词条', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.CRIT_, new StatValue(2, false)); // 2条暴击率

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.CRIT_,
      new StatValue(0.24, true),
      subStats
    );
    const effectiveStats = [PropertyType.CRIT_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(12); // 主词条10 + 副词条2
  });

  it('应该支持多个有效词条', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.CRIT_, new StatValue(3, false));
    subStats.set(PropertyType.CRIT_DMG_, new StatValue(4, false));
    subStats.set(PropertyType.ATK_, new StatValue(2, false));

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.PHYSICAL_DMG_,
      new StatValue(0.30, true),
      subStats
    );
    const effectiveStats = [
      PropertyType.PHYSICAL_DMG_,
      PropertyType.CRIT_,
      PropertyType.CRIT_DMG_,
      PropertyType.ATK_
    ];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(19); // 主词条10 + 3 + 4 + 2
  });

  it('应该正确处理元素伤害主词条', () => {
    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.FIRE_DMG_,
      new StatValue(0.30, true),
      new Map()
    );
    const effectiveStats = [PropertyType.FIRE_DMG_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(10);
  });

  it('应该正确处理冰元素伤害主词条', () => {
    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ICE_DMG_,
      new StatValue(0.30, true),
      new Map()
    );
    const effectiveStats = [PropertyType.ICE_DMG_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(10);
  });

  it('应该正确处理雷元素伤害主词条', () => {
    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ELECTRIC_DMG_,
      new StatValue(0.30, true),
      new Map()
    );
    const effectiveStats = [PropertyType.ELECTRIC_DMG_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(10);
  });

  it('应该正确处理以太元素伤害主词条', () => {
    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ETHER_DMG_,
      new StatValue(0.30, true),
      new Map()
    );
    const effectiveStats = [PropertyType.ETHER_DMG_];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(10);
  });

  it('当主词条不在有效词条列表中时应该返回0', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.CRIT_, new StatValue(5, false));

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ATK_,
      new StatValue(0.30, true),
      subStats
    );
    const effectiveStats = [PropertyType.PHYSICAL_DMG_]; // 主词条不是物理伤害

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(0); // 主词条和副词条都不是物理伤害
  });

  it('应该正确处理空有效词条列表', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.CRIT_, new StatValue(5, false));

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ATK_,
      new StatValue(0.30, true),
      subStats
    );
    const effectiveStats: PropertyType[] = [];

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(0);
  });

  it('应该正确支持固定值到百分比的映射', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.ATK, new StatValue(6, false)); // 6条攻击力（固定值）

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.ATK_,
      new StatValue(0.30, true),
      subStats
    );
    const effectiveStats = [PropertyType.ATK_]; // 查询攻击%时应该匹配攻击力（固定值）

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(12); // 主词条10 + 固定值6/3=2
  });

  it('应该正确支持穿透值到穿透率的映射', () => {
    const subStats = new Map<PropertyType, StatValue>();
    subStats.set(PropertyType.PEN, new StatValue(9, false)); // 9条穿透值（固定值）

    const disk = new DriveDisk(
      '1', '1', 1, 4, 1,
      PropertyType.PEN_,
      new StatValue(0.24, true),
      subStats
    );
    const effectiveStats = [PropertyType.PEN_]; // 查询穿透率时应该匹配穿透值

    const score = disk.getEffectiveStatCounts(effectiveStats);

    expect(score).toBe(13); // 主词条10 + 固定值9/3=3
  });
});