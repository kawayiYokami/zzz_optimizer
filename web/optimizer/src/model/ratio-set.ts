/**
 * 倍率集合
 * 用于存储技能的多属性伤害倍率
 */
export class RatioSet {
  atk_ratio: number = 0;       // 攻击力倍率
  def_ratio: number = 0;       // 防御力倍率
  hp_ratio: number = 0;        // 生命值倍率
  pen_ratio: number = 0;       // 贯穿力倍率
  anom_prof_ratio: number = 0; // 异常精通倍率
  anom_atk_ratio: number = 0;  // 异常直伤倍率

  constructor(init?: Partial<RatioSet>) {
    if (init) Object.assign(this, init);
  }
}