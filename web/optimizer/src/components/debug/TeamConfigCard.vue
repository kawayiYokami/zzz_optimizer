<template>
  <div class="team-config-card card bg-base-200 shadow-xl mb-6">
    <div class="card-body">
      <h3 class="card-title">队伍配置</h3>

      <!-- 队伍选择 -->
      <div class="mb-4">
        <label class="label">
          <span class="label-text font-bold">选择队伍</span>
        </label>
        <select 
          v-model="localSelectedTeamId" 
          class="select select-bordered w-full"
          @change="handleTeamSelect"
        >
          <option value="">请选择队伍...</option>
          <option v-for="team in availableTeams" :key="team.id" :value="team.id">
            {{ team.name }}
          </option>
        </select>
      </div>

      <!-- 队伍详情 -->
      <div v-if="selectedTeam" class="bg-base-100 rounded-lg p-4">
        <div class="flex justify-between items-center mb-3">
          <h4 class="text-lg font-bold">{{ selectedTeam.name }}</h4>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- 前台角色 -->
          <div class="text-center p-4 bg-primary/10 rounded-lg">
            <div class="font-semibold text-primary mb-1">前台角色</div>
            <div class="text-xl font-bold mb-2">{{ getCharacterName(selectedTeam.frontCharacterId) }}</div>
            <div class="text-sm text-gray-500 mb-2">当前为前台</div>
          </div>
          <!-- 后台角色1 -->
          <div class="text-center p-4 bg-base-200 rounded-lg">
            <div class="font-semibold mb-1">后台角色1</div>
            <div class="text-xl font-bold mb-2">{{ getCharacterName(selectedTeam.backCharacter1Id) }}</div>
            <button 
              @click="setFrontCharacter(selectedTeam.backCharacter1Id)" 
              class="btn btn-xs btn-primary"
            >
              设置为前台
            </button>
          </div>
          <!-- 后台角色2 -->
          <div class="text-center p-4 bg-base-200 rounded-lg">
            <div class="font-semibold mb-1">后台角色2</div>
            <div class="text-xl font-bold mb-2">{{ getCharacterName(selectedTeam.backCharacter2Id) }}</div>
            <button 
              @click="setFrontCharacter(selectedTeam.backCharacter2Id)" 
              class="btn btn-xs btn-primary"
            >
              设置为前台
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ZodTeamData } from '../../model/save-data-zod';

// Props
interface Props {
  availableTeams: ZodTeamData[];
  selectedTeamId: string;
  availableCharacters: Array<{ id: string; name: string }>;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  (e: 'team-select', teamId: string): void;
  (e: 'set-front-character', characterId: string): void;
}>();

// Local state
const localSelectedTeamId = ref(props.selectedTeamId);

// Watch for prop changes
watch(() => props.selectedTeamId, (newValue) => {
  localSelectedTeamId.value = newValue;
});

// Computed properties
const selectedTeam = computed(() => {
  return props.availableTeams.find(t => t.id === localSelectedTeamId.value) || null;
});

// Methods
function handleTeamSelect() {
  emit('team-select', localSelectedTeamId.value);
}

function setFrontCharacter(characterId: string) {
  emit('set-front-character', characterId);
}

function getCharacterName(agentId: string): string {
  if (!agentId) return '未选择';
  const character = props.availableCharacters.find(c => c.id === agentId);
  return character?.name || agentId;
}
</script>

<style scoped>
.team-config-card {
  width: 100%;
}
</style>