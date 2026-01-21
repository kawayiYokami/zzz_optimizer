/**
 * Enemy 异常条阈值缓存测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Enemy } from '../src/model/enemy';
import type { EnemyInfo } from '../src/services/data-loader.service';

// Mock dataLoaderService
vi.mock('../src/services/data-loader.service', () => ({
  dataLoaderService: {
    anomalyBarsData: null,
  },
}));

describe('Enemy 异常条阈值缓存', () => {
  let enemy: Enemy;
  let mockEnemyInfo: EnemyInfo;

  beforeEach(() => {
    // 创建模拟的敌人数据
    mockEnemyInfo = {
      id: 'test_enemy_001',
      code_name: 'TEST_ENEMY',
      CHS: '测试敌人',
      EN: 'Test Enemy',
      hp: 10000,
      atk: 500,
      defense: 300,
      stun_max: 1000,
      can_stun: true,
      stun_vulnerability_multiplier: 0.5,
      ice_dmg_resistance: 0,
      fire_dmg_resistance: 0,
      electric_dmg_resistance: 0,
      physical_dmg_resistance: 0,
      ether_dmg_resistance: 0,
      ice_anomaly_resistance: 0,
      fire_anomaly_resistance: 0,
      electric_anomaly_resistance: 0,
      physical_anomaly_resistance: 0,
      ether_anomaly_resistance: 0,
      ice_stun_resistance: 0,
      fire_stun_resistance: 0,
      electric_stun_resistance: 0,
      physical_stun_resistance: 0,
      ether_stun_resistance: 0,
      ice_anomaly_bar: '10001',
      fire_anomaly_bar: '10002',
      electric_anomaly_bar: '10003',
      physical_anomaly_bar: '10004',
      ether_anomaly_bar: '10005',
      crit_dmg: 0,
      chain_attack_count: 0,
      base_poise_level: 0,
      freeze_time_resistance: 0,
      base_buildup_coefficient: 0,
    };

    enemy = Enemy.fromGameData(mockEnemyInfo);
  });

  describe('默认值常量', () => {
    it('应该定义物理异常条默认值为 720', () => {
      // 通过私有属性访问器测试默认值
      const stats = enemy.getCombatStats();
      expect(stats.anomaly_thresholds.physical).toBe(720);
    });

    it('应该定义元素异常条默认值为 600', () => {
      const stats = enemy.getCombatStats();
      expect(stats.anomaly_thresholds.ice).toBe(600);
      expect(stats.anomaly_thresholds.fire).toBe(600);
      expect(stats.anomaly_thresholds.electric).toBe(600);
      expect(stats.anomaly_thresholds.ether).toBe(600);
    });
  });

  describe('缓存机制', () => {
    it('第一次调用 getCombatStats 应该初始化缓存', () => {
      const dataLoaderService = require('../src/services/data-loader.service').dataLoaderService;

      // 设置模拟的异常条数据
      dataLoaderService.anomalyBarsData = new Map([
        ['10001', { id: '10001', element: 'ice', buildup_requirements: [500] }],
        ['10002', { id: '10002', element: 'fire', buildup_requirements: [550] }],
        ['10003', { id: '10003', element: 'electric', buildup_requirements: [600] }],
        ['10004', { id: '10004', element: 'physical', buildup_requirements: [700] }],
        ['10005', { id: '10005', element: 'ether', buildup_requirements: [650] }],
      ]);

      const stats1 = enemy.getCombatStats();
      expect(stats1.anomaly_thresholds.ice).toBe(500);
      expect(stats1.anomaly_thresholds.fire).toBe(550);
      expect(stats1.anomaly_thresholds.electric).toBe(600);
      expect(stats1.anomaly_thresholds.physical).toBe(700);
      expect(stats1.anomaly_thresholds.ether).toBe(650);
    });

    it('第二次调用 getCombatStats 应该使用缓存', () => {
      const dataLoaderService = require('../src/services/data-loader.service').dataLoaderService;

      // 设置模拟的异常条数据
      dataLoaderService.anomalyBarsData = new Map([
        ['10001', { id: '10001', element: 'ice', buildup_requirements: [500] }],
        ['10002', { id: '10002', element: 'fire', buildup_requirements: [550] }],
        ['10003', { id: '10003', element: 'electric', buildup_requirements: [600] }],
        ['10004', { id: '10004', element: 'physical', buildup_requirements: [700] }],
        ['10005', { id: '10005', element: 'ether', buildup_requirements: [650] }],
      ]);

      const stats1 = enemy.getCombatStats();

      // 修改数据源，验证是否使用缓存
      dataLoaderService.anomalyBarsData.set('10001', { id: '10001', element: 'ice', buildup_requirements: [999] });

      const stats2 = enemy.getCombatStats();

      // 应该仍然返回缓存的值，而不是修改后的值
      expect(stats2.anomaly_thresholds.ice).toBe(500);
      expect(stats1).toBe(stats2);
    });

    it('没有异常条ID时应该使用默认值', () => {
      const enemyNoBar = new Enemy('test_002', 'Test Enemy', 'TEST', 10000, 500, 300, 1000, true);

      const stats = enemyNoBar.getCombatStats();
      expect(stats.anomaly_thresholds.physical).toBe(720);
      expect(stats.anomaly_thresholds.ice).toBe(600);
      expect(stats.anomaly_thresholds.fire).toBe(600);
      expect(stats.anomaly_thresholds.electric).toBe(600);
      expect(stats.anomaly_thresholds.ether).toBe(600);
    });

    it('异常条数据未加载时应该使用默认值', () => {
      const dataLoaderService = require('../src/services/data-loader.service').dataLoaderService;
      dataLoaderService.anomalyBarsData = null;

      const stats = enemy.getCombatStats();
      expect(stats.anomaly_thresholds.physical).toBe(720);
      expect(stats.anomaly_thresholds.ice).toBe(600);
      expect(stats.anomaly_thresholds.fire).toBe(600);
      expect(stats.anomaly_thresholds.electric).toBe(600);
      expect(stats.anomaly_thresholds.ether).toBe(600);
    });

    it('异常条数据不存在时应该使用默认值', () => {
      const dataLoaderService = require('../src/services/data-loader.service').dataLoaderService;
      dataLoaderService.anomalyBarsData = new Map();

      const stats = enemy.getCombatStats();
      expect(stats.anomaly_thresholds.physical).toBe(720);
      expect(stats.anomaly_thresholds.ice).toBe(600);
      expect(stats.anomaly_thresholds.fire).toBe(600);
      expect(stats.anomaly_thresholds.electric).toBe(600);
      expect(stats.anomaly_thresholds.ether).toBe(600);
    });

    it('异常条数据 build_requirements 为空时应该使用默认值', () => {
      const dataLoaderService = require('../src/services/data-loader.service').dataLoaderService;
      dataLoaderService.anomalyBarsData = new Map([
        ['10001', { id: '10001', element: 'ice', buildup_requirements: [] }],
        ['10002', { id: '10002', element: 'fire', buildup_requirements: null }],
      ]);

      const stats = enemy.getCombatStats();
      expect(stats.anomaly_thresholds.ice).toBe(600);
      expect(stats.anomaly_thresholds.fire).toBe(600);
    });
  });

  describe('性能优化', () => {
    it('多次调用 getCombatStats 应该只查询一次数据', () => {
      const dataLoaderService = require('../src/services/data-loader.service').dataLoaderService;

      // 设置模拟的异常条数据
      dataLoaderService.anomalyBarsData = new Map([
        ['10001', { id: '10001', element: 'ice', buildup_requirements: [500] }],
        ['10002', { id: '10002', element: 'fire', buildup_requirements: [550] }],
        ['10003', { id: '10003', element: 'electric', buildup_requirements: [600] }],
        ['10004', { id: '10004', element: 'physical', buildup_requirements: [700] }],
        ['10005', { id: '10005', element: 'ether', buildup_requirements: [650] }],
      ]);

      // 监听 Map.get 调用次数
      const getSpy = vi.spyOn(dataLoaderService.anomalyBarsData, 'get');

      // 第一次调用 - 应该查询数据
      enemy.getCombatStats();
      expect(getSpy).toHaveBeenCalledTimes(5);

      // 第二次调用 - 应该使用缓存，不再查询
      enemy.getCombatStats();
      expect(getSpy).toHaveBeenCalledTimes(5); // 没有增加

      // 第三次调用 - 应该使用缓存，不再查询
      enemy.getCombatStats();
      expect(getSpy).toHaveBeenCalledTimes(5); // 仍然没有增加
    });
  });

  describe('序列化兼容性', () => {
    it('fromGameData 创建的实例应该可以正常使用', () => {
      const enemy2 = Enemy.fromGameData(mockEnemyInfo);
      const stats = enemy2.getCombatStats();

      expect(stats.anomaly_thresholds).toBeDefined();
      expect(typeof stats.anomaly_thresholds.ice).toBe('number');
      expect(typeof stats.anomaly_thresholds.fire).toBe('number');
      expect(typeof stats.anomaly_thresholds.electric).toBe('number');
      expect(typeof stats.anomaly_thresholds.physical).toBe('number');
      expect(typeof stats.anomaly_thresholds.ether).toBe('number');
    });
  });
});