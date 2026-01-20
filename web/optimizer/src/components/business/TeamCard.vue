<template>
  <div
    class="card shadow-sm border border-base-300 transition-all relative"
    :class="[
      teamRarityClass,
      {
        'cursor-pointer hover:shadow-md hover:scale-[1.02]': clickable
      }
    ]"
    @click="clickable ? $emit('click', team.id) : null"
  >
    <div class="card-body p-0">
      <!-- Agent Avatars using carousel -->
      <div class="carousel rounded-box w-full h-32">
        <div
          v-for="(agent, index) in agents"
          :key="agent?.id || index"
          class="carousel-item w-1/3 relative"
        >
          <img
            v-if="agent"
            :src="iconService.getCharacterCropById(agent.game_id)"
            :alt="agent.name_cn"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full bg-base-200 flex items-center justify-center text-xs opacity-50"
          >
            空
          </div>
          <!-- Agent Name Overlay -->
          <div
            v-if="agent"
            class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2"
          >
            <div class="text-xs text-white font-bold truncate text-center">{{ agent.name_cn }}</div>
          </div>
          <!-- 前台标记 (左上角旗帜图标) -->
          <div
            v-if="agent && index === 0"
            class="absolute top-2 left-2 bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center"
          >
            <i class="ri-flag-2-fill text-sm"></i>
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
  clickable?: boolean;
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

// 计算队伍稀有度背景色
const teamRarityClass = computed(() => {
  const validAgents = agents.value.filter(a => a !== null);
  if (validAgents.length === 0) return 'bg-base-100';
  
  // 检查是否有S级角色
  const hasSSR = validAgents.some(agent => agent.rarity === 4);
  
  if (hasSSR) {
    return 'bg-gradient-to-br from-[var(--rarity-s-gradient-start)] to-[var(--rarity-s-gradient-end)]';
  } else {
    return 'bg-gradient-to-br from-[var(--rarity-a-gradient-start)] to-[var(--rarity-a-gradient-end)]';
  }
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
