/**
 * 技能数据模型
 *
 * 对应 public/game-data/csv/代理人技能数据.csv
 */

/**
 * 技能段数据（对应CSV一行）
 */
export interface AgentSkillSegment {
  agentName: string;           // 代理人
  skillName: string;           // 技能（普通攻击、特殊技等）
  segmentName: string;         // 段（一段、二段...或空）
  damageRatio: number;         // 伤害倍率
  damageRatioGrowth: number;   // 伤害倍率成长
  stunRatio: number;           // 失衡倍率
  stunRatioGrowth: number;     // 失衡倍率成长
  energyRecovery: number;      // 能量回复
  anomalyBuildup: number;      // 异常积蓄
  decibelRecovery: number;     // 喧响值回复
  flashEnergyAccumulation: number; // 闪能累积
  corruptionShieldReduction: number; // 秽盾削减值
  skillType: number;           // 技能类型
  attackType: number;          // 攻击类型
  energyExtraCost: number;     // 能量额外消耗
  specialEnergy: string;       // 特殊能量类型
  distanceDecay: string;       // 距离衰减
}

/**
 * 技能（包含多个段）
 */
export interface AgentSkill {
  skillName: string;
  segments: AgentSkillSegment[];
}

/**
 * 技能集（一个角色的所有技能）
 */
export interface AgentSkillSet {
  agentName: string;
  skills: Map<string, AgentSkill>;
}
