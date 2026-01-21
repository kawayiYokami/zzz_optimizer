/**
 * 异常伤害常量
 *
 * 从 DamageCalculatorService 提取的常量定义
 * 确保 Worker 和主线程使用相同的计算参数
 */

/**
 * 异常持续伤害倍率（每tick）
 */
export const ANOMALY_DOT_RATIOS: Record<string, { ratio: number; interval: number }> = {
  fire: { ratio: 0.5, interval: 0.5 },      // 灼烧：50%/0.5秒
  electric: { ratio: 1.25, interval: 1 },   // 感电：125%/秒
  ether: { ratio: 0.625, interval: 0.5 },   // 侵蚀：62.5%/0.5秒
  ice: { ratio: 5.0, interval: 0 },         // 碎冰：500%（一次性）
  physical: { ratio: 7.13, interval: 0 },   // 强击：713%（一次性）
};

/**
 * 异常默认持续时间（秒）
 */
export const ANOMALY_DEFAULT_DURATION: Record<string, number> = {
  fire: 10,      // 灼烧
  electric: 10,  // 感电
  ether: 10,     // 侵蚀
  ice: 10,       // 霜寒
  physical: 10,  // 畏缩
};

/**
 * 标准异常积蓄阈值
 */
export const STANDARD_BUILDUP_THRESHOLD = 100;

/**
 * 异常时间 T1 = 3 秒（异常 T1 + 紊乱 T2 = 10）
 */
export const ANOMALY_TIME_T1 = 3;

/**
 * 获取异常持续伤害参数
 */
export function getAnomalyDotParams(element: string): {
  ratio: number;
  interval: number;
  duration: number;
  totalRatio: number;
} {
  const dot = ANOMALY_DOT_RATIOS[element.toLowerCase()] || { ratio: 0, interval: 0 };
  const duration = ANOMALY_DEFAULT_DURATION[element.toLowerCase()] || 10;

  // 根据元素类型计算总伤害倍率
  let totalRatio = 0;
  const elementLower = element.toLowerCase();

  switch (elementLower) {
    case 'fire': // 灼烧
      totalRatio = Math.floor(ANOMALY_TIME_T1 / 0.5) * 0.5;
      break;
    case 'electric': // 感电
      totalRatio = Math.floor(ANOMALY_TIME_T1) * 1.25;
      break;
    case 'ether': // 侵蚀
    case 'ink': // 玄墨
      totalRatio = Math.floor(ANOMALY_TIME_T1 / 0.5) * 0.625;
      break;
    case 'ice': // 碎冰
    case 'lieshuang': // 烈霜
      totalRatio = 5.0; // 500%
      break;
    case 'physical': // 强击
      totalRatio = 7.13; // 713%
      break;
    default:
      totalRatio = dot.ratio;
  }

  return {
    ratio: dot.ratio,
    interval: dot.interval,
    duration,
    totalRatio,
  };
}

/**
 * 获取异常持续时间乘数
 */
export function getAnomalyDurationMult(element: string): number {
  // 异常总伤害 = 单次 tick × 次数
  const mults: Record<string, number> = {
    physical: 1,  // 物理 - 单次
    fire: 10,     // 火 - 10 次 tick
    ice: 1,       // 冰 - 单次
    electric: 10, // 电 - 10 次 tick
    ether: 10,    // 以太 - 10 次 tick
  };
  return mults[element.toLowerCase()] ?? 1;
}

/**
 * 获取紊乱伤害倍率
 */
export function getDisorderRatio(element: string): number {
  // 紊乱倍率（简化值）
  return 1.5;
}