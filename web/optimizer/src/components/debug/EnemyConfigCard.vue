<template>
  <div class="enemy-config-card card bg-base-200 shadow-xl mb-6">
    <div class="card-body">
      <h3 class="card-title">敌人配置</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 敌人选择 -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">选择敌人 (Lv.70)</span>
          </label>
          <select 
            v-model="localSelectedEnemyId" 
            class="select select-bordered w-full"
            @change="handleEnemySelect"
          >
            <option value="">请选择敌人...</option>
            <option v-for="enemy in availableEnemies" :key="enemy.id" :value="enemy.id">
              {{ enemy.CHS || enemy.EN }}
            </option>
          </select>
        </div>

        <!-- 失衡状态 -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">失衡状态</span>
          </label>
          <div class="flex items-center h-12">
            <label class="label cursor-pointer">
              <input
                v-model="localEnemyIsStunned"
                type="checkbox"
                class="checkbox checkbox-primary"
                :disabled="!localSelectedEnemyId || !selectedEnemy?.can_stun"
                @change="handleEnemyStunChange"
              />
              <span class="label-text ml-2">已失衡</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 敌人详情 -->
      <div v-if="selectedEnemy" class="mt-4 p-4 bg-base-100 rounded-lg">
        <h4 class="font-bold mb-3 text-lg">{{ selectedEnemy.CHS || selectedEnemy.EN }} (Lv.70)</h4>

        <!-- 基础属性 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div class="stat bg-base-200 rounded p-3">
            <div class="stat-title text-xs">生命值</div>
            <div class="stat-value text-lg">{{ (selectedEnemy.level_70_max_hp || 0).toFixed(0) }}</div>
          </div>
          <div class="stat bg-base-200 rounded p-3">
            <div class="stat-title text-xs">攻击力</div>
            <div class="stat-value text-lg">{{ (selectedEnemy.level_70_max_atk || 0).toFixed(0) }}</div>
          </div>
          <div class="stat bg-base-200 rounded p-3">
            <div class="stat-title text-xs">防御力</div>
            <div class="stat-value text-lg">{{ (selectedEnemy.level_60_plus_defense || 0).toFixed(0) }}</div>
          </div>
          <div class="stat bg-base-200 rounded p-3">
            <div class="stat-title text-xs">失衡值</div>
            <div class="stat-value text-lg">
              {{ selectedEnemy.can_stun ? (selectedEnemy.level_70_max_stun || 0).toFixed(0) : '无法失衡' }}
            </div>
          </div>
        </div>

        <!-- 标签 -->
        <div v-if="selectedEnemy.tags" class="mb-3">
          <span class="text-sm font-semibold">标签: </span>
          <span class="text-sm">{{ selectedEnemy.tags }}</span>
        </div>

        <!-- 抗性列表 -->
        <div v-if="displayedResistances.length > 0">
          <span class="text-sm font-semibold">元素抗性: </span>
          <div class="flex flex-wrap gap-2 mt-2">
            <div
              v-for="res in displayedResistances"
              :key="res.name"
              class="badge"
              :class="{
                'badge-error': res.value > 0,
                'badge-success': res.value < 0,
              }"
            >
              {{ res.name }}: {{ res.value > 0 ? '+' : '' }}{{ (res.value * 100).toFixed(1) }}%
            </div>
          </div>
        </div>

        <!-- 失衡状态 -->
        <div v-if="selectedEnemy.can_stun && localEnemyIsStunned" class="mt-3">
          <div class="alert alert-warning">
            <span>⚠️ 敌人已失衡</span>
          </div>
        </div>
      </div>

      <div v-if="!localSelectedEnemyId" class="text-center text-gray-500 py-8">
        请选择敌人
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// Props
interface Props {
  availableEnemies: any[];
  selectedEnemyId: string;
  enemyIsStunned: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  (e: 'enemy-select', enemyId: string): void;
  (e: 'enemy-stun-change', isStunned: boolean): void;
}>();

// Local state
const localSelectedEnemyId = ref(props.selectedEnemyId);
const localEnemyIsStunned = ref(props.enemyIsStunned);

// Watch for prop changes
watch(() => props.selectedEnemyId, (newValue) => {
  localSelectedEnemyId.value = newValue;
  if (!newValue) {
    localEnemyIsStunned.value = false;
    emit('enemy-stun-change', false);
  }
});

watch(() => props.enemyIsStunned, (newValue) => {
  localEnemyIsStunned.value = newValue;
});

// Computed properties
const selectedEnemy = computed(() => {
  return props.availableEnemies.find(e => e.id === localSelectedEnemyId.value) || null;
});

// 如果选中的敌人不能失衡，则自动取消失衡状态
watch(
  () => selectedEnemy.value?.can_stun,
  (canStun) => {
    if (!canStun) {
      localEnemyIsStunned.value = false;
      emit('enemy-stun-change', false);
    }
  }
);

// 显示的抗性列表（仅显示非0的抗性）
const displayedResistances = computed(() => {
  if (!selectedEnemy.value) return [];

  const elements = [
    { key: 'ice', name: '冰' },
    { key: 'fire', name: '火' },
    { key: 'electric', name: '电' },
    { key: 'physical', name: '物理' },
    { key: 'ether', name: '以太' },
  ];

  return elements
    .map(element => ({
      name: element.name,
      value: selectedEnemy.value![`${element.key}_dmg_resistance`] || 0,
    }))
    .filter(res => res.value !== 0);
});

// Methods
function handleEnemySelect() {
  emit('enemy-select', localSelectedEnemyId.value);
}

function handleEnemyStunChange() {
  emit('enemy-stun-change', localEnemyIsStunned.value);
}
</script>

<style scoped>
.enemy-config-card {
  width: 100%;
}
</style>