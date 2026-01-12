import { Agent } from './src/model/agent';
import { WEngine } from './src/model/wengine';
import { DriveDisk, DriveDiskPosition } from './src/model/drive-disk';
import { Rarity, PropertyType } from './src/model/base';
import { PropertyCollection } from './src/model/property-collection';

// 模拟数据加载服务
const mockDataLoader = {
  characterData: new Map([
    ['101', { code: '101', EN: 'Test Character', CHS: '测试角色', rank: Rarity.S, element: 'physical', type: 'attack' }]
  ]),
  weaponData: new Map([
    ['201', { EN: 'Test Weapon', CHS: '测试音擎' }]
  ]),
  equipmentData: new Map([
    ['301', { EN: { name: 'Test Set' }, CHS: { name: '测试套装' } }]
  ]),
  getCharacterDetail: async () => ({
    Stats: {
      HpMax: 1000,
      HpGrowth: 100,
      Attack: 100,
      AttackGrowth: 10,
      Defence: 50,
      DefenceGrowth: 5,
      BreakStun: 10,
      Crit: 500,
      CritDamage: 1500,
      ElementAbnormalPower: 50,
      ElementMystery: 50,
      SpRecover: 100
    }
  }),
  getWeaponDetail: async () => ({
    BaseProperty: { Value: 100 },
    RandProperty: { Name: '攻击力%', Format: '%', Value: 10 }
  }),
  getEquipmentBuff: async () => ({
    two_piece_buffs: [],
    four_piece_buffs: []
  }),
  getWeaponBuff: async () => ({ talents: [] })
} as any;

// 测试脚本
async function testAgentEquipment() {
  console.log('=== 开始测试 Agent 装备属性获取 ===\n');

  // 1. 创建测试音擎实例
  const wengine1 = new WEngine('w1', '201', '测试音擎1');
  wengine1.level = 50;
  wengine1.breakthrough = 3;
  wengine1.refinement = 1;
  
  // 模拟音擎基础属性
  wengine1.base_atk = 100;
  wengine1.rand_stat_type = PropertyType.ATK_;
  wengine1.rand_stat = 0.1;
  wengine1.base_stats = new PropertyCollection(
    new Map([
      [PropertyType.ATK_BASE, 500],
      [PropertyType.ATK_, 0.1]
    ]),
    new Map()
  );

  // 2. 创建测试驱动盘实例
  const disk1 = new DriveDisk('d1', '301', DriveDiskPosition.SLOT_1, Rarity.S, 15, PropertyType.ATK_, { value: 0, isPercent: true });
  disk1.set_name = '测试套装';
  disk1.sub_stats = new Map([
    [PropertyType.CRIT_, { value: 5, isPercent: true }]
  ]);
  
  const disk2 = new DriveDisk('d2', '301', DriveDiskPosition.SLOT_2, Rarity.S, 15, PropertyType.HP_, { value: 0, isPercent: true });
  disk2.set_name = '测试套装';
  disk2.sub_stats = new Map([
    [PropertyType.CRIT_DMG_, { value: 10, isPercent: true }]
  ]);
  
  const disk3 = new DriveDisk('d3', '301', DriveDiskPosition.SLOT_3, Rarity.S, 15, PropertyType.DEF_, { value: 0, isPercent: true });
  disk3.set_name = '其他套装';
  disk3.sub_stats = new Map([
    [PropertyType.ATK, { value: 50, isPercent: false }]
  ]);

  // 3. 创建测试角色实例
  const agent1 = new Agent('a1', '101', '测试角色1', 50, Rarity.S);
  agent1.equipped_wengine = 'w1';
  agent1.equipped_drive_disks = ['d1', 'd2', 'd3', null, null, null];
  
  // 注入模拟数据
  agent1['_dataLoader'] = mockDataLoader;
  agent1['_charDetail'] = await mockDataLoader.getCharacterDetail();
  agent1['_zodData'] = { level: 50, promotion: 3, mindscape: 0 };
  agent1['_gameCharId'] = '101';

  // 4. 创建装备集合
  const wengines = new Map<string, WEngine>([['w1', wengine1]]);
  const driveDisks = new Map<string, DriveDisk>([['d1', disk1], ['d2', disk2], ['d3', disk3]]);

  // 5. 设置装备集合引用
  agent1.setEquipmentReferences(wengines, driveDisks);

  // 6. 测试 getBareStats() - 裸属性
  console.log('1. 测试 getBareStats() - 裸属性:');
  const bareStats = agent1.getBareStats();
  console.log('   裸属性 HP:', bareStats.out_of_combat.get(PropertyType.HP_BASE));
  console.log('   裸属性 ATK:', bareStats.out_of_combat.get(PropertyType.ATK_BASE));
  console.log('   裸属性 暴击率:', bareStats.out_of_combat.get(PropertyType.CRIT_));
  console.log('');

  // 7. 测试 getSelfProperties() - 包含装备属性
  console.log('2. 测试 getSelfProperties() - 包含装备属性:');
  const selfProps = agent1.getSelfProperties();
  console.log('   包含装备的 HP:', selfProps.out_of_combat.get(PropertyType.HP_BASE));
  console.log('   包含装备的 ATK:', selfProps.out_of_combat.get(PropertyType.ATK_BASE));
  console.log('   包含装备的 攻击力%:', selfProps.out_of_combat.get(PropertyType.ATK_));
  console.log('   包含装备的 暴击率:', selfProps.out_of_combat.get(PropertyType.CRIT_));
  console.log('   包含装备的 暴击伤害:', selfProps.out_of_combat.get(PropertyType.CRIT_DMG_));
  console.log('');

  // 8. 测试不同装备配置
  console.log('3. 测试移除装备后的属性:');
  agent1.equipped_wengine = null;
  agent1.equipped_drive_disks = [null, null, null, null, null, null];
  const selfPropsWithoutEquipment = agent1.getSelfProperties();
  console.log('   移除装备后的 ATK:', selfPropsWithoutEquipment.out_of_combat.get(PropertyType.ATK_BASE));
  console.log('   移除装备后的 攻击力%:', selfPropsWithoutEquipment.out_of_combat.get(PropertyType.ATK_));
  console.log('');

  console.log('=== 测试完成 ===');
}

// 运行测试
testAgentEquipment().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
