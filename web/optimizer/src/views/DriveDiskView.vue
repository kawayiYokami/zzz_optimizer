<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- 右侧滚动区域 -->
    <div class="flex-1 overflow-y-auto p-4 min-h-0 bg-base-200">
      <!-- 主容器（6XL宽度） -->
      <div class="max-w-6xl mx-auto">
        <!-- 过滤卡片 -->
        <div class="card bg-base-100 shadow-md mb-4">
          <div class="card-body p-4">
            <!-- 套装过滤 -->
            <div class="mb-4">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="set in availableSets"
                  :key="set"
                  @click="toggleSet(set)"
                  class="btn btn-circle btn-lg border border-base-300 p-0"
                  :class="{ 'btn-primary': filters.sets.includes(set) }"
                >
                  <img :src="getSetIcon(set)" :alt="set" class="w-10 h-10 object-contain" />
                </button>
              </div>
            </div>

            <!-- 分割线 -->
            <div class="divider my-3"></div>

            <!-- 部位按钮 -->
            <div>
              <div class="join w-full">
                <button
                  v-for="position in positions"
                  :key="position.value"
                  @click="selectPosition(position.value)"
                  class="btn btn-sm flex-1 join-item"
                  :class="{ 'btn-primary': filters.positions.length === 1 && filters.positions[0] === position.value }"
                >
                  {{ position.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 驱动盘列表 -->
        <div class="flex flex-wrap justify-center gap-4">
          <DriveDiskCard
            v-for="disk in filteredAndSortedDisks"
            :key="disk.id"
            :disk="disk"
          />
        </div>

        <!-- 空状态 -->
        <div v-if="filteredAndSortedDisks.length === 0" class="flex flex-col items-center justify-center min-h-100 text-base-content/50 text-xl">
          <div class="text-6xl mb-4">🔍</div>
          <p>没有找到符合条件的驱动盘</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../stores/save.store';
import DriveDiskCard from '../components/business/DriveDiskCard.vue';
import { DriveDiskPosition } from '../model/drive-disk';
import { iconService } from '../services/icon.service';

const saveStore = useSaveStore();

// 筛选条件
const filters = ref({
  sets: [] as string[],
  positions: [DriveDiskPosition.SLOT_1] as DriveDiskPosition[],
});

// 部位选项
const positions = [
  { value: DriveDiskPosition.SLOT_1, label: '1' },
  { value: DriveDiskPosition.SLOT_2, label: '2' },
  { value: DriveDiskPosition.SLOT_3, label: '3' },
  { value: DriveDiskPosition.SLOT_4, label: '4' },
  { value: DriveDiskPosition.SLOT_5, label: '5' },
  { value: DriveDiskPosition.SLOT_6, label: '6' },
];

// 计算属性
const allDisks = computed(() => saveStore.driveDisks);

// 可用套装列表（从所有驱动盘中提取）
const availableSets = computed(() => {
  const setNames = new Set<string>();
  allDisks.value.forEach(disk => {
    if (disk.set_name) {
      setNames.add(disk.set_name);
    }
  });
  return Array.from(setNames).sort();
});

// 筛选和排序后的驱动盘
const filteredAndSortedDisks = computed(() => {
  let result = [...allDisks.value];

  // 应用套装筛选
  if (filters.value.sets.length > 0) {
    result = result.filter(disk =>
      filters.value.sets.includes(disk.set_name)
    );
  }

  // 应用部位筛选
  if (filters.value.positions.length > 0) {
    result = result.filter(disk =>
      filters.value.positions.includes(disk.position)
    );
  }

  // 排序：先按套装，再按部位，再按稀有度
  result.sort((a, b) => {
    // 套装名称排序
    const setCompare = a.set_name.localeCompare(b.set_name);
    if (setCompare !== 0) return setCompare;

    // 部位排序
    if (a.position !== b.position) return a.position - b.position;

    // 稀有度排序（S级在前）
    return b.rarity - a.rarity;
  });

  return result;
});

// 选择部位（单选模式）
function selectPosition(position: DriveDiskPosition) {
  filters.value.positions = [position];
}

// 清除套装筛选
function clearSetFilters() {
  filters.value.sets = [];
}

// 切换套装筛选
function toggleSet(setName: string) {
  const index = filters.value.sets.indexOf(setName);
  if (index === -1) {
    filters.value.sets.push(setName);
  } else {
    filters.value.sets.splice(index, 1);
  }
}

// 获取套装图标
function getSetIcon(setName: string): string {
  // 从所有驱动盘中找到该套装的game_id
  const disk = allDisks.value.find(d => d.set_name === setName);
  if (disk) {
    return iconService.getEquipmentIconById(disk.game_id);
  }
  return '';
}
</script>

<style scoped>
</style>