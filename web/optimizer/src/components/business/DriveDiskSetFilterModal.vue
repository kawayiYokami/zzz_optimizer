<template>
  <dialog class="modal" :open="modelValue">
    <div class="modal-box max-w-2xl overflow-visible">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">驱动盘套装过滤</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="close">✕</button>
      </div>

      <!-- 说明文字 -->
      <div class="alert alert-info text-sm mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>选择需要激活的四件套效果。未选择的套装将不会提供4件套加成。</span>
      </div>

      <!-- 套装列表 -->
      <div class="max-h-96 overflow-y-auto space-y-2">
        <!-- 加载中 -->
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <!-- 套装卡片 -->
        <div
          v-for="set in availableSets"
          :key="set.id"
          class="card card-compact bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
          :class="{ 'ring-2 ring-primary': activeSets.includes(set.id) }"
          @click="toggleSet(set.id)"
        >
          <div class="card-body p-3 flex gap-3 items-start">
            <!-- 勾选框 -->
            <input
              type="checkbox"
              class="checkbox checkbox-primary mt-1"
              :checked="activeSets.includes(set.id)"
              @click.stop="toggleSet(set.id)"
            />

            <!-- 套装图标 -->
            <img
              :src="set.icon"
              class="w-12 h-12 rounded-lg object-cover bg-base-300"
              :alt="set.name"
            />

            <!-- 套装信息 -->
            <div class="flex-1 min-w-0">
              <div class="font-bold text-base">{{ set.name }}</div>
              <div class="text-sm text-base-content/70 mt-1 line-clamp-2">
                4件套：{{ set.fourPieceDescription }}
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

// Props
interface Props {
  modelValue: boolean;  // 弹窗显示状态
  activeSets: string[]; // 已激活的套装ID列表
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  activeSets: () => [],
});

// Emits
interface Emits {
  'update:modelValue': (value: boolean) => void;
  'update:activeSets': (sets: string[]) => void;
}

const emit = defineEmits<Emits>();

// 状态
const gameDataStore = useGameDataStore();
const availableSets = ref<Array<{ id: string; name: string; icon: string; fourPieceDescription: string }>>([]);
const isLoading = ref(false);
const localActiveSets = ref<string[]>([...props.activeSets]);

// 监听 props.activeSets 变化
watch(() => props.activeSets, (newSets) => {
  localActiveSets.value = [...newSets];
}, { deep: true });

// 监听弹窗打开，加载套装数据
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    await loadAvailableSets();
    // 重置本地状态
    localActiveSets.value = [...props.activeSets];
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

// 切换套装选择状态
function toggleSet(setId: string): void {
  const index = localActiveSets.value.indexOf(setId);
  if (index > -1) {
    localActiveSets.value.splice(index, 1);
  } else {
    localActiveSets.value.push(setId);
  }
}

// 确认选择
function confirm(): void {
  emit('update:activeSets', [...localActiveSets.value]);
  emit('update:modelValue', false);
}

// 关闭弹窗
function close(): void {
  emit('update:modelValue', false);
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
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>