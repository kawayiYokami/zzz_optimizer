/**
 * 配装建议服务
 * 
 * 提供驱动盘配装优化建议，包括：
 * - 槽位分析：当前盘 vs 候选盘
 * - 升级建议：哪个盘值得升级
 * - 分解建议：哪个盘可以分解
 */

import { DriveDisk, DriveDiskPosition } from '../model/drive-disk';
import { PropertyType } from '../model/base';
import type { Agent } from '../model/agent';

/**
 * 套装配置
 */
export interface SetConfig {
  fourPieceSet: string | null;  // 4件套ID
  twoPieceSets: string[];       // 2件套ID列表
}

/**
 * 候选盘信息
 */
export interface CandidateDisc {
  disc: DriveDisk;
  currentScore: number;        // 该盘当前得分
  expectedScore: number;       // 该盘期望满级得分
  optimisticScore: number;     // 该盘乐观满级得分
  pessimisticScore: number;    // 该盘悲观得分
  scoreGain: number;           // 相比当前装备的收益
  isPositiveGain: boolean;     // 是否正收益
  isUpgradeNeeded: boolean;    // 是否需要强化
  upgradeFrom: number;         // 当前等级
  matchesTargetSet: boolean;   // 是否属于目标4件套
  breaksFourPieceSet: boolean; // 是否会破坏当前4件套
  breaksTwoPieceSets: string[]; // 会破坏的2件套ID
  effectiveSubStats: number;   // 有效副词条数
}

/**
 * 槽位建议
 */
export interface SlotRecommendation {
  action: 'keep' | 'replace' | 'consider';
  reason: string;
  suggestedDisc?: DriveDisk;
  expectedGain?: number;
}

/**
 * 槽位分析结果
 */
export interface SlotAnalysis {
  position: DriveDiskPosition;
  currentDisc: DriveDisk | null;
  currentScore: number;
  currentExpectedScore: number;
  candidates: CandidateDisc[];
  recommendation: SlotRecommendation;
}

/**
 * 代理人配装分析结果
 */
export interface AgentBuildAnalysis {
  agentId: string;
  agentName: string;
  effectiveStats: PropertyType[];
  setConfig: SetConfig;
  slotAnalyses: SlotAnalysis[];
  totalCurrentScore: number;
  totalExpectedScore: number;
  totalOptimizedScore: number;  // 如果执行所有建议后的得分
  coordinatedRecommendations: CoordinatedRecommendation[]; // 联动替换建议（双槽位）
  recommendations: string[];    // 摘要建议
}

/**
 * 双槽位联动替换建议
 */
export interface CoordinatedRecommendation {
  positions: [DriveDiskPosition, DriveDiskPosition];
  discs: [DriveDisk, DriveDisk];
  expectedGain: number;
  setPatternBefore: string;
  setPatternAfter: string;
  breaksFourPieceSets: string[];
  breaksTwoPieceSets: string[];
  isSetStructureDowngrade: boolean;
}

/**
 * 分解建议
 */
export interface DiscardRecommendation {
  disc: DriveDisk;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 配装建议服务
 */
export class BuildAdvisorService {
  
  /**
   * 检测当前装备的套装配置
   */
  detectCurrentSets(equippedDiscs: (DriveDisk | null)[]): SetConfig {
    const setCounts = new Map<string, number>();
    
    for (const disc of equippedDiscs) {
      if (disc) {
        const count = setCounts.get(disc.game_id) || 0;
        setCounts.set(disc.game_id, count + 1);
      }
    }
    
    let fourPieceSet: string | null = null;
    const twoPieceSets: string[] = [];
    
    for (const [setId, count] of setCounts) {
      if (count >= 4) {
        fourPieceSet = setId;
      } else if (count >= 2) {
        twoPieceSets.push(setId);
      }
    }
    
    return { fourPieceSet, twoPieceSets };
  }

  /**
   * 分析单个槽位
   */
  analyzeSlot(
    position: DriveDiskPosition,
    currentDisc: DriveDisk | null,
    allDiscs: DriveDisk[],
    effectiveStats: PropertyType[],
    targetSetId: string | null,
    targetSetCount: number,
    setCounts: Map<string, number>
  ): SlotAnalysis {
    // 当前盘得分
    const currentScore = currentDisc?.getEffectiveStatCounts(effectiveStats) ?? 0;
    const currentExpectedScore = currentDisc?.calculateExpectedMaxScore(effectiveStats) ?? 0;
    
    // 筛选候选盘（同位置）
    const candidateDiscs = allDiscs.filter(d => 
      d.position === position &&
      d.id !== currentDisc?.id
    );
    
    // 计算每个候选盘的得分
    const candidates: CandidateDisc[] = candidateDiscs.map(disc => {
      const discCurrentScore = disc.getEffectiveStatCounts(effectiveStats);
      const discExpectedScore = disc.calculateExpectedMaxScore(effectiveStats);
      const discOptimisticScore = disc.calculateOptimisticMaxScore(effectiveStats);
      const discPessimisticScore = disc.calculatePessimisticScore(effectiveStats);
      
      return {
        disc,
        currentScore: discCurrentScore,
        expectedScore: discExpectedScore,
        optimisticScore: discOptimisticScore,
        pessimisticScore: discPessimisticScore,
        scoreGain: discExpectedScore - currentExpectedScore,
        isPositiveGain: discExpectedScore - currentExpectedScore > 0,
        isUpgradeNeeded: disc.level < 15,
        upgradeFrom: disc.level,
        matchesTargetSet: disc.game_id === targetSetId,
        breaksFourPieceSet: !!(
          targetSetId &&
          targetSetCount === 4 &&
          currentDisc &&
          currentDisc.game_id === targetSetId &&
          disc.game_id !== targetSetId
        ),
        breaksTwoPieceSets: (
          currentDisc &&
          currentDisc.game_id !== disc.game_id &&
          (setCounts.get(currentDisc.game_id) ?? 0) === 2
        ) ? [currentDisc.game_id] : [],
        effectiveSubStats: disc.getEffectiveSubStatCount(effectiveStats),
      };
    });
    
    // 按收益排序（先看收益，再看套装偏好与破套风险）
    candidates.sort((a, b) => {
      if (a.scoreGain !== b.scoreGain) {
        return b.scoreGain - a.scoreGain;
      }
      if (a.matchesTargetSet !== b.matchesTargetSet) {
        return a.matchesTargetSet ? -1 : 1;
      }
      if (a.breaksFourPieceSet !== b.breaksFourPieceSet) {
        return a.breaksFourPieceSet ? 1 : -1;
      }
      if (a.breaksTwoPieceSets.length !== b.breaksTwoPieceSets.length) {
        return a.breaksTwoPieceSets.length - b.breaksTwoPieceSets.length;
      }
      return b.expectedScore - a.expectedScore;
    });
    
    // 生成建议
    const recommendation = this.generateRecommendation(
      currentDisc,
      currentExpectedScore,
      candidates
    );
    
    return {
      position,
      currentDisc,
      currentScore,
      currentExpectedScore,
      candidates,
      recommendation,
    };
  }

  /**
   * 生成槽位建议
   */
  private generateRecommendation(
    currentDisc: DriveDisk | null,
    currentExpectedScore: number,
    candidates: CandidateDisc[]
  ): SlotRecommendation {
    if (candidates.length === 0) {
      return { action: 'keep', reason: '没有候选盘' };
    }
    
    const best = candidates[0];
    const bestPositive = candidates.find(c => c.isPositiveGain);
    
    // 如果当前盘为空
    if (!currentDisc) {
      return {
        action: 'replace',
        reason: '当前槽位为空',
        suggestedDisc: best.disc,
        expectedGain: best.expectedScore,
      };
    }

    if (!bestPositive) {
      return {
        action: 'keep',
        reason: '当前装备已是最优或接近最优'
      };
    }
    
    // 根据收益判断
    if (bestPositive.scoreGain >= 2) {
      return {
        action: 'replace',
        reason: `期望收益 +${bestPositive.scoreGain.toFixed(1)}${bestPositive.isUpgradeNeeded ? `，需从Lv${bestPositive.upgradeFrom}升级` : ''}`,
        suggestedDisc: bestPositive.disc,
        expectedGain: bestPositive.scoreGain,
      };
    } else if (bestPositive.scoreGain >= 1) {
      return {
        action: 'consider',
        reason: `期望收益 +${bestPositive.scoreGain.toFixed(1)}`,
        suggestedDisc: bestPositive.disc,
        expectedGain: bestPositive.scoreGain,
      };
    } else {
      return { 
        action: 'keep', 
        reason: '当前装备已是最优或接近最优' 
      };
    }
  }

  /**
   * 分析代理人的完整配装
   */
  analyzeAgent(
    agent: Agent,
    equippedDiscs: (DriveDisk | null)[],
    allDiscs: DriveDisk[]
  ): AgentBuildAnalysis {
    const effectiveStats = agent.effective_stats;
    const setConfig = this.detectCurrentSets(equippedDiscs);
    const setCounts = this.countSetCounts(equippedDiscs);
    const targetSetCount = setConfig.fourPieceSet
      ? equippedDiscs.filter(d => d?.game_id === setConfig.fourPieceSet).length
      : 0;
    
    // 分析每个槽位
    const slotAnalyses: SlotAnalysis[] = [];
    for (let i = 0; i < 6; i++) {
      const position = (i + 1) as DriveDiskPosition;
      const currentDisc = equippedDiscs[i];
      
      const analysis = this.analyzeSlot(
        position,
        currentDisc,
        allDiscs,
        effectiveStats,
        setConfig.fourPieceSet,
        targetSetCount,
        setCounts
      );
      slotAnalyses.push(analysis);
    }
    
    // 计算总分
    const totalCurrentScore = slotAnalyses.reduce((sum, s) => sum + s.currentScore, 0);
    const totalExpectedScore = slotAnalyses.reduce((sum, s) => sum + s.currentExpectedScore, 0);
    
    // 计算优化后的总分
    let totalOptimizedScore = 0;
    for (const analysis of slotAnalyses) {
      if (analysis.recommendation.action === 'replace') {
        const suggestedId = analysis.recommendation.suggestedDisc?.id;
        const bestCandidate = suggestedId
          ? analysis.candidates.find(c => c.disc.id === suggestedId)
          : null;
        if (bestCandidate) {
          totalOptimizedScore += bestCandidate.expectedScore;
        } else {
          totalOptimizedScore += analysis.currentExpectedScore;
        }
      } else {
        totalOptimizedScore += analysis.currentExpectedScore;
      }
    }

    const coordinatedRecommendations = this.analyzeCoordinatedReplacements(
      equippedDiscs,
      slotAnalyses,
      totalExpectedScore,
      setCounts
    );
    
    // 生成摘要建议
    const recommendations: string[] = [];
    const replaceSlots = slotAnalyses.filter(s => s.recommendation.action === 'replace');
    const considerSlots = slotAnalyses.filter(s => s.recommendation.action === 'consider');
    
    if (replaceSlots.length > 0) {
      recommendations.push(`建议替换 ${replaceSlots.map(s => s.position + '号位').join('、')}`);
    }
    if (considerSlots.length > 0) {
      recommendations.push(`可考虑替换 ${considerSlots.map(s => s.position + '号位').join('、')}`);
    }
    if (replaceSlots.length === 0 && considerSlots.length === 0) {
      recommendations.push('当前配装已接近最优');
    }
    if (coordinatedRecommendations.length > 0) {
      recommendations.push(`发现 ${coordinatedRecommendations.length} 组双槽位联动替换机会`);
    }
    
    return {
      agentId: agent.id,
      agentName: agent.name_cn,
      effectiveStats,
      setConfig,
      slotAnalyses,
      totalCurrentScore,
      totalExpectedScore,
      totalOptimizedScore,
      coordinatedRecommendations,
      recommendations,
    };
  }

  private countSetCounts(discs: (DriveDisk | null)[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const d of discs) {
      if (!d) continue;
      counts.set(d.game_id, (counts.get(d.game_id) ?? 0) + 1);
    }
    return counts;
  }

  private cloneSetCounts(setCounts: Map<string, number>): Map<string, number> {
    return new Map<string, number>(setCounts);
  }

  private applyReplacementSetCount(
    setCounts: Map<string, number>,
    oldDisc: DriveDisk | null,
    newDisc: DriveDisk
  ): void {
    if (oldDisc && oldDisc.game_id !== newDisc.game_id) {
      const oldCount = (setCounts.get(oldDisc.game_id) ?? 0) - 1;
      if (oldCount <= 0) setCounts.delete(oldDisc.game_id);
      else setCounts.set(oldDisc.game_id, oldCount);
    }
    if (!oldDisc || oldDisc.game_id !== newDisc.game_id) {
      setCounts.set(newDisc.game_id, (setCounts.get(newDisc.game_id) ?? 0) + 1);
    }
  }

  private getSetPattern(setCounts: Map<string, number>): string {
    const counts = Array.from(setCounts.values()).sort((a, b) => b - a);
    const hasFour = counts.some(c => c >= 4);
    const twoOrMore = counts.filter(c => c >= 2).length;
    if (hasFour && twoOrMore >= 2) return '4+2';
    if (hasFour) return '4+x';
    if (twoOrMore >= 3) return '2+2+2';
    if (twoOrMore === 2) return '2+2+散件';
    if (twoOrMore === 1) return '2+散件';
    return '散件';
  }

  private getSetStructureScore(setCounts: Map<string, number>): number {
    const counts = Array.from(setCounts.values());
    const hasFour = counts.some(c => c >= 4);
    const twoOrMore = counts.filter(c => c >= 2).length;
    if (hasFour && twoOrMore >= 2) return 4; // 4+2
    if (hasFour) return 3; // 4+x
    if (twoOrMore >= 3) return 2; // 2+2+2
    if (twoOrMore === 2) return 1; // 2+2
    return 0;
  }

  private getBrokenSetIds(
    before: Map<string, number>,
    after: Map<string, number>,
    threshold: number
  ): string[] {
    const broken: string[] = [];
    for (const [setId, count] of before.entries()) {
      if (count < threshold) continue;
      const afterCount = after.get(setId) ?? 0;
      if (afterCount < threshold) broken.push(setId);
    }
    return broken;
  }

  private analyzeCoordinatedReplacements(
    equippedDiscs: (DriveDisk | null)[],
    slotAnalyses: SlotAnalysis[],
    totalExpectedScore: number,
    baseSetCounts: Map<string, number>
  ): CoordinatedRecommendation[] {
    const results: CoordinatedRecommendation[] = [];
    const baseSetScore = this.getSetStructureScore(baseSetCounts);
    const basePattern = this.getSetPattern(baseSetCounts);
    const topK = 8;

    for (let i = 0; i < slotAnalyses.length; i++) {
      for (let j = i + 1; j < slotAnalyses.length; j++) {
        const slotA = slotAnalyses[i];
        const slotB = slotAnalyses[j];
        const candsA = slotA.candidates.filter(c => c.isPositiveGain).slice(0, topK);
        const candsB = slotB.candidates.filter(c => c.isPositiveGain).slice(0, topK);
        if (candsA.length === 0 || candsB.length === 0) continue;

        for (const candA of candsA) {
          for (const candB of candsB) {
            const newExpected =
              totalExpectedScore
              - slotA.currentExpectedScore
              - slotB.currentExpectedScore
              + candA.expectedScore
              + candB.expectedScore;
            const expectedGain = newExpected - totalExpectedScore;
            if (expectedGain <= 0) continue;

            const afterSetCounts = this.cloneSetCounts(baseSetCounts);
            this.applyReplacementSetCount(afterSetCounts, slotA.currentDisc, candA.disc);
            this.applyReplacementSetCount(afterSetCounts, slotB.currentDisc, candB.disc);

            const breaksFourPieceSets = this.getBrokenSetIds(baseSetCounts, afterSetCounts, 4);
            const breaksTwoPieceSets = this.getBrokenSetIds(baseSetCounts, afterSetCounts, 2);
            const afterSetScore = this.getSetStructureScore(afterSetCounts);

            results.push({
              positions: [slotA.position, slotB.position],
              discs: [candA.disc, candB.disc],
              expectedGain,
              setPatternBefore: basePattern,
              setPatternAfter: this.getSetPattern(afterSetCounts),
              breaksFourPieceSets,
              breaksTwoPieceSets,
              isSetStructureDowngrade: afterSetScore < baseSetScore,
            });
          }
        }
      }
    }

    results.sort((a, b) => {
      if (a.isSetStructureDowngrade !== b.isSetStructureDowngrade) {
        return a.isSetStructureDowngrade ? 1 : -1;
      }
      if (a.breaksFourPieceSets.length !== b.breaksFourPieceSets.length) {
        return a.breaksFourPieceSets.length - b.breaksFourPieceSets.length;
      }
      if (a.breaksTwoPieceSets.length !== b.breaksTwoPieceSets.length) {
        return a.breaksTwoPieceSets.length - b.breaksTwoPieceSets.length;
      }
      return b.expectedGain - a.expectedGain;
    });

    return results.slice(0, 12);
  }

  /**
   * 分析分解建议
   */
  analyzeDiscards(
    allDiscs: DriveDisk[],
    allAgentEffectiveStats: PropertyType[][]
  ): DiscardRecommendation[] {
    // 合并所有代理人的有效词条
    const allEffective = new Set<PropertyType>();
    for (const stats of allAgentEffectiveStats) {
      stats.forEach(s => allEffective.add(s));
    }
    
    const recommendations: DiscardRecommendation[] = [];
    
    for (const disc of allDiscs) {
      // 跳过已锁定的盘
      if (disc.locked) continue;
      
      const result = this.shouldDiscard(disc, allDiscs, [...allEffective]);
      if (result.shouldDiscard) {
        recommendations.push({
          disc,
          reason: result.reason,
          confidence: result.confidence,
        });
      }
    }
    
    return recommendations;
  }

  /**
   * 判断盘子是否应该分解
   */
  private shouldDiscard(
    disc: DriveDisk,
    allDiscs: DriveDisk[],
    allEffective: PropertyType[]
  ): { shouldDiscard: boolean; reason: string; confidence: 'high' | 'medium' | 'low' } {
    // 固定值到百分比的映射
    const flatToPercentMap: Partial<Record<PropertyType, PropertyType>> = {
      [PropertyType.ATK]: PropertyType.ATK_,
      [PropertyType.HP]: PropertyType.HP_,
      [PropertyType.DEF]: PropertyType.DEF_,
      [PropertyType.PEN]: PropertyType.PEN_,
    };

    const isEffectiveStat = (prop: PropertyType): boolean => {
      if (allEffective.includes(prop)) return true;
      const percentType = flatToPercentMap[prop];
      return percentType !== undefined && allEffective.includes(percentType);
    };
    
    // 检查主词条是否有效
    const mainStatEffective = isEffectiveStat(disc.main_stat);
    
    // 检查副词条是否有效
    const hasEffectiveSubStat = Array.from(disc.sub_stats.keys())
      .some(p => isEffectiveStat(p));
    
    // 主副词条均无效
    if (!mainStatEffective && !hasEffectiveSubStat) {
      return { 
        shouldDiscard: true, 
        reason: '主副词条均无效',
        confidence: 'high'
      };
    }
    
    // 检查支配关系：是否存在同套装、同位置、同主词条但更优的盘
    const dominated = this.findDominatingDisc(disc, allDiscs, allEffective);
    if (dominated) {
      return { 
        shouldDiscard: true, 
        reason: `被同套装同位置的更优盘完全支配`,
        confidence: 'medium'
      };
    }
    
    return { shouldDiscard: false, reason: '', confidence: 'low' };
  }

  /**
   * 查找支配当前盘的盘
   */
  private findDominatingDisc(
    disc: DriveDisk,
    allDiscs: DriveDisk[],
    effectiveStats: PropertyType[]
  ): DriveDisk | null {
    const discScore = disc.calculateExpectedMaxScore(effectiveStats);
    
    // 找同套装、同位置、同主词条的盘
    const competitors = allDiscs.filter(d =>
      d.id !== disc.id &&
      d.game_id === disc.game_id &&
      d.position === disc.position &&
      d.main_stat === disc.main_stat
    );
    
    for (const comp of competitors) {
      const compScore = comp.calculateExpectedMaxScore(effectiveStats);
      // 如果竞争者的期望得分明显更高（>=2），认为支配
      if (compScore - discScore >= 2) {
        return comp;
      }
    }
    
    return null;
  }

  /**
   * 获取盘子的简要描述
   */
  getDiscDescription(disc: DriveDisk): string {
    const mainStatName = PropertyType[disc.main_stat];
    return `${disc.set_name}/${mainStatName} Lv${disc.level}`;
  }
}

// 导出单例
export const buildAdvisorService = new BuildAdvisorService();
