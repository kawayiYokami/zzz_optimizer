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
  /**
   * 敌人抗性削减（来源：角色/武器/可选 buff，不含驱动盘）
   * Worker 在初始化阶段据此计算抗性区。
   */
  baseResRed: number;

  /**
   * 敌人易伤（来源：角色/武器/可选 buff，不含驱动盘）
   * Worker 在初始化阶段据此计算承伤区。
   */
  baseDmgTakenInc: number;

  /**
   * 失衡易伤倍率（来源：敌人/战斗状态）
   * Worker 在初始化阶段据此计算失衡易伤区。
   */
  stunVulnerability: number;

  /**
   * 距离衰减（默认 1.0）
   * Worker 在初始化阶段据此计算距离区。
   */
  distanceMult: number;

  /**
   * 攻击者等级（用于等级区与防御区 levelBase）
   */
  attackerLevel: number;

  /**
   * 异常暴击率/暴击伤害/异常增伤（来源：角色/武器/可选 buff，不含驱动盘）
   * Worker 在初始化阶段据此计算异常暴击区/异常增伤区。
   */
  baseAnomalyCritRate: number;
  baseAnomalyCritDmg: number;
  baseAnomalyDmgBonus: number;

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
  /** 套装索引（用于 Worker 热路径计数；由 OptimizerContext 预编码） */
  setIdx: number;
  /** 是否为目标套装 */
  isTargetSet: boolean;
}

/**
 * 预计算数据（传递给 Worker）
 */
export interface PrecomputedData {
  /**
   * 局外静态属性底座（不含驱动盘组合，也不含任何 Buff）
   *
   * 只允许包含：
   * - 角色白值（Agent.getCharacterBaseStats().out_of_combat）
   * - 音擎静态属性（WEngine.getBaseStats().out_of_combat）
   * - 目标两件套静态属性（2pc out_of_combat）
   */
  mergedStats: Float64Array;

  /**
   * 普通 Buff 的合并结果（只参与快照2；禁止写入 mergedStats）
   *
   * 只允许包含：所有启用的普通 Buff 的 in_combat_stats 叠加后的结果。
   */
  mergedBuff: Float64Array;

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
   * 目标套装的 2 件套静态属性（out_of_combat）
   * - 由 Worker/FastEvaluator 在初始化阶段预合并（同一 worker 复用）
   */
  targetSetTwoPiece: Float64Array;

  /**
   * 目标套装的 4 件套 Buff（局内普通 Buff：in_combat_stats）
   * - 由 Worker/FastEvaluator 在初始化阶段预合并（同一 worker 复用）
   */
  targetSetFourPieceBuff: Float64Array;

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

  /**
   * 异常在固定时间点/窗口 T 下的总倍率（类似技能倍率；可预计算下发）
   */
  anomalyTotalRatioAtT: number;

  /**
   * 紊乱在固定时间点/窗口 T 下的一次性总倍率（类似技能倍率；可预计算下发）
   */
  disorderTotalRatioAtT: number;
}

/**
 * 伤害乘区（可变区，不包括固定区）
 */
export interface DamageMultipliers {
  /** 基础直伤 */
  baseDirectDamage: number;
  /** 基础异常伤 */
  baseAnomalyDamage: number;
  /** 基础紊乱伤 */
  baseDisorderDamage?: number;
  /** 基础烈霜伤（星见雅特有） */
  baseLieshuangDamage?: number;
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
  /** 调试用：快照1/2/3（用于 UI 展示“局内增量 = snapshot3 - snapshot1”） */
  snapshots?: {
    snapshot1: { atk: number; hp: number; def: number; impact: number };
    snapshot2: { atk: number; hp: number; def: number; impact: number };
    snapshot3: { atk: number; hp: number; def: number; impact: number };
  };
  /** 伤害构成 */
  breakdown: {
    direct: number;
    anomaly: number;
    disorder: number;
    lieshuang?: number;
  };
  /** 伤害乘区（可变区） */
  multipliers: DamageMultipliers;
  /** 防御区（本次组合实际使用的 defMult，含盘穿透/减防） */
  defMult?: number;
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
  /** 调试信息（仅用于调试面板展示；不参与 Worker 计算） */
  debug?: {
    /** 优化器本次实际使用的 Buff 列表（已应用开关过滤） */
    activeBuffsUsed: { id: string; name: string; source: string; isConversion: boolean }[];
  };
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
    mergedBuff: new Float64Array(PROP_IDX.TOTAL_PROPS),
    conversionBuffs: [],
    discsBySlot: [[], [], [], [], [], []],
    targetSetId: '',
    targetSetTwoPiece: new Float64Array(PROP_IDX.TOTAL_PROPS),
    targetSetFourPieceBuff: new Float64Array(PROP_IDX.TOTAL_PROPS),
    otherSetTwoPiece: {},
    fixedMultipliers: {
      distanceMult: 1,
      baseResRed: 0,
      baseDmgTakenInc: 0,
      stunVulnerability: 1,
      attackerLevel: 60,
      baseAnomalyCritRate: 0,
      baseAnomalyCritDmg: 0,
      baseAnomalyDmgBonus: 0,
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
    anomalyTotalRatioAtT: 0,
    disorderTotalRatioAtT: 0,
  };
}
