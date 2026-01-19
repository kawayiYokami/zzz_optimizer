import { DriveDisk } from '../src/model/drive-disk';
import { PropertyType, StatValue } from '../src/model/base';

// 测试火元素主词条
const disk = new DriveDisk(
  '1', '1', 1, 4, 1,
  PropertyType.FIRE_DMG_,
  new StatValue(0.30, true),
  new Map()
);

const effectiveStats = [PropertyType.FIRE_DMG_];
const score = disk.getEffectiveStatCounts(effectiveStats);

console.log('火元素主词条测试:');
console.log('主词条:', disk.main_stat);
console.log('有效词条:', effectiveStats);
console.log('得分:', score);
console.log('期望得分: 10');
console.log('测试结果:', score === 10 ? '✅ 通过' : '❌ 失败');

// 测试火元素 + 暴击率
const disk2 = new DriveDisk(
  '2', '2', 1, 4, 1,
  PropertyType.FIRE_DMG_,
  new StatValue(0.30, true),
  new Map([
    [PropertyType.CRIT_, new StatValue(3, false)],
    [PropertyType.CRIT_DMG_, new StatValue(2, false)]
  ])
);

const effectiveStats2 = [PropertyType.FIRE_DMG_, PropertyType.CRIT_, PropertyType.CRIT_DMG_];
const score2 = disk2.getEffectiveStatCounts(effectiveStats2);

console.log('\n火元素主词条 + 副词条测试:');
console.log('主词条:', disk2.main_stat);
console.log('副词条:', Array.from(disk2.sub_stats.keys()));
console.log('有效词条:', effectiveStats2);
console.log('得分:', score2);
console.log('期望得分: 15 (主词条10 + 暴击率3 + 暴击伤害2)');
console.log('测试结果:', score2 === 15 ? '✅ 通过' : '❌ 失败');