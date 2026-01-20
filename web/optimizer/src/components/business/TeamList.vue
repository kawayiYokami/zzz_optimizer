<template>
  <div class="max-w-4xl mx-auto space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
      <!-- Existing Teams with name -->
      <div
        v-for="team in teamInstances"
        :key="team.id"
        class="flex flex-col gap-2"
      >
        <div class="text-center font-bold text-sm">{{ team.name }}</div>
        <TeamCard
          :team="team"
          :clickable="true"
          @click="$emit('select', team.id)"
        />
      </div>

      <!-- New Team Card (Always present) -->
      <div
        class="card border-2 border-dashed border-base-300 bg-base-100/50 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all min-h-30 flex items-center justify-center group"
        @click="$emit('create')"
      >
        <div class="flex flex-col items-center gap-2 text-base-content/40 group-hover:text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="text-sm font-medium">新建队伍</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import TeamCard from './TeamCard.vue';

const emit = defineEmits<{
  edit: [teamId: string];
  select: [teamId: string];
  create: [];
}>();

const saveStore = useSaveStore();

const teamInstances = computed(() => saveStore.teamInstances);
</script>