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
            :active-disk-sets="constraints.activeDiskSets"
            :pruned-discs="prunedDiscs"
            :filtered-discs="filteredDiscs"
            :constraints="constraints"
            :current-team-id="selectedTeamId"
            :current-team-priority="currentTeam?.priority ?? 0"
            :excluded-discs-count="excludedDiscsCount"
            @update:worker-count="workerCount = $event"
            @update:min-disc-level="minDiscLevel = $event"
            @toggle-effective-stat="toggleEffectiveStat"
            @start-optimization="startOptimization"
            @cancel-optimization="cancelOptimization"
            @update:active-disk-sets="constraints.activeDiskSets = $event"
            @update:main-stat-filters="handleMainStatFiltersUpdate"
            @update:excluded-team-ids="handleExcludedTeamIdsUpdate"
          />
        </div>

        <!-- 结果展示 -->
        <div class="lg:col-span-2 space-y-6">

          <!-- 武器状态警告 -->
          <div v-if="targetAgent && !equippedWeapon" class="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>当前角色未装备武器，将使用基础攻击力计算伤害</span>
          </div>

          <!-- 战斗信息卡 -->
          <BattleInfoCard
            ref="battleInfoCardRef"
            :battle-service="battleService"
            :selected-skill-keys="selectedSkillKeys"
          />

          <!-- 优化结果卡片 -->
          <OptimizationResultCard
            :results="results"
            :is-running="isRunning"
            :total-time="totalTime"
            :current-damage="currentDamage"
            @equip-build="handleEquipBuild"
          />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, unref } from 'vue';
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
import { PresetGenerator } from '../services/preset-generator.service';
import BattleConfigCard from '../components/business/BattleConfigCard.vue';
import CalculationConfigCard from '../components/business/CalculationConfigCard.vue';
import BattleInfoCard from '../components/business/BattleInfoCard.vue';
import OptimizationResultCard from '../components/business/OptimizationResultCard.vue';

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
const workerCount = ref(16);
const minDiscLevel = ref(15); // 默认只用15级盘

const battleInfoCardRef = ref<InstanceType<typeof BattleInfoCard> | null>(null);

// Buff 配置相关
const selectedEnemyId = ref('');  // 默认不选择敌人
const disabledBuffIds = ref<string[]>([]); // 存储被禁用的 Buff ID (黑名单模式)
const buffsVersion = ref(0);  // 用于触发 Buff UI 更新
const isLoadingConfig = ref(false);  // 防止加载配置时触发自动保存

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
  mainStatFilters: { 4: [], 5: [], 6: [] }, // 主词条限定器
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
  activeDiskSets: [], // 激活的驱动盘套装ID列表
});

// 计算属性
const teams = computed(() => saveStore.teamInstances);

const currentTeam = computed<Team | null>(() => {
  return teams.value.find(t => t.id === selectedTeamId.value) || null;
});

// 排除的驱动盘数量
const excludedDiscsCount = computed(() => {
  if (!constraints.value.excludedTeamIds || constraints.value.excludedTeamIds.length === 0) {
    return 0;
  }

  const excludedIds = new Set<string>();
  constraints.value.excludedTeamIds.forEach(teamId => {
    const team = teams.value.find(t => t.id === teamId);
    if (team) {
      team.allAgents.forEach(agent => {
        agent.equipped_drive_disks.forEach(diskId => {
          if (diskId) {
            excludedIds.add(diskId);
          }
        });
      });
    }
  });

  return excludedIds.size;
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
  { value: PropertyType.ANOM_MAS_, label: '异常掌控%' },
  // 冲击力
  { value: PropertyType.IMPACT_, label: '冲击力%' },
  // 能量
  { value: PropertyType.ENER_REGEN_, label: '能量回复%' },
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

// 从队伍加载配置
const loadTeamOptimizationConfig = (teamId: string) => {
  isLoadingConfig.value = true;
  try {
    const team = teams.value.find(t => t.id === teamId);
    if (!team) {
      console.warn(`[Optimizer] 队伍 ${teamId} 不存在`);
      return;
    }

    let config = team.optimizationConfig;

    // 如果队伍没有配置，生成智能推荐配置
    if (!config) {
      console.log(`[Optimizer] 队伍 ${team.name} 没有配置，生成智能推荐配置`);
      config = PresetGenerator.generateRecommendedConfig(team);
      // 保存到队伍
      saveStore.updateTeamOptimizationConfig(teamId, config);
    }

    console.log(`[Optimizer] 加载配置前 - activeDiskSets:`, constraints.value.activeDiskSets);
    console.log(`[Optimizer] 加载配置前 - effectiveStats:`, constraints.value.effectiveStatPruning?.effectiveStats);

    // 应用配置到界面
    constraints.value = config.constraints;
    selectedSkillKeys.value = config.selectedSkillKeys;
    disabledBuffIds.value = config.disabledBuffIds;
    selectedEnemyId.value = config.selectedEnemyId;

    console.log(`[Optimizer] 加载配置后 - activeDiskSets:`, constraints.value.activeDiskSets);
    console.log(`[Optimizer] 加载配置后 - effectiveStats:`, constraints.value.effectiveStatPruning?.effectiveStats);
    console.log(`[Optimizer] 已加载队伍 ${team.name} 的配置 - selectedEnemyId: ${config.selectedEnemyId}`);
  } catch (e) {
    console.error('[Optimizer] Failed to load team config:', e);
  } finally {
    isLoadingConfig.value = false;
  }
};

// 保存配置到当前队伍
const saveTeamOptimizationConfig = (teamId: string) => {
  try {
    const config = {
      constraints: constraints.value,
      selectedSkillKeys: selectedSkillKeys.value,
      disabledBuffIds: disabledBuffIds.value,
      selectedEnemyId: selectedEnemyId.value,
      lastUpdated: new Date().toISOString(),
    };

    console.log(`[Optimizer] 保存队伍配置 - teamId: ${teamId}, selectedEnemyId: ${selectedEnemyId.value}`);
    const success = saveStore.updateTeamOptimizationConfig(teamId, config);
    if (success) {
      console.log(`[Optimizer] 已保存队伍配置 - selectedEnemyId: ${config.selectedEnemyId}`);
    } else {
      console.error(`[Optimizer] 保存队伍配置失败`);
    }
  } catch (e) {
    console.error('[Optimizer] Failed to save team config:', e);
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
    // 加载队伍的优化配置
    loadTeamOptimizationConfig(team.id);
    // 加载队伍的优化结果缓存
    if (team.optimizationResults && team.optimizationResults.length > 0) {
      results.value = team.optimizationResults;
    } else {
      results.value = [];
    }
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

// 处理主词条限定器更新
const handleMainStatFiltersUpdate = (data: { slot: number; filters: PropertyType[] }) => {
  if (!constraints.value.mainStatFilters) {
    constraints.value.mainStatFilters = {};
  }
  constraints.value.mainStatFilters[data.slot] = data.filters;
};

// 处理排除的队伍ID更新
const handleExcludedTeamIdsUpdate = (teamIds: string[]) => {
  constraints.value.excludedTeamIds = teamIds;
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

// 当前伤害（从 BattleInfoCard 获取）
const currentDamage = computed(() => {
  const dmg = battleInfoCardRef.value?.totalSkillDamage;
  return unref(dmg) || 0;
});

// 一键换装
const handleEquipBuild = (build: OptimizationBuild) => {
  if (!targetAgentId.value) return;

  try {
    let successCount = 0;
    // 遍历6个位置装备驱动盘
    build.discIds.forEach((discId) => {
      if (discId && saveStore.equipDriveDisk(targetAgentId.value, discId)) {
        successCount++;
      }
    });

    // 刷新战斗信息卡以显示新的属性
    battleInfoCardRef.value?.refresh();
    
    // 显示成功提示 (这里简单用 alert 或者 console，实际项目可能有 Toast 组件)
    console.log(`装备已更新，成功装备 ${successCount} 个驱动盘`);
  } catch (e) {
    console.error('装备失败:', e);
    alert('装备失败，请重试');
  }
};

// 获取排除的驱动盘ID列表
  const excludedDiscIds = computed(() => {
    if (!constraints.value.excludedTeamIds || constraints.value.excludedTeamIds.length === 0) {
      return [];
    }

    const excludedIds: string[] = [];
    constraints.value.excludedTeamIds.forEach(teamId => {
      const team = teams.value.find(t => t.id === teamId);
      if (team) {
        team.allAgents.forEach(agent => {
          agent.equipped_drive_disks.forEach(diskId => {
            if (diskId) {
              excludedIds.push(diskId);
            }
          });
        });
      }
    });

    return excludedIds;
  });

  const startOptimization = async () => {
  const agent = targetAgent.value;
  if (!agent) return;

  // 获取角色已装备的武器（如果没有则使用 null）
  const weapon = equippedWeapon.value;
  if (!weapon) {
    console.warn('[Optimizer] 角色未装备武器，将使用基础攻击力计算');
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
        excludedDiscIds: excludedDiscIds.value,  // 排除的驱动盘ID列表
        topN: 10,
        callbacks: {
          onProgress: (p) => {
            progress.value = p;
          },
          onComplete: (res: AggregatedResult) => {
            results.value = res.builds;
            totalTime.value = res.totalTimeMs;
            isRunning.value = false;

            // 保存优化结果到队伍
            if (currentTeam.value) {
              saveStore.updateTeamOptimizationResults(currentTeam.value.id, res.builds);
            }
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
  // 5. 自动选择第一个队伍
  if (teams.value.length > 0 && !selectedTeamId.value) {
    selectedTeamId.value = teams.value[0].id;
    await onTeamChange();
  }
});

// 监听配置变化并自动保存到当前队伍
watch([constraints, selectedSkillKeys, disabledBuffIds, selectedEnemyId], () => {
  if (selectedTeamId.value && !isLoadingConfig.value) {
    saveTeamOptimizationConfig(selectedTeamId.value);
  }
}, { deep: true });

// 监听队伍切换
watch(selectedTeamId, () => {
  onTeamChange();
});

// 监听敌人变化
watch(selectedEnemyId, () => {
  updateBattleService();
});

onUnmounted(() => {
  optimizerService.terminateWorkers();
});
</script>
