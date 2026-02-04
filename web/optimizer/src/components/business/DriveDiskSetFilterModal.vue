<template>
  <dialog class="modal" :open="modelValue">
    <div class="modal-box max-w-6xl overflow-visible">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">选择目标四件套</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="close">✕</button>
      </div>

      <!-- 说明文字 -->
      <div class="alert alert-info text-sm mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>选择一个目标四件套，优化器只会搜索包含4个以上该套装驱动盘的组合。</span>
      </div>

      <!-- 套装列表 - 使用网格布局 -->
      <div class="max-h-[600px] overflow-y-auto">
        <!-- 加载中 -->
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <!-- 套装网格 -->
        <div v-else class="grid grid-cols-4 gap-3">
          <!-- 套装卡片 -->
          <div
            v-for="set in availableSets"
            :key="set.id"
            class="card card-compact bg-base-200 transition-colors cursor-pointer hover:bg-base-300"
            :class="{ 'ring-2 ring-primary bg-primary/10': localTargetSetId === set.id }"
            @click="selectSet(set.id)"
          >
            <div class="card-body p-3 flex gap-3 items-start">
              <!-- 套装图标 -->
              <img
                :src="getSetIconUrl(set.icon)"
                class="w-14 h-14 rounded-lg object-cover bg-base-300 flex-shrink-0"
                :alt="set.name"
              />

              <!-- 右侧：开关和名字（上下排布） -->
              <div class="flex-1 min-w-0 flex flex-col gap-2">
                <!-- 开关 -->
                <div class="flex items-center justify-between">
                  <div class="font-bold text-sm">{{ set.name }}</div>
                  <input
                    type="radio"
                    name="target-set"
                    class="radio radio-primary"
                    :checked="localTargetSetId === set.id"
                    @change="selectSet(set.id)"
                  />
                </div>

                <!-- 套装描述 -->
                <div class="text-xs text-base-content/70 line-clamp-3">
                  4件套：{{ set.fourPieceDescription }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 无数据提示 -->
        <div v-if="!isLoading && availableSets.length === 0" class="text-center py-8 text-base-content/60">
          无可用的驱动盘套装
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="modal-action">
        <button class="btn btn-ghost" @click="clearSelection">清除选择</button>
        <button class="btn" @click="close">取消</button>
        <button class="btn btn-primary" @click="confirm">确定</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close"></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useGameDataStore } from '../../stores/game-data.store';
import { iconService } from '../../services/icon.service';

// Props
interface Props {
  modelValue: boolean;  // 弹窗显示状态
  targetSetId: string;  // 目标套装ID（单选）
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  targetSetId: '',
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:targetSetId': [setId: string];
}>();

// 状态
const gameDataStore = useGameDataStore();
const availableSets = ref<Array<{ id: string; name: string; icon: string; fourPieceDescription: string }>>([]);
const isLoading = ref(false);
const localTargetSetId = ref(props.targetSetId);

// 监听 props.targetSetId 变化
watch(() => props.targetSetId, (newSetId) => {
  localTargetSetId.value = newSetId;
});

// 监听弹窗打开，加载套装数据
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    await loadAvailableSets();
    // 重置本地状态
    localTargetSetId.value = props.targetSetId;
  }
});

// 加载可用套装
async function loadAvailableSets(): Promise<void> {
  if (availableSets.value.length > 0) {
    return; // 已加载过
  }

  isLoading.value = true;
  try {
    availableSets.value = await gameDataStore.getDriveDiskSets();
  } catch (err) {
    console.error('加载驱动盘套装失败:', err);
    availableSets.value = [];
  } finally {
    isLoading.value = false;
  }
}

// 选择套装（单选）
function selectSet(setId: string): void {
  localTargetSetId.value = setId;
}

// 清除选择
function clearSelection(): void {
  localTargetSetId.value = '';
}

// 确认选择
function confirm(): void {
  emit('update:targetSetId', localTargetSetId.value);
  emit('update:modelValue', false);
}

// 关闭弹窗
function close(): void {
  emit('update:modelValue', false);
}

// 获取套装图标URL
function getSetIconUrl(iconPath: string): string {
  return iconService.getEquipmentIconUrl(iconPath);
}

// 组件挂载时预加载数据
onMounted(() => {
  if (props.modelValue) {
    loadAvailableSets();
  }
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}
</style>