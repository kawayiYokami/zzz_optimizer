<template>
  <div
    class="card bg-base-100 shadow-sm border border-base-300 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
    @click="$emit('click', team.id)"
  >
    <div class="card-body p-3">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h4 class="font-bold truncate flex-1">{{ team.name }}</h4>
      </div>

      <!-- Agent Avatars -->
      <div class="flex gap-2 justify-center mt-2">
        <div
          v-for="(agent, index) in agents"
          :key="agent?.id || index"
          class="text-center relative"
          draggable="true"
          @dragstart="handleDragStart(index)"
          @dragend="handleDragEnd"
        >
          <div class="relative">
            <img
              v-if="agent"
              :src="iconService.getCharacterCircleById(agent.game_id)"
              :alt="agent.name_cn"
              class="w-12 h-12 rounded-full cursor-move"
              :class="{ 'opacity-50': draggedIndex === index }"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center text-xs opacity-50"
            >
              空
            </div>
            <!-- 前台标记 -->
            <div
              v-if="agent && index === 0"
              class="absolute -top-1 -right-1 badge badge-xs badge-primary"
            >
              前
            </div>
          </div>
          <div v-if="agent" class="text-xs mt-1 opacity-60 truncate max-w-12">
            {{ agent.name_cn }}
          </div>
          <div v-if="agent" class="text-xs opacity-50">
            Lv.{{ agent.level }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Team } from '../../model/team';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  team: Team;
}>();

const emit = defineEmits<{
  click: [teamId: string];
  dragStart: [index: number];
  dragEnd: [];
  drop: [fromIndex: number, toIndex: number];
  remove: [index: number];
}>();

const draggedIndex = ref<number | null>(null);

// 简单的computed，无复杂逻辑
const agents = computed(() => [
  props.team.frontAgent,
  props.team.backAgents[0] ?? null,
  props.team.backAgents[1] ?? null,
]);

const agentCount = computed(() => {
  return agents.value.filter(a => a !== null).length;
});

function handleDragStart(index: number) {
  draggedIndex.value = index;
  emit('dragStart', index);
}

function handleDragEnd() {
  draggedIndex.value = null;
  emit('dragEnd');
}
</script>
