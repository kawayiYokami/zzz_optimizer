<template>
  <div class="card bg-base-100 shadow-sm min-h-64">
    <div class="card-body p-4 gap-4">
      <!-- 顶部控制区 -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-base-200 pb-2">
        <h3 class="card-title text-base">
          <span>战斗环境</span>
          <span v-if="!canCalculate" class="text-xs text-error font-normal">(需配置队伍与敌人)</span>
        </h3>

        <div class="flex items-center gap-3">
          <!-- 失衡状态开关 -->
          <label class="label cursor-pointer gap-2 p-0">
            <span class="label-text text-xs font-medium">失衡状态</span>
            <input
              type="checkbox"
              class="toggle toggle-xs toggle-warning"
              :checked="isStunned"
              :disabled="!canCalculate"
              @change="toggleStun"
            />
          </label>

          <!-- 侵蚀护盾开关 -->
          <label class="label cursor-pointer gap-2 p-0">
            <span class="label-text text-xs font-medium">侵蚀护盾</span>
            <input
              type="checkbox"
              class="toggle toggle-xs toggle-error"
              :checked="hasShield"
              :disabled="!canCalculate"
              @change="toggleShield"
            />
          </label>
        </div>
      </div>

      <!-- 核心内容区 (Tabs) -->
      <div v-if="canCalculate" class="flex flex-col flex-1">
        <!-- Tab 导航 -->
        <div class="tabs tabs-boxed tabs-xs bg-base-200/50 mb-3 p-1">
          <a
            class="tab flex-1 transition-all duration-200"
            :class="{ 'tab-active bg-primary text-primary-content shadow-sm': activeTab === 'damage' }"
            @click="activeTab = 'damage'"
          >
            伤害预估
          </a>
          <a
            class="tab flex-1 transition-all duration-200"
            :class="{ 'tab-active bg-primary text-primary-content shadow-sm': activeTab === 'stats' }"
            @click="activeTab = 'stats'"
          >
            战斗面板
          </a>
          <a
            class="tab flex-1 transition-all duration-200"
            :class="{ 'tab-active bg-primary text-primary-content shadow-sm': activeTab === 'zones' }"
            @click="activeTab = 'zones'"
          >
            乘区分析
          </a>
        </div>

        <!-- Tab 1: 伤害预估 -->
        <div v-if="activeTab === 'damage'" class="flex-1 space-y-3 animate-fade-in">
          <!-- 技能伤害列表 -->
          <div v-if="skillDamageList.length > 0" class="space-y-2">
            <div v-for="skill in skillDamageList" :key="skill.name" class="card bg-base-200/50 rounded-box border border-base-200 hover:shadow-sm transition-shadow">
              <div class="card-body p-3 space-y-2">
                <!-- 技能名称和总伤害 -->
                <div class="flex justify-between items-center">
                  <h4 class="text-sm font-medium">{{ skill.name }}</h4>
                  <span class="font-mono text-primary text-lg">{{ Math.round(skill.damage.totalDamage).toLocaleString() }}</span>
                </div>
                
                <!-- 伤害明细网格 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2">
                  <!-- 直伤 -->
                  <div class="flex flex-col">
                    <span class="text-base-content/60 mb-1 text-xs">直伤</span>
                    <span class="font-mono text-primary text-sm">{{ Math.round(skill.damage.directDamage).toLocaleString() }}</span>
                  </div>
                  
                  <!-- 异常 -->
                  <div class="flex flex-col">
                    <span class="text-base-content/60 mb-1 text-xs">异常</span>
                    <span class="font-mono text-secondary text-sm">{{ Math.round(skill.damage.anomalyDamage).toLocaleString() }}</span>
                  </div>
                  
                  <!-- 紊乱 -->
                  <div class="flex flex-col">
                    <span class="text-base-content/60 mb-1 text-xs">紊乱</span>
                    <span class="font-mono text-purple-500 text-sm">{{ Math.round(skill.damage.disorderDamage).toLocaleString() }}</span>
                  </div>
                  
                  <!-- 烈霜期望 -->
                  <div v-if="skill.damage.lieshuangExpectedDamage > 0" class="flex flex-col">
                    <span class="text-base-content/60 mb-1 text-xs">烈霜</span>
                    <span class="font-mono text-accent text-sm">{{ Math.round(skill.damage.lieshuangExpectedDamage).toLocaleString() }}</span>
                  </div>
                  <div v-else-if="skill.damage.specialAnomalyDamage > 0" class="flex flex-col">
                    <span class="text-base-content/60 mb-1 text-xs">特效</span>
                    <span class="font-mono text-accent text-sm">{{ Math.round(skill.damage.specialAnomalyDamage).toLocaleString() }}</span>
                  </div>
                </div>
                
                <!-- 积蓄值 -->
                <div class="flex flex-col space-y-1">
                  <div class="flex justify-between">
                    <span class="text-base-content/60 text-xs">积蓄</span>
                    <span class="font-mono text-sm">{{ Math.min(Math.max(0, skill.anomaly * (1 + (zones?.accumulate_zone || 0) - 1)), skill.damage.anomalyThreshold).toFixed(1) }} / {{ skill.damage.anomalyThreshold.toFixed(0) }}</span>
                  </div>
                  <div class="w-full bg-base-300 rounded-full h-1.5">
                    <div 
                      class="bg-primary h-1.5 rounded-full transition-all duration-300"
                      :style="{ 
                        width: `${Math.min(100, (skill.anomaly * (1 + (zones?.accumulate_zone || 0) - 1)) / skill.damage.anomalyThreshold * 100)}%` 
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 总伤合计 -->
            <div class="alert alert-info py-2 px-3 text-sm shadow-sm mt-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              <div class="flex justify-between w-full items-center">
                <span>已选技能总伤</span>
                <span class="font-bold font-mono text-lg">{{ Math.round(totalSkillDamage).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- 无技能时的默认预估 -->
          <div v-else class="space-y-3">
            <div class="alert alert-warning py-2 px-3 text-xs shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>未选择技能，显示基准伤害预估</span>
            </div>

            <!-- 直伤预估 -->
            <div class="stats stats-vertical lg:stats-horizontal shadow bg-base-200/30 w-full">
              <div class="stat p-3">
                <div class="stat-title text-xs">基准直伤 (100%倍率)</div>
                <div class="stat-value text-lg text-primary font-mono mt-1">
                  {{ Math.round(damageResult?.directDamage?.damage_expected || 0).toLocaleString() }}
                </div>
                <div class="stat-desc text-xs mt-1 space-x-2">
                  <span>未暴: {{ Math.round(damageResult?.directDamage?.damage_no_crit || 0).toLocaleString() }}</span>
                  <span>暴击: {{ Math.round(damageResult?.directDamage?.damage_crit || 0).toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <!-- 异常伤害 -->
            <div class="stats stats-vertical lg:stats-horizontal shadow bg-base-200/30 w-full">
               <div class="stat p-3">
                <div class="stat-title text-xs flex items-center gap-1">
                  <span>单次异常</span>
                  <span class="badge badge-xs badge-ghost">{{ agentElement }}</span>
                </div>
                <div class="stat-value text-lg text-secondary font-mono mt-1">
                  {{ Math.round(damageResult?.anomalyDamage?.anomaly_damage_expected || 0).toLocaleString() }}
                </div>
                <div class="stat-desc text-xs mt-1">
                  触发期望: {{ ((damageResult?.anomalyDamage?.trigger_expectation || 0) * 100).toFixed(1) }}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: 战斗面板 -->
        <div v-else-if="activeTab === 'stats'" class="flex-1 pr-1 animate-fade-in">
          <PropertySetCard
            :property-collection="finalPropertyCollection"
            :no-card="true"
            default-active-tab="in"
          />
        </div>

        <!-- Tab 3: 乘区分析 -->
        <div v-else-if="activeTab === 'zones'" class="flex-1 space-y-3 animate-fade-in">
          <div class="grid grid-cols-4 gap-2 text-xs">
            <!-- 直伤乘区 -->
            <!-- 分割线 -->
            <div class="col-span-4 divider text-xs font-bold text-base-content/50 my-2">直伤乘区</div>

            <!-- 基础区 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">基础区</div>
                <div class="font-bold font-mono text-base">{{ zones?.base_damage_zone?.toFixed(0) || '-' }}</div>
              </div>
            </button>
            <!-- 暴击区 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">暴击区</div>
                <div class="font-bold font-mono text-base text-error">{{ zones?.crit_zone?.toFixed(2) || '-' }}</div>
              </div>
            </button>
            <!-- 抗性区 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">抗性区</div>
                <div class="font-bold font-mono text-base">{{ zones?.res_mult?.toFixed(3) || '-' }}</div>
              </div>
            </button>
            <!-- 失衡区 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200" :class="{'ring-1 ring-warning bg-warning/10': isStunned}">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">失衡易伤</div>
                <div class="font-bold font-mono text-base">{{ zones?.stun_vuln_mult?.toFixed(2) || '-' }}</div>
              </div>
            </button>

            <!-- 异常乘区 -->
            <!-- 分割线 -->
            <div class="col-span-4 divider text-xs font-bold text-base-content/50 my-2">异常乘区</div>

            <!-- 异常基础区 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">基础区-{{ anomalyCnName }}</div>
                <div class="font-bold font-mono text-base">{{ zones?.anomaly_base_damage_zone?.toFixed(0) || '-' }}</div>
              </div>
            </button>
            <!-- 异常精通 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">精通区</div>
                <div class="font-bold font-mono text-base">{{ zones?.anomaly_prof_mult?.toFixed(2) || '-' }}</div>
              </div>
            </button>
            <!-- 异常增伤 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">异常增伤区</div>
                <div class="font-bold font-mono text-base text-secondary">{{ zones?.anomaly_dmg_mult?.toFixed(2) || '-' }}</div>
              </div>
            </button>
            <!-- 异常暴击 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">异常暴击区</div>
                <div class="font-bold font-mono text-base">{{ zones?.anomaly_crit_mult?.toFixed(2) || '-' }}</div>
              </div>
            </button>
            <!-- 异常积蓄 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">积蓄区</div>
                <div class="font-bold font-mono text-base">{{ zones?.accumulate_zone?.toFixed(2) || '-' }}</div>
              </div>
            </button>

            <!-- 通用乘区 -->
            <!-- 分割线 -->
            <div class="col-span-4 divider text-xs font-bold text-base-content/50 my-2">通用乘区</div>

            <!-- 防御区 (直伤/异常通用) -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200 relative overflow-hidden">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">防御区</div>
                <div class="font-bold font-mono text-base">{{ zones?.def_mult?.toFixed(3) || '-' }}</div>
                <div v-if="(zones?.getFinal(PropertyType.DEF_RED_, 0) || 0) > 0" class="absolute bottom-0 right-0 text-[10px] bg-success/20 px-1 rounded-tl">
                  减防生效
                </div>
              </div>
            </button>
            <!-- 增伤区 (直伤/异常通用) -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">增伤区</div>
                <div class="font-bold font-mono text-base text-warning">{{ zones?.dmg_bonus?.toFixed(2) || '-' }}</div>
              </div>
            </button>
            <!-- 承伤区 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">承伤区</div>
                <div class="font-bold font-mono text-base">{{ zones?.dmg_taken_mult?.toFixed(2) || '-' }}</div>
              </div>
            </button>
            <!-- 距离衰减 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">距离衰减</div>
                <div class="font-bold font-mono text-base">{{ zones?.distance_mult?.toFixed(2) || '-' }}</div>
              </div>
            </button>
            <!-- 等级压制 -->
            <button class="btn btn-sm h-auto py-3 bg-base-100 border-base-200 hover:bg-base-200">
              <div class="flex flex-col items-center w-full">
                <div class="opacity-60 mb-1">等级压制</div>
                <div class="font-bold font-mono text-base">{{ zones?.level_mult?.toFixed(4) || '-' }}</div>
              </div>
            </button>
          </div>
        </div>

      </div>

      <!-- 空状态 -->
      <div v-else class="flex flex-col items-center justify-center py-8 opacity-40 gap-2">
        <div class="text-3xl">🛡️</div>
        <div class="text-sm">请先配置队伍与敌人</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { BattleService } from '../../services/battle.service';
import { DamageCalculator } from '../../utils/damage-calculator';
import type { DirectDamageResult, AnomalyDamageResult } from '../../utils/damage-calculator';
import { PropertyCollection } from '../../model/property-collection';
import { ZoneCollection } from '../../model/zone-collection';
import { RatioSet } from '../../model/ratio-set';
import { PropertyType, ElementType, getElementCnName } from '../../model/base';
import PropertySetCard from './PropertySetCard.vue';
import { optimizerService } from '../../optimizer/services';

// Props
interface Props {
  battleService: BattleService;
  selectedSkillKeys?: string[]; // 用于计算总伤
}

const props = defineProps<Props>();

// State
const activeTab = ref<'damage' | 'stats' | 'zones'>('damage');
const updateTick = ref(0); // 用于强制刷新

// Reactive Data from BattleService
const canCalculate = computed(() => {
  // 依赖 updateTick 确保变更时刷新
  updateTick.value;
  return props.battleService && props.battleService.getTeam() && props.battleService.getEnemy();
});

const isStunned = computed(() => {
  updateTick.value;
  return props.battleService.getIsEnemyStunned();
});

const hasShield = computed(() => {
  updateTick.value;
  return props.battleService.getEnemyHasCorruptionShield();
});

const agentElement = computed(() => {
  if (!props.battleService) return '未知';
  const agent = props.battleService.getFrontAgent();
  if (!agent) return '未知';
  return getElementCnName(agent.element);
});

// 异常类型名称映射
const anomalyNameMap: Record<string, string> = {
  '物理': '强击',
  '火': '灼烧',
  '冰': '碎冰',
  '雷': '感电',
  '以太': '侵蚀',
};

const anomalyName = computed(() => {
  if (!props.battleService) return '未知';
  const agent = props.battleService.getFrontAgent();
  if (!agent) return '未知';
  const elementName = getElementCnName(agent.element);
  return anomalyNameMap[elementName] || elementName;
});

const anomalyCnName = computed(() => {
  if (!props.battleService) return '未知';
  const agent = props.battleService.getFrontAgent();
  if (!agent) return '未知';
  return getElementCnName(agent.element);
});

// 计算属性集合 (Tab 2)
const finalPropertyCollection = computed(() => {
  updateTick.value;
  if (!canCalculate.value) return new PropertyCollection();

  // 构造一个新的 PropertyCollection，只包含局内属性
  // 因为 BattleService.getMergedInCombatProperties() 返回的就是 PropertyCollection
  const p = props.battleService.getMergedInCombatProperties();

  // 我们需要一个新的对象来确保 PropertySetCard 正确渲染
  const displayCollection = new PropertyCollection();
  displayCollection.in_combat = p.in_combat; // 直接复用 Map
  displayCollection.conversion = p.conversion;

  return displayCollection;
});

// 计算乘区 (Tab 3) & 伤害结果 (Tab 1)
const zones = ref<ZoneCollection | null>(null);
const damageResult = ref<{
  directDamage: DirectDamageResult;
  anomalyDamage: AnomalyDamageResult;
} | null>(null);

const totalSkillDamage = ref(0);
const skillDamageList = ref<Array<{
  name: string;
  ratio: number;
  anomaly: number;
  damage: any; // Using any to avoid circular dependency issues with BattleService types if not exported correctly
}>>([]);

// Methods
const toggleStun = (e: Event) => {
  const target = e.target as HTMLInputElement;
  props.battleService.setEnemyStatus(target.checked, hasShield.value);
  refreshData();
};

const toggleShield = (e: Event) => {
  const target = e.target as HTMLInputElement;
  props.battleService.setEnemyStatus(isStunned.value, target.checked);
  refreshData();
};

const calculateData = () => {
  if (!canCalculate.value) {
    zones.value = null;
    damageResult.value = null;
    totalSkillDamage.value = 0;
    return;
  }

  const agent = props.battleService.getFrontAgent();
  const enemy = props.battleService.getEnemy();
  if (!agent || !enemy) return;

  const combatProps = props.battleService.getMergedInCombatProperties();
  const enemyStats = enemy.getCombatStats(60, isStunned.value); // 假设60级
  enemyStats.has_corruption_shield = hasShield.value;

  const elementStr = ElementType[agent.element].toLowerCase();

  // 1. 计算乘区
  const currentZones = DamageCalculator.updateAllZones(
    combatProps,
    enemyStats,
    elementStr
  );
  zones.value = currentZones;

  // 计算默认技能的基础区
  const baseZones = DamageCalculator.calculateDefaultSkillBaseZones(agent, currentZones);
  zones.value.base_damage_zone = baseZones.directBase;
  zones.value.anomaly_base_damage_zone = baseZones.anomalyBase;

  // 2. 计算基准直伤 (100% 倍率)
  const baseRatios = new RatioSet();
  baseRatios.atk_ratio = 1.0; // 100%
  baseRatios.element = agent.element;

  let directResult: DirectDamageResult;
  if (agent.isPenetrationAgent()) {
    directResult = DamageCalculator.calculatePenetrationDamage(currentZones, baseRatios) as unknown as DirectDamageResult;
  } else {
    directResult = DamageCalculator.calculateDirectDamageFromRatios(currentZones, baseRatios) as unknown as DirectDamageResult;
  }
  // 补全 DirectDamageResult 缺失的字段以便显示
  directResult.base_damage = DamageCalculator.calculateBaseDamageZone(currentZones, baseRatios, agent.isPenetrationAgent());
  directResult.dmg_bonus = currentZones.dmg_bonus;
  directResult.crit_zone = currentZones.crit_zone;
  directResult.def_mult = currentZones.def_mult;
  directResult.res_mult = currentZones.res_mult;
  directResult.dmg_taken_mult = currentZones.dmg_taken_mult;
  directResult.stun_vuln_mult = currentZones.stun_vuln_mult;
  directResult.distance_mult = currentZones.distance_mult;

  // 3. 计算异常伤害 (单次)
  const anomalyParams = DamageCalculator.getAnomalyDotParams(elementStr);
  const anomalyRatios = new RatioSet();
  anomalyRatios.atk_ratio = anomalyParams.ratio; // 单次/单跳倍率
  anomalyRatios.element = agent.element;

  const anomalyCalcResult = DamageCalculator.calculateAnomalyDamageFromZones(currentZones, anomalyRatios);
  const triggerExpectation = props.battleService.calculateAnomalyTriggerExpectation(100, elementStr); // 假设100积蓄

  const anomalyResult: AnomalyDamageResult = {
    anomaly_damage_no_crit: anomalyCalcResult.damage_no_crit,
    anomaly_damage_crit: anomalyCalcResult.damage_crit,
    anomaly_damage_expected: anomalyCalcResult.damage_expected,
    anomaly_ratio: anomalyParams.ratio,
    anomaly_buildup: 100,
    anomaly_threshold: enemyStats.getAnomalyThreshold(elementStr),
    trigger_expectation: triggerExpectation / 100, // 归一化
    atk_zone: DamageCalculator.calculateBaseDamageZone(currentZones, new RatioSet(), agent.isPenetrationAgent()), // 近似
    dmg_bonus: currentZones.dmg_bonus,
    anomaly_prof_mult: currentZones.anomaly_prof_mult,
    anomaly_dmg_mult: currentZones.anomaly_dmg_mult,
    anomaly_crit_mult: currentZones.anomaly_crit_mult,
    level_mult: currentZones.level_mult,
    def_mult: currentZones.def_mult,
    res_mult: currentZones.res_mult,
    dmg_taken_mult: currentZones.dmg_taken_mult,
    stun_vuln_mult: currentZones.stun_vuln_mult,
    anomaly_buildup_zone: currentZones.accumulate_zone,
    anomaly_mastery_zone: currentZones.getFinal(PropertyType.ANOM_MAS, 0) / 100,
  };

  damageResult.value = {
    directDamage: directResult,
    anomalyDamage: anomalyResult
  };

  // 4. 计算已选技能总伤
  skillDamageList.value = [];
  totalSkillDamage.value = 0;

  // 使用 setTargetAgent 确保 optimizerService 知道当前角色是谁
  if (agent) {
    optimizerService.setTargetAgent(agent.id);
  }

  if (props.selectedSkillKeys && props.selectedSkillKeys.length > 0) {
    const availableSkills = optimizerService.getAvailableSkills();
    const skills = props.selectedSkillKeys
      .map(key => availableSkills.find(s => s.key === key))
      .filter(s => s !== undefined);

    // 计算烈霜伤害（星见雅专属）
    let lieshuangExpectedDamage = 0;
    const specialAnomalyConfig = agent.getSpecialAnomalyConfig();
    if (specialAnomalyConfig && specialAnomalyConfig.element === 'lieshuang') {
      // 保存积蓄区和阈值，供后续使用
      (window as any).__lieshuangData = {
        accumulateZone: currentZones.accumulate_zone || 0,
        iceThreshold: enemyStats.getAnomalyThreshold('ice'),
        ratio: specialAnomalyConfig.ratio
      };
    }

    let total = 0;
    const list = [];

    for (const skill of skills) {
      if (!skill) continue;

      // 使用 OptimizerService 计算该技能的总倍率和总积蓄
      const skillStats = optimizerService.calculateSkillStats(skill.key, -1);

      // 使用 BattleService 的完整逻辑计算总伤害（直伤+异常）
      const dmgResult = props.battleService.calculateTotalDamage(skillStats.ratio, skillStats.anomaly);

      // 直接使用BattleService计算的specialAnomalyDamage作为烈霜伤害
      const dmgResultWithLieshuang = {
        ...dmgResult,
        // 将specialAnomalyDamage作为烈霜伤害显示
        lieshuangExpectedDamage: dmgResult.specialAnomalyDamage
      };

      list.push({
        name: skill.name,
        ratio: skillStats.ratio,
        anomaly: skillStats.anomaly,
        damage: dmgResultWithLieshuang
      });

      // 直接使用BattleService计算的totalDamage，已经包含了烈霜伤害
      total += dmgResult.totalDamage;
    }

    skillDamageList.value = list;
    totalSkillDamage.value = total;
  } else {
    // 默认展示第一个技能
    const availableSkills = optimizerService.getAvailableSkills();
    if (availableSkills.length > 0) {
      const defaultSkill = availableSkills[0];
      const skillStats = optimizerService.calculateSkillStats(defaultSkill.key, -1);
      const dmgResult = props.battleService.calculateTotalDamage(skillStats.ratio, skillStats.anomaly);

      // 直接使用BattleService计算的specialAnomalyDamage作为烈霜伤害
      const dmgResultWithLieshuang = {
        ...dmgResult,
        // 将specialAnomalyDamage作为烈霜伤害显示
        lieshuangExpectedDamage: dmgResult.specialAnomalyDamage
      };

      skillDamageList.value = [{
        name: `${defaultSkill.name} (默认预览)`,
        ratio: skillStats.ratio,
        anomaly: skillStats.anomaly,
        damage: dmgResultWithLieshuang
      }];
    }
  }
};

const refreshData = () => {
  updateTick.value++;
  calculateData();
};

// 监听 BattleService 变化
// 注意：由于 BattleService 内部状态变化不一定触发 Vue 响应式，
// 我们依赖外部传入的 props 或者父组件的触发。
// 这里我们监听 selectedSkillKeys 的变化
watch(() => props.selectedSkillKeys, () => {
  refreshData();
}, { deep: true });

// 暴露刷新方法和数据给父组件
defineExpose({
  refresh: refreshData,
  totalSkillDamage
});

onMounted(() => {
  refreshData();
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
