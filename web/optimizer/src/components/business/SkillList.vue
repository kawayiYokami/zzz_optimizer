<template>
  <div class="space-y-6">
    <div v-if="groupedSkills.length === 0" class="text-center opacity-50 py-8">
      当前角色没有技能数据
    </div>
    <div v-else v-for="group in groupedSkills" :key="group.type">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 p-2">
          <img :src="iconService.getSkillIconUrl(group.type)" :alt="group.typeName" class="w-full h-full object-contain" />
        </div>
        <h4 class="text-lg font-bold flex-shrink-0">{{ group.typeName }}</h4>
        <span class="text-sm opacity-60 flex-shrink-0 w-12">Lv.{{ group.level }}</span>
        <div class="flex-1 max-w-xs">
          <input
            type="range"
            min="1"
            max="12"
            :value="props.agent.getSkillLevel(group.type)"
            @input="updateLevel(group.type, $event)"
            class="range range-xs"
            step="1"
          />
        </div>
      </div>

      <div class="space-y-2">
        <div v-for="skill in group.skills" :key="skill.name">
          <div class="text-sm font-semibold mb-1 ml-2">{{ skill.name }}</div>
          <div v-for="(seg, idx) in skill.segments" :key="idx" class="card bg-base-200 shadow-sm">
            <div class="card-body p-4">
              <div class="flex justify-between items-start gap-4">
                <span class="font-semibold">{{ seg.segmentName || `段${idx + 1}` }}</span>
                <div class="flex flex-wrap gap-2 justify-end">
                  <div class="badge badge-primary badge-lg">伤害倍率: {{ calculateDamage(seg, group.level) }}%</div>
                  <div class="badge badge-secondary badge-lg">失衡倍率: {{ calculateStun(seg, group.level) }}%</div>
                  <div v-if="seg.energyRecovery > 0" class="badge badge-info badge-lg">能量回复: {{ seg.energyRecovery }}</div>
                  <div v-if="seg.anomalyBuildup > 0" class="badge badge-accent badge-lg">异常积蓄: {{ seg.anomalyBuildup }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Agent } from '../../model/agent';
import { iconService } from '../../services/icon.service';
import type { AgentSkillSegment } from '../../model/skill';

const props = defineProps<{
  agent: Agent;
}>();

const skillTypeMap: Record<string, string> = {
  '普通攻击': 'normal',
  '闪避': 'dodge',
  '冲刺攻击': 'dodge',
  '支援': 'assist',
  '特殊技': 'special',
  '强化特殊技': 'special',
  '连携技': 'chain',
  '终结技': 'chain',
  '核心被动': 'core',
  '额外的能力': 'core'
};

const skillTypeNames: Record<string, string> = {
  'normal': '普通攻击',
  'dodge': '闪避',
  'assist': '支援',
  'special': '特殊技',
  'chain': '连携技',
  'core': '核心技能'
};

const skillTypeOrder = ['normal', 'dodge', 'assist', 'special', 'chain', 'core', 'uncategorized'];

const groupedSkills = computed(() => {
  if (!props.agent.agentSkills || props.agent.agentSkills.skills.size === 0) {
    return [];
  }

  const groups = new Map<string, { type: string; typeName: string; level: number; skills: any[] }>();

  for (const [skillName, skill] of props.agent.agentSkills.skills.entries()) {
    let skillType = '';
    for (const [keyword, type] of Object.entries(skillTypeMap)) {
      if (skillName.includes(keyword)) {
        skillType = type;
        break;
      }
    }

    if (!skillType) {
      skillType = 'uncategorized';
    }

    if (!groups.has(skillType)) {
      groups.set(skillType, {
        type: skillType,
        typeName: skillType === 'uncategorized' ? '未分类' : (skillTypeNames[skillType] || skillType),
        level: skillType === 'uncategorized' ? 1 : props.agent.getEffectiveSkillLevel(skillType),
        skills: []
      });
    }

    groups.get(skillType)!.skills.push({ name: skillName, segments: skill.segments });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const orderA = skillTypeOrder.indexOf(a.type);
    const orderB = skillTypeOrder.indexOf(b.type);
    return orderA - orderB;
  });
});

function calculateDamage(seg: AgentSkillSegment, level: number): string {
  const damage = seg.damageRatio + seg.damageRatioGrowth * (level - 1);
  return (damage * 100).toFixed(1);
}

function calculateStun(seg: AgentSkillSegment, level: number): string {
  const stun = seg.stunRatio + seg.stunRatioGrowth * (level - 1);
  return (stun * 100).toFixed(1);
}

function updateLevel(skillType: string, event: Event): void {
  if (skillType === 'uncategorized') return;
  const target = event.target as HTMLInputElement;
  const newBaseLevel = parseInt(target.value);
  const currentBaseLevel = props.agent.getSkillLevel(skillType);
  const delta = newBaseLevel - currentBaseLevel;
  if (delta !== 0) {
    props.agent.adjustSkillLevel(skillType as 'normal' | 'dodge' | 'assist' | 'special' | 'chain', delta);
  }
}
</script>
