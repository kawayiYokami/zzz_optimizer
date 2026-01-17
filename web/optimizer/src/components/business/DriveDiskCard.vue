<template>
  <div class="card bg-base-100 shadow-xl compact-card border border-base-300 w-64">
    <!-- Card Header: Rarity color top border -->
    <div :class="['h-1 w-full', rarityColorClass]"></div>
    
    <div class="card-body p-3 gap-1">
      <!-- Header: Level & Lock -->
      <div class="flex justify-between items-center text-xs">
        <span class="badge badge-sm badge-neutral">Lv.{{ disk.level }}</span>
        <button class="btn btn-ghost btn-xs btn-circle" v-if="disk.locked">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </button>
      </div>

      <!-- Icon & Set Name -->
      <div class="flex items-center gap-2 mt-1">
        <div class="avatar">
          <div class="w-10 h-10 rounded-full bg-base-200 p-1 overflow-hidden">
             <img
                v-if="diskIconUrl"
                :src="diskIconUrl"
                class="w-full h-full object-cover rounded-full"
                :alt="disk.set_name"
             />
             <div v-else class="w-full h-full bg-neutral-content rounded-full flex items-center justify-center text-xs">
                {{ disk.position }}
             </div>
          </div>
        </div>
        <div class="flex flex-col overflow-hidden">
          <span class="font-bold text-sm truncate" :title="disk.set_name">{{ disk.set_name }}</span>
          <span class="text-xs text-base-content/60">位置 {{ disk.position }}</span>
        </div>
      </div>

      <!-- Main Stat -->
      <div class="bg-base-200 rounded p-2 mt-2 flex justify-between items-center">
        <span class="text-sm font-semibold text-primary">{{ getMainStatName() }}</span>
        <span class="text-lg font-bold">{{ getMainStatValue() }}</span>
      </div>

      <!-- Sub Stats -->
      <div class="divider my-1 text-xs">副词条</div>
      <ul class="text-xs space-y-1">
        <li v-for="[prop, stat] in disk.sub_stats" :key="prop" class="flex justify-between items-center">
          <span class="text-base-content/80">{{ getPropName(prop) }}</span>
          <div class="flex items-center gap-2">
            <span>{{ formatValue(stat.value, stat.isPercent) }}</span>
            <span v-if="stat.value > 0" class="badge badge-xs badge-secondary bg-opacity-20 text-secondary border-none">
              +{{ stat.value }}
            </span>
          </div>
        </li>
      </ul>

      <!-- Footer: Equipped By -->
      <div v-if="disk.equipped_agent" class="mt-2 pt-2 border-t border-base-200 flex items-center gap-1 text-xs text-base-content/60">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>已装备</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DriveDisk } from '../../model/drive-disk';
import { getPropertyCnName } from '../../model/base';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  disk: DriveDisk;
}>();

const rarityColorClass = computed(() => {
  switch (props.disk.rarity) {
    case 3: return 'bg-orange-500'; // S
    case 2: return 'bg-purple-500'; // A
    case 1: return 'bg-blue-500';   // B
    default: return 'bg-base-300';
  }
});

const diskIconUrl = computed(() => {
    // 使用 game_id 获取套装图标
    return iconService.getEquipmentIconById(props.disk.game_id);
});

function getMainStatName() {
  return getPropertyCnName(props.disk.main_stat);
}

function getMainStatValue() {
  const val = props.disk.main_stat_value;
  return formatValue(val.value, val.isPercent);
}

function getPropName(prop: number) {
  return getPropertyCnName(prop);
}

function formatValue(value: number, isPercent: boolean) {
  if (isPercent) {
    return (value * 100).toFixed(1) + '%';
  }
  return value.toFixed(0);
}
</script>

<style scoped>
.compact-card {
  min-height: 280px;
}
</style>