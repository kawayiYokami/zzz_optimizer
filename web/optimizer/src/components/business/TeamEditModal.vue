<template>
  <dialog v-if="show" class="modal modal-open">
    <div class="modal-box w-150 max-w-full overflow-visible">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-bold text-lg">
          {{ isEditMode ? '编辑队伍' : '创建队伍' }}
        </h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="cancel">✕</button>
      </div>

      <!-- Main Content -->
      <div class="flex flex-col gap-8">
        <!-- Team Name Input -->
        <div class="form-control w-full">
          <label class="label px-0 pt-0">
            <span class="label-text font-medium text-base-content/70">队伍名称</span>
          </label>
          <div class="relative">
             <input
              v-model="teamName"
              type="text"
              placeholder="输入队伍名称"
              class="input input-bordered w-full text-lg font-medium"
              maxlength="20"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-base-content/30">
              {{ teamName.length }}/20
            </span>
          </div>
        </div>

        <!-- Team Members Slots (Horizontal) -->
        <div class="flex items-center justify-between px-4">
          <template v-for="(agentId, index) in teamAgentIds" :key="index">
            
            <!-- Character Slot -->
            <div class="flex flex-col items-center gap-2">
              <div 
                class="relative group cursor-pointer transition-all hover:scale-105"
                @click="openSelector(index)"
              >
                <!-- Avatar Circle -->
                <div 
                  class="w-24 h-24 rounded-full border-4 overflow-hidden bg-base-200 flex items-center justify-center shadow-lg"
                  :class="agentId ? 'border-primary/20 group-hover:border-primary' : 'border-dashed border-base-300 group-hover:border-base-content/30'"
                >
                  <img
                    v-if="agentId"
                    :src="iconService.getCharacterAvatarById(getAgent(agentId)?.game_id || '')"
                    :alt="getAgent(agentId)?.name_cn"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-3xl text-base-content/20">+</span>
                </div>

                <!-- Position Label -->
                <div
                  v-if="index === 0"
                  class="absolute -bottom-2 left-1/2 -translate-x-1/2 badge badge-sm badge-primary shadow-md"
                >
                  前台
                </div>
              </div>
              
              <!-- Name Label -->
              <div class="text-sm font-medium h-5 mt-1 text-center min-w-[4em]">
                {{ agentId ? getAgent(agentId)?.name_cn : '空置' }}
              </div>
            </div>

            <!-- Swap Button (between slots) -->
            <div v-if="index < 2" class="flex flex-col items-center justify-center -mt-8 px-1">
               <button
                class="btn btn-circle btn-sm btn-ghost text-base-content/50 hover:text-primary hover:bg-primary/10 transition-colors"
                @click="swapAgents(index, index + 1)"
                title="交换位置"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M8 3 4 7l4 4" />
                   <path d="M4 7h16" />
                   <path d="m16 21 4-4-4-4" />
                   <path d="M20 17H4" />
                 </svg>
               </button>
            </div>

          </template>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-action mt-8 flex justify-between">
        <div>
          <button
            v-if="isEditMode"
            class="btn btn-error px-6 text-white"
            @click="deleteTeam"
          >
            删除队伍
          </button>
        </div>
        <button
          class="btn btn-primary px-8"
          :disabled="!canSave"
          @click="save"
        >
          {{ isEditMode ? '保存' : '创建' }}
        </button>
      </div>

      <!-- Character Selector Overlay -->
      <div v-if="selectingSlotIndex !== null" class="absolute inset-0 bg-base-100/95 z-50 rounded-2xl flex flex-col animate-fade-in">
        <!-- Overlay Header -->
        <div class="flex items-center justify-between p-4 border-b border-base-200">
          <h3 class="font-bold text-lg">
            选择角色
          </h3>
          <button class="btn btn-sm btn-circle btn-ghost" @click="closeSelector">✕</button>
        </div>

        <!-- Character Grid -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="grid grid-cols-5 gap-3">
            <!-- Remove Option -->
            <button 
              class="aspect-square rounded-xl border-2 border-dashed border-error/30 hover:border-error hover:bg-error/5 flex flex-col items-center justify-center gap-2 transition-all"
              @click="selectAgent('')"
            >
              <span class="text-error text-xl">✕</span>
              <span class="text-xs text-error font-medium">移除</span>
            </button>

            <!-- Available Agents -->
            <button
              v-for="agent in availableAgents"
              :key="agent.id"
              class="group relative aspect-square rounded-xl overflow-hidden bg-base-200 transition-all hover:ring-2 hover:ring-primary hover:scale-105"
              @click="selectAgent(agent.id)"
            >
              <img
                :src="iconService.getCharacterAvatarById(agent.game_id)"
                :alt="agent.name_cn"
                class="w-full h-full object-cover transition-transform group-hover:scale-110"
              />
              <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-1 pt-4 text-center">
                <div class="text-[10px] text-white truncate">{{ agent.name_cn }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Status Toast -->
      <div v-if="statusMessage" class="toast toast-top toast-center z-100">
        <div class="alert shadow-lg" :class="statusClass">
          <span>{{ statusMessage }}</span>
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import { iconService } from '../../services/icon.service';
import type { Agent } from '../../model/agent';

const props = defineProps<{
  teamId?: string;
  show: boolean;
}>();

const emit = defineEmits<{
  saved: [teamId: string];
  deleted: [teamId: string];
  cancel: [];
}>();

const saveStore = useSaveStore();

// State
const teamName = ref('');
const teamAgentIds = ref<Array<string>>(['', '', '']); // 3个位置
const statusMessage = ref('');
const statusClass = ref('');
const selectingSlotIndex = ref<number | null>(null);

// Computed
const isEditMode = computed(() => !!props.teamId);

const canSave = computed(() => {
  return teamName.value.trim().length > 0 && teamAgentIds.value[0] !== '';
});

// 计算可用角色列表（排除掉已经在队伍中其他位置的角色，但包含当前位置的角色）
const availableAgents = computed(() => {
  // 获取队伍中除了当前正在选择的位置之外的所有角色ID
  const otherUsedIds = new Set(
    teamAgentIds.value.filter((id, index) => index !== selectingSlotIndex.value && !!id)
  );
  
  return saveStore.agents.filter(a => !otherUsedIds.has(a.id));
});

// Watchers
watch(() => props.teamId, (newId) => {
  if (newId) {
    loadTeam(newId);
  } else {
    reset();
  }
}, { immediate: true });

watch(() => props.show, (newShow) => {
  if (!newShow) {
    statusMessage.value = '';
    selectingSlotIndex.value = null;
  }
});

// Methods
function getAgent(agentId: string): Agent | undefined {
  return saveStore.agents.find(a => a.id === agentId);
}

function loadTeam(teamId: string) {
  const team = saveStore.teams.find(t => t.id === teamId);
  if (!team) return;

  teamName.value = team.name;
  teamAgentIds.value = [
    team.frontCharacterId,
    team.backCharacter1Id,
    team.backCharacter2Id,
  ];
}

function reset() {
  teamName.value = '';
  teamAgentIds.value = ['', '', ''];
  statusMessage.value = '';
  selectingSlotIndex.value = null;
}

function openSelector(index: number) {
  selectingSlotIndex.value = index;
}

function closeSelector() {
  selectingSlotIndex.value = null;
}

function selectAgent(agentId: string) {
  if (selectingSlotIndex.value !== null) {
    teamAgentIds.value[selectingSlotIndex.value] = agentId;
    compactTeam();
    closeSelector();
  }
}

function swapAgents(index1: number, index2: number) {
  const temp = teamAgentIds.value[index1];
  teamAgentIds.value[index1] = teamAgentIds.value[index2];
  teamAgentIds.value[index2] = temp;
  compactTeam();
}

/**
 * 压缩队伍数组，移除中间的空洞，确保角色连续排列
 * 例如：[A, '', B] -> [A, B, '']
 */
function compactTeam() {
  const nonEmptyAgents = teamAgentIds.value.filter(id => !!id);
  // 重新填充数组，保证总是3个长度
  teamAgentIds.value = [
    nonEmptyAgents[0] || '',
    nonEmptyAgents[1] || '',
    nonEmptyAgents[2] || '',
  ];
}

function save() {
  if (!canSave.value) {
    showStatus('请至少设置前台角色并填写队伍名称', 'error');
    return;
  }

  try {
    if (isEditMode.value && props.teamId) {
      saveStore.updateTeam(props.teamId, {
        name: teamName.value.trim(),
        frontCharacterId: teamAgentIds.value[0],
        backCharacter1Id: teamAgentIds.value[1],
        backCharacter2Id: teamAgentIds.value[2],
      });
      showStatus('队伍已更新', 'success');
      setTimeout(() => emit('saved', props.teamId!), 500);
    } else {
      const newId = saveStore.createTeam(
        teamName.value.trim(),
        teamAgentIds.value[0],
        teamAgentIds.value[1],
        teamAgentIds.value[2]
      );
      if (newId) {
        showStatus('队伍已创建', 'success');
        setTimeout(() => {
          emit('saved', newId);
          reset();
        }, 500);
      } else {
        showStatus('创建队伍失败', 'error');
      }
    }
  } catch (error) {
    showStatus('保存失败', 'error');
  }
}

function deleteTeam() {
  if (!props.teamId || !confirm(`确定要删除队伍"${teamName.value}"吗？`)) return;
  
  if (saveStore.deleteTeam(props.teamId)) {
    showStatus('队伍已删除', 'success');
    setTimeout(() => emit('deleted', props.teamId!), 500);
  } else {
    showStatus('删除失败', 'error');
  }
}

function cancel() {
  emit('cancel');
}

function showStatus(message: string, type: 'success' | 'error') {
  statusMessage.value = message;
  statusClass.value = type === 'success' ? 'alert-success' : 'alert-error';
  setTimeout(() => {
    statusMessage.value = '';
  }, 2000);
}
</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out forwards;
}
</style>