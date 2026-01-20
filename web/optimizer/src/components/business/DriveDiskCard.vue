<template>
  <div class="card bg-base-100 shadow-xl compact-card border border-base-300 w-52">

    <div class="card-body p-3 gap-1">
      <!-- Icon & Set Name -->
      <div class="flex items-center gap-2">
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
        <div class="flex flex-col overflow-hidden flex-1">
          <span class="font-bold text-sm truncate" :title="disk.set_name">{{ disk.set_name }}[{{ disk.position }}]</span>
          <div class="flex items-center gap-2">
            <span class="text-xs">Lv.{{ disk.level }}</span>
            <button class="btn btn-ghost btn-xs btn-circle ml-auto" v-if="disk.locked">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Stat -->
      <div class="mt-2 flex justify-between items-center">
        <span class="text-sm font-semibold">{{ getMainStatName() }}</span>
        <span class="text-xl font-bold">{{ getMainStatValue() }}</span>
      </div>

      <!-- Sub Stats -->
      <div class="divider my-1 text-xs">副词条</div>
      <div class="overflow-x-auto">
        <table class="table table-sm table-compact">
          <tbody>
            <tr v-for="subStat in getSubStatsWithRolls()" :key="subStat.prop">
              <td class="py-2">{{ getPropName(subStat.prop) }}{{ subStat.rolls > 0 ? ` +${subStat.rolls}` : '' }}</td>
              <td class="text-right py-0">{{ formatValue(subStat.value, subStat.isPercent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer: Equipped By -->
      <div v-if="disk.equipped_agent" class="mt-2 pt-2 border-t border-base-200 flex items-center gap-1 text-xs">
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
import { getPropertyCnName, Rarity } from '../../model/base';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  disk: DriveDisk;
}>();

const rarityColorClass = computed(() => {
  switch (props.disk.rarity) {
    case Rarity.S: return 'bg-orange-500'; // S级
    case Rarity.A: return 'bg-purple-500'; // A级
    case Rarity.B: return 'bg-blue-500';   // B级
    default: return 'bg-base-300';
  }
});

const diskIconUrl = computed(() => {
    // 使用 game_id 获取套装图标
    return iconService.getEquipmentIconById(props.disk.game_id);
});

function getMainStatName() {
  const propName = getPropertyCnName(props.disk.main_stat);
  // 检查主词条是否无法识别
  if (propName === props.disk.main_stat.toString()) {
    console.warn(`无法识别的驱动盘主词条:`, {
      diskId: props.disk.id,
      diskName: props.disk.set_name,
      propId: props.disk.main_stat
    });
  }
  return propName;
}

function getMainStatValue() {
  // 从 getStats() 中获取实际计算后的主词条数值
  const stats = props.disk.getStats();
  const actualValue = stats.out_of_combat.get(props.disk.main_stat);

  if (actualValue === undefined) {
    return formatValue(props.disk.main_stat_value.value, props.disk.main_stat_value.isPercent);
  }

  return formatValue(actualValue, props.disk.main_stat_value.isPercent);
}

function getPropName(prop: number) {
  return getPropertyCnName(prop);
}

function getSubStatsWithRolls() {
  const subStats = props.disk.getSubStatsWithRolls();

  // 检查是否有无法识别的词条
  subStats.forEach(subStat => {
    const propName = getPropertyCnName(subStat.prop);
    if (propName === subStat.prop.toString()) {
      console.warn(`无法识别的驱动盘词条:`, {
        diskId: props.disk.id,
        diskName: props.disk.set_name,
        propId: subStat.prop,
        value: subStat.value,
        isPercent: subStat.isPercent,
        rolls: subStat.rolls
      });
    }
  });

  return subStats;
}

function formatValue(value: number, isPercent: boolean) {
  // 如果明确是百分比，或者数值小于1，都显示百分比格式
  if (isPercent || Math.abs(value) < 1) {
    return (value * 100).toFixed(1) + '%';
  }
  return value.toFixed(0);
}
</script>

<style scoped>
.compact-card {
  min-height: 220px;
}
</style>