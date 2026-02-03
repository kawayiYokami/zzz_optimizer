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
          <!-- 添加音擎卡片（第一个位置） -->
          <div
            class="card border-2 border-dashed border-base-300 bg-base-100/50 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all w-52 min-h-[220px] flex items-center justify-center group"
            @click="openCreateModal"
          >
            <div class="flex flex-col items-center gap-2 text-base-content/40 group-hover:text-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span class="text-sm font-medium">添加音擎</span>
            </div>
          </div>

          <!-- 现有音擎 -->
          <WEngineCard
            v-for="wengine in filteredAndSortedWEngines"
            :key="wengine.id"
            :wengine="wengine"
            @edit="openEditModal"
          />
        </div>

        <!-- 空状态 -->
        <div v-if="filteredAndSortedWEngines.length === 0" class="flex flex-col items-center justify-center min-h-100 text-base-content/50 text-xl">
          <div class="text-6xl mb-4">🔍</div>
          <p>没有找到符合条件的音擎</p>
        </div>
      </div>
    </div>

    <!-- 创建音擎弹窗 -->
    <WEngineCreateModal
      :show="showCreateModal"
      @cancel="closeCreateModal"
      @created="handleCreated"
    />

    <!-- 编辑音擎弹窗 -->
    <WEngineEditModal
      :show="showEditModal"
      :wengine-id="editingWengineId"
      @cancel="closeEditModal"
      @saved="handleEdited"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSaveStore } from '../stores/save.store';
import { useGameDataStore } from '../stores/game-data.store';
import WEngineCard from '../components/business/WEngineCard.vue';
import WEngineCreateModal from '../components/business/WEngineCreateModal.vue';
import WEngineEditModal from '../components/business/WEngineEditModal.vue';
import { WeaponType } from '../model/base';
import { iconService } from '../services/icon.service';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// 创建弹窗控制
const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingWengineId = ref<string | null>(null);

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
  { value: WeaponType.RUPTURE, label: '命破' },
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

// 打开创建弹窗
function openCreateModal() {
  showCreateModal.value = true;
}

// 关闭创建弹窗
function closeCreateModal() {
  showCreateModal.value = false;
}

// 创建成功回调
function handleCreated() {
  closeCreateModal();
}

function openEditModal(wengineId: string) {
  editingWengineId.value = wengineId;
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingWengineId.value = null;
}

function handleEdited() {
  closeEditModal();
}

// 生命周期
onMounted(async () => {
  // 初始化游戏数据
  if (!gameDataStore.isInitialized) {
    await gameDataStore.initialize();
  }
});
</script>

<style scoped>
</style>
