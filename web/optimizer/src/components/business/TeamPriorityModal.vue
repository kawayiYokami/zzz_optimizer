<template>
  <dialog class="modal" :open="modelValue">
    <div class="modal-box max-w-4xl overflow-visible">
      <h3 class="font-bold text-lg mb-4">队伍优先级设置</h3>

      <div class="text-xs text-base-content/60 mb-4">
        数字越大优先级越高。优化时会排除优先级更高的队伍身上的驱动盘。
      </div>

      <div class="overflow-x-auto max-h-[60vh]">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>队伍名称</th>
              <th>前台角色</th>
              <th>后台角色</th>
              <th class="w-32">优先级</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="team in sortedTeams" :key="team.id">
              <td class="font-semibold">{{ team.name }}</td>
              <td>
                <div class="avatar">
                  <div class="w-10 h-10 rounded-full">
                    <img
                      v-if="getAgentIcon(team.frontAgent.id)"
                      :src="getAgentIcon(team.frontAgent.id)"
                      class="w-full h-full object-cover"
                      :alt="team.frontAgent.name_cn"
                    />
                    <div v-else class="w-full h-full bg-primary text-primary-content rounded-full flex items-center justify-center">
                      {{ team.frontAgent.name_cn?.charAt(0) || '?' }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div v-if="team.backAgents.length > 0" class="flex gap-1">
                  <div v-for="agent in team.backAgents" :key="agent.id" class="avatar">
                    <div class="w-10 h-10 rounded-full">
                      <img
                        v-if="getAgentIcon(agent.id)"
                        :src="getAgentIcon(agent.id)"
                        class="w-full h-full object-cover"
                        :alt="agent.name_cn"
                      />
                      <div v-else class="w-full h-full bg-primary text-primary-content rounded-full flex items-center justify-center">
                        {{ agent.name_cn?.charAt(0) || '?' }}
                      </div>
                    </div>
                  </div>
                </div>
                <span v-else class="text-base-content/40">-</span>
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="localPriorities[team.id]"
                  class="input input-sm input-bordered w-full"
                  min="0"
                  max="999"
                  @change="onPriorityChange(team.id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-action">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="close">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Team } from '../../model/team';
import { useSaveStore } from '../../stores/save.store';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  modelValue: boolean;
  currentTeamId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:excludedTeamIds': [teamIds: string[]];
}>();

const saveStore = useSaveStore();

// 本地优先级缓存
const localPriorities = ref<Record<string, number>>({});

// 获取所有队伍
const teams = computed(() => saveStore.teamInstances);

// 按优先级排序的队伍
const sortedTeams = computed(() => {
  return [...teams.value].sort((a, b) => {
    const priorityA = localPriorities.value[a.id] ?? a.priority;
    const priorityB = localPriorities.value[b.id] ?? b.priority;
    return priorityB - priorityA; // 降序排列
  });
});

// 初始化本地优先级
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    // 打开弹窗时，加载所有队伍的优先级
    localPriorities.value = {};
    teams.value.forEach(team => {
      localPriorities.value[team.id] = team.priority;
    });
  }
}, { immediate: true });

// 优先级变化时更新
function onPriorityChange(teamId: string) {
  const newPriority = localPriorities.value[teamId];
  if (newPriority !== undefined) {
    // 更新队伍优先级
    const team = teams.value.find(t => t.id === teamId);
    if (team) {
      team.priority = newPriority;
      saveStore.syncInstanceToRawSave();
      saveStore.saveToStorage();
    }
  }
  updateExcludedTeamIds();
}

// 更新排除的队伍ID列表
function updateExcludedTeamIds() {
  if (!props.currentTeamId) {
    emit('update:excludedTeamIds', []);
    return;
  }

  const currentPriority = localPriorities.value[props.currentTeamId] ?? 0;
  const excludedIds: string[] = [];

  teams.value.forEach(team => {
    if (team.id !== props.currentTeamId) {
      const teamPriority = localPriorities.value[team.id] ?? team.priority;
      if (teamPriority > currentPriority) {
        excludedIds.push(team.id);
      }
    }
  });

  emit('update:excludedTeamIds', excludedIds);
}

// 关闭弹窗
function close() {
  emit('update:modelValue', false);
}

// 获取角色圆形头像
function getAgentIcon(agentId: string) {
  const agent = teams.value.find(t => t.allAgents.some(a => a.id === agentId));
  if (!agent) return '';
  const targetAgent = agent.allAgents.find(a => a.id === agentId);
  if (!targetAgent) return '';
  return iconService.getCharacterAvatarById(targetAgent.game_id);
}
</script>