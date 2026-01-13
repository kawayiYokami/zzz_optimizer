import { describe, it, expect } from 'vitest';
import { DamageCalculatorService } from '../damage-calculator.service';
import { ZoneCollection } from '../../model/zone-collection';
import { PropertyType, ElementType } from '../../model/base';
import { EnemyStats } from '../../model/enemy';
import { RatioSet } from '../../model/ratio-set';

describe('DamageCalculatorService', () => {
  // 失衡易伤区测试
  describe('calculateStunVulnerabilityMultiplier', () => {
    it('失衡时应返回 1 + 敌人倍率 + buff加成', () => {
      const zones = new ZoneCollection();
      zones.final.set(PropertyType.DAZE_RED_, 0.1);
      const enemy = new EnemyStats(10000, 800, 60, 1000, true, 0.5, true, {}, {});
      const result = DamageCalculatorService.calculateStunVulnerabilityMultiplier(enemy, zones);
      expect(result).toBeCloseTo(1.6, 5); // 1 + 0.5 + 0.1
    });

    it('未失衡时应返回 1 + buff加成', () => {
      const zones = new ZoneCollection();
      zones.final.set(PropertyType.DAZE_RED_, 0.2);
      const enemy = new EnemyStats(10000, 800, 60, 1000, true, 0.5, false, {}, {});
      const result = DamageCalculatorService.calculateStunVulnerabilityMultiplier(enemy, zones);
      expect(result).toBeCloseTo(1.2, 5); // 1 + 0.2
    });

    it('失衡时应限制在 [0.2, 5] 范围内', () => {
      const zones = new ZoneCollection();
      zones.final.set(PropertyType.DAZE_RED_, 10); // 极端值
      const enemy = new EnemyStats(10000, 800, 60, 1000, true, 0.5, true, {}, {});
      expect(DamageCalculatorService.calculateStunVulnerabilityMultiplier(enemy, zones)).toBe(5);

      zones.final.set(PropertyType.DAZE_RED_, -10); // 负极端值
      expect(DamageCalculatorService.calculateStunVulnerabilityMultiplier(enemy, zones)).toBe(0.2);
    });

    it('未失衡时应限制在 [1, 3] 范围内', () => {
      const zones = new ZoneCollection();
      zones.final.set(PropertyType.DAZE_RED_, 10);
      const enemy = new EnemyStats(10000, 800, 60, 1000, true, 0.5, false, {}, {});
      expect(DamageCalculatorService.calculateStunVulnerabilityMultiplier(enemy, zones)).toBe(3);

      zones.final.set(PropertyType.DAZE_RED_, -10);
      expect(DamageCalculatorService.calculateStunVulnerabilityMultiplier(enemy, zones)).toBe(1);
    });
  });

  // 距离衰减区测试
  describe('calculateDistanceDecayMultiplier', () => {
    it('15m内应返回1.0', () => {
      expect(DamageCalculatorService.calculateDistanceDecayMultiplier({ distance: 0 } as any)).toBe(1.0);
      expect(DamageCalculatorService.calculateDistanceDecayMultiplier({ distance: 15 } as any)).toBe(1.0);
    });

    it('默认型超过15m应衰减25%', () => {
      expect(DamageCalculatorService.calculateDistanceDecayMultiplier({ distance: 16 } as any)).toBeCloseTo(0.75, 5);
      expect(DamageCalculatorService.calculateDistanceDecayMultiplier({ distance: 21 } as any)).toBeCloseTo(0.5625, 5);
    });

    it('格莉丝型超过15m应衰减30%', () => {
      expect(DamageCalculatorService.calculateDistanceDecayMultiplier({ distance: 20 } as any, 'grace')).toBe(0.7);
    });
  });

  // 增伤区测试
  describe('calculateDmgBonusFromZones', () => {
    it('应限制在 [0, 6] 范围内', () => {
      const zones = new ZoneCollection();
      const ratios = new RatioSet();
      ratios.element = ElementType.PHYSICAL;

      zones.final.set(PropertyType.DMG_, 10);
      expect(DamageCalculatorService.calculateDmgBonusFromZones(zones, ratios)).toBe(6);

      zones.final.set(PropertyType.DMG_, -10);
      expect(DamageCalculatorService.calculateDmgBonusFromZones(zones, ratios)).toBe(0);
    });
  });

  // 紊乱伤害倍率测试
  describe('getDisorderDamageRatio', () => {
    it('火元素应正确计算', () => {
      expect(DamageCalculatorService.getDisorderDamageRatio('fire', 0)).toBe(4.5);
      expect(DamageCalculatorService.getDisorderDamageRatio('fire', 5)).toBe(9.5); // 4.5 + 10*0.5
    });

    it('雷元素应正确计算', () => {
      expect(DamageCalculatorService.getDisorderDamageRatio('electric', 0)).toBe(4.5);
      expect(DamageCalculatorService.getDisorderDamageRatio('electric', 5)).toBe(10.75); // 4.5 + 5*1.25
    });

    it('未知元素应返回基础值', () => {
      expect(DamageCalculatorService.getDisorderDamageRatio('unknown', 10)).toBe(4.5);
    });
  });

  // 异常持续伤害参数测试
  describe('getAnomalyDotParams', () => {
    it('火元素灼烧参数正确', () => {
      const params = DamageCalculatorService.getAnomalyDotParams('fire');
      expect(params.ratio).toBe(0.5);
      expect(params.interval).toBe(0.5);
      expect(params.totalRatio).toBe(10); // 0.5 * 20次
    });

    it('冰元素碎冰为一次性伤害', () => {
      const params = DamageCalculatorService.getAnomalyDotParams('ice');
      expect(params.interval).toBe(0);
      expect(params.totalRatio).toBe(5.0);
    });
  });
});