<template>
  <dialog class="modal" :open="modelValue">
    <div class="modal-box max-w-6xl overflow-visible">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">位置 {{ slot }} 驱动盘限定</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="close">✕</button>
      </div>

      <!-- 主词条限定 -->
      <div class="mb-4">
        <div class="text-sm font-bold mb-2">主词条限定</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="stat in mainStatTypes"
            :key="stat"
            class="btn btn-sm"
            :class="isStatAllowed(stat) ? 'btn-primary' : 'btn-outline'"
            @click="toggleStat(stat)"
          >
            {{ getStatName(stat) }}
          </button>
        </div>
      </div>

      <!-- 驱动盘列表 -->
      <div class="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
        <!-- 可用驱动盘 -->
        <div>
          <div class="text-sm font-bold mb-2 text-success">
            可用驱动盘 ({{ availableDiscs.length }})
          </div>
          <div class="flex flex-wrap gap-2">
            <DriveDiskCard
              v-for="disc in availableDiscs"
              :key="disc.id"
              :disk="disc"
            />
          </div>
        </div>

        <!-- 被排除的驱动盘 -->
        <div>
          <div class="text-sm font-bold mb-2 text-error">
            被排除驱动盘 ({{ excludedDiscs.length }})
          </div>
          <div class="flex flex-wrap gap-2">
            <DriveDiskCard
              v-for="disc in excludedDiscs"
              :key="disc.id"
              :disk="disc"
              class="opacity-60"
            />
          </div>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close"></form>
  </dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DriveDisk } from '../../model/drive-disk';
import { PropertyType } from '../../model/base';
import { getPropertyCnName } from '../../model/base';
import DriveDiskCard from './DriveDiskCard.vue';

interface Props {
  modelValue: boolean;
  slot: number;
  availableDiscs: DriveDisk[];
  excludedDiscs: DriveDisk[];
  mainStatFilters: PropertyType[]; // 主词条限定器
}

interface Emits {
  'update:modelValue': [value: boolean];
  'update:mainStatFilters': [filters: PropertyType[]];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 收集所有主词条类型
const mainStatTypes = computed(() => {
  const stats = new Set<PropertyType>();
  [...props.availableDiscs, ...props.excludedDiscs].forEach(disc => {
    stats.add(disc.main_stat);
  });
  return Array.from(stats);
});

// 检查主词条是否允许
const isStatAllowed = (stat: PropertyType): boolean => {
  return props.mainStatFilters.includes(stat);
};

// 切换主词条限定状态
const toggleStat = (stat: PropertyType) => {
  const filters = [...props.mainStatFilters];
  const index = filters.indexOf(stat);
  if (index >= 0) {
    // 移除（排除）
    filters.splice(index, 1);
  } else {
    // 添加（允许）
    filters.push(stat);
  }
  emit('update:mainStatFilters', filters);
};

// 获取属性名称
const getStatName = (stat: PropertyType): string => {
  return getPropertyCnName(stat);
};

// 关闭弹窗
const close = () => {
  emit('update:modelValue', false);
};
</script>