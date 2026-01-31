import { PropertyCollection } from './property-collection';
import { PropertyType } from './base';
import { RatioSet } from './ratio-set';

/**
 * 乘区集合
 * 存储伤害计算的所有乘区和最终伤害值
 */
export class ZoneCollection {
  // 最终属性快照
  final: Map<PropertyType, number> = new Map();
  ratios: RatioSet = new RatioSet();

  // 基础伤害区（技能相关）
  base_damage_zone: number = 0;
  anomaly_base_damage_zone: number = 0;
  disorder_base_damage_zone: number = 0;
  lieshuang_base_damage_zone: number = 0;

  // 直伤乘区
  dmg_bonus: number = 1.0;      // 增伤区
  crit_zone: number = 1.0;      // 暴击区
  def_mult: number = 1.0;       // 防御区
  res_mult: number = 1.0;       // 抗性区
  dmg_taken_mult: number = 1.0; // 减易伤区
  stun_vuln_mult: number = 1.0; // 失衡易伤区
  distance_mult: number = 1.0;  // 距离衰减区
  penetration_dmg_bonus: number = 0; // 贯穿增伤

  // 异常乘区
  accumulate_zone: number = 1.0;    // 积蓄区
  anomaly_prof_mult: number = 1.0;  // 精通区
  anomaly_dmg_mult: number = 1.0;   // 异常增伤区
  anomaly_crit_mult: number = 1.0;  // 异常暴击区
  level_mult: number = 1.0;         // 等级区
  trigger_expect: number = 1.0;     // 触发期望

  // 各属性伤害贡献
  atk_damage: number = 0;
  def_damage: number = 0;
  hp_damage: number = 0;
  pen_damage: number = 0;
  anom_atk_damage: number = 0;
  anom_prof_damage: number = 0;

  // 直伤最终值
  direct_damage_no_crit: number = 0;
  direct_damage_crit: number = 0;
  direct_damage_expected: number = 0;

  // 异常直伤最终值
  anomaly_attack_damage_no_crit: number = 0;
  anomaly_attack_damage_crit: number = 0;
  anomaly_attack_damage_expected: number = 0;

  // 异常精通伤害最终值
  anomaly_prof_damage_no_crit: number = 0;
  anomaly_prof_damage_crit: number = 0;
  anomaly_prof_damage_expected: number = 0;

  // 总伤害最终值
  total_damage_no_crit: number = 0;
  total_damage_crit: number = 0;
  total_damage_expected: number = 0;

  constructor(init?: Partial<ZoneCollection>) {
    if (init) Object.assign(this, init);
  }

  copy(): ZoneCollection {
    return new ZoneCollection({ ...this });
  }

  /**
   * 从 PropertyCollection 更新最终属性快照
   */
  updateFromPropertyCollection(props: PropertyCollection): void {
    this.final = props.toFinalStats();
  }

  /**
   * 获取最终属性值
   */
  getFinal(prop: PropertyType, defaultValue: number = 0): number {
    return this.final.get(prop) ?? defaultValue;
  }
}
