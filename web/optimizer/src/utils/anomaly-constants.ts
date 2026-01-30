/**
 * 异常伤害常量
 *
 * 从 DamageCalculatorService 提取的常量定义
 * 确保 Worker 和主线程使用相同的计算参数
 */

export type AnomalyDamageKind = 'tick' | 'single';

/**
 * 异常伤害参数（覆盖 tick 型 / 一次型）
 *
 * - tick 型：按固定间隔造成多段伤害（灼烧/感电/侵蚀/玄墨）
 * - single 型：一次性伤害（碎冰/强击）
 */
export const ANOMALY_DAMAGE_PARAMS: Record<
  string,
  { kind: AnomalyDamageKind; ratio: number; interval: number }
> = {
  fire: { kind: 'tick', ratio: 0.5, interval: 0.5 },      // 灼烧：50%/0.5秒
  electric: { kind: 'tick', ratio: 1.25, interval: 1 },   // 感电：125%/秒
  ether: { kind: 'tick', ratio: 0.625, interval: 0.5 },   // 侵蚀：62.5%/0.5秒
  ink: { kind: 'tick', ratio: 0.625, interval: 0.5 },     // 玄墨：62.5%/0.5秒（与侵蚀同口径）
  ice: { kind: 'single', ratio: 5.0, interval: 0 },       // 碎冰：500%（一次性）
  physical: { kind: 'single', ratio: 7.13, interval: 0 }, // 强击：713%（一次性）
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
 * 用于“技能贡献期望”的固定结算窗口（秒）
 *
 * 注意：这是项目内部的统一计算口径，不是异常在游戏中的完整持续时间。
 */
export const ANOMALY_EXPECT_WINDOW_SEC = 3;

export interface AnomalyDamageParams {
  kind: AnomalyDamageKind;
  ratio: number;        // 单次倍率（tick 型为每 tick 倍率；single 型为一次性倍率）
  interval: number;     // tick 间隔（秒）；single 型为 0
  duration: number;     // 异常默认持续时间（秒），用于展示/说明，不参与“技能贡献期望”窗口
  tickCount: number;    // 在固定窗口内的 tick 次数（single 型为 1）
  totalRatio: number;   // 在固定窗口内的总倍率（ratio * tickCount）
}

/**
 * 获取异常伤害参数（tick 型 / 一次型统一口径）
 */
export function getAnomalyDamageParams(element: string): AnomalyDamageParams {
  const elementLower = element.toLowerCase();

  // 烈霜作为“异常触发的直伤”，这里不作为异常伤害本体返回
  // （调用方如需异常本体口径，按 ice 的碎冰规则处理即可）
  const params = ANOMALY_DAMAGE_PARAMS[elementLower] || {
    kind: 'single' as const,
    ratio: 0,
    interval: 0,
  };

  const duration = ANOMALY_DEFAULT_DURATION[elementLower] || 10;

  const tickCount =
    params.kind === 'tick' && params.interval > 0
      ? Math.floor(ANOMALY_EXPECT_WINDOW_SEC / params.interval)
      : 1;

  return {
    kind: params.kind,
    ratio: params.ratio,
    interval: params.interval,
    duration,
    tickCount,
    totalRatio: params.ratio * tickCount,
  };
}

/**
 * 获取异常持续时间乘数
 */
export function getAnomalyDurationMult(element: string): number {
  // 旧接口：历史遗留，仅用于少量旧逻辑（如仍有调用方）
  // 新代码应使用 getAnomalyDamageParams(element).tickCount。
  const mults: Record<string, number> = {
    physical: 1,
    fire: 10,
    ice: 1,
    electric: 10,
    ether: 10,
    ink: 10,
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
