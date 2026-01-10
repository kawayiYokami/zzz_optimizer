/**
 * 简化的存档数据模型
 *
 * 直接存储ZOD格式，不做任何转换
 */

import type { OptimizationConstraints, OptimizationBuild } from '../optimizer/types';

export interface ZodCharacterData {
  key: string;          // CodeName: "Anby"
  level: number;
  core: number;
  mindscape: number;
  dodge: number;
  basic: number;
  chain: number;
  special: number;
  assist: number;
  promotion: number;
  potential: number;
  equippedDiscs: Record<string, string>;
  equippedWengine: string;
  id: string;
}

export interface ZodWengineData {
  key: string;          // EN name/codename
  level: number;
  modification: number; // 精炼
  promotion: number;    // 突破
  phase?: number;       // 一些工具使用 phase 表示突破
  location: string;     // 装备角色ID
  lock?: boolean;
  id: string;
}

export interface ZodDiscData {
  setKey: string;       // 套装CodeName: "WhiteWaterBallad"
  rarity: string;
  level: number;
  slotKey: string;      // 位置
  mainStatKey: string;
  substats: Array<{
    key: string;
    upgrades: number;
  }>;
  location: string;     // 装备角色ID
  lock: boolean;
  trash: boolean;
  id: string;
}

/**
 * 队伍数据
 */
export interface ZodTeamData {
  id: string;
  name: string;
  priority: number;            // 队伍优先级（数字越大优先级越高）
  frontCharacterId: string;    // 前台角色ID
  backCharacter1Id: string;    // 后台角色1ID
  backCharacter2Id: string;    // 后台角色2ID

  /**
   * 优化配置（可选）
   * 每个队伍可以有独立的优化配置
   */
  optimizationConfig?: {
    /** 优化约束 */
    constraints: OptimizationConstraints;
    /** 选中的技能键列表 */
    selectedSkillKeys: string[];
    /** 禁用的Buff ID列表（黑名单模式） */
    disabledBuffIds: string[];
    /** 选中的敌人ID */
    selectedEnemyId: string;
    /** 最后更新时间 */
    lastUpdated: string;
  };

  /**
   * 优化结果缓存（可选）
   * 存储前10组优化结果
   */
  optimizationResults?: OptimizationBuild[];
}

/**
 * 战场数据
 */
export interface ZodBattleData {
  id: string;
  name: string;
  teamId: string;              // 队伍ID
  enemyId: string;             // 敌人ID
  enemyStatus?: {
    isStunned: boolean;
    hasCorruptionShield: boolean;
  };
  activeBuffs?: Record<string, boolean>; // Buff开关状态 {buffId: isActive}
  manualBuffs?: any[];         // 手动Buff列表（暂存）
  targetSkills?: string[];     // 目标技能列表
  selectedSkill?: string;      // 当前选中的技能（用于伤害计算展示）
}

/**
 * 存档数据（完全ZOD格式）
 */
export interface SaveDataZod {
  name?: string;
  format: string;
  dbVersion: number;
  source: string;
  version: number;
  created_at?: string;
  updated_at?: string;

  characters: ZodCharacterData[];
  wengines: ZodWengineData[];
  discs: ZodDiscData[];
  teams: ZodTeamData[];
  battles: ZodBattleData[];
}
