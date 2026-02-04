<template>
  <div class="card bg-base-100 shadow border border-base-300">
    <div class="card-body p-4 gap-3">
      <!-- 标题 -->
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-base flex items-center gap-2">
          <i class="ri-focus-3-line text-secondary"></i>
          有效词条
        </h3>
        <button
          v-if="hasChanges"
          class="btn btn-xs btn-ghost text-base-content/50"
          @click="resetToDefault"
          title="重置为默认"
        >
          <i class="ri-refresh-line"></i>
          重置
        </button>
      </div>

      <!-- 已选词条 -->
      <div class="bg-base-200/50 rounded-lg p-3">
        <div v-if="selectedStats.length > 0" class="flex flex-wrap gap-2">
          <button
            v-for="stat in selectedStats"
            :key="stat.value"
            class="badge badge-lg badge-primary gap-1 cursor-pointer hover:badge-error transition-colors"
            @click="toggleStat(stat.value)"
            :title="`点击移除 ${stat.label}`"
          >
            {{ stat.label }}
            <i class="ri-close-line text-xs"></i>
          </button>
        </div>
        <div v-else class="text-sm text-base-content/50 text-center py-2">
          <i class="ri-information-line mr-1"></i>
          未选择有效词条
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="divider my-0 text-xs text-base-content/40">
        <i class="ri-add-circle-line mr-1"></i>
        点击添加
      </div>

      <!-- 可选词条分组 -->
      <div class="space-y-3">
        <!-- 基础属性 -->
        <div v-if="groupedUnselected.basic.length > 0">
          <div class="text-xs text-base-content/50 mb-1.5 font-medium">基础属性</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="stat in groupedUnselected.basic"
              :key="stat.value"
              class="badge badge-outline badge-sm gap-1 cursor-pointer hover:badge-primary transition-colors"
              @click="toggleStat(stat.value)"
              :title="`点击添加 ${stat.label}`"
            >
              {{ stat.label }}
              <i class="ri-add-line text-xs opacity-50"></i>
            </button>
          </div>
        </div>

        <!-- 暴击属性 -->
        <div v-if="groupedUnselected.crit.length > 0">
          <div class="text-xs text-base-content/50 mb-1.5 font-medium">暴击属性</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="stat in groupedUnselected.crit"
              :key="stat.value"
              class="badge badge-outline badge-sm gap-1 cursor-pointer hover:badge-warning transition-colors"
              @click="toggleStat(stat.value)"
              :title="`点击添加 ${stat.label}`"
            >
              {{ stat.label }}
              <i class="ri-add-line text-xs opacity-50"></i>
            </button>
          </div>
        </div>

        <!-- 异常属性 -->
        <div v-if="groupedUnselected.anomaly.length > 0">
          <div class="text-xs text-base-content/50 mb-1.5 font-medium">异常属性</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="stat in groupedUnselected.anomaly"
              :key="stat.value"
              class="badge badge-outline badge-sm gap-1 cursor-pointer hover:badge-accent transition-colors"
              @click="toggleStat(stat.value)"
              :title="`点击添加 ${stat.label}`"
            >
              {{ stat.label }}
              <i class="ri-add-line text-xs opacity-50"></i>
            </button>
          </div>
        </div>

        <!-- 属性伤害 -->
        <div v-if="groupedUnselected.element.length > 0">
          <div class="text-xs text-base-content/50 mb-1.5 font-medium">属性伤害</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="stat in groupedUnselected.element"
              :key="stat.value"
              class="badge badge-outline badge-sm gap-1 cursor-pointer hover:badge-info transition-colors"
              @click="toggleStat(stat.value)"
              :title="`点击添加 ${stat.label}`"
            >
              {{ stat.label }}
              <i class="ri-add-line text-xs opacity-50"></i>
            </button>
          </div>
        </div>

        <!-- 其他属性 -->
        <div v-if="groupedUnselected.other.length > 0">
          <div class="text-xs text-base-content/50 mb-1.5 font-medium">其他属性</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="stat in groupedUnselected.other"
              :key="stat.value"
              class="badge badge-outline badge-sm gap-1 cursor-pointer hover:badge-secondary transition-colors"
              @click="toggleStat(stat.value)"
              :title="`点击添加 ${stat.label}`"
            >
              {{ stat.label }}
              <i class="ri-add-line text-xs opacity-50"></i>
            </button>
          </div>
        </div>
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
</script>
