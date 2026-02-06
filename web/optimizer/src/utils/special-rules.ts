/**
 * 集中管理少量“特例规则”。
 *
 * 目标不是消灭硬编码，而是把硬编码聚合到单点，降低散落成本。
 */

export interface AgentSpecialRule {
  forceStunned?: boolean;
  stunVulnerabilityCap?: number;
}

const AGENT_SPECIAL_RULES_BY_CN_NAME: Record<string, AgentSpecialRule> = {
  // 叶瞬光：强制视为失衡，失衡易伤乘区上限 2.1
  叶瞬光: {
    forceStunned: true,
    stunVulnerabilityCap: 2.1,
  },
};

export function getAgentSpecialRuleByCnName(nameCn?: string | null): AgentSpecialRule | null {
  if (!nameCn) return null;
  return AGENT_SPECIAL_RULES_BY_CN_NAME[nameCn] ?? null;
}

const LIESHUANG_ELEMENT = 'lieshuang';
const LIESHUANG_DISORDER_BASE = 6.0;
const LIESHUANG_DISORDER_STEP = 0.75;

/**
 * 读取元素特例的紊乱倍率公式。
 *
 * @returns 命中特例返回倍率；未命中特例返回 null
 */
export function getSpecialDisorderRatio(element: string, remainingTimeSec: number): number | null {
  if (element.toLowerCase() !== LIESHUANG_ELEMENT) return null;
  const t = Math.max(0, remainingTimeSec);
  // 烈霜：600% + floor(T) * 75%
  return LIESHUANG_DISORDER_BASE + Math.floor(t) * LIESHUANG_DISORDER_STEP;
}

