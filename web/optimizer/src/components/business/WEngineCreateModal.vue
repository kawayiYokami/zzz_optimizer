<template>
  <dialog class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      <h3 class="font-bold text-lg mb-4">添加音擎</h3>
      
      <div class="flex-1 overflow-y-auto space-y-4">
        <!-- 音擎选择 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">选择音擎</span>
          </label>
          <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            <button
              v-for="weapon in allWeapons.filter(w => w.id)"
              :key="weapon.id"
              @click="selectedWeaponId = weapon.id"
              class="btn btn-sm p-0 border border-base-300"
              :class="{
                'btn-primary': selectedWeaponId === weapon.id,
                'btn-outline': selectedWeaponId !== weapon.id
              }"
              :title="weapon.CHS"
            >
              <img :src="iconService.getWeaponIconById(weapon.id)" :alt="weapon.CHS" class="w-10 h-10 object-contain" />
            </button>
          </div>
        </div>

        <!-- 精炼等级选择 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">精炼等级</span>
          </label>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="refinement in refinementOptions"
              :key="refinement"
              @click="selectedRefinement = refinement"
              class="btn btn-sm"
              :class="{
                'btn-primary': selectedRefinement === refinement,
                'btn-outline': selectedRefinement !== refinement
              }"
            >
              R{{ refinement }}
            </button>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 确认信息 -->
        <div class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 class="font-bold">默认配置</h4>
            <p class="text-xs">等级: 60 | 突破: 5</p>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="$emit('cancel')">取消</button>
        <button class="btn btn-primary" @click="handleCreate" :disabled="!selectedWeaponId">添加</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="$emit('cancel')">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import { iconService } from '../../services/icon.service';
import { DataLoaderService } from '../../services/data-loader.service';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  created: [];
}>();

const saveStore = useSaveStore();

const selectedWeaponId = ref<string | null>(null);
const selectedRefinement = ref(1);
const refinementOptions = [1, 2, 3, 4, 5];
const errorMessage = ref<string | null>(null);

const allWeapons = computed(() => {
  const dataLoader = DataLoaderService.getInstance();
  const data = dataLoader.weaponData;
  if (!data) return [];
  
  // 从 Map 转换为数组，同时添加 id 字段
  return Array.from(data.entries()).map(([id, weapon]) => ({
    ...weapon,
    id: id
  }));
});

async function handleCreate() {
  console.log('[WEngineCreateModal] handleCreate 被调用');
  console.log('[WEngineCreateModal] selectedWeaponId:', selectedWeaponId.value);

  if (!selectedWeaponId.value) {
    console.warn('[WEngineCreateModal] 未选择音擎');
    return;
  }

  const weapon = allWeapons.value.find(w => w.id === selectedWeaponId.value);
  console.log('[WEngineCreateModal] 找到的音擎:', weapon);
  
  if (!weapon) {
    console.warn('[WEngineCreateModal] 未找到音擎数据');
    return;
  }

  errorMessage.value = null;

  try {
    console.log('[WEngineCreateModal] 开始创建音擎:', weapon.EN);
    const success = await saveStore.createWEngine(
      weapon.EN,
      60,
      selectedRefinement.value,
      5
    );

    console.log('[WEngineCreateModal] 创建结果:', success);

    if (success) {
      selectedWeaponId.value = null;
      selectedRefinement.value = 1;
      emit('created');
    } else {
      errorMessage.value = '创建音擎失败，请重试';
    }
  } catch (error) {
    console.error('[WEngineCreateModal] 创建音擎失败:', error);
    errorMessage.value = '创建音擎失败：' + (error instanceof Error ? error.message : '未知错误');
  }
}
</script>