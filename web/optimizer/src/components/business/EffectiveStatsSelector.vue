<template>
  <div class="card bg-base-100 shadow border border-base-200 overflow-hidden">
    <!-- 顶部渐变装饰 -->
    <div class="h-1 bg-linear-to-r from-primary via-secondary to-accent"></div>

    <div class="card-body p-5 gap-4">
      <!-- 标题区域 -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-base-content">有效词条</h3>
          <p class="text-xs text-base-content/50 mt-0.5">用于驱动盘排序和优化</p>
        </div>
        <button
          v-if="hasChanges"
          class="btn btn-sm btn-ghost gap-1.5 hover:bg-base-200"
          @click="resetToDefault"
          title="重置为默认"
        >
          <i class="ri-refresh-line"></i>
          重置
        </button>
      </div>

      <!-- 已选词条区域 -->
      <div class="relative">
        <div class="absolute inset-0 bg-linear-to-br from-primary/5 to-secondary/5 rounded-xl -z-10"></div>
        <div class="bg-base-100/80 backdrop-blur-sm rounded-xl p-4 border border-primary/10">
          <div v-if="selectedStats.length > 0" class="flex flex-wrap gap-2">
            <button
              v-for="stat in selectedStats"
              :key="stat.value"
              class="group badge badge-lg gap-1.5 px-3 py-2 cursor-pointer hover:badge-error transition-all duration-200 hover:scale-105 shadow-sm"
              :class="getStatBadgeClass(stat.group)"
              @click="toggleStat(stat.value)"
              :title="`点击移除 ${stat.label}`"
            >
              {{ stat.label }}
              <i class="ri-close-circle-fill text-base-content/40 group-hover:text-base-content transition-colors"></i>
            </button>
          </div>
          <div v-else class="flex flex-col items-center justify-center py-6 text-center">
            <div class="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mb-2">
              <i class="ri-information-line text-2xl text-base-content/30"></i>
            </div>
            <p class="text-sm text-base-content/50 font-medium">未选择有效词条</p>
          </div>
        </div>
      </div>

      <!-- 可选词条分组 -->
      <div class="space-y-5">
        <!-- 基础属性 -->
        <template v-if="groupedUnselected.basic.length > 0">
          <div class="divider my-0 text-xs text-base-content/50 font-medium">基础属性</div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="stat in groupedUnselected.basic"
              :key="stat.value"
              class="btn btn-sm btn-outline border-base-300 hover:border-primary hover:bg-primary/5 hover:text-primary gap-2 justify-start transition-all duration-200 group"
              @click="toggleStat(stat.value)"
            >
              <span class="truncate">{{ stat.label }}</span>
              <i class="ri-add-line text-base-content/20 group-hover:text-primary ml-auto transition-colors"></i>
            </button>
          </div>
        </template>

        <!-- 暴击属性 -->
        <template v-if="groupedUnselected.crit.length > 0">
          <div class="divider my-0 text-xs text-base-content/50 font-medium">暴击属性</div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="stat in groupedUnselected.crit"
              :key="stat.value"
              class="btn btn-sm btn-outline border-base-300 hover:border-warning hover:bg-warning/5 hover:text-warning gap-2 justify-start transition-all duration-200 group"
              @click="toggleStat(stat.value)"
            >
              <span class="truncate">{{ stat.label }}</span>
              <i class="ri-add-line text-base-content/20 group-hover:text-warning ml-auto transition-colors"></i>
            </button>
          </div>
        </template>

        <!-- 异常属性 -->
        <template v-if="groupedUnselected.anomaly.length > 0">
          <div class="divider my-0 text-xs text-base-content/50 font-medium">异常属性</div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="stat in groupedUnselected.anomaly"
              :key="stat.value"
              class="btn btn-sm btn-outline border-base-300 hover:border-accent hover:bg-accent/5 hover:text-accent gap-2 justify-start transition-all duration-200 group"
              @click="toggleStat(stat.value)"
            >
              <span class="truncate">{{ stat.label }}</span>
              <i class="ri-add-line text-base-content/20 group-hover:text-accent ml-auto transition-colors"></i>
            </button>
          </div>
        </template>

        <!-- 属性伤害 -->
        <template v-if="groupedUnselected.element.length > 0">
          <div class="divider my-0 text-xs text-base-content/50 font-medium">属性伤害</div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="stat in groupedUnselected.element"
              :key="stat.value"
              class="btn btn-sm btn-outline border-base-300 hover:border-info hover:bg-info/5 hover:text-info gap-2 justify-start transition-all duration-200 group"
              @click="toggleStat(stat.value)"
            >
              <span class="truncate">{{ stat.label }}</span>
              <i class="ri-add-line text-base-content/20 group-hover:text-info ml-auto transition-colors"></i>
            </button>
          </div>
        </template>

        <!-- 其他属性 -->
        <template v-if="groupedUnselected.other.length > 0">
          <div class="divider my-0 text-xs text-base-content/50 font-medium">其他属性</div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="stat in groupedUnselected.other"
              :key="stat.value"
              class="btn btn-sm btn-outline border-base-300 hover:border-secondary hover:bg-secondary/5 hover:text-secondary gap-2 justify-start transition-all duration-200 group"
              @click="toggleStat(stat.value)"
            >
              <span class="truncate">{{ stat.label }}</span>
              <i class="ri-add-line text-base-content/20 group-hover:text-secondary ml-auto transition-colors"></i>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PropertyType } from '../../model/base';

const props = defineProps<{
  selectedStats: PropertyType[];
  defaultStats?: PropertyType[];
}>();

const emit = defineEmits<{
  'update:selectedStats': [stats: PropertyType[]];
}>();

// 有效词条选项（驱动盘可能出现的所有词条）
const effectiveStatOptions = [
  // 暴击相关
  { value: PropertyType.CRIT_, label: '暴击率', group: 'crit' },
  { value: PropertyType.CRIT_DMG_, label: '暴击伤害', group: 'crit' },
  // 攻击（包含固定值和百分比）
  { value: PropertyType.ATK_, label: '攻击', group: 'basic' },
  // 生命（包含固定值和百分比）
  { value: PropertyType.HP_, label: '生命', group: 'basic' },
  // 防御（包含固定值和百分比）
  { value: PropertyType.DEF_, label: '防御', group: 'basic' },
  // 穿透（包含固定值和百分比）
  { value: PropertyType.PEN_, label: '穿透', group: 'basic' },
  // 异常
  { value: PropertyType.ANOM_PROF, label: '异常精通', group: 'anomaly' },
  { value: PropertyType.ANOM_MAS_, label: '异常掌控', group: 'anomaly' },
  // 冲击力
  { value: PropertyType.IMPACT_, label: '冲击力', group: 'other' },
  // 能量
  { value: PropertyType.ENER_REGEN_, label: '能量回复', group: 'other' },
  // 属性伤害加成
  { value: PropertyType.PHYSICAL_DMG_, label: '物理伤害', group: 'element' },
  { value: PropertyType.FIRE_DMG_, label: '火伤害', group: 'element' },
  { value: PropertyType.ICE_DMG_, label: '冰伤害', group: 'element' },
  { value: PropertyType.ELECTRIC_DMG_, label: '电伤害', group: 'element' },
  { value: PropertyType.ETHER_DMG_, label: '以太伤害', group: 'element' },
];

// 已选词条
const selectedStats = computed(() => {
  return effectiveStatOptions.filter(opt => props.selectedStats.includes(opt.value));
});

// 未选词条
const unselectedStats = computed(() => {
  return effectiveStatOptions.filter(opt => !props.selectedStats.includes(opt.value));
});

// 分组的未选词条
const groupedUnselected = computed(() => {
  const groups: Record<string, typeof effectiveStatOptions> = {
    basic: [],
    crit: [],
    anomaly: [],
    element: [],
    other: [],
  };

  for (const stat of unselectedStats.value) {
    const group = stat.group || 'other';
    if (groups[group]) {
      groups[group].push(stat);
    }
  }

  return groups;
});

// 是否有变化（与默认值不同）
const hasChanges = computed(() => {
  if (!props.defaultStats) return false;
  if (props.selectedStats.length !== props.defaultStats.length) return true;
  return !props.selectedStats.every(s => props.defaultStats!.includes(s));
});

// 切换词条选中状态
function toggleStat(stat: PropertyType) {
  const current = [...props.selectedStats];
  const index = current.indexOf(stat);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(stat);
  }
  emit('update:selectedStats', current);
}

// 重置为默认值
function resetToDefault() {
  if (props.defaultStats) {
    emit('update:selectedStats', [...props.defaultStats]);
  }
}

// 获取属性badge样式类
function getStatBadgeClass(group: string) {
  const classMap: Record<string, string> = {
    basic: 'badge-neutral',
    crit: 'badge-warning',
    anomaly: 'badge-accent',
    element: 'badge-info',
    other: 'badge-secondary',
  };
  return classMap[group] || 'badge-ghost';
}
</script>

<style scoped>
</style>
