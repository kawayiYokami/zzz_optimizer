<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex flex-1 min-h-0">
      <!-- 左侧过滤栏 -->
      <div class="w-64 bg-base-100 border-r border-base-300 shrink-0 overflow-y-auto">
        <div class="p-4 space-y-6">
          <!-- 等级筛选 -->
          <div>
            <div class="flex items-center justify-between">
              <div class="font-semibold text-sm">满级</div>
              <input
                type="checkbox"
                v-model="filters.maxLevel"
                class="toggle toggle-sm"
              />
            </div>
          </div>

          <!-- 部位筛选 -->
          <div>
            <div class="font-semibold text-sm mb-2">部位</div>
            <div class="join w-full">
              <button
                v-for="position in positions"
                :key="position.value"
                @click="togglePosition(position.value)"
                class="btn btn-sm flex-1 join-item"
                :class="{ 'btn-active': filters.positions.includes(position.value) }"
              >
                {{ position.label }}
              </button>
            </div>
          </div>

          <!-- 套装筛选 -->
          <div>
            <details class="collapse collapse-arrow bg-base-200" open>
              <summary class="collapse-title font-semibold text-sm">套装</summary>
              <div class="collapse-content">
                <div class="space-y-2 pt-2">
                  <label v-for="set in availableSets" :key="set" class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      :value="set"
                      v-model="filters.sets"
                      class="checkbox checkbox-sm"
                    />
                    <img :src="getSetIcon(set)" :alt="set" class="w-6 h-6 object-contain" />
                    <span class="text-sm truncate flex-1">{{ set }}</span>
                  </label>
                </div>
              </div>
            </details>
          </div>

          <!-- 清除筛选 -->
          <button
            v-if="filters.sets.length > 0 || filters.positions.length > 0 || filters.maxLevel"
            @click="clearFilters"
            class="btn btn-sm btn-outline w-full"
          >
            清除筛选 ({{ filters.sets.length + filters.positions.length + (filters.maxLevel ? 1 : 0) }})
          </button>
        </div>
      </div>

      <!-- 右侧滚动区域 -->
      <div class="flex-1 overflow-y-auto p-4 min-h-0 bg-base-200">
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
  positions: [] as DriveDiskPosition[],
  maxLevel: false,
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

  // 应用等级筛选
  if (filters.value.maxLevel) {
    // 打开：只显示满级
    result = result.filter(disk => disk.level === 15);
  } else {
    // 关闭：只显示未满级
    result = result.filter(disk => disk.level < 15);
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

// 切换部位
function togglePosition(position: DriveDiskPosition) {
  const index = filters.value.positions.indexOf(position);
  if (index === -1) {
    filters.value.positions.push(position);
  } else {
    filters.value.positions.splice(index, 1);
  }
}

// 清除筛选
function clearFilters() {
  filters.value.sets = [];
  filters.value.positions = [];
  filters.value.maxLevel = false;
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