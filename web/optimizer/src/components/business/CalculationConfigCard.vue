<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4">
      <h3 class="font-bold text-sm">计算设置</h3>
      <div class="space-y-4 mt-2">
        <!-- Worker 数量 -->
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span>Worker 数量</span>
            <span>{{ workerCount }}</span>
          </div>
          <input
            type="range"
            min="1"
            max="16"
            :value="workerCount"
            @input="emit('update:workerCount', Number(($event.target as HTMLInputElement).value))"
            class="range range-xs range-primary"
          />
        </div>
        <!-- 驱动盘等级 -->
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span>驱动盘最低等级</span>
            <span>{{ minDiscLevel }}</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            :value="minDiscLevel"
            @input="emit('update:minDiscLevel', Number(($event.target as HTMLInputElement).value))"
            class="range range-xs range-primary"
          />
        </div>
      </div>

      <!-- 有效词条 -->
      <div class="divider my-2"></div>
      <h3 class="font-bold text-sm">有效词条</h3>
      <div class="flex flex-col gap-2 mt-2">
        <!-- 已选词条（上方） -->
        <div class="flex flex-wrap gap-1">
          <button
            v-for="stat in selectedStats"
            :key="stat.value"
            class="badge badge-primary cursor-pointer hover:badge-secondary"
            @click="emit('toggleEffectiveStat', stat.value)"
          >
            {{ stat.label }}
          </button>
        </div>
        <!-- 分割线 -->
        <div class="divider my-1"></div>
        <!-- 未选词条（下方） -->
        <div class="flex flex-wrap gap-1">
          <button
            v-for="stat in unselectedStats"
            :key="stat.value"
            class="badge badge-ghost cursor-pointer hover:badge-primary"
            @click="emit('toggleEffectiveStat', stat.value)"
          >
            {{ stat.label }}
          </button>
        </div>
      </div>

      <!-- 套装过滤 -->
      <div class="divider my-2"></div>
      <h3 class="font-bold text-sm">套装过滤</h3>
      <div class="flex flex-col gap-2 mt-2">
        <!-- 激活的套装徽章 -->
        <div class="flex flex-wrap gap-1">
          <!-- 无选择时 -->
          <div v-if="activeDiskSets.length === 0" class="badge badge-ghost">
            无（不激活任何四件套）
          </div>
          <!-- 有选择时 -->
          <div
            v-for="setId in activeDiskSets"
            :key="setId"
            class="badge badge-primary badge-outline cursor-pointer hover:badge-error"
            @click="removeSet(setId)"
            :title="'点击移除: ' + getSetName(setId)"
          >
            {{ getSetName(setId) }} ✕
          </div>
        </div>
        <!-- 配置按钮 -->
        <button
          class="btn btn-sm btn-outline"
          @click="openSetFilter"
        >
          配置套装过滤
        </button>
      </div>

      <!-- 套装过滤弹窗 -->
      <DriveDiskSetFilterModal
        v-model="showSetFilterModal"
        :active-sets="activeDiskSets"
        @update:active-sets="emit('update:activeDiskSets', $event)"
      />

      <!-- 组合明细 -->
      <div class="divider my-2"></div>
      <h3 class="font-bold text-sm">组合明细</h3>
      <div class="grid grid-cols-3 gap-2 mt-2">
        <!-- 剪枝统计 -->
        <div v-if="pruningStats.removed > 0" class="col-span-3 text-xs text-success">
          支配剪枝: {{ pruningStats.before }} → {{ pruningStats.after }} (-{{ pruningStats.removed }})
        </div>
        <!-- 位置组合数 -->
        <div v-for="slot in [1,2,3,4,5,6]" :key="slot" class="card bg-base-200 p-2 text-center">
          <div class="text-xs text-base-content/60">位置 {{ slot }}</div>
          <div class="font-mono font-bold text-sm">{{ formatCompact(estimatedCombinations.breakdown[`slot${slot}`] || 0) }}</div>
        </div>
        <!-- 总计 -->
        <div class="col-span-3 text-center mt-2">
          <div class="text-xs text-base-content/60">总计</div>
          <div class="font-mono font-bold text-primary text-lg">{{ formatCompact(estimatedCombinations.total) }}</div>
        </div>
      </div>

      <!-- 开始优化按钮 -->
      <div class="divider my-2"></div>
      <button
        class="btn btn-primary w-full"
        :disabled="!canStart || isRunning"
        @click="emit('startOptimization')"
      >
        <span v-if="isRunning" class="loading loading-spinner loading-sm"></span>
        {{ isRunning ? '正在计算...' : '开始优化' }}
      </button>
      <button
        v-if="isRunning"
        class="btn btn-error w-full mt-2"
        @click="emit('cancelOptimization')"
      >
        取消
      </button>

      <!-- 进度条 -->
      <div v-if="isRunning || progress" class="mt-4">
        <div class="flex justify-between text-xs mb-1">
          <span>进度</span>
          <span>{{ progressPercentage.toFixed(1) }}%</span>
        </div>
        <progress class="progress progress-primary w-full" :value="progressPercentage" max="100"></progress>
        <div class="grid grid-cols-3 gap-2 mt-2 text-center">
          <div>
            <div class="text-xs text-base-content/60">已处理</div>
            <div class="text-sm font-bold">{{ formatCompact(progress?.totalProcessed || 0) }}</div>
          </div>
          <div>
            <div class="text-xs text-base-content/60">速度</div>
            <div class="text-sm font-bold">{{ formatCompact(progress?.speed || 0) }}/s</div>
          </div>
          <div>
            <div class="text-xs text-base-content/60">剩余</div>
            <div class="text-sm font-bold">{{ formatTime(progress?.estimatedTimeRemaining || 0) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AggregatedProgress } from '../../optimizer/services';
import type { PropertyType } from '../../model/base';
import { useGameDataStore } from '../../stores/game-data.store';
import DriveDiskSetFilterModal from './DriveDiskSetFilterModal.vue';

// Props
interface StatOption {
  value: PropertyType;
  label: string;
}

interface PruningStats {
  before: number;
  after: number;
  removed: number;
}

interface CombinationEstimate {
  total: number;
  breakdown: Record<string, number>;
}

interface Props {
  workerCount: number;
  minDiscLevel: number;
  isRunning: boolean;
  progress: AggregatedProgress | null;
  selectedStats: StatOption[];
  unselectedStats: StatOption[];
  pruningStats: PruningStats;
  estimatedCombinations: CombinationEstimate;
  canStart: boolean;
  activeDiskSets: string[]; // 激活的驱动盘套装ID列表
}

const props = withDefaults(defineProps<Props>(), {
  workerCount: 1,
  minDiscLevel: 15,
  isRunning: false,
  progress: null,
  selectedStats: () => [],
  unselectedStats: () => [],
  pruningStats: () => ({ before: 0, after: 0, removed: 0 }),
  estimatedCombinations: () => ({ total: 0, breakdown: {} }),
  canStart: false,
  activeDiskSets: () => [],
});

// Emits
interface Emits {
  'update:workerCount': [count: number];
  'update:minDiscLevel': [level: number];
  'toggleEffectiveStat': [stat: PropertyType];
  'startOptimization': [];
  'cancelOptimization': [];
  'update:activeDiskSets': [sets: string[]];
}

const emit = defineEmits<Emits>();

// 状态
const gameDataStore = useGameDataStore();
const showSetFilterModal = ref(false);

// 计算属性
const progressPercentage = computed(() => {
  return props.progress?.percentage || 0;
});

// 方法
const formatCompact = (num: number) => {
  if (num === 0) return '0';
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿';
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString();
};

const formatTime = (seconds: number) => {
  if (!isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m${s}s`;
};

// 打开套装过滤弹窗
function openSetFilter(): void {
  showSetFilterModal.value = true;
}

// 移除套装
function removeSet(setId: string): void {
  const newSets = props.activeDiskSets.filter(id => id !== setId);
  emit('update:activeDiskSets', newSets);
}

// 获取套装名称
function getSetName(setId: string): string {
  const info = gameDataStore.getEquipmentInfo(setId);
  return info?.setName ?? setId;
}
</script>