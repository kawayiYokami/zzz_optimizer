<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-7xl mx-auto space-y-6">

      <!-- Navbar -->
      <div class="navbar bg-base-100 rounded-box shadow-sm">
        <div class="flex-1">
          <a class="btn btn-ghost text-xl">装备优化器 (Beta)</a>
        </div>
        <div class="flex-none gap-2">
          <div class="badge badge-info gap-2">
            组合数: {{ formatCompact(estimatedCombinations.total) }}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- 配置面板 -->
        <div class="lg:col-span-1 space-y-4">

          <!-- 队伍选择 -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="font-bold text-sm">队伍选择</h3>
              <select class="select select-bordered select-sm w-full" v-model="selectedTeamId" @change="onTeamChange">
                <option disabled value="">请选择队伍...</option>
                <option v-for="team in teams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </select>

              <!-- 目标角色选择 -->
              <div v-if="currentTeam" class="flex gap-2 mt-2">
                <button
                  v-for="agent in currentTeam.allAgents"
                  :key="agent.id"
                  class="btn btn-sm flex-1"
                  :class="targetAgentId === agent.id ? 'btn-primary' : 'btn-ghost'"
                  @click="selectTargetAgent(agent.id)"
                >
                  {{ agent.name_cn || agent.id }}
                </button>
              </div>
            </div>
          </div>

          <!-- 武器显示（使用角色已装备的武器） -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="font-bold text-sm">武器（来自角色装备）</h3>
              <div class="mt-2 p-2 bg-base-200 rounded" v-if="equippedWeapon">
                <span class="font-medium">{{ equippedWeapon.name }}</span>
                <span class="text-xs text-base-content/60 ml-2">
                  Lv.{{ equippedWeapon.level }} R{{ equippedWeapon.refinement }}
                </span>
              </div>
              <div class="mt-2 text-warning text-sm" v-else>
                ⚠️ 角色未装备武器
              </div>
            </div>
          </div>

          <!-- 有效词条 -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="font-bold text-sm">有效词条</h3>
              <div class="flex flex-wrap gap-1 mt-2">
                <label
                  v-for="stat in effectiveStatOptions"
                  :key="stat.value"
                  class="cursor-pointer"
                >
                  <input
                    type="checkbox"
                    class="hidden"
                    :checked="constraints.effectiveStatPruning?.effectiveStats.includes(stat.value)"
                    @change="toggleEffectiveStat(stat.value)"
                  />
                  <span
                    class="badge badge-sm"
                    :class="constraints.effectiveStatPruning?.effectiveStats.includes(stat.value) ? 'badge-primary' : 'badge-ghost'"
                  >
                    {{ stat.label }}
                  </span>
                </label>
              </div>
              <div class="text-xs text-base-content/60 mt-2">
                选中词条计入有效得分，用于智能剪枝
              </div>
            </div>
          </div>

          <!-- 计算设置 -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="font-bold text-sm">计算设置</h3>
              <div class="space-y-3 mt-2">
                <!-- Worker 数量 -->
                <div class="flex items-center justify-between">
                  <span class="text-sm">Worker 数量</span>
                  <select class="select select-bordered select-xs w-20" v-model.number="workerCount">
                    <option v-for="n in 16" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <!-- 驱动盘等级 -->
                <div class="flex items-center justify-between">
                  <span class="text-sm">驱动盘最低等级</span>
                  <select class="select select-bordered select-xs w-20" v-model.number="minDiscLevel">
                    <option v-for="n in 16" :key="n - 1" :value="n - 1">{{ n - 1 }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 预设管理 -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-sm">预设配置</h3>
                <button class="btn btn-xs btn-primary" @click="saveCurrentPreset">保存</button>
              </div>
              <div class="flex flex-wrap gap-1 mt-2">
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  class="btn btn-xs btn-ghost"
                  @click="loadPreset(preset)"
                >
                  {{ preset.name }}
                </button>
              </div>
            </div>
          </div>

          <!-- 技能配置 -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="font-bold text-sm">技能配置</h3>
              <select class="select select-bordered select-sm w-full mt-2" v-model="selectedSkillKey">
                <option value="">选择技能...</option>
                <option v-for="skill in availableSkills" :key="skill.key" :value="skill.key">
                  {{ skill.name }} ({{ (skill.defaultRatio * 100).toFixed(0) }}%)
                </option>
              </select>
            </div>
          </div>

          <!-- 组合数预估 -->
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="font-bold text-sm">组合数明细</h3>
              <div class="text-xs space-y-1 mt-2">
                <!-- 剪枝统计 -->
                <div v-if="pruningStats.removed > 0" class="flex justify-between text-success">
                  <span>支配剪枝:</span>
                  <span class="font-mono">{{ pruningStats.before }} → {{ pruningStats.after }} (-{{ pruningStats.removed }})</span>
                </div>
                <div v-for="slot in [1,2,3,4,5,6]" :key="slot" class="flex justify-between">
                  <span>位置 {{ slot }}:</span>
                  <span class="font-mono">{{ estimatedCombinations.breakdown[`slot${slot}`] || 0 }}</span>
                </div>
                <div class="divider my-1"></div>
                <div class="flex justify-between font-bold">
                  <span>总计:</span>
                  <span class="font-mono text-primary">{{ formatCompact(estimatedCombinations.total) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 启动按钮 -->
          <button
            class="btn btn-primary w-full"
            :disabled="!canStart || isRunning"
            @click="startOptimization"
          >
            <span v-if="isRunning" class="loading loading-spinner loading-sm"></span>
            {{ isRunning ? '正在计算...' : '开始优化' }}
          </button>
          <button
            v-if="isRunning"
            class="btn btn-error w-full"
            @click="cancelOptimization"
          >
            取消
          </button>

          <!-- 进度条 -->
          <div v-if="isRunning || progress" class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <div class="flex justify-between text-xs mb-1">
                <span>进度</span>
                <span>{{ progressPercentage.toFixed(1) }}%</span>
              </div>
              <progress class="progress progress-primary w-full" :value="progressPercentage" max="100"></progress>
              <div class="grid grid-cols-3 gap-2 mt-2 text-center">
                <div>
                  <div class="text-xs text-base-content/60">已处理</div>
                  <div class="text-sm font-bold">{{ formatCompact(progress?.totalProcessed || 0) }}</div>
                </div>
                <div>
                  <div class="text-xs text-base-content/60">速度</div>
                  <div class="text-sm font-bold">{{ formatCompact(progress?.speed || 0) }}/s</div>
                </div>
                <div>
                  <div class="text-xs text-base-content/60">剩余</div>
                  <div class="text-sm font-bold">{{ formatTime(progress?.estimatedTimeRemaining || 0) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 结果展示 -->
        <div class="lg:col-span-2">
          <div class="card bg-base-100 shadow-sm min-h-[600px]">
            <div class="card-body">
              <h2 class="card-title flex justify-between items-center">
                <span>优化结果</span>
                <span class="text-sm font-normal text-base-content/70" v-if="results.length">
                  Top {{ results.length }} / 耗时 {{ (totalTime / 1000).toFixed(2) }}s
                </span>
              </h2>

              <div v-if="results.length === 0 && !isRunning" class="flex flex-col items-center justify-center h-96 text-base-content/50">
                <div class="text-6xl mb-4">📊</div>
                <p>请在左侧配置并开始优化</p>
              </div>

              <div v-else-if="results.length === 0 && isRunning" class="flex flex-col items-center justify-center h-96 text-base-content/50">
                <span class="loading loading-dots loading-lg"></span>
                <p class="mt-4">Worker 正在计算中...</p>
              </div>

              <!-- 结果列表 -->
              <div v-else class="overflow-x-auto">
                <table class="table table-zebra table-sm w-full">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>套装</th>
                      <th>属性</th>
                      <th class="text-right">伤害</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="(build, index) in results" :key="index">
                      <tr class="hover cursor-pointer" @click="toggleBuildDetails(index)">
                        <th class="text-center">{{ index + 1 }}</th>
                        <td>
                          <div class="flex flex-wrap gap-1">
                            <span v-if="build.setBonusInfo.fourPieceSet" class="badge badge-primary badge-xs">
                              4{{ getSetName(build.setBonusInfo.fourPieceSet) }}
                            </span>
                            <span v-for="setId in build.setBonusInfo.twoPieceSets" :key="setId" class="badge badge-outline badge-xs">
                              2{{ getSetName(setId) }}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div class="text-xs space-x-2">
                            <span>CR: {{ ((build.finalStats[20103] || 0) * 100).toFixed(1) }}%</span>
                            <span>CD: {{ ((build.finalStats[21103] || 0) * 100).toFixed(1) }}%</span>
                          </div>
                        </td>
                        <td class="text-right">
                          <div class="font-mono font-bold text-primary">{{ Math.round(build.damage).toLocaleString() }}</div>
                        </td>
                        <td>
                          <button class="btn btn-xs btn-ghost">
                            {{ expandedBuildIndex === index ? '收起' : '详情' }}
                          </button>
                        </td>
                      </tr>
                      <!-- 展开的驱动盘详情 -->
                      <tr v-if="expandedBuildIndex === index">
                        <td colspan="5" class="bg-base-200 p-4">
                          <div class="grid grid-cols-6 gap-2">
                            <div v-for="(discId, slot) in build.discIds" :key="slot" class="card bg-base-100 shadow-sm p-2">
                              <div class="text-xs font-bold text-center mb-1">位置 {{ slot + 1 }}</div>
                              <template v-if="getDiscInfo(discId)">
                                <div class="text-xs text-center text-primary">{{ getDiscInfo(discId)?.set_name }}</div>
                                <div class="divider my-1"></div>
                                <div class="text-xs">
                                  <span class="font-bold">{{ formatStatName(getDiscInfo(discId)?.main_stat) }}</span>
                                </div>
                                <div class="text-xs text-base-content/60 mt-1">
                                  <div v-for="[stat, value] in getDiscInfo(discId)?.sub_stats || []" :key="stat" class="truncate">
                                    {{ formatStatName(stat) }}
                                  </div>
                                </div>
                              </template>
                              <template v-else>
                                <div class="text-xs text-error">未找到</div>
                              </template>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSaveStore } from '../stores/save.store';
import { useGameDataStore } from '../stores/game-data.store';
import {
  optimizerService,
  type AggregatedProgress,
  type AggregatedResult,
  type OptimizationBuild
} from '../optimizer/services';
import { OptimizerContext } from '../optimizer/services/optimizer-context';
import type { OptimizationConstraints, OptimizationPreset } from '../optimizer/types';
import { PropertyType } from '../model/base';
import { Enemy } from '../model/enemy';
import type { Team } from '../model/team';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// 状态
const selectedTeamId = ref('');
const targetAgentId = ref('');
const selectedSkillKey = ref('');
const isRunning = ref(false);
const progress = ref<AggregatedProgress | null>(null);
const results = ref<OptimizationBuild[]>([]);
const totalTime = ref(0);
const presets = ref<OptimizationPreset[]>([]);
const workerCount = ref(Math.max(1, navigator.hardwareConcurrency - 1));
const minDiscLevel = ref(15); // 默认只用15级盘
const expandedBuildIndex = ref<number | null>(null);  // 展开的结果行索引

// 约束配置
const constraints = ref<OptimizationConstraints>({
  mainStatFilters: { 4: [], 5: [], 6: [] },
  requiredSets: [],
  pinnedSlots: {},
  setMode: 'any',
  selectedWeaponIds: [],
  effectiveStatPruning: {
    enabled: true,
    effectiveStats: [],
    mainStatScore: 10,
    pruneThreshold: 10,
  },
});

// 计算属性
const teams = computed(() => saveStore.teamInstances);

const currentTeam = computed<Team | null>(() => {
  return teams.value.find(t => t.id === selectedTeamId.value) || null;
});

const targetAgent = computed(() => {
  // 依赖 targetAgentId 触发响应式更新
  if (!targetAgentId.value) return null;
  return optimizerService.getTargetAgent();
});

// 获取角色已装备的武器
const equippedWeapon = computed(() => {
  const agent = targetAgent.value;
  if (!agent || !agent.equipped_wengine) return null;
  return saveStore.wengines.find(w => w.id === agent.equipped_wengine) || null;
});

const availableSkills = computed(() => {
  // 依赖 targetAgentId 触发响应式更新
  if (!targetAgentId.value) return [];
  return optimizerService.getAvailableSkills();
});

// 按等级过滤的驱动盘
const filteredDiscs = computed(() => {
  return saveStore.driveDisks.filter(d => d.level >= minDiscLevel.value);
});

// 支配关系剪枝后的驱动盘（在有效词条变化时自动计算）
const prunedDiscs = computed(() => {
  const effectiveStats = constraints.value.effectiveStatPruning?.effectiveStats ?? [];
  if (effectiveStats.length === 0) {
    return filteredDiscs.value;
  }
  return OptimizerContext.applyDominancePruning(filteredDiscs.value, effectiveStats);
});

// 剪枝统计信息
const pruningStats = computed(() => {
  const before = filteredDiscs.value.length;
  const after = prunedDiscs.value.length;
  return {
    before,
    after,
    removed: before - after,
  };
});

const estimatedCombinations = computed(() => {
  if (!targetAgent.value) {
    return { total: 0, breakdown: {} };
  }
  // 使用剪枝后的驱动盘计算组合数
  return optimizerService.estimateCombinations({
    weapons: [],
    selectedWeaponIds: [],
    discs: prunedDiscs.value,
    constraints: constraints.value,
  });
});

const progressPercentage = computed(() => {
  return progress.value?.percentage || 0;
});

const canStart = computed(() => {
  return !!targetAgent.value &&
         !!equippedWeapon.value &&
         !!selectedSkillKey.value &&
         !isRunning.value;
});

// 有效词条选项（驱动盘可能出现的所有词条）
// 固定值和百分比合并显示，计算时固定值按1/3分计算
const effectiveStatOptions = [
  // 暴击相关
  { value: PropertyType.CRIT_, label: '暴击率' },
  { value: PropertyType.CRIT_DMG_, label: '暴击伤害' },
  // 攻击（包含固定值和百分比）
  { value: PropertyType.ATK_, label: '攻击' },
  // 生命（包含固定值和百分比）
  { value: PropertyType.HP_, label: '生命' },
  // 防御（包含固定值和百分比）
  { value: PropertyType.DEF_, label: '防御' },
  // 穿透（包含固定值和百分比）
  { value: PropertyType.PEN_, label: '穿透' },
  // 异常
  { value: PropertyType.ANOM_PROF, label: '异常精通' },
  { value: PropertyType.ANOM_MAS, label: '异常掌控' },
  // 冲击力
  { value: PropertyType.IMPACT_, label: '冲击力' },
  // 能量
  { value: PropertyType.ENER_REGEN_, label: '能量回复' },
  // 属性伤害加成
  { value: PropertyType.PHYSICAL_DMG_, label: '物理伤害' },
  { value: PropertyType.FIRE_DMG_, label: '火伤害' },
  { value: PropertyType.ICE_DMG_, label: '冰伤害' },
  { value: PropertyType.ELECTRIC_DMG_, label: '电伤害' },
  { value: PropertyType.ETHER_DMG_, label: '以太伤害' },
];

// 方法
const onTeamChange = async () => {
  const team = teams.value.find(t => t.id === selectedTeamId.value);
  if (team) {
    await optimizerService.setTargetTeam(team);
    targetAgentId.value = team.frontAgent?.id || '';
  }
};

const selectTargetAgent = (agentId: string) => {
  optimizerService.setTargetAgent(agentId);
  targetAgentId.value = agentId;
};

const toggleEffectiveStat = (stat: PropertyType) => {
  if (!constraints.value.effectiveStatPruning) return;
  const stats = constraints.value.effectiveStatPruning.effectiveStats;
  const index = stats.indexOf(stat);
  if (index >= 0) {
    stats.splice(index, 1);
  } else {
    stats.push(stat);
  }
};

const saveCurrentPreset = () => {
  const name = prompt('请输入预设名称:');
  if (!name) return;

  const preset = optimizerService.createPresetFromConstraints(
    name,
    constraints.value,
    targetAgentId.value
  );
  optimizerService.savePreset(preset);
  presets.value = optimizerService.loadPresets();
};

const loadPreset = (preset: OptimizationPreset) => {
  constraints.value = optimizerService.applyPreset(preset);
};

const formatCompact = (num: number) => {
  if (num === 0) return '0';
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
};

const formatTime = (seconds: number) => {
  if (!isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m${s}s`;
};

const getWEngineName = (id: string) => {
  const wengine = saveStore.wengines.find(w => w.id === id);
  return wengine?.name || id;
};

const getSetName = (id: string) => {
  const gameData = gameDataStore.getEquipmentInfo(id);
  return gameData?.CHS?.name || id;
};

// 结果详情展开
const toggleBuildDetails = (index: number) => {
  expandedBuildIndex.value = expandedBuildIndex.value === index ? null : index;
};

const getDiscInfo = (discId: string) => {
  return saveStore.driveDisks.find(d => d.id === discId);
};

const formatStatName = (stat: PropertyType | undefined) => {
  if (stat === undefined) return '未知';
  const statNames: Partial<Record<PropertyType, string>> = {
    [PropertyType.HP]: '生命',
    [PropertyType.HP_]: '生命%',
    [PropertyType.ATK]: '攻击',
    [PropertyType.ATK_]: '攻击%',
    [PropertyType.DEF]: '防御',
    [PropertyType.DEF_]: '防御%',
    [PropertyType.CRIT_]: '暴击率',
    [PropertyType.CRIT_DMG_]: '暴击伤害',
    [PropertyType.PEN]: '穿透',
    [PropertyType.PEN_]: '穿透%',
    [PropertyType.ANOM_PROF]: '异常精通',
    [PropertyType.ANOM_MAS]: '异常掌控',
    [PropertyType.IMPACT_]: '冲击力',
    [PropertyType.ENER_REGEN_]: '能量回复',
    [PropertyType.PHYSICAL_DMG_]: '物理伤害',
    [PropertyType.FIRE_DMG_]: '火伤害',
    [PropertyType.ICE_DMG_]: '冰伤害',
    [PropertyType.ELECTRIC_DMG_]: '电伤害',
    [PropertyType.ETHER_DMG_]: '以太伤害',
  };
  return statNames[stat] || `属性${stat}`;
};

const startOptimization = async () => {
  const agent = targetAgent.value;
  if (!agent) return;

  // 使用角色已装备的武器
  const weapon = equippedWeapon.value;
  if (!weapon) {
    alert('角色未装备武器');
    return;
  }

  progress.value = null;
  results.value = [];
  isRunning.value = true;
  totalTime.value = 0;

  // 创建敌人
  const enemy = new Enemy(
    'mock_dulahan',
    '杜拉罕',
    'Dulahan',
    1000000, 1000, 953, 100, true
  );
  enemy.physical_dmg_resistance = -0.2;

  // 获取技能信息
  const skill = availableSkills.value.find(s => s.key === selectedSkillKey.value);
  const ratio = skill?.defaultRatio || 1;

  try {
    // 使用快速优化模式
    optimizerService.initializeFastWorkers(workerCount.value);

    optimizerService.startFastOptimization({
      agent,
      weapon,  // 角色已装备的武器
      skill: {
        id: selectedSkillKey.value || 'default',
        name: skill?.name || '默认技能',
        element: agent.element,
        ratio,
        tags: [skill?.type || 'normal'],
        isPenetration: false,
        anomalyBuildup: skill?.defaultAnomaly || 0,
      },
      enemy,
      discs: prunedDiscs.value,  // 使用剪枝后的驱动盘
      constraints: constraints.value,
      externalBuffs: optimizerService.getTeammateBuffs(),
      topN: 50,
      callbacks: {
        onProgress: (p) => {
          progress.value = p;
        },
        onComplete: (res: AggregatedResult) => {
          results.value = res.builds;
          totalTime.value = res.totalTimeMs;
          isRunning.value = false;
        },
        onError: (err) => {
          console.error('[Optimizer] Error:', err);
          isRunning.value = false;
          alert(`优化出错: ${err.message}`);
        }
      }
    });
  } catch (e: any) {
    alert(e.message);
    isRunning.value = false;
  }
};

const cancelOptimization = () => {
  optimizerService.cancelOptimization();
  isRunning.value = false;
};

onMounted(async () => {
  // 1. 初始化游戏数据
  await gameDataStore.initialize();
  // 2. 加载存档
  await saveStore.loadFromStorage();
  // 3. 初始化快速 Workers
  optimizerService.initializeFastWorkers(workerCount.value);
  // 4. 加载预设
  presets.value = optimizerService.loadPresets();
});

onUnmounted(() => {
  optimizerService.terminateWorkers();
});
</script>
