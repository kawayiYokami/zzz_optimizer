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
  /** 套装索引 */
  setIdx: number;
  /** 属性数组 */
  stats: Float64Array;
  /** 有效词条得分（用于剪枝） */
  effectiveScore: number;
}

/**
 * 预计算数据（传递给 Worker）
 */
export interface PrecomputedData {
  /**
   * 角色静态属性（已合并：基础属性 + 被动Buff + 音擎属性 + 音擎Buff）
   * 音擎固定不参与搜索，直接合并到角色属性中
   */
  agentStats: Float64Array;

  /**
   * 驱动盘数据（按位置分组）
   * 索引 0-5 对应位置 1-6
   */
  discsBySlot: DiscData[][];

  /**
   * 套装加成数据
   * key: setIdx (数字索引，用于快速查找)
   */
  setBonuses: SetBonusData[];

  /**
   * 外部 Buff 合并后的属性
   */
  externalBuffStats: Float64Array;

  /**
   * 队友转换 Buff 贡献的固定属性（可直接累加）
   */
  teammateConversionStats: Float64Array;

  /**
   * 自身转换 Buff 列表（需要循环计算）
   */
  selfConversionBuffs: ConversionBuffData[];

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
   * 套装 ID 到索引的映射
   */
  setIdToIdx: Record<string, number>;

  /**
   * 激活的驱动盘套装 ID 列表
   * 只有在此列表中的套装才会提供 4 件套效果
   */
  activeDiskSets: string[];

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
}

/**
 * 创建空的预计算数据结构
 */
export function createEmptyPrecomputedData(): PrecomputedData {
  return {
    agentStats: new Float64Array(PROP_IDX.TOTAL_PROPS),
    discsBySlot: [[], [], [], [], [], []],
    setBonuses: [],
    externalBuffStats: new Float64Array(PROP_IDX.TOTAL_PROPS),
    teammateConversionStats: new Float64Array(PROP_IDX.TOTAL_PROPS),
    selfConversionBuffs: [],
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
    setIdToIdx: {},
    activeDiskSets: [],
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
