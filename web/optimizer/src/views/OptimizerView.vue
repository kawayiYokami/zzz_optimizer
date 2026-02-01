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
            :target-set-id="constraints.targetSetId"
            :optimized-discs="optimizedDiscs"
            :all-discs="saveStore.driveDisks"
            :constraints="constraints"
            :current-team-id="selectedTeamId"
            :current-team-priority="currentTeam?.priority ?? 0"
            :excluded-discs-count="excludedDiscsCount"
            @update:worker-count="workerCount = $event"
            @update:min-disc-level="minDiscLevel = $event"
            @toggle-effective-stat="toggleEffectiveStat"
            @start-optimization="startOptimization"
            @cancel-optimization="cancelOptimization"
            @update:target-set-id="constraints.targetSetId = $event"
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
            :selected-agent="targetAgent"
            :enemy="selectedEnemy"
            @update:selected-enemy-id="selectedEnemyId = $event"
            @change="onBattleEnvChange"
            @update:env-version="battleEnvVersion = $event"
          />

          <!-- 战斗环境（Worker 口径） -->
          <BattleEvaluatorCard
            v-if="isDebugMode && targetAgent && selectedEnemy"
            ref="debugCardRef"
            :agent="targetAgent"
            :weapon="equippedWeapon"
            :enemy="selectedEnemy"
            :key="`battle_eval_${battleEnvVersion}`"
            :buffs-version="buffsVersion"
            :discs="saveStore.driveDisks"
            :skill-ratio="selectedSkills[0]?.defaultRatio || 1"
            :skill-anomaly="selectedSkills[0]?.defaultAnomaly || 0"
            :skill-name="selectedSkills[0]?.name || '未选择'"
            :skill-type="selectedSkills[0]?.type || 'normal'"
            :ui-damage="currentDamage"
            :external-buffs="[...evaluatorBuffs.self, ...evaluatorBuffs.teammate]"
            :buff-status-map="battleService.getBuffStatusMap()"
            :enemy-level="60"
            :is-stunned="battleService.getIsEnemyStunned()"
            :has-corruption-shield="battleService.getEnemyHasCorruptionShield()"
            :enemy-serialized="battleService.getSerializedEnemy(60)"
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
import { PropertyType, ElementType } from '../model/base';
import { Enemy } from '../model/enemy';
import type { Team } from '../model/team';
import { BattleService } from '../services/battle.service';
import { PresetGenerator } from '../services/preset-generator.service';
import BattleConfigCard from '../components/business/BattleConfigCard.vue';
import CalculationConfigCard from '../components/business/CalculationConfigCard.vue';
import BattleInfoCard from '../components/business/BattleInfoCard.vue';
import OptimizationResultCard from '../components/business/OptimizationResultCard.vue';
import BattleEvaluatorCard from '../components/business/BattleEvaluatorCard.vue';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// BattleService 实例
const battleService = new BattleService();

// 状态
const selectedTeamId = ref(localStorage.getItem('optimizer_selected_team_id') || '');
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

// 调试模式
const isDebugMode = ref(true);  // 设为 true 开启调试卡片
const debugCardRef = ref<InstanceType<typeof BattleEvaluatorCard> | null>(null);

// Buff 配置相关
const selectedEnemyId = ref('');  // 默认不选择敌人
const battleEnvVersion = ref(0);
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
  targetSetId: '', // 目标四件套ID（单选）
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

// 统一的优化驱动盘（整合所有过滤逻辑）
const optimizedDiscs = computed(() => {
  // 步骤1：按等级过滤
  let discs = saveStore.driveDisks.filter(d => d.level >= minDiscLevel.value);

  // 步骤2：排除高优先级队伍的驱动盘
  const excludedIds = excludedDiscIds.value;
  if (excludedIds.length > 0) {
    const excludedSet = new Set(excludedIds);
    discs = discs.filter(d => !excludedSet.has(d.id));
  }

  // 步骤3：支配关系剪枝
  const effectiveStats = constraints.value.effectiveStatPruning?.effectiveStats ?? [];
  if (effectiveStats.length > 0) {
    discs = OptimizerContext.applyDominancePruning(discs, effectiveStats);
  }

  // 步骤4：主词条限定剪枝
  const mainStatFilters = constraints.value.mainStatFilters ?? {};
  if (Object.keys(mainStatFilters).length > 0) {
    discs = OptimizerContext.applyMainStatFilterPruning(discs, mainStatFilters);
  }

  return discs;
});

// 剪枝统计信息
const pruningStats = computed(() => {
  const levelFiltered = saveStore.driveDisks.filter(d => d.level >= minDiscLevel.value).length;
  const final = optimizedDiscs.value.length;
  return {
    before: levelFiltered,
    after: final,
    removed: levelFiltered - final,
  };
});

const estimatedCombinations = computed(() => {
  if (!targetAgent.value) {
    return { total: 0, breakdown: {} };
  }
  // 使用优化后的驱动盘计算组合数
  return optimizerService.estimateCombinations({
    weapons: [],
    selectedWeaponIds: [],
    discs: optimizedDiscs.value,
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
  
  // 合并前台角色buff和队友buff（配置候选口径，不含“是否选中”语义）
  const { self: frontAgentBuffs, teammate: teammateBuffs } = battleService.getOptimizerConfigBuffs({ includeFourPiece: false });
  // (debug logs removed)

  // 不去重：调试/优化器配置层面需要看到“真实来源的 Buff 列表”。
  // 后续若存在同 id 的 Buff，需要在数据层修复，而不是在 UI 静默覆盖。
  const all = [...frontAgentBuffs, ...teammateBuffs];

  // (debug logs removed)

  return all;
});

const selectedBuffs = computed(() => {
  buffsVersion.value; // BattleService 非响应式：用 version 驱动刷新
  // UI “已选中/高亮”口径：只按 buffStatusMap 过滤（配置层）
  const { self, teammate } = battleService.getOptimizerConfigActiveBuffs({ includeFourPiece: false });
  return [...self, ...teammate];
});

// 计算口径：由 BattleService 产出最终“计算用 Buff 列表”
const evaluatorBuffs = computed(() => {
  buffsVersion.value; // BattleService 非响应式：用 version 驱动刷新
  return battleService.getOptimizerEvaluatorBuffs();
});

const unselectedBuffs = computed(() => {
  buffsVersion.value; // BattleService 非响应式：用 version 驱动刷新
  // UI “未选中” = 候选 - 已选中（按 buffStatusMap）
  const activeIds = new Set(selectedBuffs.value.map(b => b.id));
  return availableBuffs.value.filter(b => !activeIds.has(b.id));
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

    // 应用配置到界面
    constraints.value = config.constraints;
    selectedSkillKeys.value = config.selectedSkillKeys;
    selectedEnemyId.value = config.selectedEnemyId;

    // 恢复 Buff 开关：如果有 battleData.activeBuffs（单一真相），同步到 BattleService
    const battle = saveStore.battleInstances?.find?.((b: any) => b.teamId === teamId);
    const activeBuffs = battle?.activeBuffs as Record<string, boolean> | undefined;
    if (activeBuffs) {
      for (const [buffId, isActive] of Object.entries(activeBuffs)) {
        battleService.updateBuffStatus(buffId, isActive);
      }
      buffsVersion.value++;
    }

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
    // BattleInfoCard 已精简，内部无 refresh 逻辑
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
  const current = battleService.getBuffStatus(buffId)?.isActive === true;
  battleService.updateBuffStatus(buffId, !current);
  buffsVersion.value++;
  // BattleInfoCard 已精简，内部无 refresh 逻辑
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

  // 刷新 Buff 列表
  buffsVersion.value++;
  // BattleInfoCard 已精简，内部无 refresh 逻辑
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

// BattleInfoCard 已精简，不再提供伤害口径
const currentDamage = computed(() => 0);

const onBattleEnvChange = () => {
  if (isRunning.value) {
    updateEstimatedCombinations();
  }
};

// 一键换装
const handleEquipBuild = async (build: OptimizationBuild) => {
  if (!targetAgentId.value) return;

  console.log('[handleEquipBuild] build.discIds:', build.discIds);

  try {
    let successCount = 0;
    // 遍历6个位置装备驱动盘
    build.discIds.forEach((discId, index) => {
      console.log(`[handleEquipBuild] 位置 ${index + 1}: discId = ${discId}`);
      if (discId && saveStore.equipDriveDisk(targetAgentId.value, discId)) {
        successCount++;
        console.log(`[handleEquipBuild] 位置 ${index + 1} 装备成功`);
      } else {
        console.log(`[handleEquipBuild] 位置 ${index + 1} 装备失败`);
      }
    });

    // 重新加载队伍以更新 BattleService 的缓存
    if (currentTeam.value) {
      console.log('[handleEquipBuild] 重新加载队伍以更新属性缓存');
      await battleService.setTeam(currentTeam.value);
    }

    // BattleInfoCard 已精简，内部无 refresh 逻辑

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

  // 检查是否选择了目标套装
  if (!constraints.value.targetSetId) {
    alert('请选择目标四件套');
    return;
  }

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

  if (skills.length === 0) {
    console.error('[Optimizer] 没有选择任何技能');
    isRunning.value = false;
    alert('请至少选择一个技能');
    return;
  }

  try {
    // 使用快速优化模式
    optimizerService.initializeFastWorkers(workerCount.value);

    // 一次性传入所有技能
    const skillParams = skills.map(skill => ({
      id: skill.key || 'default',
      name: skill.name || '默认技能',
      element: agent.element,  // 直接传枚举值，不要转字符串
      ratio: skill.defaultRatio || 1,
      tags: [skill.type || 'normal'],
      isPenetration: agent.isPenetrationAgent?.() || false,
      anomalyBuildup: skill.defaultAnomaly || 0,
    }));

    optimizerService.startFastOptimization({
      agent,
      weapon,  // 角色已装备的武器
      skills: skillParams,
      enemy: battleService.getEnemy(),
      enemySerialized: battleService.getSerializedEnemy(60),  // 传递序列化敌人数据，保持与 BattleEvaluatorCard 口径一致
      enemyLevel: 60,
      isStunned: battleService.getIsEnemyStunned(),
      hasCorruptionShield: battleService.getEnemyHasCorruptionShield(),
      discs: optimizedDiscs.value,  // 使用优化后的驱动盘
      constraints: constraints.value,
      externalBuffs: [...evaluatorBuffs.value.self, ...evaluatorBuffs.value.teammate],
      buffStatusMap: battleService.getBuffStatusMap(),
      topN: 10,
      estimatedTotal: estimatedCombinations.value.total,  // 传入UI计算的有效组合数
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
          // 使用 toast 显示错误
          const toast = document.createElement('div');
          toast.className = 'toast toast-error z-50';
          toast.innerHTML = `
            <div class="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>优化出错: ${err.message}</span>
            </div>
          `;
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.remove();
          }, 5000);
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
  console.log('[OptimizerView] onMounted 开始');
  // 1. 初始化游戏数据
  await gameDataStore.initialize();

  // 2. 加载存档
  await saveStore.loadFromStorage();
  // 3. 初始化快速 Workers
  optimizerService.initializeFastWorkers(workerCount.value);
  // 4. 加载预设
  presets.value = optimizerService.loadPresets();
  // 5. 自动选择第一个队伍或恢复已保存的队伍
  if (teams.value.length > 0) {
    if (!selectedTeamId.value) {
      selectedTeamId.value = teams.value[0].id;
    }
    await onTeamChange();
  }
});

// 监听配置变化并自动保存到当前队伍
watch([constraints, selectedSkillKeys, selectedEnemyId], () => {
  if (selectedTeamId.value && !isLoadingConfig.value) {
    saveTeamOptimizationConfig(selectedTeamId.value);
  }
}, { deep: true });

// 监听队伍切换
watch(selectedTeamId, () => {
  localStorage.setItem('optimizer_selected_team_id', selectedTeamId.value);
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
