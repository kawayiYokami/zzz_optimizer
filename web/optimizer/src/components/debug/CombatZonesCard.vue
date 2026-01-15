<template>
  <div class="combat-zones-card card bg-base-200 shadow-xl mb-6">
    <div class="card-body">
      <div class="flex justify-between items-center cursor-pointer" @click="$emit('toggle-expand')">
        <h3 class="card-title">战斗属性</h3>
        <span>{{ isExpanded ? '▼' : '▶' }}</span>
      </div>

      <div v-if="isExpanded">
        <!-- 技能选择 -->
        <div class="form-control mb-4">
          <label class="label"><span class="label-text font-bold">选择技能</span></label>
          <select v-model="selectedSkillName" class="select select-bordered w-full">
            <option value="">请选择技能...</option>
            <option v-for="skill in availableSkills" :key="skill.skillName" :value="skill.skillName">
              {{ skill.skillName }}
            </option>
          </select>
        </div>

        <!-- 直伤乘区 -->
        <div class="mb-4">
          <div class="text-sm font-semibold mb-2">直伤乘区</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">增伤区</div>
              <div class="stat-value text-lg">{{ zones.dmg_bonus.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">暴击区</div>
              <div class="stat-value text-lg">{{ zones.crit_zone.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">防御区</div>
              <div class="stat-value text-lg">{{ zones.def_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">抗性区</div>
              <div class="stat-value text-lg">{{ zones.res_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">承伤区</div>
              <div class="stat-value text-lg">{{ zones.dmg_taken_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">失衡易伤区</div>
              <div class="stat-value text-lg">{{ zones.stun_vuln_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">距离衰减区</div>
              <div class="stat-value text-lg">{{ zones.distance_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">贯穿增伤</div>
              <div class="stat-value text-lg">{{ zones.penetration_dmg_bonus.toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- 异常乘区 -->
        <div class="mb-4">
          <div class="text-sm font-semibold mb-2">异常乘区</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">积蓄区</div>
              <div class="stat-value text-lg">{{ zones.accumulate_zone.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">精通区</div>
              <div class="stat-value text-lg">{{ zones.anomaly_prof_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">异常增伤区</div>
              <div class="stat-value text-lg">{{ zones.anomaly_dmg_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">异常暴击区</div>
              <div class="stat-value text-lg">{{ zones.anomaly_crit_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">等级区</div>
              <div class="stat-value text-lg">{{ zones.level_mult.toFixed(2) }}</div>
            </div>
            <div class="stat bg-base-100 rounded p-3">
              <div class="stat-title text-xs">触发期望</div>
              <div class="stat-value text-lg">{{ zones.trigger_expect.toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- 伤害计算结果 -->
        <div v-if="damageResult" class="p-4 bg-base-100 rounded-lg">
          <h4 class="font-bold mb-3">伤害计算结果</h4>
          
          <!-- 直伤 -->
          <div class="mb-3">
            <div class="text-sm font-semibold mb-2">直伤（可暴击）</div>
            <div class="grid grid-cols-3 gap-3">
              <div class="stat bg-base-200 rounded p-3">
                <div class="stat-title text-xs">未暴击</div>
                <div class="stat-value text-lg text-primary">{{ damageResult.damage_no_crit.toFixed(0) }}</div>
              </div>
              <div class="stat bg-base-200 rounded p-3">
                <div class="stat-title text-xs">暴击</div>
                <div class="stat-value text-lg text-secondary">{{ damageResult.damage_crit.toFixed(0) }}</div>
              </div>
              <div class="stat bg-base-200 rounded p-3">
                <div class="stat-title text-xs">期望</div>
                <div class="stat-value text-lg text-accent">{{ damageResult.damage_expected.toFixed(0) }}</div>
              </div>
            </div>
          </div>

          <!-- 异常伤害 -->
          <div v-if="anomalyResult" class="mb-3">
            <div class="text-sm font-semibold mb-2">异常伤害（可暴击）</div>
            <div class="grid grid-cols-3 gap-3">
              <div class="stat bg-base-200 rounded p-3">
                <div class="stat-title text-xs">未暴击</div>
                <div class="stat-value text-lg text-primary">{{ anomalyResult.damage_no_crit.toFixed(0) }}</div>
              </div>
              <div class="stat bg-base-200 rounded p-3">
                <div class="stat-title text-xs">暴击</div>
                <div class="stat-value text-lg text-secondary">{{ anomalyResult.damage_crit.toFixed(0) }}</div>
              </div>
              <div class="stat bg-base-200 rounded p-3">
                <div class="stat-title text-xs">期望</div>
                <div class="stat-value text-lg text-accent">{{ anomalyResult.damage_expected.toFixed(0) }}</div>
              </div>
            </div>
          </div>

          <!-- 紊乱伤害 -->
          <div v-if="disorderResult" class="mb-3">
            <div class="text-sm font-semibold mb-2">紊乱伤害（不可暴击）</div>
            <div class="grid grid-cols-1 gap-3">
              <div class="stat bg-base-200 rounded p-3">
                <div class="stat-title text-xs">期望</div>
                <div class="stat-value text-lg text-accent">{{ disorderResult.damage_expected.toFixed(0) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { BattleService } from '../../services/battle.service';
import type { Agent } from '../../model/agent';
import type { AgentSkill } from '../../model/skill';
import { DamageCalculatorService, type DamageResult } from '../../services/damage-calculator.service';
import { RatioSet } from '../../model/ratio-set';
import { ElementType } from '../../model/base';
import { Enemy } from '../../model/enemy';

interface Props {
  isExpanded: boolean;
  battleService: BattleService;
  frontAgent: Agent | null;
  enemy: any;
  enemyIsStunned: boolean;
  enemyHasCorruptionShield: boolean;
  selectedSkill?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'toggle-expand'): void;
  (e: 'update:selectedSkill', value: string): void;
}>();

const selectedSkillName = ref('');

// 监听props变化更新本地状态
watch(() => props.selectedSkill, (newVal) => {
  if (newVal !== undefined && newVal !== selectedSkillName.value) {
    selectedSkillName.value = newVal;
  }
}, { immediate: true });

// 监听本地状态变化向上传递
watch(selectedSkillName, (newVal) => {
  if (newVal !== props.selectedSkill) {
    emit('update:selectedSkill', newVal);
  }
});

const availableSkills = computed((): AgentSkill[] => {
  if (!props.frontAgent?.agentSkills) return [];
  return Array.from(props.frontAgent.agentSkills.skills.values());
});

const zones = computed(() => {
  // 显式声明所有响应式依赖，确保 Vue 追踪
  const agent = props.frontAgent;
  const enemy = props.enemy;
  const isStunned = props.enemyIsStunned;
  const hasShield = props.enemyHasCorruptionShield;
  
  if (!agent || !enemy) {
    return {
      // 直伤乘区
      dmg_bonus: 1.0,
      crit_zone: 1.0,
      def_mult: 1.0,
      res_mult: 1.0,
      dmg_taken_mult: 1.0,
      stun_vuln_mult: 1.0,
      distance_mult: 1.0,
      penetration_dmg_bonus: 0,
      // 异常乘区
      accumulate_zone: 1.0,
      anomaly_prof_mult: 1.0,
      anomaly_dmg_mult: 1.0,
      anomaly_crit_mult: 1.0,
      level_mult: 1.0,
      trigger_expect: 1.0,
    };
  }
  
  const mergedProps = props.battleService.mergeCombatProperties();
  const enemyInstance = Enemy.fromGameData(enemy);
  const enemyStats = enemyInstance.getCombatStats(70, isStunned);
  enemyStats.has_corruption_shield = hasShield;
  const element = ElementType[agent.element].toLowerCase();
  const zoneCollection = DamageCalculatorService.updateAllZones(mergedProps, enemyStats, element);
  
  return {
    // 直伤乘区
    dmg_bonus: zoneCollection.dmg_bonus,
    crit_zone: zoneCollection.crit_zone,
    def_mult: zoneCollection.def_mult,
    res_mult: zoneCollection.res_mult,
    dmg_taken_mult: zoneCollection.dmg_taken_mult,
    stun_vuln_mult: zoneCollection.stun_vuln_mult,
    distance_mult: zoneCollection.distance_mult,
    penetration_dmg_bonus: zoneCollection.penetration_dmg_bonus,
    // 异常乘区
    accumulate_zone: zoneCollection.accumulate_zone,
    anomaly_prof_mult: zoneCollection.anomaly_prof_mult,
    anomaly_dmg_mult: zoneCollection.anomaly_dmg_mult,
    anomaly_crit_mult: zoneCollection.anomaly_crit_mult,
    level_mult: zoneCollection.level_mult,
    trigger_expect: zoneCollection.trigger_expect,
  };
});

const currentZoneCollection = computed(() => {
  if (!props.frontAgent || !props.enemy) return null;
  const mergedProps = props.battleService.mergeCombatProperties();
  const enemyInstance = Enemy.fromGameData(props.enemy);
  const enemyStats = enemyInstance.getCombatStats(70, props.enemyIsStunned);
  enemyStats.has_corruption_shield = props.enemyHasCorruptionShield;
  const element = ElementType[props.frontAgent.element].toLowerCase();
  return DamageCalculatorService.updateAllZones(mergedProps, enemyStats, element);
});

const damageResult = computed((): DamageResult | null => {
  if (!selectedSkillName.value || !props.frontAgent || !currentZoneCollection.value) return null;
  
  const skill = availableSkills.value.find(s => s.skillName === selectedSkillName.value);
  if (!skill) return null;
  
  let totalRatio = 0;
  for (const segment of skill.segments) {
    const level = props.frontAgent.getSkillLevel(skill.skillName);
    totalRatio += segment.damageRatio + (level - 1) * segment.damageRatioGrowth;
  }
  
  const ratios = new RatioSet();
  ratios.atk_ratio = totalRatio;
  ratios.element = props.frontAgent.element;
  
  return DamageCalculatorService.calculateDirectDamageFromRatios(currentZoneCollection.value, ratios);
});

const anomalyResult = computed((): DamageResult | null => {
  if (!props.frontAgent || !currentZoneCollection.value) return null;
  const dotParams = DamageCalculatorService.getAnomalyDotParams(ElementType[props.frontAgent.element].toLowerCase());
  if (dotParams.totalRatio <= 0) return null;
  
  const ratios = new RatioSet();
  ratios.anom_atk_ratio = dotParams.totalRatio;
  ratios.element = props.frontAgent.element;
  
  return DamageCalculatorService.calculateAnomalyDamageFromZones(currentZoneCollection.value, ratios, 60);
});

const disorderResult = computed((): DamageResult | null => {
  if (!props.frontAgent || !currentZoneCollection.value) return null;
  const element = ElementType[props.frontAgent.element].toLowerCase();
  const disorderRatio = DamageCalculatorService.getDisorderDamageRatio(element, 10);
  
  const ratios = new RatioSet();
  ratios.anom_atk_ratio = disorderRatio;
  ratios.element = props.frontAgent.element;
  
  const result = DamageCalculatorService.calculateAnomalyDamageFromZones(currentZoneCollection.value, ratios, 60);
  return { damage_no_crit: result.damage_expected, damage_crit: result.damage_expected, damage_expected: result.damage_expected };
});
</script>

<style scoped>
.combat-zones-card {
  width: 100%;
}
</style>