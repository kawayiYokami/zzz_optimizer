<template>
  <dialog class="modal" :open="modelValue">
    <div class="modal-box max-w-6xl overflow-visible">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">选择目标套装</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="close">✕</button>
      </div>

      <!-- 说明文字 -->
      <div class="alert alert-info text-sm mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>选择一个目标四件套（必选）和多个可选的两件套，优化器只会搜索这些套装的驱动盘组合。</span>
      </div>

      <!-- 套装列表 - 使用网格布局 -->
      <div class="max-h-[600px] overflow-y-auto">
        <!-- 加载中 -->
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <template v-else>
          <!-- 四件套区域 -->
          <div class="mb-6">
            <div class="flex items-center gap-2 mb-3">
              <h4 class="font-bold">目标四件套</h4>
              <span class="badge badge-primary badge-sm">必选</span>
            </div>
            <div class="grid grid-cols-4 gap-3">
              <!-- 套装卡片 -->
              <div
                v-for="set in availableSets"
                :key="'4pc-' + set.id"
                class="card card-compact bg-base-200 transition-colors cursor-pointer hover:bg-base-300"
                :class="{ 'ring-2 ring-primary bg-primary/10': localTargetSetId === set.id }"
                @click="selectFourPieceSet(set.id)"
              >
                <div class="card-body p-3 flex gap-3 items-start">
                  <!-- 套装图标 -->
                  <img
                    :src="getSetIconUrl(set.icon)"
                    class="w-14 h-14 rounded-lg object-cover bg-base-300 shrink-0"
                    :alt="set.name"
                  />

                  <!-- 右侧：开关和名字 -->
                  <div class="flex-1 min-w-0 flex flex-col gap-2">
                    <!-- 开关 -->
                    <div class="flex items-center justify-between">
                      <div class="font-bold text-sm">{{ set.name }}</div>
                      <input
                        type="radio"
                        name="target-four-piece-set"
                        class="radio radio-primary"
                        :checked="localTargetSetId === set.id"
                        @change="selectFourPieceSet(set.id)"
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
          </div>

          <!-- 分隔线 -->
          <div class="divider">可选两件套</div>

          <!-- 两件套区域 -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <h4 class="font-bold">目标两件套</h4>
              <span class="badge badge-secondary badge-sm">可多选</span>
              <span v-if="localTwoPieceSetIds.length > 0" class="text-sm text-base-content/70">
                已选 {{ localTwoPieceSetIds.length }} 个
              </span>
            </div>
            <div class="grid grid-cols-4 gap-3">
              <!-- 套装卡片 -->
              <div
                v-for="set in availableSets"
                :key="'2pc-' + set.id"
                class="card card-compact bg-base-200 transition-colors cursor-pointer hover:bg-base-300"
                :class="{
                  'ring-2 ring-secondary bg-secondary/10': localTwoPieceSetIds.includes(set.id),
                  'opacity-50': set.id === localTargetSetId
                }"
                @click="toggleTwoPieceSet(set.id)"
              >
                <div class="card-body p-3 flex gap-3 items-start">
                  <!-- 套装图标 -->
                  <img
                    :src="getSetIconUrl(set.icon)"
                    class="w-14 h-14 rounded-lg object-cover bg-base-300 shrink-0"
                    :alt="set.name"
                  />

                  <!-- 右侧：开关和名字 -->
                  <div class="flex-1 min-w-0 flex flex-col gap-2">
                    <!-- 开关 -->
                    <div class="flex items-center justify-between">
                      <div class="font-bold text-sm">{{ set.name }}</div>
                      <input
                        type="checkbox"
                        class="checkbox checkbox-secondary"
                        :checked="localTwoPieceSetIds.includes(set.id)"
                        :disabled="set.id === localTargetSetId"
                        @change="toggleTwoPieceSet(set.id)"
                        @click.stop
                      />
                    </div>

                    <!-- 套装描述 -->
                    <div class="text-xs text-base-content/70 line-clamp-3">
                      2件套：{{ set.twoPieceDescription }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

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
  targetSetId: string;  // 目标四件套ID（单选）
  targetTwoPieceSetIds: string[];  // 目标两件套ID（多选）
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  targetSetId: '',
  targetTwoPieceSetIds: () => [],
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:targetSetId': [setId: string];
  'update:targetTwoPieceSetIds': [setIds: string[]];
}>();

// 状态
const gameDataStore = useGameDataStore();
const availableSets = ref<Array<{ id: string; name: string; icon: string; fourPieceDescription: string; twoPieceDescription: string }>>([]);
const isLoading = ref(false);
const localTargetSetId = ref(props.targetSetId);
const localTwoPieceSetIds = ref<string[]>([...props.targetTwoPieceSetIds]);

// 监听 props 变化
watch(() => props.targetSetId, (newSetId) => {
  localTargetSetId.value = newSetId;
});

watch(() => props.targetTwoPieceSetIds, (newSetIds) => {
  localTwoPieceSetIds.value = [...newSetIds];
}, { deep: true });

// 监听弹窗打开，加载套装数据
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    await loadAvailableSets();
    // 重置本地状态
    localTargetSetId.value = props.targetSetId;
    localTwoPieceSetIds.value = [...props.targetTwoPieceSetIds];
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

// 选择四件套（单选）
function selectFourPieceSet(setId: string): void {
  localTargetSetId.value = setId;
  // 如果该套装在两件套中，移除它
  const idx = localTwoPieceSetIds.value.indexOf(setId);
  if (idx !== -1) {
    localTwoPieceSetIds.value.splice(idx, 1);
  }
}

// 切换两件套选择（多选）
function toggleTwoPieceSet(setId: string): void {
  // 不能选择已选为四件套的套装
  if (setId === localTargetSetId.value) {
    return;
  }

  const idx = localTwoPieceSetIds.value.indexOf(setId);
  if (idx === -1) {
    localTwoPieceSetIds.value.push(setId);
  } else {
    localTwoPieceSetIds.value.splice(idx, 1);
  }
}

// 清除选择
function clearSelection(): void {
  localTargetSetId.value = '';
  localTwoPieceSetIds.value = [];
}

// 确认选择
function confirm(): void {
  emit('update:targetSetId', localTargetSetId.value);
  emit('update:targetTwoPieceSetIds', [...localTwoPieceSetIds.value]);
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
