<template>
  <dialog class="modal" :class="{ 'modal-open': isOpen }">
    <div class="modal-box max-w-5xl p-0 overflow-hidden flex flex-col h-[85vh]">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 bg-base-200 border-b border-base-300">
        <h3 class="text-xl font-bold">{{ title }}</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="closeDialog">✕</button>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center justify-center gap-4 p-4 bg-base-100 border-b border-base-300 shrink-0">
        <!-- 套装筛选（仅驱动盘） -->
        <div v-if="type === 'drive-disk'" class="flex items-center gap-2">
          <span class="text-sm font-semibold">套装：</span>
          <div class="flex flex-wrap items-center gap-2">
            <label v-for="set in availableSets" :key="set"
                   class="btn btn-ghost btn-circle p-0 w-10 h-10"
                   :class="{ 'bg-primary text-primary-content': filters.sets.includes(set) }">
              <input
                type="checkbox"
                :value="set"
                v-model="filters.sets"
                class="hidden"
              />
              <img :src="getSetIcon(set)" :alt="set" class="w-8 h-8 object-contain" :title="set" />
            </label>
          </div>
        </div>

        <!-- 部位筛选（仅驱动盘，且未指定部位时显示） -->
        <div v-if="type === 'drive-disk' && !position" class="flex items-center gap-2">
          <span class="text-sm font-semibold">部位：</span>
          <div class="flex items-center gap-2">
            <label v-for="position in positions" :key="position.value"
                   class="btn btn-ghost btn-circle p-0 w-10 h-10"
                   :class="{ 'bg-primary text-primary-content': filters.positions.includes(position.value) }">
              <input
                type="checkbox"
                :value="position.value"
                v-model="filters.positions"
                class="hidden"
              />
              {{ position.label }}
            </label>
          </div>
        </div>

        <!-- 评估模式开关（仅驱动盘且有角色时显示） -->
        <div v-if="type === 'drive-disk' && currentAgentEffectiveStats && currentAgentEffectiveStats.length > 0" class="flex items-center gap-2">
          <span class="text-sm font-semibold text-base-content/70">评估模式</span>
          <div class="flex items-center gap-1 bg-base-200 rounded-lg p-1">
            <button
              @click="evaluateAsMaxLevel = true"
              class="btn btn-xs gap-1.5"
              :class="evaluateAsMaxLevel ? 'btn-primary text-white' : 'btn-ghost text-base-content/60'"
            >
              <i class="ri-bar-chart-fill text-sm"></i>
              <span>满级</span>
            </button>
            <button
              @click="evaluateAsMaxLevel = false"
              class="btn btn-xs gap-1.5"
              :class="!evaluateAsMaxLevel ? 'btn-primary text-white' : 'btn-ghost text-base-content/60'"
            >
              <i class="ri-line-chart-fill text-sm"></i>
              <span>成长</span>
            </button>
          </div>
        </div>

        <!-- 武器类型筛选（仅音擎） -->
        <div v-if="type === 'wengine'" class="flex items-center gap-2">
          <span class="text-sm font-semibold">武器类型：</span>
          <div class="flex flex-wrap items-center gap-2">
            <label v-for="weaponType in weaponTypes" :key="weaponType.value"
                   class="btn btn-ghost btn-circle p-0 w-10 h-10"
                   :class="{ 'bg-primary text-primary-content': filters.weaponTypes.includes(weaponType.value) }">
              <input
                type="checkbox"
                :value="weaponType.value"
                v-model="filters.weaponTypes"
                class="hidden"
              />
              <img :src="getWeaponTypeIcon(weaponType.value)" :alt="weaponType.label" class="w-8 h-8 object-contain" :title="weaponType.label" />
            </label>
          </div>
        </div>
      </div>

      <!-- Grid -->
      <div class="flex-1 overflow-y-auto p-4 min-h-0">
        <div class="flex flex-wrap justify-center gap-4">
          <DriveDiskCard
            v-if="type === 'drive-disk'"
            v-for="disk in filteredItems"
            :key="disk.id"
            :disk="disk"
            :effective-stats="currentAgentEffectiveStats"
            :show-ideal-by-default="!evaluateAsMaxLevel"
            class="cursor-pointer hover:ring-2 hover:ring-primary relative"
            :class="{ 'ring-2 ring-success': isEquippedByCurrentAgent(disk) }"
            @click="selectItem(disk)"
          />
          <WEngineCard
            v-if="type === 'wengine'"
            v-for="wengine in filteredItems"
            :key="wengine.id"
            :wengine="wengine"
            class="cursor-pointer hover:ring-2 hover:ring-primary relative"
            :class="{ 'ring-2 ring-success': isEquippedByCurrentAgent(wengine) }"
            @click="selectItem(wengine)"
          />
        </div>

        <!-- Empty State -->
        <div v-if="filteredItems.length === 0" class="flex flex-col items-center justify-center min-h-50 text-base-content/50">
          <div class="text-4xl mb-2">🔍</div>
          <p>没有找到符合条件的装备</p>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click.prevent="closeDialog">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import DriveDiskCard from './DriveDiskCard.vue';
import WEngineCard from './WEngineCard.vue';
import { DriveDiskPosition, DriveDisk } from '../../model/drive-disk';
import { WEngine } from '../../model/wengine';
import { WeaponType, PropertyType, Rarity } from '../../model/base';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  isOpen: boolean;
  type: 'drive-disk' | 'wengine';
  position?: DriveDiskPosition; // 仅驱动盘需要
  agentId?: string; // 当前角色ID，用于显示已装备状态
}>();

const emit = defineEmits<{
  close: [];
  select: [item: DriveDisk | WEngine];
}>();

const saveStore = useSaveStore();

const filters = ref({
  sets: [] as string[],
  positions: [] as DriveDiskPosition[],
  weaponTypes: [] as WeaponType[],
});

// 评估模式：是否按满级评估
const evaluateAsMaxLevel = ref(true);

// 获取当前角色的有效词条
const currentAgentEffectiveStats = computed((): PropertyType[] => {
  if (!props.agentId) return [];
  const agent = saveStore.agents.find(a => a.id === props.agentId);
  return agent?.effective_stats ?? [];
});

// 计算驱动盘得分
function getDiskScore(disk: DriveDisk): number {
  const effectiveStats = currentAgentEffectiveStats.value;
  if (effectiveStats.length === 0) return 0;

  if (evaluateAsMaxLevel.value) {
    // 满级模式：直接比较当前有效词条得分
    return disk.getEffectiveStatCounts(effectiveStats);
  } else {
    // 非满级模式：计算完美成长期望得分
    const growth = disk.getPerfectGrowthStats(effectiveStats);
    // 根据完美成长后的副词条计算有效词条得分
    let score = 0;
    for (const [prop, value] of growth.subStats.entries()) {
      if (effectiveStats.includes(prop)) {
        score += value; // value 是强化次数
      }
    }
    return score;
  }
}

// 当指定了部位时，自动设置过滤条件
watch(() => props.position, (newPosition) => {
  if (newPosition !== undefined) {
    filters.value.positions = [newPosition];
  } else {
    filters.value.positions = [];
  }
}, { immediate: true });

// 部位选项
const positions = [
  { value: DriveDiskPosition.SLOT_1, label: '1' },
  { value: DriveDiskPosition.SLOT_2, label: '2' },
  { value: DriveDiskPosition.SLOT_3, label: '3' },
  { value: DriveDiskPosition.SLOT_4, label: '4' },
  { value: DriveDiskPosition.SLOT_5, label: '5' },
  { value: DriveDiskPosition.SLOT_6, label: '6' },
];

// 武器类型选项
const weaponTypes = [
  { value: WeaponType.ATTACK, label: '强攻' },
  { value: WeaponType.STUN, label: '击破' },
  { value: WeaponType.ANOMALY, label: '异常' },
  { value: WeaponType.SUPPORT, label: '支援' },
  { value: WeaponType.DEFENSE, label: '防护' },
];

const title = computed(() => {
  if (props.type === 'drive-disk') {
    return props.position !== undefined ? `选择驱动盘 - 部位 ${props.position}` : '选择驱动盘';
  }
  return '选择音擎';
});

// 所有装备
const allItems = computed(() => {
  if (props.type === 'drive-disk') {
    return saveStore.driveDisks;
  }
  return saveStore.wengines;
});

// 可用套装列表（仅驱动盘）
const availableSets = computed(() => {
  if (props.type !== 'drive-disk') return [];
  const setNames = new Set<string>();
  (allItems.value as DriveDisk[]).forEach(disk => {
    if (disk.set_name) {
      setNames.add(disk.set_name);
    }
  });
  return Array.from(setNames).sort();
});

// 筛选后的装备
const filteredItems = computed(() => {
  let result = [...allItems.value];

  if (props.type === 'drive-disk') {
    // 应用套装筛选
    if (filters.value.sets.length > 0) {
      result = result.filter((disk: DriveDisk) =>
        filters.value.sets.includes(disk.set_name)
      );
    }

    // 应用部位筛选
    if (filters.value.positions.length > 0) {
      result = result.filter((disk: DriveDisk) =>
        filters.value.positions.includes(disk.position)
      );
    }

    // 如果指定了部位，只显示该部位的驱动盘
    if (props.position !== undefined) {
      result = result.filter((disk: DriveDisk) => disk.position === props.position);
    }

    // 根据评估模式过滤等级
    if (currentAgentEffectiveStats.value.length > 0) {
      if (evaluateAsMaxLevel.value) {
        // 满级模式：只显示满级驱动盘
        result = result.filter((disk: DriveDisk) => {
          const rarityStr = Rarity[disk.rarity] as 'S' | 'A' | 'B';
          const maxLevel = { 'S': 15, 'A': 12, 'B': 9 }[rarityStr] ?? 0;
          if (maxLevel === 0) {
            console.warn(`Unknown rarity for disk ${disk.id}: ${disk.rarity}`);
            return false;
          }
          return disk.level >= maxLevel;
        });
      }
      // 成长模式：显示所有驱动盘（包括未满级的）
    }

    // 排序：优先按有效词条得分降序，然后按套装名、部位、稀有度
    result.sort((a: DriveDisk, b: DriveDisk) => {
      // 如果有有效词条配置，优先按得分排序
      if (currentAgentEffectiveStats.value.length > 0) {
        const scoreA = getDiskScore(a);
        const scoreB = getDiskScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      const setCompare = a.set_name.localeCompare(b.set_name);
      if (setCompare !== 0) return setCompare;
      if (a.position !== b.position) return a.position - b.position;
      return b.rarity - a.rarity;
    });
  } else {
    // 音擎筛选
    if (filters.value.weaponTypes.length > 0) {
      result = result.filter((wengine: WEngine) =>
        filters.value.weaponTypes.includes(wengine.weapon_type)
      );
    }

    // 排序
    result.sort((a: WEngine, b: WEngine) => {
      if (a.level !== b.level) return b.level - a.level;
      return b.id.localeCompare(a.id);
    });
  }

  return result;
});

// 检查装备是否已被当前角色装备
function isEquippedByCurrentAgent(item: DriveDisk | WEngine): boolean {
  if (!props.agentId) return false;
  return item.equipped_agent === props.agentId;
}

// 获取套装图标
function getSetIcon(setName: string): string {
  const disk = (allItems.value as DriveDisk[]).find(d => d.set_name === setName);
  if (disk) {
    return iconService.getEquipmentIconById(disk.game_id);
  }
  return '';
}

// 获取武器类型图标
function getWeaponTypeIcon(weaponType: WeaponType): string {
  return iconService.getWeaponTypeIconUrl(weaponType);
}

// 选择装备
function selectItem(item: DriveDisk | WEngine | null) {
  emit('select', item);
  emit('close');
}

// 关闭弹窗
function closeDialog() {
  emit('close');
}
</script>

<style scoped>
</style>