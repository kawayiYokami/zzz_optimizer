<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4">
      <h3 class="font-bold text-sm">计算设置</h3>
      <div class="space-y-4 mt-2">
        <!-- Worker 数量 -->
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span>并行数</span>
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

      <!-- 目标套装 -->
              <div class="divider text-xs font-bold text-base-content/50 my-2">目标套装</div>      <div class="flex flex-col gap-2 mt-2">
        <!-- 四件套徽章 -->
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-xs text-base-content/60 mr-1">4件套:</span>
          <!-- 无选择时 -->
          <div v-if="!targetSetId" class="badge badge-warning badge-sm">
            请选择目标四件套
          </div>
          <!-- 有选择时 -->
          <div
            v-else
            class="badge badge-primary badge-outline cursor-pointer hover:badge-error gap-1"
            @click="openSetFilter"
            :title="'点击更换: ' + getSetName(targetSetId)"
          >
            <img
              v-if="getSetIconUrl(targetSetId)"
              :src="getSetIconUrl(targetSetId)"
              class="w-4 h-4 rounded"
              :alt="getSetName(targetSetId)"
            />
            {{ getSetName(targetSetId) }}
          </div>
        </div>
        <!-- 两件套徽章 -->
        <div class="flex flex-wrap gap-1 items-center">
          <span class="text-xs text-base-content/60 mr-1">2件套:</span>
          <!-- 无选择时 -->
          <div v-if="targetTwoPieceSetIds.length === 0" class="badge badge-ghost badge-sm">
            未限定
          </div>
          <!-- 有选择时 -->
          <div
            v-for="setId in targetTwoPieceSetIds"
            :key="setId"
            class="badge badge-secondary badge-outline cursor-pointer hover:badge-error gap-1"
            @click="openSetFilter"
            :title="'点击编辑: ' + getSetName(setId)"
          >
            <img
              v-if="getSetIconUrl(setId)"
              :src="getSetIconUrl(setId)"
              class="w-4 h-4 rounded"
              :alt="getSetName(setId)"
            />
            {{ getSetName(setId) }}
          </div>
        </div>
        <!-- 配置按钮 -->
        <button
          class="btn btn-base-200 w-full"
          @click="openSetFilter"
        >
          选择目标套装
        </button>
      </div>

      <!-- 套装选择弹窗 -->
      <DriveDiskSetFilterModal
        v-model="showSetFilterModal"
        :target-set-id="targetSetId"
        :target-two-piece-set-ids="targetTwoPieceSetIds"
        @update:target-set-id="emit('update:targetSetId', $event)"
        @update:target-two-piece-set-ids="emit('update:targetTwoPieceSetIds', $event)"
      />

      <!-- 有效词条 -->
      <div class="divider text-xs font-bold text-base-content/50 my-2">有效词条</div>
      <div class="flex flex-wrap gap-1.5 mt-2">
        <button
          v-for="stat in selectedStats"
          :key="stat.value"
          class="badge badge-md py-3 h-auto min-h-[1.5rem] cursor-pointer transition-all duration-200"
          :class="'badge-primary font-medium shadow-sm'"
          @click="emit('toggleEffectiveStat', stat.value)"
        >
          {{ stat.label }}
        </button>
        <button
          v-for="stat in unselectedStats"
          :key="stat.value"
          class="badge badge-md py-3 h-auto min-h-[1.5rem] cursor-pointer transition-all duration-200"
          :class="'badge-ghost border-base-300 text-base-content/60'"
          @click="emit('toggleEffectiveStat', stat.value)"
        >
          {{ stat.label }}
        </button>
      </div>

      <!-- 优化目标 -->
      <div class="divider text-xs font-bold text-base-content/50 my-2">优化目标</div>
      <div class="join w-full mt-2">
        <button
          class="btn join-item flex-1"
          :class="(objective ?? 'skill') === 'skill' ? 'btn-primary' : 'btn-base-200'"
          @click="emit('update:objective', 'skill')"
        >
          目标技能
        </button>
        <button
          class="btn join-item flex-1"
          :class="objective === 'atk' ? 'btn-primary' : 'btn-base-200'"
          @click="emit('update:objective', 'atk')"
        >
          攻击
        </button>
        <button
          class="btn join-item flex-1"
          :class="objective === 'hp' ? 'btn-primary' : 'btn-base-200'"
          @click="emit('update:objective', 'hp')"
        >
          生命
        </button>
      </div>

      <!-- 组合明细 -->
      <div class="divider text-xs font-bold text-base-content/50 my-2">组合明细</div>
      <div class="grid grid-cols-3 gap-2 mt-2">
        <!-- 剪枝统计 -->
        <div v-if="pruningStats.removed > 0" class="col-span-3 text-xs text-success">
          支配剪枝: {{ pruningStats.before }} → {{ pruningStats.after }} (-{{ pruningStats.removed }})
        </div>
        <!-- 位置组合数 -->
        <div
          v-for="slot in [1,2,3,4,5,6]"
          :key="slot"
          class="card bg-base-200 p-2 text-center cursor-pointer hover:bg-base-300 transition-colors"
          @click="openSlotFilter(slot)"
        >
          <div class="text-xs text-base-content/60">位置 {{ slot }}</div>
          <div class="font-mono font-bold text-sm">{{ formatCompact(estimatedCombinations.breakdown[`slot${slot}`] || 0) }}</div>
          <!-- 456位置主词条限定显示 -->
          <div v-if="slot >= 4 && getSlotMainStatFilters(slot).length > 0" class="mt-1">
            <div class="flex flex-wrap gap-0.5 justify-center">
              <span
                v-for="stat in getSlotMainStatFilters(slot)"
                :key="stat"
                class="badge badge-xs badge-primary"
                :title="'主词条限定: ' + getStatName(stat)"
              >
                {{ getStatName(stat) }}
              </span>
            </div>
          </div>
        </div>
        <!-- 总计 -->
        <div class="col-span-3 text-center mt-2">
          <div class="text-xs text-base-content/60">总计</div>
          <div class="font-mono font-bold text-primary text-lg">{{ formatCompact(estimatedCombinations.total) }}</div>
        </div>
      </div>

      <!-- 装备优先级 -->
      <div class="divider text-xs font-bold text-base-content/50 my-2">装备优先级</div>
      <div class="card bg-base-200 p-3 mt-2">
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <div class="text-xs text-base-content/60">当前优先级</div>
            <div class="font-mono font-bold text-lg text-primary">{{ currentTeamPriority }}</div>
          </div>
          <div class="flex flex-col gap-1 items-end">
            <div class="text-xs text-base-content/60">排除驱动盘</div>
            <div class="font-mono font-bold text-lg text-error">{{ excludedDiscsCount }}</div>
          </div>
          <button class="btn btn-sm btn-primary" @click="openPriorityModal">
            设置优先级
          </button>
        </div>
      </div>

      <!-- 队伍优先级弹窗 -->
      <TeamPriorityModal
        v-model="showPriorityModal"
        :current-team-id="currentTeamId"
        @update:excludedTeamIds="emit('update:excludedTeamIds', $event)"
      />


      <!-- 驱动盘位置限定弹窗 -->
      <DriveDiskSlotFilterModal
        v-model="showSlotFilterModal"
        :slot="selectedSlot"
        :available-discs="getSlotAvailableDiscs(selectedSlot)"
        :excluded-discs="getSlotExcludedDiscs(selectedSlot)"
        :main-stat-filters="getSlotMainStatFilters(selectedSlot)"
        @update:main-stat-filters="updateSlotMainStatFilters"
      />

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
import DriveDiskSlotFilterModal from './DriveDiskSlotFilterModal.vue';
import DriveDiskSetFilterModal from './DriveDiskSetFilterModal.vue';
import { iconService } from '../../services/icon.service';
import { getPropertyCnName } from '../../model/base';
import TeamPriorityModal from './TeamPriorityModal.vue';

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
  targetSetId: string; // 目标四件套ID（单选）
  targetTwoPieceSetIds: string[]; // 目标两件套ID列表（多选）
  objective?: 'skill' | 'atk' | 'hp'; // 优化目标（互斥）
  optimizedDiscs: any[]; // 优化后的驱动盘（已完成所有过滤）
  allDiscs: any[]; // 所有驱动盘
  constraints: any; // 约束配置（包含主词条限定器）
  currentTeamId?: string; // 当前队伍ID
  currentTeamPriority?: number; // 当前队伍优先级
  excludedDiscsCount?: number; // 排除的驱动盘数量
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
  targetSetId: '',
  targetTwoPieceSetIds: () => [],
  objective: 'skill',
  optimizedDiscs: () => [],
  allDiscs: () => [],
  constraints: () => ({}),
});

// Emits
interface Emits {
  'update:workerCount': [count: number];
  'update:minDiscLevel': [level: number];
  'toggleEffectiveStat': [stat: PropertyType];
  'startOptimization': [];
  'cancelOptimization': [];
  'update:targetSetId': [setId: string];
  'update:targetTwoPieceSetIds': [setIds: string[]];
  'update:objective': [objective: 'skill' | 'atk' | 'hp'];
  'update:mainStatFilters': [filters: any]; // 更新主词条限定器
  'update:excludedTeamIds': [teamIds: string[]]; // 更新排除的队伍ID列表
}

const emit = defineEmits<Emits>();

// 状态
const gameDataStore = useGameDataStore();
const showSlotFilterModal = ref(false);
const showSetFilterModal = ref(false);
const showPriorityModal = ref(false);
const selectedSlot = ref<number>(1);

// 可用的套装列表（从游戏数据中获取）
const availableSets = computed(() => {
  const equipmentList = gameDataStore.allEquipments || [];
  return equipmentList.map(info => ({
    id: info.id,
    name: info.CHS?.name ?? info.EN?.name ?? info.id,
  }));
});

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

// 获取套装名称
function getSetName(setId: string): string {
  const info = gameDataStore.getEquipmentInfo(setId);
  return info?.CHS?.name ?? info?.EN?.name ?? setId;
}

// 获取套装图标URL
function getSetIconUrl(setId: string): string {
  const info = gameDataStore.getEquipmentInfo(setId);
  if (!info?.icon) return '';
  return iconService.getEquipmentIconUrl(info.icon);
}

// 获取属性名称
function getStatName(stat: PropertyType): string {
  return getPropertyCnName(stat);
}

// 打开位置限定弹窗
function openSlotFilter(slot: number): void {
  selectedSlot.value = slot;
  showSlotFilterModal.value = true;
}

// 获取指定位置的可用驱动盘
function getSlotAvailableDiscs(slot: number) {
  return props.optimizedDiscs.filter(d => d.position === slot);
}

// 获取指定位置被排除的驱动盘
function getSlotExcludedDiscs(slot: number) {
  // 从所有驱动盘中获取该位置的盘
  const allSlotDiscs = props.allDiscs.filter(d => d.position === slot);
  const availableIds = new Set(props.optimizedDiscs.filter(d => d.position === slot).map(d => d.id));
  
  // 被排除的盘 = 该位置的所有盘 - 可用的盘
  return allSlotDiscs.filter(d => !availableIds.has(d.id));
}

// 获取指定位置的主词条限定器
function getSlotMainStatFilters(slot: number): PropertyType[] {
  return props.constraints.mainStatFilters?.[slot] || [];
}

// 更新位置的主词条限定器
function updateSlotMainStatFilters(filters: PropertyType[]): void {
  emit('update:mainStatFilters', {
    slot: selectedSlot.value,
    filters: filters
  });
}

// 打开优先级设置弹窗
function openPriorityModal(): void {
  showPriorityModal.value = true;
}

// 打开套装选择弹窗
function openSetFilter(): void {
  showSetFilterModal.value = true;
}
</script>
