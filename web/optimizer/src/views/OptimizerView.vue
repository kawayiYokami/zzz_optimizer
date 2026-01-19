<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-7xl mx-auto space-y-6">

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- 配置面板 -->
        <div class="lg:col-span-1 space-y-4">

          <!-- 战斗配置 -->
          <BattleConfigCard
            :current-team="currentTeam"
            :selected-enemy="selectedEnemy"
            :selected-skills="selectedSkills"
            :unselected-skills="unselectedSkills"
            :selected-buffs="selectedBuffs"
            :unselected-buffs="unselectedBuffs"
            @update:selected-team-id="selectedTeamId = $event"
            @update:selected-enemy-id="selectedEnemyId = $event"
            @toggle-skill="toggleSkill"
            @toggle-buff="toggleBuff"
            @edit-team="onTeamChange"
            @create-team="onTeamChange"
          />

          <!-- 计算设置和组合明细 -->
          <CalculationConfigCard
            :worker-count="workerCount"
            :min-disc-level="minDiscLevel"
            :is-running="isRunning"
            :progress="progress"
            :selected-stats="selectedStats"
            :unselected-stats="unselectedStats"
            :pruning-stats="pruningStats"
            :estimated-combinations="estimatedCombinations"
            :can-start="canStart"
            @update:worker-count="workerCount = $event"
            @update:min-disc-level="minDiscLevel = $event"
            @toggle-effective-stat="toggleEffectiveStat"
            @start-optimization="startOptimization"
            @cancel-optimization="cancelOptimization"
          />
        </div>

        <!-- 结果展示 -->
        <div class="lg:col-span-2 space-y-6">
          
          <!-- 战斗信息卡 -->
          <BattleInfoCard
            ref="battleInfoCardRef"
            :battle-service="battleService"
            :selected-skill-keys="selectedSkillKeys"
          />

          <div class="card bg-base-100 shadow-sm min-h-150">
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
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
import { BattleService } from '../services/battle.service';
import BattleConfigCard from '../components/business/BattleConfigCard.vue';
import CalculationConfigCard from '../components/business/CalculationConfigCard.vue';
import BattleInfoCard from '../components/business/BattleInfoCard.vue';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// BattleService 实例
const battleService = new BattleService();

// 状态
const selectedTeamId = ref('');
const targetAgentId = ref('');
const selectedSkillKeys = ref<string[]>([]);
const isRunning = ref(false);
const progress = ref<AggregatedProgress | null>(null);
const results = ref<OptimizationBuild[]>([]);
const totalTime = ref(0);
const presets = ref<OptimizationPreset[]>([]);
const workerCount = ref(Math.max(1, navigator.hardwareConcurrency - 1));
const minDiscLevel = ref(15); // 默认只用15级盘
const expandedBuildIndex = ref<number | null>(null);  // 展开的结果行索引

const battleInfoCardRef = ref<InstanceType<typeof BattleInfoCard> | null>(null);

// Buff 配置相关
const selectedEnemyId = ref('');  // 默认不选择敌人
const disabledBuffIds = ref<string[]>([]); // 存储被禁用的 Buff ID (黑名单模式)
const buffsVersion = ref(0);  // 用于触发 Buff UI 更新

// 敌人列表
const enemies = computed(() => {
  const enemyInfos = gameDataStore.allEnemies || [];
  return enemyInfos.map(info => Enemy.fromGameData(info));
});

const selectedEnemy = computed(() => {
  return enemies.value.find(e => e.id === selectedEnemyId.value) || null;
});

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
         selectedSkillKeys.value.length > 0 &&
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

// 已选词条
const selectedStats = computed(() => {
  const stats = constraints.value.effectiveStatPruning?.effectiveStats ?? [];
  return effectiveStatOptions.filter(opt => stats.includes(opt.value));
});

// 未选词条
const unselectedStats = computed(() => {
  const stats = constraints.value.effectiveStatPruning?.effectiveStats ?? [];
  return effectiveStatOptions.filter(opt => !stats.includes(opt.value));
});

// 已选技能
const selectedSkills = computed(() => {
  return availableSkills.value.filter(skill => selectedSkillKeys.value.includes(skill.key));
});

// 未选技能
const unselectedSkills = computed(() => {
  return availableSkills.value.filter(skill => !selectedSkillKeys.value.includes(skill.key));
});

// Buff 列表
const availableBuffs = computed(() => {
  buffsVersion.value; // 触发响应式依赖
  if (!currentTeam.value) return [];
  return battleService.getAllBuffs();
});

const selectedBuffs = computed(() => {
  // 黑名单模式：不在 disabledBuffIds 中的为选中
  return availableBuffs.value.filter(buff => !disabledBuffIds.value.includes(buff.id));
});

const unselectedBuffs = computed(() => {
  // 黑名单模式：在 disabledBuffIds 中的为未选中
  return availableBuffs.value.filter(buff => disabledBuffIds.value.includes(buff.id));
});

// 加载配置
const loadConfig = () => {
  try {
    const configJson = localStorage.getItem('optimizer_config');
    if (configJson) {
      const config = JSON.parse(configJson);
      if (config.constraints) {
        constraints.value = config.constraints;
      }
      if (config.workerCount !== undefined) {
        workerCount.value = config.workerCount;
      }
      if (config.minDiscLevel !== undefined) {
        minDiscLevel.value = config.minDiscLevel;
      }
      if (config.selectedSkillKeys) {
        selectedSkillKeys.value = config.selectedSkillKeys;
      }
      if (config.disabledBuffIds) {
        disabledBuffIds.value = config.disabledBuffIds;
      }
      if (config.selectedEnemyId) {
        selectedEnemyId.value = config.selectedEnemyId;
      }
    }
  } catch (e) {
    console.error('[Optimizer] Failed to load config:', e);
  }
};

// 保存配置
const saveConfig = () => {
  try {
    const config = {
      constraints: constraints.value,
      workerCount: workerCount.value,
      minDiscLevel: minDiscLevel.value,
      selectedSkillKeys: selectedSkillKeys.value,
      disabledBuffIds: disabledBuffIds.value,
      selectedEnemyId: selectedEnemyId.value,
    };
    localStorage.setItem('optimizer_config', JSON.stringify(config));
  } catch (e) {
    console.error('[Optimizer] Failed to save config:', e);
  }
};

// 方法
const onTeamChange = async () => {
  const team = teams.value.find(t => t.id === selectedTeamId.value);
  if (team) {
    await optimizerService.setTargetTeam(team);
    targetAgentId.value = team.frontAgent?.id || '';
    // 更新战场服务
    await updateBattleService();
    // 增加 buffsVersion 触发 Buff UI 更新
    buffsVersion.value++;
    // 刷新战斗信息卡
    battleInfoCardRef.value?.refresh();
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

const toggleSkill = (skillKey: string) => {
  const index = selectedSkillKeys.value.indexOf(skillKey);
  if (index >= 0) {
    selectedSkillKeys.value.splice(index, 1);
  } else {
    selectedSkillKeys.value.push(skillKey);
  }
};

const toggleBuff = (buffId: string) => {
  const index = disabledBuffIds.value.indexOf(buffId);
  if (index >= 0) {
    // 之前在黑名单中（未激活），现在移除（激活）
    disabledBuffIds.value.splice(index, 1);
    battleService.updateBuffStatus(buffId, true);
  } else {
    // 之前不在黑名单中（激活），现在添加（禁用）
    disabledBuffIds.value.push(buffId);
    battleService.updateBuffStatus(buffId, false);
  }
  buffsVersion.value++;
  // 刷新战斗信息卡
  battleInfoCardRef.value?.refresh();
};

const updateBattleService = async () => {
  const team = currentTeam.value;
  const enemy = selectedEnemy.value;

  // 设置队伍（不依赖敌人）
  if (team) {
    await battleService.setTeam(team);
  }

  // 设置敌人（可选）
  if (enemy) {
    battleService.setEnemy(enemy);
    // 保持之前的状态，不重置敌人状态
    // battleService.setEnemyStatus(false, false);
  }

  // 同步 Buff 状态
  // BattleService 默认全开，我们需要根据 disabledBuffIds 关闭对应的 Buff
  const allBuffs = battleService.getAllBuffs();
  allBuffs.forEach(buff => {
    if (disabledBuffIds.value.includes(buff.id)) {
      battleService.updateBuffStatus(buff.id, false);
    } else {
      battleService.updateBuffStatus(buff.id, true);
    }
  });

  // 刷新 Buff 列表
  buffsVersion.value++;
  // 刷新战斗信息卡
  battleInfoCardRef.value?.refresh();
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
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString();
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

  // 使用选中的敌人，如果没有则使用默认敌人
  let enemy = selectedEnemy.value;
  if (!enemy) {
    console.warn('[Optimizer] 未选择敌人，使用默认 mock 敌人');
    enemy = new Enemy(
      'mock_dulahan',
      '杜拉罕',
      'Dulahan',
      1000000, 1000, 953, 100, true
    );
    enemy.physical_dmg_resistance = -0.2;
  }

  // 获取所有选中的技能
  const skills = selectedSkillKeys.value.map(key => availableSkills.value.find(s => s.key === key)).filter(s => s !== undefined);

  try {
    // 使用快速优化模式
    optimizerService.initializeFastWorkers(workerCount.value);

    // 对每个技能进行优化
    for (const skill of skills) {
      optimizerService.startFastOptimization({
        agent,
        weapon,  // 角色已装备的武器
        skill: {
          id: skill.key || 'default',
          name: skill.name || '默认技能',
          element: agent.element,
          ratio: skill.defaultRatio || 1,
          tags: [skill.type || 'normal'],
          isPenetration: false,
          anomalyBuildup: skill.defaultAnomaly || 0,
        },
        enemy,
        discs: prunedDiscs.value,  // 使用剪枝后的驱动盘
        constraints: constraints.value,
        externalBuffs: optimizerService.getTeammateBuffs(),
        topN: 10,
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
    }
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
  console.log('[OptimizerView] onMounted 开始');
  // 1. 初始化游戏数据
  await gameDataStore.initialize();

  // 2. 加载存档
  await saveStore.loadFromStorage();
  // 3. 初始化快速 Workers
  optimizerService.initializeFastWorkers(workerCount.value);
  // 4. 加载预设
  presets.value = optimizerService.loadPresets();
  // 5. 加载配置
  loadConfig();
  // 6. 自动选择第一个队伍
  if (teams.value.length > 0 && !selectedTeamId.value) {
    selectedTeamId.value = teams.value[0].id;
    await onTeamChange();
  }
});

// 监听配置变化并自动保存
watch([constraints, workerCount, minDiscLevel, selectedSkillKeys, disabledBuffIds, selectedEnemyId], () => {
  saveConfig();
}, { deep: true });

// 监听敌人变化
watch(selectedEnemyId, () => {
  updateBattleService();
});

onUnmounted(() => {
  optimizerService.terminateWorkers();
});
</script>
