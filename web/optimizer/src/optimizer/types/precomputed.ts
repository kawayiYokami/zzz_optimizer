/**
 * 预计算数据结构
 *
 * 存储优化器预计算的数据，用于在 Worker 中快速计算伤害。
 * 所有数据都使用 Float64Array 存储，避免对象创建和 GC 压力。
 */

import { PROP_IDX } from './property-index';
import { EnemyStats } from '../../model/enemy';

/**
 * 转换类 Buff 的预处理数据
 */
export interface ConversionBuffData {
  /** 源属性索引 */
  fromPropIdx: number;
  /** 目标属性索引 */
  toPropIdx: number;
  /** 转换比例 */
  ratio: number;
  /** 源属性阈值（超过此值的部分才参与转换） */
  threshold: number;
  /** 转换值上限（null 表示无上限） */
  maxValue: number | null;
  /** 是否为队友转换（队友转换可预计算） */
  isTeammate: boolean;
}

/**
 * 防御区参数
 */
export interface DefenseParams {
  /** 等级基数 = level * 10 + 100 */
  levelBase: number;
  /** 敌人基础防御 */
  enemyDef: number;
  /** 基础防御削弱（来自角色/音擎/Buff，不含驱动盘） */
  baseDefRed: number;
  /** 基础无视防御（来自角色/音擎/Buff，不含驱动盘） */
  baseDefIgn: number;
}

/**
 * 固定乘区（不受驱动盘影响，可预计算）
 */
export interface FixedMultipliers {
  /** 抗性区 = max(0, min(2, 1 - 敌人抗性 + 抗性削弱)) */
  resMult: number;
  /** 承伤区 = 1 + 易伤 */
  dmgTakenMult: number;
  /** 失衡易伤区 */
  stunVulnMult: number;
  /** 距离衰减区（默认 1.0） */
  distanceMult: number;
  /** 等级区 = 1 + (level - 1) / 59 */
  levelMult: number;
  /** 异常暴击区 = 1 + 异常暴击率 × 异常暴击伤害 */
  anomalyCritMult: number;
  /** 异常增伤区 = 1 + 异常伤害加成 */
  anomalyDmgMult: number;
  /** 防御区参数（穿透需要循环计算） */
  defenseParams: DefenseParams;
}

/**
 * 技能参数（预计算版，使用数字索引）
 */
export interface PrecomputedSkillParams {
  /** 技能倍率 */
  ratio: number;
  /** 元素类型（枚举值） */
  element: number;
  /** 异常积蓄值 */
  anomalyBuildup: number;
  /** 技能类型标签（用于技能增伤匹配） */
  tags: number[];
  /** 是否为贯穿伤害（仪玄等角色） */
  isPenetration?: boolean;
}

/**
 * 套装加成数据
 */
export interface SetBonusData {
  /** 套装 ID */
  setId: string;
  /** 套装索引（用于快速查找） */
  setIdx: number;
  /** 2 件套属性加成 */
  twoPiece: Float64Array;
  /** 4 件套属性加成 */
  fourPiece: Float64Array;
  /** 4 件套 Buff 属性（如果有） */
  fourPieceBuff: Float64Array | null;
}

/**
 * 驱动盘预计算数据
 */
export interface DiscData {
  /** 驱动盘 ID */
  id: string;
  /** 属性数组（主词条+副词条，不含套装效果） */
  stats: Float64Array;
  /** 有效词条得分（用于剪枝） */
  effectiveScore: number;
  /** 套装 ID（用于2件套判断） */
  setId: string;
  /** 是否为目标套装 */
  isTargetSet: boolean;
}

/**
 * 预计算数据（传递给 Worker）
 */
export interface PrecomputedData {
  /**
   * 合并后的静态属性
   * 包含：角色裸属性 + 武器属性 + 所有非转换buff + 目标4件套2+4效果
   */
  mergedStats: Float64Array;

  /**
   * 转换类 Buff 列表（需要最终属性才能计算）
   */
  conversionBuffs: ConversionBuffData[];

  /**
   * 驱动盘数据（按位置分组）
   * 索引 0-5 对应位置 1-6
   */
  discsBySlot: DiscData[][];

  /**
   * 目标四件套 ID
   */
  targetSetId: string;

  /**
   * 非目标套装的2件套效果缓存
   * key: 套装ID, value: 2件套属性数组
   */
  otherSetTwoPiece: Record<string, Float64Array>;

  /**
   * 固定乘区（不受驱动盘影响）
   */
  fixedMultipliers: FixedMultipliers;

  /**
   * 技能参数列表
   */
  skillsParams: PrecomputedSkillParams[];

  /**
   * 角色等级
   */
  agentLevel: number;

  /**
   * 敌人战斗属性
   */
  enemyStats: EnemyStats;

  /**
   * 特殊异常配置（如烈霜）
   */
  specialAnomalyConfig: { element: string; ratio: number } | null;
}

/**
 * 伤害乘区（可变区，不包括固定区）
 */
export interface DamageMultipliers {
  /** 基础直伤 */
  baseDirectDamage: number;
  /** 基础异常伤 */
  baseAnomalyDamage: number;
  /** 精通区 */
  anomalyProfMult: number;
  /** 积蓄区 */
  accumulationZone: number;
  /** 暴击区 */
  critZone: number;
  /** 增伤区 */
  dmgBonus: number;
}

/**
 * 优化结果中的单个构建
 */
export interface OptimizationBuildResult {
  /** 伤害值 */
  damage: number;
  /** 驱动盘 ID 数组（按位置 1-6） */
  discIds: [string, string, string, string, string, string];
  /** 最终属性快照 */
  finalStats: Float64Array;
  /** 伤害构成 */
  breakdown: {
    direct: number;
    anomaly: number;
    disorder: number;
  };
  /** 伤害乘区（可变区） */
  multipliers: DamageMultipliers;
  /** 套装信息 */
  setInfo: {
    twoPieceSets: string[];
    fourPieceSet: string | null;
  };
}

/**
 * 快速优化请求（传递给 Worker）
 */
export interface FastOptimizationRequest {
  /** 预计算数据 */
  precomputed: PrecomputedData;
  /** Worker ID（用于分片） */
  workerId: number;
  /** Worker 总数 */
  totalWorkers: number;
  /** 返回前 N 个结果 */
  topN: number;
  /** 剪枝阈值 */
  pruneThreshold: number;
  /** 进度上报间隔（毫秒） */
  progressInterval: number;
  /** 预估的有效组合总数（用于进度计算，从UI传入） */
  estimatedTotal?: number;
}

/**
 * 创建空的预计算数据结构
 */
export function createEmptyPrecomputedData(): PrecomputedData {
  return {
    mergedStats: new Float64Array(PROP_IDX.TOTAL_PROPS),
    conversionBuffs: [],
    discsBySlot: [[], [], [], [], [], []],
    targetSetId: '',
    otherSetTwoPiece: {},
    fixedMultipliers: {
      resMult: 1,
      dmgTakenMult: 1,
      stunVulnMult: 1,
      distanceMult: 1,
      levelMult: 1,
      anomalyCritMult: 1,
      anomalyDmgMult: 1,
      defenseParams: {
        levelBase: 700,
        enemyDef: 800,
        baseDefRed: 0,
        baseDefIgn: 0,
      },
    },
    skillsParams: [],
    agentLevel: 60,
    enemyStats: new EnemyStats(
      100000, // hp
      800,    // defense
      60,     // level
      1000,   // stunMax
      true,   // canStun
      1,      // stunVulnerability
      false,  // isStunned
      {},     // elementResistances
      {},     // anomalyThresholds
      false   // hasCorruptionShield
    ),
    specialAnomalyConfig: null,
  };
}
