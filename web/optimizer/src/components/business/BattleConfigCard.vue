<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4">
      <h3 class="font-bold text-sm">战斗配置</h3>
      <!-- 当前队伍卡片（可点击选择） -->
      <div v-if="currentTeam" class="mt-2">
        <TeamCard
          :team="currentTeam"
          @click="showTeamSelector = true"
          :clickable="true"
        />
      </div>
      <div v-else class="mt-2 text-sm text-base-content/60 text-center py-4">
        暂无队伍，请先创建队伍
      </div>

      <!-- 技能配置 -->
      <div class="divider text-xs font-bold text-base-content/50 my-2">技能配置</div>
      <div class="flex flex-col gap-3">
        <div class="text-xs font-bold text-base-content/70 pl-1">已激活</div>

        <div v-for="group in groupedActiveSkills" :key="group.agentName" class="flex flex-col gap-1">
          <div class="text-xs font-bold text-base-content/70 pl-1">{{ group.agentName }}</div>
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="skill in group.skills"
              :key="skill.key"
              class="tooltip tooltip-bottom"
              :data-tip="formatSkillTooltip(skill)"
            >
              <button
                class="badge badge-md py-3 h-auto min-h-[1.5rem] cursor-pointer transition-all duration-200 badge-primary font-medium shadow-sm"
                @click="emit('decSkill', skill.key)"
              >
                {{ skill.name }} x{{ skill.count }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="ungroupedActiveSkills.length > 0" class="flex flex-col gap-1">
          <div class="text-xs font-bold text-base-content/70 pl-1">其他</div>
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="skill in ungroupedActiveSkills"
              :key="skill.key"
              class="tooltip tooltip-bottom"
              :data-tip="formatSkillTooltip(skill)"
            >
              <button
                class="badge badge-md py-3 h-auto min-h-[1.5rem] cursor-pointer transition-all duration-200 badge-primary font-medium shadow-sm"
                @click="emit('decSkill', skill.key)"
              >
                {{ skill.name }} x{{ skill.count }}
              </button>
            </div>
          </div>
        </div>

        <div class="divider text-xs font-bold text-base-content/50 my-1">全部技能（点击 +1）</div>

        <div v-for="group in groupedAllSkills" :key="group.agentName" class="flex flex-col gap-1">
          <div class="text-xs font-bold text-base-content/70 pl-1">{{ group.agentName }}</div>
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="skill in group.skills"
              :key="skill.key"
              class="tooltip tooltip-bottom"
              :data-tip="formatSkillTooltip(skill)"
            >
              <button
                class="badge badge-md py-3 h-auto min-h-[1.5rem] cursor-pointer transition-all duration-200 badge-ghost border-base-300 text-base-content/60"
                @click="emit('incSkill', skill.key)"
              >
                {{ skill.name }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="ungroupedAllSkills.length > 0" class="flex flex-col gap-1">
          <div class="text-xs font-bold text-base-content/70 pl-1">其他</div>
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="skill in ungroupedAllSkills"
              :key="skill.key"
              class="tooltip tooltip-bottom"
              :data-tip="formatSkillTooltip(skill)"
            >
              <button
                class="badge badge-md py-3 h-auto min-h-[1.5rem] cursor-pointer transition-all duration-200 badge-ghost border-base-300 text-base-content/60"
                @click="emit('incSkill', skill.key)"
              >
                {{ skill.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Buff 配置 -->
      <div class="divider text-xs font-bold text-base-content/50 my-2">Buff 配置</div>
      <div class="flex flex-col gap-3">
        <div v-for="group in groupedBuffs" :key="group.sourceLabel" class="flex flex-col gap-1">
          <div class="text-xs font-bold text-base-content/70 pl-1">{{ group.sourceLabel }}</div>
          <div class="flex flex-wrap gap-1.5">
            <div
              v-for="buff in group.buffs"
              :key="buff.id"
              class="tooltip tooltip-bottom max-w-full"
              :data-tip="formatBuffTooltip(buff)"
            >
              <button
                class="badge badge-md py-3 h-auto min-h-[1.5rem] cursor-pointer transition-all duration-200"
                :class="buff.isActive ? 'badge-primary font-medium shadow-sm' : 'badge-ghost border-base-300 text-base-content/60'"
                @click="emit('toggleBuff', buff.id)"
              >
                {{ buff.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 敌人配置已迁移到「战斗环境」卡片 -->
    </div>
  </div>

  <!-- 队伍选择弹窗 -->
  <dialog v-if="showTeamSelector" class="modal modal-open">
    <div class="modal-box w-150 max-w-full relative flex flex-col max-h-[85vh]">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10" @click="showTeamSelector = false">✕</button>
      <h3 class="font-bold text-lg mb-4 shrink-0">选择队伍</h3>
      <div class="flex-1 overflow-y-auto min-h-0 pr-2">
        <TeamList 
          @select="(teamId) => { showTeamSelector = false; emit('update:selectedTeamId', teamId); }"
          @create="() => { showTeamSelector = false; editingTeamId = undefined; showTeamEditModal = true; emit('createTeam'); }"
        />
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click.prevent="showTeamSelector = false">
      <button>close</button>
    </form>
  </dialog>

  <!-- 队伍编辑弹窗 -->
  <TeamEditModal
    v-if="showTeamEditModal"
    :team-id="editingTeamId"
    :show="showTeamEditModal"
    @saved="(teamId) => { showTeamEditModal = false; emit('update:selectedTeamId', teamId); }"
    @deleted="() => { showTeamEditModal = false; emit('update:selectedTeamId', ''); }"
    @cancel="showTeamEditModal = false"
  />

  <!-- 敌人选择弹窗已迁移到「战斗环境」卡片 -->
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import TeamCard from './TeamCard.vue';
import TeamEditModal from './TeamEditModal.vue';
import TeamList from './TeamList.vue';
import type { Team } from '../../model/team';
import type { Enemy } from '../../model/enemy';
import type { AgentSkillOption } from '../../optimizer/services/optimizer.service';
import { Buff, BuffSource } from '../../model/buff';

// Props
interface Props {
  currentTeam: Team | null;
  selectedEnemy: Enemy | null;
  allSkills: AgentSkillOption[];
  selectedSkills: (AgentSkillOption & { count: number })[];
  unselectedSkills: AgentSkillOption[];
  selectedBuffs: Buff[];
  unselectedBuffs: Buff[];
}

const props = withDefaults(defineProps<Props>(), {
  currentTeam: null,
  selectedEnemy: null,
  allSkills: () => [],
  selectedSkills: () => [],
  unselectedSkills: () => [],
  selectedBuffs: () => [],
  unselectedBuffs: () => [],
});

// Emits
interface Emits {
  'update:selectedTeamId': [teamId: string];
  'update:selectedEnemyId': [enemyId: string];
  'incSkill': [skillKey: string];
  'decSkill': [skillKey: string];
  'toggleBuff': [buffId: string];
  'createTeam': [];
}

const emit = defineEmits<Emits>();

// 内部状态
const showTeamSelector = ref(false);
const showTeamEditModal = ref(false);
const editingTeamId = ref<string | undefined>();
// 敌人选择已迁移到「战斗环境」卡片

// === 技能分组逻辑（上：已激活；下：可选） ===

type SelectedSkill = AgentSkillOption & { count: number };

const groupedActiveSkills = computed(() => {
  if (!props.currentTeam) return [];
  
  const groups: { agentName: string; skills: SelectedSkill[] }[] = [];

  const agents = [
    props.currentTeam.frontAgent,
    ...props.currentTeam.backAgents
  ].filter(Boolean);

  for (const agent of agents) {
    if (!agent) continue;
    
    const agentSkills = props.selectedSkills.filter(skill => skill.key.includes(agent.name_cn));

    if (agentSkills.length > 0) {
      groups.push({
        agentName: agent.name_cn,
        skills: agentSkills
      });
    }
  }

  return groups;
});

const groupedAllSkills = computed(() => {
  if (!props.currentTeam) return [];

  const groups: { agentName: string; skills: AgentSkillOption[] }[] = [];

  const agents = [
    props.currentTeam.frontAgent,
    ...props.currentTeam.backAgents
  ].filter(Boolean);

  for (const agent of agents) {
    if (!agent) continue;
    const agentSkills = props.allSkills.filter(skill => skill.key.includes(agent.name_cn));
    if (agentSkills.length > 0) groups.push({ agentName: agent.name_cn, skills: agentSkills });
  }

  return groups;
});

const ungroupedActiveSkills = computed(() => {
  const processedKeys = new Set(groupedActiveSkills.value.flatMap(g => g.skills.map(s => s.key)));
  return props.selectedSkills.filter(s => !processedKeys.has(s.key));
});

const ungroupedAllSkills = computed(() => {
  const processedKeys = new Set(groupedAllSkills.value.flatMap(g => g.skills.map(s => s.key)));
  return props.allSkills.filter(s => !processedKeys.has(s.key));
});

function formatSkillTooltip(skill: AgentSkillOption & Partial<{ count: number }>) {
    const parts = [];
    const count = skill.count ?? 1;
    if (skill.defaultRatio) parts.push(`倍率: ${(skill.defaultRatio * 100).toFixed(0)}% x${count} = ${((skill.defaultRatio * count) * 100).toFixed(0)}%`);
    if (skill.defaultAnomaly) parts.push(`积蓄: ${skill.defaultAnomaly} x${count} = ${(skill.defaultAnomaly * count).toFixed(0)}`);
    return parts.join(' | ') || skill.name;
}

// === Buff 分组逻辑 ===

interface BuffWithStatus extends Buff {
  isActive: boolean;
}

const allBuffs = computed(() => {
  const active = props.selectedBuffs.map(b => Object.assign(Object.create(Object.getPrototypeOf(b)), b, { isActive: true }));
  const inactive = props.unselectedBuffs.map(b => Object.assign(Object.create(Object.getPrototypeOf(b)), b, { isActive: false }));
  return [...active, ...inactive] as BuffWithStatus[];
});

const groupedBuffs = computed(() => {
  const groups: Record<string, BuffWithStatus[]> = {};
  
  for (const buff of allBuffs.value) {
    const sourceLabel = getBuffSourceCn(buff.source);
    if (!groups[sourceLabel]) {
      groups[sourceLabel] = [];
    }
    groups[sourceLabel].push(buff);
  }

  // 定义显示顺序
  const order = ['角色天赋', '角色被动', '音擎效果', '驱动盘套装', '邦布', '其他增益'];
  
  return Object.entries(groups)
    .sort((a, b) => {
      const idxA = order.indexOf(a[0]);
      const idxB = order.indexOf(b[0]);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    })
    .map(([sourceLabel, buffs]) => ({
      sourceLabel,
      buffs: buffs.sort((a, b) => {
          // 激活的排前面
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return 0;
      })
    }));
});

function getBuffSourceCn(source: BuffSource): string {
  switch (source) {
    case BuffSource.AGENT_TALENT: return '角色天赋';
    case BuffSource.AGENT_PASSIVE: return '角色被动';
    case BuffSource.AGENT_CORE: return '核心技';
    case BuffSource.WENGINE: return '音擎效果';
    case BuffSource.WENGINE_TALENT: return '音擎效果';
    case BuffSource.DRIVE_DISK_2PC: return '驱动盘套装';
    case BuffSource.DRIVE_DISK_4PC: return '驱动盘套装';
    case BuffSource.TEAM_MATE: return '队友提供';
    case BuffSource.CORE_PASSIVE: return '核心被动';
    case BuffSource.POTENTIAL: return '潜能';
    default: return '其他增益';
  }
}

function formatBuffTooltip(buff: Buff) {
    // 简单截取描述，避免过长
    const desc = buff.description.length > 50 ? buff.description.substring(0, 50) + '...' : buff.description;
    const condition = buff.trigger_conditions ? `\n触发: ${buff.trigger_conditions}` : '';
    return `${desc}${condition}`;
}
</script>
