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
});