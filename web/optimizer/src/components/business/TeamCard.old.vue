<template>
  <div class="card bg-base-100 shadow-xl border border-base-300">
    <div class="card-body p-4">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-bold">队伍配置</h3>
          <input
            v-model="teamName"
            type="text"
            placeholder="队伍名称"
            class="input input-sm input-bordered w-32"
            maxlength="20"
          />
        </div>
        <div class="flex gap-2">
          <button
            v-if="hasAnyAgent"
            class="btn btn-sm btn-primary"
            @click="saveTeam"
            :disabled="!canSave"
            title="保存队伍"
          >
            {{ isEditMode ? '更新' : '保存' }}
          </button>
          <button
            v-if="isEditMode"
            class="btn btn-sm btn-error btn-outline"
            @click="deleteCurrentTeam"
            title="删除队伍"
          >
            删除
          </button>
          <button
            class="btn btn-sm btn-ghost"
            @click="clearTeam"
            title="清空队伍"
          >
            清空
          </button>
        </div>
      </div>

      <!-- Team Slots -->
      <div class="flex gap-3 justify-center">
        <TeamSlotCard
          v-for="(agent, index) in agents"
          :key="index"
          :agent="agent"
          :is-front="index === 0"
          :show-swap="index > 0 && agents[index === 1 ? 2 : 1] !== null"
          @click="openAgentSelector(index)"
          @set-front="setFront(index)"
          @swap="swapOrder(index)"
          @remove="removeAgent(index)"
        />
      </div>

      <!-- Status Message -->
      <div v-if="statusMessage" class="text-center mt-2">
        <div class="text-sm" :class="statusClass">{{ statusMessage }}</div>
      </div>
    </div>
  </div>

  <!-- Agent Selector Modal -->
  <dialog class="modal" :class="{ 'modal-open': showSelector }">
    <div class="modal-box max-w-4xl">
      <h3 class="font-bold text-lg mb-4">选择角色</h3>
      <div class="grid grid-cols-4 md:grid-cols-6 gap-3 max-h-[60vh] overflow-y-auto p-4">
        <div
          v-for="agent in availableAgents"
          :key="agent.id"
          class="cursor-pointer hover:ring-2 hover:ring-primary transition-all rounded-lg p-2 hover:bg-base-200"
          @click="selectAgent(agent)"
        >
          <img
            :src="iconService.getCharacterCircleById(agent.game_id)"
            :alt="agent.name_cn"
            class="w-16 h-16 rounded-full object-cover mx-auto"
          />
          <div class="text-center text-xs mt-1 truncate">{{ agent.name_cn }}</div>
        </div>
      </div>
      <div class="modal-action">
        <button class="btn" @click="showSelector = false">取消</button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Agent } from '../../model/agent';
import { iconService } from '../../services/icon.service';
import { useSaveStore } from '../../stores/save.store';
import TeamSlotCard from './TeamSlotCard.vue';

const props = defineProps<{
  teamId?: string; // 如果提供，则为编辑模式
}>();

const emit = defineEmits<{
  saved: [teamId: string];
  deleted: [teamId: string];
}>();

const saveStore = useSaveStore();

// State
const agents = ref<Array<Agent | null>>([null, null, null]);
const teamName = ref('');
const currentTeamId = ref<string | null>(null);
const showSelector = ref(false);
const selectedSlotIndex = ref(0);
const statusMessage = ref('');
const statusClass = ref('');

// Computed
const isEditMode = computed(() => !!currentTeamId.value);

const hasAnyAgent = computed(() => agents.value.some(a => a !== null));

const canSave = computed(() => {
  // 至少需要一个角色和队伍名称
  return hasAnyAgent.value && teamName.value.trim().length > 0;
});

const availableAgents = computed(() => {
  const usedAgentIds = new Set(
    agents.value.filter((a): a is Agent => a !== null).map(a => a.id)
  );
  return saveStore.agents.filter(agent => !usedAgentIds.has(agent.id));
});

// Watch for prop changes
watch(
  () => props.teamId,
  (newTeamId) => {
    if (newTeamId) {
      loadTeam(newTeamId);
    }
  },
  { immediate: true }
);

// Methods
function loadTeam(teamId: string) {
  const teamData = saveStore.teams.find(t => t.id === teamId);
  if (!teamData) {
    showStatus('队伍不存在', 'error');
    return;
  }

  currentTeamId.value = teamId;
  teamName.value = teamData.name;

  // 加载角色
  const agentMap = new Map(saveStore.agents.map(a => [a.id, a]));
  agents.value = [
    agentMap.get(teamData.frontCharacterId) ?? null,
    agentMap.get(teamData.backCharacter1Id) ?? null,
    agentMap.get(teamData.backCharacter2Id) ?? null,
  ];
}

function openAgentSelector(index: number) {
  selectedSlotIndex.value = index;
  showSelector.value = true;
}

function selectAgent(agent: Agent) {
  agents.value[selectedSlotIndex.value] = agent;
  showSelector.value = false;
}

function removeAgent(index: number) {
  agents.value[index] = null;
}

function setFront(index: number) {
  // 循环左移，把选中的角色移到第一位
  const newAgents = [...agents.value.slice(index), ...agents.value.slice(0, index)];
  agents.value = newAgents;
}

function swapOrder(index: number) {
  // 交换两个后台角色的位置
  const otherIndex = index === 1 ? 2 : 1;
  [agents.value[index], agents.value[otherIndex]] = [
    agents.value[otherIndex],
    agents.value[index],
  ];
}

function clearTeam() {
  agents.value = [null, null, null];
  if (!isEditMode.value) {
    teamName.value = '';
  }
  statusMessage.value = '';
}

function saveTeam() {
  if (!canSave.value) {
    showStatus('请至少选择一个角色并填写队伍名称', 'error');
    return;
  }

  const frontAgent = agents.value[0];
  if (!frontAgent) {
    showStatus('必须有前台角色', 'error');
    return;
  }

  try {
    if (isEditMode.value && currentTeamId.value) {
      // 更新现有队伍
      const success = saveStore.updateTeam(currentTeamId.value, {
        name: teamName.value.trim(),
        frontCharacterId: frontAgent.id,
        backCharacter1Id: agents.value[1]?.id ?? '',
        backCharacter2Id: agents.value[2]?.id ?? '',
      });

      if (success) {
        showStatus('队伍已更新', 'success');
        emit('saved', currentTeamId.value);
      } else {
        showStatus('更新失败', 'error');
      }
    } else {
      // 创建新队伍
      const newTeamId = saveStore.createTeam(
        teamName.value.trim(),
        frontAgent.id,
        agents.value[1]?.id,
        agents.value[2]?.id
      );

      if (newTeamId) {
        currentTeamId.value = newTeamId;
        showStatus('队伍已保存', 'success');
        emit('saved', newTeamId);
      } else {
        showStatus('保存失败', 'error');
      }
    }
  } catch (error) {
    console.error('保存队伍失败:', error);
    showStatus('保存失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
  }
}

function deleteCurrentTeam() {
  if (!currentTeamId.value) return;

  if (!confirm(`确定要删除队伍"${teamName.value}"吗？`)) {
    return;
  }

  const teamId = currentTeamId.value;
  const success = saveStore.deleteTeam(teamId);

  if (success) {
    showStatus('队伍已删除', 'success');
    emit('deleted', teamId);
    // 重置状态
    currentTeamId.value = null;
    clearTeam();
  } else {
    showStatus('删除失败', 'error');
  }
}

function showStatus(message: string, type: 'success' | 'error') {
  statusMessage.value = message;
  statusClass.value = type === 'success' ? 'text-success' : 'text-error';
  setTimeout(() => {
    statusMessage.value = '';
  }, 3000);
}
</script>