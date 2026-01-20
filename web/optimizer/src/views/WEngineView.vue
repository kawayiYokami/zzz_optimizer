<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- 右侧滚动区域 -->
    <div class="flex-1 overflow-y-auto p-4 min-h-0 bg-base-200">
      <!-- 主容器（6XL宽度） -->
      <div class="max-w-6xl mx-auto">
        <!-- 过滤卡片 -->
        <div class="card bg-base-100 shadow-md mb-4 mx-6">
          <div class="card-body p-4">
            <!-- 武器类型过滤 -->
            <div>
              <div class="flex flex-wrap justify-center gap-2">
                <button
                  v-for="weaponType in weaponTypes"
                  :key="weaponType.value"
                  @click="selectWeaponType(weaponType.value)"
                  class="btn btn-circle btn-lg border border-base-300 p-0"
                  :class="{ 'bg-neutral text-neutral-content': filters.weaponTypes.length === 1 && filters.weaponTypes[0] === weaponType.value }"
                >
                  <img :src="getWeaponTypeIcon(weaponType.value)" :alt="weaponType.label" class="w-10 h-10 object-contain" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 音擎列表 -->
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
  weaponTypes: [WeaponType.ATTACK] as WeaponType[],
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

  // 排序：按等级（从高到低），再按序号（从大到小）
  result.sort((a, b) => {
    // 等级排序（从高到低）
    if (a.level !== b.level) return b.level - a.level;

    // 序号排序（从大到小）
    return b.id.localeCompare(a.id);
  });

  return result;
});

// 选择武器类型（单选模式）
function selectWeaponType(weaponType: WeaponType) {
  filters.value.weaponTypes = [weaponType];
}

// 获取武器类型图标
function getWeaponTypeIcon(weaponType: WeaponType): string {
  return iconService.getWeaponTypeIconUrl(weaponType);
}
</script>

<style scoped>
</style>