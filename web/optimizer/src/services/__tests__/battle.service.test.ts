import { describe, it, expect, beforeEach } from 'vitest';
import { BattleService } from '../battle.service';
import { Team } from '../../model/team';
import { Agent } from '../../model/agent';
import { Enemy } from '../../model/enemy';
import { Buff, BuffSource } from '../../model/buff';
import { PropertyType, ElementType, WeaponType, Rarity } from '../../model/base';
import { PropertyCollection } from '../../model/property-collection';

describe('BattleService 集成测试', () => {
  let battleService: BattleService;

  beforeEach(() => {
    battleService = new BattleService();
  });

  // 创建测试用角色（带基础属性）
  function createTestAgent(id: string, name: string, element: ElementType = ElementType.FIRE): Agent {
    const agent = new Agent(id, id, name, 60, Rarity.S, element, WeaponType.ATTACK);
    agent.skills.normal = 12;
    agent.skills.special = 12;

    // 设置基础属性，避免伤害计算返回0
    agent.self_properties = new PropertyCollection();
    agent.self_properties.out_of_combat.set(PropertyType.ATK_BASE, 800);
    agent.self_properties.out_of_combat.set(PropertyType.HP_BASE, 8000);
    agent.self_properties.out_of_combat.set(PropertyType.DEF_BASE, 600);
    agent.self_properties.out_of_combat.set(PropertyType.CRIT_, 0.05);
    agent.self_properties.out_of_combat.set(PropertyType.CRIT_DMG_, 0.5);

    return agent;
  }

  // 创建测试用敌人
  function createTestEnemy(): Enemy {
    return new Enemy('test_enemy', '测试敌人', 'Test', 100000, 1000, 800, 1000, true);
  }

  describe('calculateTotalDamage', () => {
    it('应正确计算直伤期望', async () => {
      const agent = createTestAgent('1011', '安比');
      const team = new Team([agent], 'test_team', '测试队伍');
      const enemy = createTestEnemy();

      await battleService.setTeam(team);
      battleService.setEnemy(enemy);

      const result = battleService.calculateTotalDamage(10.0, 50);

      expect(result.directDamage).toBeGreaterThan(0);
      expect(result.totalDamage).toBeGreaterThan(0);
      expect(result.triggerExpectation).toBeGreaterThan(0);
    });
  });

  describe('乘区刷新测试', () => {
    it('更换队伍后乘区应刷新', async () => {
      const agent1 = createTestAgent('1011', '安比', ElementType.ELECTRIC);
      const agent2 = createTestAgent('1021', '猫又', ElementType.PHYSICAL);
      // 为第二个角色设置不同的攻击力
      agent2.self_properties.out_of_combat.set(PropertyType.ATK_BASE, 1200);

      const team1 = new Team([agent1], 'team1', '队伍1');
      const team2 = new Team([agent2], 'team2', '队伍2');
      const enemy = createTestEnemy();

      await battleService.setTeam(team1);
      battleService.setEnemy(enemy);
      const result1 = battleService.calculateTotalDamage(10.0, 50);

      await battleService.setTeam(team2);
      const result2 = battleService.calculateTotalDamage(10.0, 50);

      // 不同角色应产生不同结果（属性不同）
      expect(result1.directDamage).not.toEqual(result2.directDamage);
    });

    it('添加Buff后乘区应刷新', async () => {
      const agent = createTestAgent('1011', '安比');
      const team = new Team([agent], 'test_team', '测试队伍');
      const enemy = createTestEnemy();

      await battleService.setTeam(team);
      battleService.setEnemy(enemy);

      const result1 = battleService.calculateTotalDamage(10.0, 50);

      // 添加伤害增加buff（局内属性）
      const buff = new Buff(
        BuffSource.TALENT,
        new Map([[PropertyType.DMG_, 0.5]]), // 使用DMG_增伤
        undefined,
        undefined,
        undefined,
        1,
        'linear',
        true,
        'test_buff',
        '测试Buff',
        '增加伤害'
      );
      battleService.addManualBuff(buff);

      const result2 = battleService.calculateTotalDamage(10.0, 50);

      // 添加buff后伤害应增加
      expect(result2.directDamage).toBeGreaterThan(result1.directDamage);
    });

    it('关闭Buff后乘区应刷新', async () => {
      const agent = createTestAgent('1011', '安比');
      const team = new Team([agent], 'test_team', '测试队伍');
      const enemy = createTestEnemy();

      await battleService.setTeam(team);
      battleService.setEnemy(enemy);

      // 添加伤害增加buff
      const buff = new Buff(
        BuffSource.TALENT,
        new Map([[PropertyType.DMG_, 0.5]]),
        undefined,
        undefined,
        undefined,
        1,
        'linear',
        true,
        'test_buff',
        '测试Buff',
        '增加伤害'
      );
      battleService.addManualBuff(buff);

      const result1 = battleService.calculateTotalDamage(10.0, 50);

      // 关闭buff
      battleService.updateBuffStatus('test_buff', false);

      const result2 = battleService.calculateTotalDamage(10.0, 50);

      // 关闭buff后伤害应减少
      expect(result2.directDamage).toBeLessThan(result1.directDamage);
    });
  });

  describe('异常触发期望计算', () => {
    it('应正确计算异常触发期望', async () => {
      const agent = createTestAgent('1011', '安比');
      const team = new Team([agent], 'test_team', '测试队伍');
      const enemy = createTestEnemy();

      await battleService.setTeam(team);
      battleService.setEnemy(enemy);

      const triggerExp = battleService.calculateAnomalyTriggerExpectation(100, 'fire');

      // 触发期望 = 异常积蓄 / 敌人异常条
      expect(triggerExp).toBeGreaterThan(0);
      expect(triggerExp).toBeLessThanOrEqual(1);
    });
  });
  describe('序列化测试', () => {
    it('toZod 和 loadFromZod 应能保存和恢复状态', async () => {
      const agent = createTestAgent('1011', '安比');
      const team = new Team([agent], 'test_team', '测试队伍');
      const enemy = createTestEnemy();

      await battleService.setTeam(team);
      battleService.setEnemy(enemy);

      // 添加一个手动Buff并激活
      const buff = new Buff(
        BuffSource.TALENT,
        new Map([[PropertyType.DMG_, 0.5]]),
        undefined,
        undefined,
        undefined,
        1,
        'linear',
        true,
        'test_buff_save',
        '测试保存Buff',
        '增加伤害'
      );
      battleService.addManualBuff(buff);

      // 添加一个状态并关闭
      const buff2 = new Buff(
        BuffSource.TALENT,
        new Map([[PropertyType.ATK_, 0.5]]),
        undefined,
        undefined,
        undefined,
        1,
        'linear',
        true,
        'test_buff_save_2',
        '测试保存Buff2',
        '增加攻击'
      );
      battleService.addManualBuff(buff2);
      battleService.updateBuffStatus('test_buff_save_2', false);

      // 设置目标技能
      battleService.setTargetSkills(['skill_1-0', 'skill_2-1']);

      // 序列化
      const zodData = battleService.toZod('battle_1', '测试战场');

      expect(zodData.id).toBe('battle_1');
      expect(zodData.teamId).toBe('test_team');
      expect(zodData.enemyId).toBe('test_enemy');
      expect(zodData.activeBuffs!['test_buff_save']).toBe(true);
      expect(zodData.activeBuffs!['test_buff_save_2']).toBe(false);
      expect(zodData.manualBuffs).toHaveLength(2);
      expect(zodData.targetSkills).toContain('skill_1-0');
      expect(zodData.targetSkills).toContain('skill_2-1');

      // 创建新服务并恢复
      const newService = new BattleService();
      // 这里需要重新创建team和enemy实例，模拟从store获取
      const newTeam = new Team([agent], 'test_team', '测试队伍');
      const newEnemy = createTestEnemy();

      await newService.loadFromZod(zodData, newTeam, newEnemy);

      expect(newService.getTeam()?.id).toBe('test_team');
      expect(newService.getEnemy()?.id).toBe('test_enemy');
      expect(newService.getBuffIsActive('test_buff_save')).toBe(true);
      expect(newService.getBuffIsActive('test_buff_save_2')).toBe(false);
      expect(newService.getTargetSkills()).toContain('skill_1-0');
      expect(newService.getTargetSkills()).toContain('skill_2-1');
      // 由于手动Buff恢复逻辑目前是简化的（或者是空的，视实现而定），这里检查是否至少没有报错
      // 如果battle.service.ts中的restoreManualBuffs有逻辑，可以进一步检查
    });
  });
});