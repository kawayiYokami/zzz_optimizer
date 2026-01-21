/**
 * 技能数据模型
 *
 * 对应 public/game-data/character/{id}.json
 */

// ============================================
// 新的技能数据结构（基于原始游戏数据格式）
// ============================================

/**
 * 技能参数类型
 */
export enum SkillPropType {
  DAMAGE = 1001,      // 伤害倍率
  STUN = 1002,        // 失衡倍率
}

/**
 * 技能分类
 */
export enum SkillCategory {
  BASIC = 'Basic',         // 普通攻击
  DODGE = 'Dodge',         // 闪避
  SPECIAL = 'Special',     // 特殊技
  CHAIN = 'Chain',         // 连携技
  ASSIST = 'Assist',       // 支援
  CORE = 'Core',           // 核心被动
}

/**
 * 技能段（已根据等级计算好的属性）
 */
export interface SkillSegment {
  name: string;                    // 段名称（如"一段"）
  damageRatio: number;             // 伤害倍率（已计算，小数）
  stunRatio: number;               // 失衡倍率（已计算，小数）
  anomalyBuildup: number;          // 异常积蓄
  spRecovery: number;              // 能量回复
  feverRecovery: number;           // 喧响值回复
  rpRecovery: number;              // 意识点回复
  etherPurify: number;             // 以太净化
  skillId: string;                 // 技能ID
}

/**
 * 技能（已根据等级计算好的属性）
 */
export interface Skill {
  name: string;                    // 技能名称
  category: SkillCategory;         // 技能分类
  segments: SkillSegment[];        // 技能段列表（已计算）
  level: number;                   // 技能等级
  spConsume?: number;              // 能量消耗（可选）
}

/**
 * 技能集合（已根据等级计算好的属性）
 */
export interface SkillSet {
  basic: Skill[];           // 普通攻击列表
  dodge: Skill[];           // 闪避列表
  special: Skill[];         // 特殊技列表
  chain: Skill[];           // 连携技列表
  assist: Skill[];          // 支援列表
}
