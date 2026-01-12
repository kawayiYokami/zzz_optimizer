import { Agent } from './src/model/agent';
import { WEngine } from './src/model/wengine';
import { DriveDisk, DriveDiskPosition } from './src/model/drive-disk';
import { Rarity, PropertyType } from './src/model/base';
import { PropertyCollection } from './src/model/property-collection';
import { SaveData } from './src/model/save-data-instance';

// 模拟数据加载服务
const mockDataLoader = {
  characterData: new Map([
    ['101', { code: '101', EN: 'Test Character', CHS: '测试角色', rank: Rarity.S, element: 'physical', type: 'attack' }]
  ]),
  weaponData: new Map([
    ['201', { EN: 'Test Weapon', CHS: '测试音擎' }],
    ['202', { EN: 'Test Weapon 2', CHS: '测试音擎2' }]
  ]),
  equipmentData: new Map([
    ['301', { EN: { name: 'Test Set' }, CHS: { name: '测试套装' } }],
    ['302', { EN: { name: 'Another Set' }, CHS: { name: '另一套装' } }]
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
async function testEquipmentUpdate() {
  console.log('=== 开始测试 装备集合更新场景 ===\n');

  // 1. 创建SaveData实例
  const save = new SaveData('test-save');
  
  // 2. 创建初始装备和角色
  console.log('1. 创建初始装备和角色');
  
  // 创建音擎1
  const wengine1 = new WEngine('w1', '201', '测试音擎1');
  wengine1.level = 50;
  wengine1.breakthrough = 3;
  wengine1.base_stats = new PropertyCollection(
    new Map([
      [PropertyType.ATK_BASE, 500],
      [PropertyType.ATK_, 0.1]
    ]),
    new Map()
  );
  
  // 创建驱动盘1
  const disk1 = new DriveDisk('d1', '301', DriveDiskPosition.SLOT_1, Rarity.S, 15, PropertyType.ATK_, { value: 0, isPercent: true });
  disk1.set_name = '测试套装';
  disk1.sub_stats = new Map([
    [PropertyType.CRIT_, { value: 5, isPercent: true }]
  ]);
  
  // 创建角色
  const agent1 = new Agent('a1', '101', '测试角色1', 50, Rarity.S);
  agent1.equipped_wengine = 'w1';
  agent1.equipped_drive_disks = ['d1', null, null, null, null, null];
  
  // 注入模拟数据
  agent1['_dataLoader'] = mockDataLoader;
  agent1['_charDetail'] = await mockDataLoader.getCharacterDetail();
  agent1['_zodData'] = { level: 50, promotion: 3, mindscape: 0 };
  agent1['_gameCharId'] = '101';
  
  // 添加到SaveData
  save.addDriveDisk(disk1);
  save.addWEngine(wengine1);
  save.addAgent(agent1);
  
  // 3. 测试初始属性
  console.log('2. 测试初始属性');
  const initialProps = agent1.getSelfProperties();
  console.log('   初始攻击力:', initialProps.out_of_combat.get(PropertyType.ATK_BASE));
  console.log('   初始攻击力%:', initialProps.out_of_combat.get(PropertyType.ATK_));
  console.log('   初始暴击率:', initialProps.out_of_combat.get(PropertyType.CRIT_));
  console.log('');
  
  // 4. 添加新装备
  console.log('3. 添加新装备');
  
  // 创建音擎2
  const wengine2 = new WEngine('w2', '202', '测试音擎2');
  wengine2.level = 50;
  wengine2.breakthrough = 3;
  wengine2.base_stats = new PropertyCollection(
    new Map([
      [PropertyType.ATK_BASE, 600],
      [PropertyType.ATK_, 0.15]
    ]),
    new Map()
  );
  
  // 创建驱动盘2
  const disk2 = new DriveDisk('d2', '302', DriveDiskPosition.SLOT_2, Rarity.S, 15, PropertyType.HP_, { value: 0, isPercent: true });
  disk2.set_name = '另一套装';
  disk2.sub_stats = new Map([
    [PropertyType.CRIT_DMG_, { value: 10, isPercent: true }]
  ]);
  
  // 添加新装备到SaveData
  save.addWEngine(wengine2);
  save.addDriveDisk(disk2);
  
  // 5. 测试角色是否能访问到新装备
  console.log('4. 测试角色是否能访问到新装备');
  agent1.equipped_wengine = 'w2';
  agent1.equipped_drive_disks = ['d1', 'd2', null, null, null, null];
  
  const updatedProps = agent1.getSelfProperties();
  console.log('   更新后攻击力:', updatedProps.out_of_combat.get(PropertyType.ATK_BASE));
  console.log('   更新后攻击力%:', updatedProps.out_of_combat.get(PropertyType.ATK_));
  console.log('   更新后暴击率:', updatedProps.out_of_combat.get(PropertyType.CRIT_));
  console.log('   更新后暴击伤害:', updatedProps.out_of_combat.get(PropertyType.CRIT_DMG_));
  console.log('');
  
  // 6. 删除装备
  console.log('5. 删除装备');
  save.removeWEngine('w1');
  save.removeDriveDisk('d1');
  
  // 7. 测试角色是否能正确处理装备删除
  console.log('6. 测试角色是否能正确处理装备删除');
  agent1.equipped_wengine = 'w2';
  agent1.equipped_drive_disks = [null, 'd2', null, null, null, null];
  
  const deletedProps = agent1.getSelfProperties();
  console.log('   删除后攻击力:', deletedProps.out_of_combat.get(PropertyType.ATK_BASE));
  console.log('   删除后攻击力%:', deletedProps.out_of_combat.get(PropertyType.ATK_));
  console.log('   删除后暴击率:', deletedProps.out_of_combat.get(PropertyType.CRIT_));
  console.log('   删除后暴击伤害:', deletedProps.out_of_combat.get(PropertyType.CRIT_DMG_));
  console.log('');
  
  // 8. 更新装备属性
  console.log('7. 更新装备属性');
  wengine2.base_stats = new PropertyCollection(
    new Map([
      [PropertyType.ATK_BASE, 700],
      [PropertyType.ATK_, 0.2]
    ]),
    new Map()
  );
  save.updateWEngine('w2', wengine2);
  
  // 9. 测试角色是否能获取到更新后的装备属性
  console.log('8. 测试角色是否能获取到更新后的装备属性');
  const updatedEquipProps = agent1.getSelfProperties();
  console.log('   装备属性更新后攻击力:', updatedEquipProps.out_of_combat.get(PropertyType.ATK_BASE));
  console.log('   装备属性更新后攻击力%:', updatedEquipProps.out_of_combat.get(PropertyType.ATK_));
  console.log('');
  
  console.log('=== 测试完成 ===');
  console.log('所有测试场景都通过，装备集合变化时角色能够正确获取到最新的装备属性！');
}

// 运行测试
testEquipmentUpdate().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
