import { ElementType } from './base';

/**
 * 技能类型枚举
 */
export enum SkillType {
  NORMAL_ATK,      // 普通攻击
  SPECIAL_ATK,     // 特殊技
  ENHANCED_SPECIAL,// 强化特殊技
  CHAIN_ATK,       // 连携技
  ULTIMATE_ATK,    // 终结技
  DASH_ATK,        // 冲刺攻击
  DODGE_COUNTER,   // 闪避反击
  ASSIST_ATK,      // 支援攻击
  ADDL_ATK,        // 追加攻击
}

/**
 * 倍率集合
 * 用于存储技能的多属性伤害倍率和技能标签
 */
export class RatioSet {
  // 属性倍率
  atk_ratio: number = 0;
  def_ratio: number = 0;
  hp_ratio: number = 0;
  pen_ratio: number = 0;
  anom_prof_ratio: number = 0;
  anom_atk_ratio: number = 0;
  
  // 技能标签（支持多标签）
  skill_types: Set<SkillType> = new Set([SkillType.NORMAL_ATK]);
  element: ElementType = ElementType.PHYSICAL;

  constructor(init?: Partial<Omit<RatioSet, 'skill_types'>> & { skill_types?: SkillType[] }) {
    if (init) {
      const { skill_types, ...rest } = init;
      Object.assign(this, rest);
      if (skill_types) this.skill_types = new Set(skill_types);
    }
  }
}