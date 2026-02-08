<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body gap-4">
          <h2 class="card-title text-2xl">
            <i class="ri-settings-3-line"></i>
            配装建议
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="form-control w-full">
              <span class="label-text text-sm text-base-content/70">按名字筛选代理人</span>
              <input
                v-model="agentFilter"
                class="input input-bordered w-full"
                placeholder="输入中文名或英文名"
              >
            </label>

            <label class="form-control w-full">
              <span class="label-text text-sm text-base-content/70">选择代理人</span>
              <select v-model="selectedAgentId" class="select select-bordered w-full">
                <option value="">-- 请选择 --</option>
                <option v-for="agent in filteredAgents" :key="agent.id" :value="agent.id">
                  {{ agent.name_cn }}
                </option>
              </select>
            </label>
          </div>

          <div v-if="selectedAgent" class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-base-content/70">有效词条：</span>
            <span
              v-for="stat in selectedAgent.effective_stats"
              :key="stat"
              class="badge badge-primary badge-sm"
            >
              {{ getPropertyName(stat) }}
            </span>
            <span v-if="selectedAgent.effective_stats.length === 0" class="text-warning text-sm">
              未配置
            </span>
          </div>
        </div>
      </div>

      <div v-if="!selectedAgent" class="alert alert-info">
        <i class="ri-information-line text-xl"></i>
        <span>请选择一个代理人来分析配装建议</span>
      </div>

      <template v-if="selectedAgent && analysis">
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div class="card bg-base-100 shadow-lg xl:col-span-2">
            <div class="card-body">
              <h3 class="card-title text-lg">
                <i class="ri-stack-line"></i>
                当前套装
              </h3>
              <div class="flex flex-wrap gap-3 items-center">
                <div class="badge badge-lg badge-primary gap-1">
                  <i class="ri-number-4"></i>
                  {{ getSetName(analysis.setConfig.fourPieceSet) || '无4件套' }}
                </div>
                <div
                  v-for="setId in analysis.setConfig.twoPieceSets"
                  :key="setId"
                  class="badge badge-lg badge-secondary gap-1"
                >
                  <i class="ri-number-2"></i>
                  {{ getSetName(setId) }}
                </div>
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-lg">
            <div class="card-body">
              <h3 class="card-title text-lg">
                <i class="ri-line-chart-line"></i>
                总览
              </h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-base-content/70">当前总分</span>
                  <span class="font-semibold">{{ analysis.totalCurrentScore.toFixed(1) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/70">满级期望</span>
                  <span class="font-semibold">{{ analysis.totalExpectedScore.toFixed(1) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/70">执行替换后</span>
                  <span class="font-semibold text-success">{{ analysis.totalOptimizedScore.toFixed(1) }}</span>
                </div>
                <div class="text-xs text-base-content/60">
                  仅按“替换”建议计入，不把“考虑”当作已替换。
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-lg">
          <div class="card-body gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="card-title text-lg">
                <i class="ri-layout-grid-line"></i>
                槽位分析
              </h3>
              <div class="flex flex-wrap items-center gap-4">
                <label class="label cursor-pointer gap-2">
                  <span class="label-text">只看正提升</span>
                  <input v-model="showOnlyPositiveCandidates" type="checkbox" class="toggle toggle-success" />
                </label>
                <label class="label cursor-pointer gap-2">
                  <span class="label-text">按伤害增益排序（实验）</span>
                  <input v-model="useDamageRanking" type="checkbox" class="toggle toggle-info" />
                </label>
                <label class="label cursor-pointer gap-2">
                  <span class="label-text">显示破4件套候选</span>
                  <input v-model="showFourPieceBreakingCandidates" type="checkbox" class="toggle toggle-warning" />
                </label>
              </div>
            </div>

            <div class="tabs tabs-boxed w-full overflow-x-auto">
              <button
                v-for="slot in analysis.slotAnalyses"
                :key="slot.position"
                class="tab"
                :class="{ 'tab-active': activeSlot === slot.position }"
                @click="activeSlot = slot.position"
              >
                {{ slot.position }}号位
                <span
                  class="ml-1 text-xs"
                  :class="getDisplayRecommendation(slot).action === 'replace' ? 'text-success' : getDisplayRecommendation(slot).action === 'consider' ? 'text-warning' : 'text-base-content/60'"
                >
                  {{ getDisplayRecommendation(slot).action === 'replace' ? '建议换' : getDisplayRecommendation(slot).action === 'consider' ? '可考虑' : '保留' }}
                </span>
              </button>
            </div>

            <div v-if="activeSlotAnalysis" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div class="card bg-base-200 lg:col-span-1">
                <div class="card-body p-4">
                  <div class="text-xs text-base-content/70">当前装备</div>
                  <div v-if="activeSlotAnalysis.currentDisc" class="space-y-1">
                    <div class="font-semibold">{{ activeSlotAnalysis.currentDisc.set_name }}</div>
                    <div class="text-sm text-base-content/70">
                      {{ getPropertyName(activeSlotAnalysis.currentDisc.main_stat) }} Lv{{ activeSlotAnalysis.currentDisc.level }}
                    </div>
                    <div class="text-sm">当前有效词条: {{ activeSlotAnalysis.currentScore.toFixed(1) }}</div>
                    <div class="text-sm">满级期望词条: {{ activeSlotAnalysis.currentExpectedScore.toFixed(1) }}</div>
                  </div>
                  <div v-else class="text-base-content/60">当前槽位为空</div>

                  <div class="divider my-2"></div>

                  <div class="badge"
                    :class="getDisplayRecommendation(activeSlotAnalysis).action === 'replace' ? 'badge-success' : getDisplayRecommendation(activeSlotAnalysis).action === 'consider' ? 'badge-warning' : 'badge-ghost'"
                  >
                    {{ getActionLabel(getDisplayRecommendation(activeSlotAnalysis).action) }}
                  </div>
                  <div class="text-sm text-base-content/80">{{ getDisplayRecommendation(activeSlotAnalysis).reason }}</div>
                  <div v-if="getDisplayRecommendation(activeSlotAnalysis).expectedGain" class="text-sm text-success font-semibold">
                    +{{ getDisplayRecommendation(activeSlotAnalysis).expectedGain!.toFixed(1) }} 条
                  </div>
                </div>
              </div>

              <div class="lg:col-span-2 space-y-3">
                <div
                  v-if="!showFourPieceBreakingCandidates && hiddenBreakingCandidateCount > 0"
                  class="alert alert-warning"
                >
                  <i class="ri-alert-line"></i>
                  <span>已默认隐藏 {{ hiddenBreakingCandidateCount }} 条破4件套候选，可打开“显示破4件套候选”查看。</span>
                </div>
                <div v-if="useDamageRanking && isDamageRankingRunning" class="alert alert-info">
                  <i class="ri-loader-4-line animate-spin"></i>
                  <span>正在计算当前槽位候选的伤害增益排序...</span>
                </div>

                <div v-if="filteredCandidates.length === 0" class="alert alert-info">
                  <i class="ri-information-line"></i>
                  <span>{{ showOnlyPositiveCandidates ? '当前没有正提升候选盘' : '当前没有候选盘' }}</span>
                </div>

                <div
                  v-for="candidate in filteredCandidates"
                  :key="candidate.disc.id"
                  class="p-4 border rounded-xl bg-base-100"
                  :class="candidate.isPositiveGain ? 'border-success/40' : 'border-base-300'"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div class="font-semibold flex items-center gap-2 flex-wrap">
                        <span>{{ candidate.disc.set_name }}</span>
                        <span v-if="candidate.matchesTargetSet" class="badge badge-primary badge-xs">目标套装</span>
                        <span v-if="candidate.breaksFourPieceSet" class="badge badge-warning badge-xs">⚠️ 破4件套</span>
                        <span v-if="candidate.breaksTwoPieceSets.length > 0" class="badge badge-warning badge-xs">⚠️ 破2件套</span>
                      </div>
                      <div class="text-sm text-base-content/70">
                        {{ getPropertyName(candidate.disc.main_stat) }} Lv{{ candidate.disc.level }}
                      </div>
                      <div class="text-xs text-base-content/60 mt-1">
                        有效副词条 {{ candidate.effectiveSubStats }} 条
                      </div>
                    </div>

                    <div class="text-right text-sm">
                      <div v-if="useDamageRanking">
                        伤害增益:
                        <span :class="getDamageGainClass(candidate.disc.id)">
                          {{ formatDamageGain(candidate.disc.id) }}
                        </span>
                      </div>
                      <div>
                        增益:
                        <span :class="candidate.isPositiveGain ? 'text-success font-semibold' : 'text-base-content/60'">
                          {{ candidate.scoreGain >= 0 ? '+' : '' }}{{ candidate.scoreGain.toFixed(1) }}
                        </span>
                      </div>
                      <div>期望: <span class="font-semibold">{{ candidate.expectedScore.toFixed(1) }}</span></div>
                      <div class="text-xs text-base-content/60">
                        乐观 {{ candidate.optimisticScore.toFixed(1) }} / 悲观 {{ candidate.pessimisticScore.toFixed(1) }}
                      </div>
                      <div class="text-xs" :class="getRiskClass(candidate)">
                        风险: {{ getRiskLabel(candidate) }}
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 flex justify-end">
                    <button
                      class="btn btn-sm btn-primary"
                      @click="equipDiscById(candidate.disc.id)"
                    >
                      替换到{{ activeSlotAnalysis.position }}号位
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-lg">
          <div class="card-body gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="card-title text-lg">
                <i class="ri-links-line"></i>
                联动替换建议（双槽位）
              </h3>
              <label class="label cursor-pointer gap-2">
                <span class="label-text">显示破套/降级组合</span>
                <input v-model="showSetBreakingCombos" type="checkbox" class="toggle toggle-warning" />
              </label>
            </div>

            <div v-if="!showSetBreakingCombos && hiddenSetBreakingComboCount > 0" class="alert alert-warning">
              <i class="ri-alert-line"></i>
              <span>已隐藏 {{ hiddenSetBreakingComboCount }} 组破套或套装结构降级组合。</span>
            </div>

            <div v-if="filteredCoordinatedRecommendations.length === 0" class="alert alert-info">
              <i class="ri-information-line"></i>
              <span>当前没有满足条件的双槽位联动替换方案。</span>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="combo in filteredCoordinatedRecommendations"
                :key="`${combo.positions[0]}-${combo.positions[1]}-${combo.discs[0].id}-${combo.discs[1].id}`"
                class="p-4 border rounded-xl bg-base-100 border-base-300"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="space-y-1">
                    <div class="font-semibold">
                      {{ combo.positions[0] }}号位 → {{ combo.discs[0].set_name }} / {{ getPropertyName(combo.discs[0].main_stat) }}
                    </div>
                    <div class="font-semibold">
                      {{ combo.positions[1] }}号位 → {{ combo.discs[1].set_name }} / {{ getPropertyName(combo.discs[1].main_stat) }}
                    </div>
                    <div class="text-xs text-base-content/60">
                      套装结构：{{ combo.setPatternBefore }} → {{ combo.setPatternAfter }}
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <span v-if="combo.breaksFourPieceSets.length > 0" class="badge badge-warning badge-xs">⚠️ 破4件套</span>
                      <span v-if="combo.breaksTwoPieceSets.length > 0" class="badge badge-warning badge-xs">⚠️ 破2件套</span>
                      <span v-if="combo.isSetStructureDowngrade" class="badge badge-error badge-xs">套装结构降级</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm text-base-content/70">联动期望增益</div>
                    <div class="text-lg font-semibold text-success">+{{ combo.expectedGain.toFixed(1) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-lg">
              <i class="ri-lightbulb-line"></i>
              优化建议摘要
            </h3>
            <div class="space-y-2 text-sm">
              <p v-for="(rec, idx) in analysis.recommendations" :key="idx" class="flex items-center gap-2">
                <i class="ri-arrow-right-s-line text-primary"></i>
                {{ rec }}
              </p>
            </div>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-100 shadow-lg">
          <input type="checkbox" />
          <div class="collapse-title text-lg font-medium">
            <i class="ri-delete-bin-line mr-2"></i>
            分解建议 ({{ discardRecommendations.length }})
          </div>
          <div class="collapse-content">
            <div v-if="discardRecommendations.length === 0" class="text-base-content/70">
              没有需要分解的盘子
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="rec in discardRecommendations"
                :key="rec.disc.id"
                class="flex items-center gap-4 p-2 rounded bg-base-200"
              >
                <div class="flex-1">
                  <div class="font-medium">{{ rec.disc.set_name }}</div>
                  <div class="text-sm text-base-content/70">
                    {{ rec.disc.position }}号位 / {{ getPropertyName(rec.disc.main_stat) }} Lv{{ rec.disc.level }}
                  </div>
                </div>
                <div class="text-sm text-error">{{ rec.reason }}</div>
                <div
                  class="badge"
                  :class="{
                    'badge-error': rec.confidence === 'high',
                    'badge-warning': rec.confidence === 'medium',
                    'badge-ghost': rec.confidence === 'low',
                  }"
                >
                  {{ rec.confidence === 'high' ? '强烈建议' : rec.confidence === 'medium' ? '建议' : '可考虑' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSaveStore } from '../stores/save.store';
import { useGameDataStore } from '../stores/game-data.store';
import {
  buildAdvisorService,
  type AgentBuildAnalysis,
  type SlotAnalysis,
  type DiscardRecommendation,
  type CandidateDisc,
  type CoordinatedRecommendation,
} from '../services/build-advisor.service';
import { PropertyType, getPropertyCnName } from '../model/base';
import type { DriveDiskPosition, DriveDisk } from '../model/drive-disk';
import { BattleService } from '../services/battle.service';
import { Enemy } from '../model/enemy';
import { OptimizerContext, type SkillParams } from '../optimizer/services/optimizer-context';
import { optimizerService } from '../optimizer/services/optimizer.service';
import type { DiscData, PrecomputedData } from '../optimizer/types/precomputed';
import type { OptimizationConstraints } from '../optimizer/types';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

const selectedAgentId = ref('');
const agentFilter = ref('');
const activeSlot = ref<DriveDiskPosition>(1 as DriveDiskPosition);
const showOnlyPositiveCandidates = ref(true);
const useDamageRanking = ref(true);
const showFourPieceBreakingCandidates = ref(false);
const showSetBreakingCombos = ref(false);
const isDamageRankingRunning = ref(false);
const candidateDamageGainMap = ref<Record<string, number | null>>({});
const currentBuildDamage = ref<number | null>(null);
const damageRankRequestId = ref(0);
const damageContext = ref<{ precomputed: PrecomputedData; discMap: Map<string, DiscData> } | null>(null);

const analysis = ref<AgentBuildAnalysis | null>(null);
const discardRecommendations = ref<DiscardRecommendation[]>([]);

const agents = computed(() => saveStore.agents);

const filteredAgents = computed(() => {
  const keyword = agentFilter.value.trim().toLowerCase();
  if (!keyword) return agents.value;
  return agents.value.filter(a =>
    a.name_cn.toLowerCase().includes(keyword) ||
    a.name_en.toLowerCase().includes(keyword)
  );
});

const selectedAgent = computed(() => {
  return agents.value.find(a => a.id === selectedAgentId.value) || null;
});

const activeSlotAnalysis = computed<SlotAnalysis | null>(() => {
  if (!analysis.value) return null;
  return analysis.value.slotAnalyses.find(s => s.position === activeSlot.value)
    ?? analysis.value.slotAnalyses[0]
    ?? null;
});

const filteredCandidates = computed<CandidateDisc[]>(() => {
  const slot = activeSlotAnalysis.value;
  if (!slot) return [];

  let list = slot.candidates;
  if (showOnlyPositiveCandidates.value) {
    list = list.filter(c => c.isPositiveGain);
  }
  if (!showFourPieceBreakingCandidates.value) {
    list = list.filter(c => !c.breaksFourPieceSet);
  }

  let sorted = [...list];
  if (useDamageRanking.value) {
    sorted.sort((a, b) => {
      const gainA = candidateDamageGainMap.value[a.disc.id];
      const gainB = candidateDamageGainMap.value[b.disc.id];
      const va = gainA ?? -Infinity;
      const vb = gainB ?? -Infinity;
      if (va !== vb) return vb - va;
      return b.scoreGain - a.scoreGain;
    });
  }

  return sorted.slice(0, 30);
});

const hiddenBreakingCandidateCount = computed(() => {
  const slot = activeSlotAnalysis.value;
  if (!slot || showFourPieceBreakingCandidates.value) return 0;

  let list = slot.candidates;
  if (showOnlyPositiveCandidates.value) {
    list = list.filter(c => c.isPositiveGain);
  }

  return list.filter(c => c.breaksFourPieceSet).length;
});

const filteredCoordinatedRecommendations = computed<CoordinatedRecommendation[]>(() => {
  if (!analysis.value) return [];
  let list = analysis.value.coordinatedRecommendations;
  if (!showSetBreakingCombos.value) {
    list = list.filter(c =>
      !c.isSetStructureDowngrade &&
      c.breaksFourPieceSets.length === 0 &&
      c.breaksTwoPieceSets.length === 0
    );
  }
  return list.slice(0, 8);
});

const hiddenSetBreakingComboCount = computed(() => {
  if (!analysis.value || showSetBreakingCombos.value) return 0;
  return analysis.value.coordinatedRecommendations.filter(c =>
    c.isSetStructureDowngrade ||
    c.breaksFourPieceSets.length > 0 ||
    c.breaksTwoPieceSets.length > 0
  ).length;
});

function getPropertyName(prop: PropertyType): string {
  return getPropertyCnName(prop);
}

function getSetName(setId: string | null): string {
  if (!setId) return '';
  const disc = saveStore.driveDisks.find(d => d.game_id === setId);
  return disc?.set_name || setId;
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'keep': return '保留';
    case 'replace': return '替换';
    case 'consider': return '考虑';
    default: return action;
  }
}

function getRiskLabel(candidate: CandidateDisc): string {
  const gap = candidate.expectedScore - candidate.pessimisticScore;
  if (gap >= 2) return '高';
  if (gap >= 1) return '中';
  return '低';
}

function getRiskClass(candidate: CandidateDisc): string {
  const risk = getRiskLabel(candidate);
  if (risk === '高') return 'text-warning';
  if (risk === '中') return 'text-info';
  return 'text-base-content/60';
}

function getVisibleCandidates(slot: SlotAnalysis): CandidateDisc[] {
  let list = slot.candidates;
  if (showOnlyPositiveCandidates.value) {
    list = list.filter(c => c.isPositiveGain);
  }
  if (!showFourPieceBreakingCandidates.value) {
    list = list.filter(c => !c.breaksFourPieceSet);
  }
  return list;
}

function getDisplayRecommendation(slot: SlotAnalysis): {
  action: 'keep' | 'replace' | 'consider';
  reason: string;
  expectedGain?: number;
} {
  const visible = getVisibleCandidates(slot);
  if (visible.length === 0) {
    if (showOnlyPositiveCandidates.value) {
      return { action: 'keep', reason: '按当前筛选条件无正提升候选' };
    }
    return { action: 'keep', reason: '按当前筛选条件无可替换候选' };
  }
  const best = visible[0];
  if (best.scoreGain >= 2) {
    return {
      action: 'replace',
      reason: `期望收益 +${best.scoreGain.toFixed(1)}${best.isUpgradeNeeded ? `，需从Lv${best.upgradeFrom}升级` : ''}`,
      expectedGain: best.scoreGain,
    };
  }
  if (best.scoreGain >= 1) {
    return {
      action: 'consider',
      reason: `期望收益 +${best.scoreGain.toFixed(1)}`,
      expectedGain: best.scoreGain,
    };
  }
  return { action: 'keep', reason: '当前装备已是最优或接近最优' };
}

function formatDamageGain(discId: string): string {
  const gain = candidateDamageGainMap.value[discId];
  if (gain === null || gain === undefined) return '--';
  const sign = gain >= 0 ? '+' : '';
  return `${sign}${gain.toFixed(0)}`;
}

function getDamageGainClass(discId: string): string {
  const gain = candidateDamageGainMap.value[discId];
  if (gain === null || gain === undefined) return 'text-base-content/50';
  return gain >= 0 ? 'text-success font-semibold' : 'text-error';
}

function getAgentSkills(agent: (typeof agents.value)[number]): Array<{ key: string; name: string; type: string; defaultRatio: number; defaultAnomaly: number }> {
  if (!agent.skillSet) return [];

  const options: Array<{ key: string; name: string; type: string; defaultRatio: number; defaultAnomaly: number }> = [];
  const skillCategories = [
    { skills: agent.skillSet.basic, type: 'normal' },
    { skills: agent.skillSet.dodge, type: 'dodge' },
    { skills: agent.skillSet.special, type: 'special' },
    { skills: agent.skillSet.chain, type: 'chain' },
    { skills: agent.skillSet.assist, type: 'assist' },
  ];

  for (const { skills, type } of skillCategories) {
    for (const skill of skills) {
      let ratio = 0;
      let anomaly = 0;
      for (const segment of skill.segments) {
        ratio += segment.damageRatio;
        anomaly += segment.anomalyBuildup || 0;
      }
      options.push({
        key: skill.name,
        name: skill.name,
        type,
        defaultRatio: ratio,
        defaultAnomaly: anomaly,
      });
    }
  }
  return options;
}

async function buildDamageEvalContext(
  agent: (typeof agents.value)[number],
  equippedDiscs: (DriveDisk | null)[],
  sourceDiscs: DriveDisk[]
): Promise<{ precomputed: PrecomputedData; discMap: Map<string, DiscData> } | null> {
  await agent.ensureDetailsLoaded();
  await agent.ensureEquippedDetailsLoaded();
  for (const disc of sourceDiscs) {
    await disc.ensureDetailsLoaded();
  }

  const team = saveStore.teams.find(t => t.allAgents.some(a => a.id === agent.id));
  if (!team) return null;

  const localBattleService = new BattleService();
  await localBattleService.setTeam(team);

  const customBuffs = saveStore.getTeamCustomBuffs(team.id);
  localBattleService.clearManualBuffs();
  for (const customBuff of customBuffs) {
    if (customBuff.isActive) {
      localBattleService.addManualBuff(BattleService.createBuffFromCustomBuff(customBuff));
    }
  }

  const selectedEnemyId = team.optimizationConfig?.selectedEnemyId || '';
  const enemyInfo = (gameDataStore.allEnemies || []).find(e => e.id === selectedEnemyId);
  const enemy = enemyInfo
    ? Enemy.fromGameData(enemyInfo)
    : new Enemy('mock_dulahan', '杜拉罕', 'Dulahan', 1000000, 1000, 953, 100, true);
  if (!enemyInfo) enemy.physical_dmg_resistance = -0.2;
  localBattleService.setEnemy(enemy);

  const availableSkills = getAgentSkills(agent);
  const selectedSkillKeys = agent.selected_skill_keys?.length
    ? [...agent.selected_skill_keys]
    : [availableSkills[0]?.key].filter(Boolean) as string[];
  const countMap = new Map<string, number>();
  for (const key of selectedSkillKeys) {
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }
  const skills = availableSkills
    .filter(skill => countMap.has(skill.key))
    .map(skill => ({
      ...skill,
      count: countMap.get(skill.key) ?? 1,
    }));

  if (skills.length === 0) return null;

  const skillParams: SkillParams[] = skills.map(skill => ({
    id: skill.key || 'default',
    name: skill.name || '默认技能',
    element: agent.element,
    ratio: (skill.defaultRatio || 1) * (skill.count ?? 1),
    tags: [skill.type || 'normal'],
    isPenetration: agent.isPenetrationAgent?.() || false,
    anomalyBuildup: (skill.defaultAnomaly || 0) * (skill.count ?? 1),
  }));

  const constraints: OptimizationConstraints = {
    mainStatFilters: agent.main_stat_filters || {},
    requiredSets: [],
    pinnedSlots: {},
    targetSetId: '',
    targetFourPieceSetId: '',
    targetTwoPieceSetIds: [],
    objective: agent.objective || 'skill',
    effectiveStatPruning: {
      effectiveStats: [...(agent.effective_stats || [])],
      mainStatScore: 10,
    },
  };

  const { self, teammate } = localBattleService.getOptimizerEvaluatorBuffs();
  const request = await OptimizerContext.buildFastRequest({
    agent,
    weapon: saveStore.wengines.find(w => w.id === agent.equipped_wengine) || null,
    skills: skillParams,
    enemy: localBattleService.getEnemy() || enemy,
    enemySerialized: localBattleService.getSerializedEnemy(60) ?? undefined,
    enemyLevel: 60,
    isStunned: localBattleService.getIsEnemyStunned(),
    hasCorruptionShield: localBattleService.getEnemyHasCorruptionShield(),
    discs: sourceDiscs,
    constraints,
    externalBuffs: [...self, ...teammate],
    buffStatusMap: localBattleService.getBuffStatusMap(),
  });

  const discMap = new Map<string, DiscData>();
  for (const slotDiscs of request.precomputed.discsBySlot) {
    for (const d of slotDiscs) {
      discMap.set(d.id, d);
    }
  }

  // 保证当前已装备盘都可映射（防止由于预筛选丢失）
  for (const d of equippedDiscs) {
    if (d && !discMap.has(d.id)) {
      return null;
    }
  }

  return { precomputed: request.precomputed, discMap };
}

async function evaluateBuildDamage(
  context: { precomputed: PrecomputedData; discMap: Map<string, DiscData> },
  discIds: string[]
): Promise<number | null> {
  const discData: DiscData[] = [];
  for (const id of discIds) {
    const d = context.discMap.get(id);
    if (!d) return null;
    discData.push(d);
  }
  const result = await optimizerService.evalOnceInWorker(context.precomputed, discData);
  return Number.isFinite(result.damage) ? result.damage : null;
}

async function rerankActiveSlotCandidatesByDamage() {
  const slot = activeSlotAnalysis.value;
  const agent = selectedAgent.value;
  const localAnalysis = analysis.value;
  if (!slot || !agent || !localAnalysis || !useDamageRanking.value) {
    candidateDamageGainMap.value = {};
    currentBuildDamage.value = null;
    return;
  }

  const requestId = ++damageRankRequestId.value;
  isDamageRankingRunning.value = true;

  try {
    const equippedDiscs = localAnalysis.slotAnalyses.map(s => s.currentDisc);
    const equippedDiscIds = equippedDiscs.map(d => d?.id || '');
    if (equippedDiscIds.some(id => !id)) {
      candidateDamageGainMap.value = {};
      currentBuildDamage.value = null;
      return;
    }

    const candidatePool = new Map<string, DriveDisk>();
    for (const d of equippedDiscs) {
      if (d) candidatePool.set(d.id, d);
    }
    for (const s of localAnalysis.slotAnalyses) {
      for (const c of s.candidates.slice(0, 20)) {
        candidatePool.set(c.disc.id, c.disc);
      }
    }
    const sourceDiscs = [...candidatePool.values()];

    if (!damageContext.value) {
      damageContext.value = await buildDamageEvalContext(agent, equippedDiscs, sourceDiscs);
    }
    const context = damageContext.value;
    if (!context) {
      candidateDamageGainMap.value = {};
      currentBuildDamage.value = null;
      return;
    }

    const baseDamage = await evaluateBuildDamage(context, equippedDiscIds as string[]);
    if (requestId !== damageRankRequestId.value) return;
    currentBuildDamage.value = baseDamage;

    const slotIdx = slot.position - 1;
    const cands = slot.candidates
      .filter(c => (!showOnlyPositiveCandidates.value || c.isPositiveGain) && (showFourPieceBreakingCandidates.value || !c.breaksFourPieceSet))
      .slice(0, 20);

    const resultMap: Record<string, number | null> = {};
    for (const candidate of cands) {
      const candidateIds = [...equippedDiscIds];
      candidateIds[slotIdx] = candidate.disc.id;
      const dmg = await evaluateBuildDamage(context, candidateIds as string[]);
      resultMap[candidate.disc.id] = (baseDamage !== null && dmg !== null) ? (dmg - baseDamage) : null;
    }
    if (requestId !== damageRankRequestId.value) return;
    candidateDamageGainMap.value = resultMap;
  } catch (err) {
    console.error('[BuildAdvisor] damage rerank failed:', err);
    candidateDamageGainMap.value = {};
    currentBuildDamage.value = null;
  } finally {
    if (requestId === damageRankRequestId.value) {
      isDamageRankingRunning.value = false;
    }
  }
}

async function runAnalysis() {
  if (!selectedAgent.value) return;

  damageContext.value = null;
  candidateDamageGainMap.value = {};
  currentBuildDamage.value = null;

  const equippedDiscs = selectedAgent.value.equipped_drive_disks.map(discId => {
    if (!discId) return null;
    return saveStore.driveDisks.find(d => d.id === discId) || null;
  });

  analysis.value = buildAdvisorService.analyzeAgent(
    selectedAgent.value,
    equippedDiscs,
    saveStore.driveDisks
  );

  const allEffectiveStats = agents.value
    .filter(a => a.effective_stats.length > 0)
    .map(a => a.effective_stats);

  discardRecommendations.value = buildAdvisorService.analyzeDiscards(
    saveStore.driveDisks,
    allEffectiveStats
  );

  await rerankActiveSlotCandidatesByDamage();
}

async function equipDiscById(discId: string) {
  if (!selectedAgent.value) return;
  await saveStore.equipDriveDisk(selectedAgent.value.id, discId);
  await runAnalysis();
}

watch(selectedAgentId, () => {
  if (!selectedAgent.value) {
    analysis.value = null;
    discardRecommendations.value = [];
    damageContext.value = null;
    candidateDamageGainMap.value = {};
    currentBuildDamage.value = null;
    return;
  }
  runAnalysis();
});

watch(analysis, () => {
  const first = analysis.value?.slotAnalyses[0]?.position;
  const exists = analysis.value?.slotAnalyses.some(s => s.position === activeSlot.value);
  if (!exists && first) activeSlot.value = first;
});

watch(
  [activeSlot, showOnlyPositiveCandidates, showFourPieceBreakingCandidates, useDamageRanking],
  () => {
    rerankActiveSlotCandidatesByDamage();
  }
);
</script>

<style scoped>
</style>
