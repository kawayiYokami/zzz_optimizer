/**
 * 预设生成器服务
 *
 * 为角色生成推荐的优化配置
 */

import type { Agent } from '../model/agent';
import { CharacterAnalyzer } from './character-analyzer.service';

/**
 * 预设生成器
 */
export class PresetGenerator {
  /**
   * 为角色生成推荐的优化配置
   * @param agent 角色实例
   */
  static generateRecommendedConfigForAgent(agent: Agent): void {
    // 分析角色，推荐有效词条
    const effectiveStats = CharacterAnalyzer.recommendEffectiveStats(agent);

    // 设置角色的默认优化配置
    agent.effective_stats = effectiveStats;
    agent.objective = 'skill';
    agent.main_stat_filters = {};
    agent.pinned_slots = {};
    agent.selected_skill_keys = [];
  }

  /**
   * 检查角色是否为默认配置（未自定义）
   * @param agent 角色实例
   * @returns 是否为默认配置
   */
  static isDefaultAgentConfig(agent: Agent): boolean {
    return agent.effective_stats.length === 0;
  }
}
