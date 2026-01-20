/**
 * 预设生成器服务
 *
 * 为队伍生成推荐的优化配置
 */

import type { Team, TeamOptimizationConfig } from '../model/team';
import type { OptimizationConstraints } from '../optimizer/types';
import { CharacterAnalyzer } from './character-analyzer.service';

/**
 * 预设生成器
 */
export class PresetGenerator {
  /**
   * 为队伍生成推荐的优化配置
   * @param team 队伍实例
   * @returns 推荐的优化配置
   */
  static generateRecommendedConfig(team: Team): TeamOptimizationConfig {
    const frontAgent = team.frontAgent;

    // 如果没有前台角色，返回默认配置
    if (!frontAgent) {
      return this.getDefaultConfig();
    }

    // 分析前台角色，推荐有效词条
    const effectiveStats = CharacterAnalyzer.recommendEffectiveStats(frontAgent);

    // 生成约束配置
    const constraints: OptimizationConstraints = {
      mainStatFilters: {},
      requiredSets: [],
      pinnedSlots: {},
      setMode: 'any',
      selectedWeaponIds: [],
      effectiveStatPruning: {
        enabled: true,
        effectiveStats,
        mainStatScore: 10,
        pruneThreshold: 10,
      },
      activeDiskSets: [],
    };

    return {
      constraints,
      selectedSkillKeys: [],
      disabledBuffIds: [],
      selectedEnemyId: '',
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 获取默认配置（当无法生成推荐配置时使用）
   * @returns 默认配置
   */
  static getDefaultConfig(): TeamOptimizationConfig {
    const constraints: OptimizationConstraints = {
      mainStatFilters: {},
      requiredSets: [],
      pinnedSlots: {},
      setMode: 'any',
      selectedWeaponIds: [],
      effectiveStatPruning: {
        enabled: false,
        effectiveStats: [],
        mainStatScore: 10,
        pruneThreshold: 10,
      },
      activeDiskSets: [],
    };

    return {
      constraints,
      selectedSkillKeys: [],
      disabledBuffIds: [],
      selectedEnemyId: '',
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 检查配置是否为默认配置（未自定义）
   * @param config 优化配置
   * @returns 是否为默认配置
   */
  static isDefaultConfig(config: TeamOptimizationConfig): boolean {
    return (
      !config.constraints.effectiveStatPruning?.enabled ||
      config.constraints.effectiveStatPruning.effectiveStats.length === 0
    );
  }

  /**
   * 获取配置来源描述（用于UI显示）
   * @param config 优化配置
   * @param team 队伍实例
   * @returns 配置来源描述
   */
  static getConfigSourceDescription(config: TeamOptimizationConfig, team: Team): string {
    if (this.isDefaultConfig(config)) {
      return '默认配置';
    }

    const frontAgent = team.frontAgent;
    if (!frontAgent) {
      return '手动配置';
    }

    const recommendedStats = CharacterAnalyzer.recommendEffectiveStats(frontAgent);
    const currentStats = config.constraints.effectiveStatPruning?.effectiveStats || [];

    // 检查是否与推荐配置一致
    const isRecommended =
      recommendedStats.length === currentStats.length &&
      recommendedStats.every(stat => currentStats.includes(stat));

    if (isRecommended) {
      return `智能推荐（${CharacterAnalyzer.getCharacterTypeDescription(frontAgent)}）`;
    }

    return '手动配置';
  }
}
