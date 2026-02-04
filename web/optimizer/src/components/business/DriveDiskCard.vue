<template>
  <div
    class="card bg-base-100 shadow compact-card border border-base-300 w-52 transition-all overflow-hidden"
    :class="{ 'cursor-pointer hover:border-primary hover:shadow-2xl': !readonly }"
    @click="!readonly && emit('edit', disk.id)"
  >
    <!-- 顶部彩边 -->
    <div class="h-1 w-full" :class="rarityGradientClass"></div>

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
            <div class="flex gap-1 ml-auto">
              <!-- 角色头像（如果被装备） -->
              <div v-if="disk.equipped_agent" class="avatar">
                <div class="w-6 h-6 rounded-full overflow-hidden">
                  <img
                    v-if="getEquippedAgentIcon()"
                    :src="getEquippedAgentIcon()"
                    class="w-full h-full object-cover"
                    :alt="getEquippedAgentName()"
                  />
                  <div v-else class="w-full h-full bg-primary text-primary-content rounded-full flex items-center justify-center text-[10px]">
                    {{ getEquippedAgentName()?.charAt(0) || '?' }}
                  </div>
                </div>
              </div>
              <!-- 锁定按钮 -->
              <button
                class="btn btn-ghost btn-xs btn-circle"
                :class="{ 'text-warning': disk.locked }"
                @click.stop="toggleLocked"
                title="锁定/解锁"
              >
                <svg v-if="disk.locked" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </button>
              <!-- 弃置按钮 -->
              <button
                class="btn btn-ghost btn-xs btn-circle"
                :class="{ 'text-error': disk.trash }"
                @click.stop="toggleTrash"
                title="标记弃置"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Stat -->
      <div class="mt-2 flex justify-between items-center">
        <span class="text-sm font-semibold">{{ getMainStatName() }}</span>
        <span class="text-xl font-bold">{{ getMainStatValue() }}</span>
      </div>

      <!-- Sub Stats -->
      <div class="divider my-0 text-xs"></div>
      <div class="overflow-x-auto">
        <table class="table table-sm table-compact border-collapse">
          <tbody>
            <!-- 当前属性模式 -->
            <template v-if="!showIdealStats">
              <tr v-for="subStat in getSubStatsWithRolls()" :key="subStat.prop" class="border-none">
                <td class="py-1 px-1 border-none">{{ getPropName(subStat.prop) }}{{ subStat.rolls > 0 ? ` +${subStat.rolls}` : '' }}</td>
                <td class="text-right py-1 px-1 border-none">{{ formatValue(subStat.value, subStat.isPercent) }}</td>
              </tr>
            </template>
            <!-- 理想属性模式 -->
            <template v-else-if="perfectGrowth">
              <tr v-for="[prop, value] in perfectGrowth.subStats.entries()" :key="prop" class="border-none">
                <td class="py-1 px-1 border-none" :class="{ 'text-success': isUpgradedSubStat(prop) }">
                  {{ getPropName(prop) }}{{ value > 1 ? ` +${value - 1}` : '' }}
                  <span v-if="isAddedSubStat(prop)" class="text-success text-[10px]">NEW</span>
                </td>
                <td class="text-right py-1 px-1 border-none">-</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- 理想属性切换按钮 -->
      <button
        v-if="hasGrowthPotential"
        class="btn btn-xs w-full mt-1"
        :class="showIdealStats ? 'btn-success' : 'btn-ghost'"
        @click.stop="toggleIdealStats"
      >
        {{ showIdealStats ? '显示当前' : '显示理想' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DriveDisk } from '../../model/drive-disk';
import { getPropertyCnName, Rarity, PropertyType } from '../../model/base';
import { iconService } from '../../services/icon.service';
import { useSaveStore } from '../../stores/save.store';

// 驱动盘最大等级
const MAX_LEVELS: Record<string, number> = { 'S': 15, 'A': 12, 'B': 9 };

// 理想属性结果类型
type PerfectGrowthResult = ReturnType<DriveDisk['getPerfectGrowthStats']>;

const props = defineProps<{
  disk: DriveDisk;
  readonly?: boolean;
  effectiveStats?: PropertyType[]; // 有效词条，用于计算理想属性
  showIdealByDefault?: boolean; // 是否默认显示理想属性
}>();

const emit = defineEmits<{
  edit: [diskId: string];
  'update:locked': [diskId: string, locked: boolean];
  'update:trash': [diskId: string, trash: boolean];
}>();

function toggleLocked() {
  emit('update:locked', props.disk.id, !props.disk.locked);
}

function toggleTrash() {
  emit('update:trash', props.disk.id, !props.disk.trash);
}

const saveStore = useSaveStore();

// 是否显示理想属性（根据 showIdealByDefault 初始化）
const showIdealStats = ref(false);

// 计算是否有成长空间（未满级且有有效词条配置）
const hasGrowthPotential = computed(() => {
  if (!props.effectiveStats || props.effectiveStats.length === 0) return false;
  const rarityStr = Rarity[props.disk.rarity] as 'S' | 'A' | 'B';
  const maxLevel = MAX_LEVELS[rarityStr] ?? 0;
  return maxLevel > 0 && props.disk.level < maxLevel;
});

// 监听 showIdealByDefault 变化，自动切换显示模式
watch(() => props.showIdealByDefault, (newVal) => {
  if (hasGrowthPotential.value) {
    showIdealStats.value = newVal ?? false;
  }
}, { immediate: true });

// 计算理想属性
const perfectGrowth = computed((): PerfectGrowthResult | null => {
  if (!hasGrowthPotential.value || !props.effectiveStats) return null;
  return props.disk.getPerfectGrowthStats(props.effectiveStats);
});

// 检查副词条是否有提升（新增或强化）
function isUpgradedSubStat(prop: PropertyType): boolean {
  if (!perfectGrowth.value) return false;

  const currentRolls = props.disk.sub_stats.get(prop)?.value ?? 0;
  const idealRolls = perfectGrowth.value.subStats.get(prop) ?? 0;

  // 如果原来的没有，现在有了 → 新增
  if (currentRolls === 0 && idealRolls > 0) return true;

  // 如果原来有，且现在的次数更多 → 强化
  if (currentRolls > 0 && idealRolls > currentRolls) return true;

  return false;
}

// 检查副词条是否为新增（原来没有的）
function isAddedSubStat(prop: PropertyType): boolean {
  if (!perfectGrowth.value) return false;

  const currentRolls = props.disk.sub_stats.get(prop)?.value ?? 0;
  const idealRolls = perfectGrowth.value.subStats.get(prop) ?? 0;

  // 原来没有，现在有了
  return currentRolls === 0 && idealRolls > 0;
}

// 切换显示模式
function toggleIdealStats() {
  showIdealStats.value = !showIdealStats.value;
}

const rarityColorClass = computed(() => {
  switch (props.disk.rarity) {
    case Rarity.S: return 'bg-orange-500'; // S级
    case Rarity.A: return 'bg-purple-500'; // A级
    case Rarity.B: return 'bg-blue-500';   // B级
    default: return 'bg-base-300';
  }
});

const rarityGradientClass = computed(() => {
  switch (props.disk.rarity) {
    case Rarity.S: return 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500'; // S级：橙黄渐变
    case Rarity.A: return 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500'; // A级：紫粉渐变
    case Rarity.B: return 'bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500'; // B级：蓝青渐变
    default: return 'bg-base-300';
  }
});

const diskIconUrl = computed(() => {
    // 使用 game_id 获取套装图标
    return iconService.getEquipmentIconById(props.disk.game_id);
});

function getEquippedAgentName() {
  if (!props.disk.equipped_agent) return undefined;
  const agent = saveStore.agents.find(a => a.id === props.disk.equipped_agent);
  return agent?.name_cn;
}

function getEquippedAgentIcon() {
  if (!props.disk.equipped_agent) return undefined;
  const agent = saveStore.agents.find(a => a.id === props.disk.equipped_agent);
  return agent ? iconService.getCharacterAvatarById(agent.game_id) : undefined;
}

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
