<template>
  <div class="skill-list-card card bg-base-200 shadow-xl mt-6">
    <div class="card-body">
      <div class="flex justify-between items-center cursor-pointer hover:bg-base-300 rounded-lg p-2 -m-2 transition-colors" @click="emit('toggle-expand')">
        <h3 class="card-title">技能列表</h3>
        <button class="btn btn-ghost btn-sm">
          <span v-if="isSkillListExpanded">▼ 收起</span>
          <span v-else>▶ 展开</span>
        </button>
      </div>

      <div v-show="isSkillListExpanded" class="mt-4">
        <div v-if="!frontCharacterId" class="alert alert-warning">
          请先选择一个角色
        </div>
        <div v-else-if="!selectedCharacter" class="alert alert-warning">
          未找到角色数据
        </div>
        <div v-else-if="!selectedCharacter.agent.agentSkills || selectedCharacter.agent.agentSkills.skills.size === 0" class="alert alert-info">
          当前角色没有技能
        </div>
        <div v-else>
          <h4 class="text-center">角色技能</h4>
          <div class="space-y-6">
            <!-- 技能类型分组显示 -->
            <div
              v-for="[skillName, skill] in Array.from(selectedCharacter.agent.agentSkills.skills.entries())"
              :key="skillName"
              class="mb-4"
            >
              <h4 class="text-lg font-bold mb-3 text-primary">{{ skillName }}</h4>

              <!-- 技能段列表 -->
              <div class="space-y-2">
                <div
                  v-for="(segment, index) in skill.segments"
                  :key="index"
                  class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div class="card-body p-4">
                    <div class="flex justify-between items-start gap-4">
                      <!-- 段名称 -->
                      <div class="flex-shrink-0">
                        <span class="font-semibold text-base">
                          {{ segment.segmentName || '单段' }}
                        </span>
                      </div>

                      <!-- 技能数据 -->
                      <div class="flex flex-wrap gap-2 justify-end">
                        <div class="badge badge-primary badge-lg">
                          伤害倍率: {{ (segment.damageRatio * 100).toFixed(1) }}%
                        </div>
                        <div class="badge badge-secondary badge-lg">
                          失衡倍率: {{ (segment.stunRatio * 100).toFixed(1) }}%
                        </div>
                        <div v-if="segment.energyRecovery > 0" class="badge badge-info badge-lg">
                          能量回复: {{ segment.energyRecovery }}
                        </div>
                        <div v-if="segment.anomalyBuildup > 0" class="badge badge-accent badge-lg">
                          异常积蓄: {{ segment.anomalyBuildup }}
                        </div>
                        <div v-if="segment.decibelRecovery > 0" class="badge badge-success badge-lg">
                          喧响值: {{ segment.decibelRecovery }}
                        </div>
                      </div>
                    </div>

                    <!-- 额外信息（如果有） -->
                    <div
                      v-if="
                        segment.flashEnergyAccumulation > 0 ||
                        segment.corruptionShieldReduction > 0 ||
                        segment.energyExtraCost > 0
                      "
                      class="mt-2 flex flex-wrap gap-2 text-sm"
                    >
                      <div v-if="segment.flashEnergyAccumulation > 0" class="text-gray-500">
                        闪能累积: {{ segment.flashEnergyAccumulation }}
                      </div>
                      <div v-if="segment.corruptionShieldReduction > 0" class="text-gray-500">
                        秽盾削减: {{ segment.corruptionShieldReduction }}
                      </div>
                      <div v-if="segment.energyExtraCost > 0" class="text-gray-500">
                        额外能量消耗: {{ segment.energyExtraCost }}
                      </div>
                    </div>
                  </div>
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
import { ref, computed, watch } from 'vue';
import type { Agent } from '../../model/agent';

interface Props {
  frontCharacterId: string | null;
  availableCharacters?: Array<{ id: string; agent: Agent }>;
  isExpanded: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  availableCharacters: () => []
});

// Emits
const emit = defineEmits<{
  (e: 'toggle-expand'): void;
}>();

// Local state
const isSkillListExpanded = ref<boolean>(props.isExpanded);

// Watch for expand prop changes
watch(() => props.isExpanded, (newValue) => {
  isSkillListExpanded.value = newValue;
});

// 当前选中的角色
const selectedCharacter = computed(() => {
  console.log(`[DEBUG] SkillListCard: frontCharacterId = ${props.frontCharacterId}`);
  console.log(`[DEBUG] SkillListCard: availableCharacters =`, props.availableCharacters);
  if (!props.frontCharacterId) return null;
  const character = props.availableCharacters.find(c => c.id === props.frontCharacterId) || null;
  console.log(`[DEBUG] SkillListCard: selectedCharacter =`, character);
  if (character) {
    console.log(`[DEBUG] SkillListCard: character.agent.agentSkills =`, character.agent.agentSkills);
  }
  return character;
});
</script>

<style scoped>
.card {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-header {
  background-color: #f8f9fa;
  font-weight: bold;
}

.alert {
  margin-bottom: 0;
}
</style>
