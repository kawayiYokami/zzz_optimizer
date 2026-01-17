<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex flex-1 min-h-0">
      <!-- 左侧过滤栏 -->
      <div class="w-48 bg-base-100 border-r border-base-300 shrink-0 overflow-y-auto">
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

          <!-- 武器类型筛选 -->
          <div>
            <div class="font-semibold text-sm mb-2">武器类型</div>
            <div class="join join-vertical w-full">
              <button
                v-for="weaponType in weaponTypes"
                :key="weaponType.value"
                @click="toggleWeaponType(weaponType.value)"
                class="btn btn-sm join-item"
                :class="{ 'btn-active': filters.weaponTypes.includes(weaponType.value) }"
              >
                <img :src="getWeaponTypeIcon(weaponType.value)" :alt="weaponType.label" class="w-5 h-5 object-contain mr-2" />
                {{ weaponType.label }}
              </button>
            </div>
          </div>

          <!-- 清除筛选 -->
          <button
            v-if="filters.weaponTypes.length > 0 || filters.maxLevel"
            @click="clearFilters"
            class="btn btn-sm btn-outline w-full"
          >
            清除筛选 ({{ filters.weaponTypes.length + (filters.maxLevel ? 1 : 0) }})
          </button>
        </div>
      </div>

      <!-- 右侧滚动区域 -->
      <div class="flex-1 overflow-y-auto p-4 min-h-0 bg-base-200">
        <div class="flex flex-wrap justify-center gap-4">
          <WEngineCard
            v-for="wengine in filteredAndSortedWEngines"
            :key="wengine.id"
            :wengine="wengine"
          />
        </div>

        <!-- 空状态 -->
        <div v-if="filteredAndSortedWEngines.length === 0" class="flex flex-col items-center justify-center min-h-100 text-base-content/50 text-xl">
          <div class="text-6xl mb-4">🔍</div>
          <p>没有找到符合条件的音擎</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../stores/save.store';
import WEngineCard from '../components/business/WEngineCard.vue';
import { WeaponType } from '../model/base';
import { iconService } from '../services/icon.service';

const saveStore = useSaveStore();

// 筛选条件
const filters = ref({
  weaponTypes: [] as WeaponType[],
  maxLevel: false,
});

// 武器类型选项
const weaponTypes = [
  { value: WeaponType.ATTACK, label: '强攻' },
  { value: WeaponType.STUN, label: '击破' },
  { value: WeaponType.ANOMALY, label: '异常' },
  { value: WeaponType.SUPPORT, label: '支援' },
  { value: WeaponType.DEFENSE, label: '防护' },
];

// 计算属性
const allWEngines = computed(() => saveStore.wengines);

// 筛选和排序后的音擎
const filteredAndSortedWEngines = computed(() => {
  let result = [...allWEngines.value];

  // 应用武器类型筛选
  if (filters.value.weaponTypes.length > 0) {
    result = result.filter(wengine =>
      filters.value.weaponTypes.includes(wengine.weapon_type)
    );
  }

  // 应用等级筛选
  if (filters.value.maxLevel) {
    // 打开：只显示满级
    result = result.filter(wengine => wengine.level === 60);
  } else {
    // 关闭：只显示未满级
    result = result.filter(wengine => wengine.level < 60);
  }

  // 排序：按等级（从高到低），再按序号（从大到小）
  result.sort((a, b) => {
    // 等级排序（从高到低）
    if (a.level !== b.level) return b.level - a.level;
    
    // 序号排序（从大到小）
    return b.id.localeCompare(a.id);
  });

  return result;
});

// 切换武器类型
function toggleWeaponType(weaponType: WeaponType) {
  const index = filters.value.weaponTypes.indexOf(weaponType);
  if (index === -1) {
    filters.value.weaponTypes.push(weaponType);
  } else {
    filters.value.weaponTypes.splice(index, 1);
  }
}

// 清除筛选
function clearFilters() {
  filters.value.weaponTypes = [];
  filters.value.maxLevel = false;
}

// 获取武器类型图标
function getWeaponTypeIcon(weaponType: WeaponType): string {
  return iconService.getWeaponTypeIconUrl(weaponType);
}
</script>

<style scoped>
</style>