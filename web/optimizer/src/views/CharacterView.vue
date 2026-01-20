<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <!-- Sidebar: 角色列表 -->
        <div class="lg:col-span-1">
          <div class="card bg-base-100 shadow-sm h-fit">
            <div class="card-body p-4">
              
              <!-- 筛选与控制区 -->
              <div class="mb-4">
                <!-- 元素类型过滤 -->
                <div class="flex flex-wrap gap-2 justify-center mb-4">
                  <button
                    v-for="element in elementTypes"
                    :key="'element-' + element.value"
                    @click="toggleFilter('elements', element.value)"
                    class="btn btn-circle border border-base-300 p-0"
                    :class="{ 'bg-neutral text-neutral-content': filters.elements.includes(element.value) }"
                    :title="element.label"
                  >
                    <img :src="element.icon" :alt="element.label" class="w-10 h-10 object-contain" />
                  </button>
                </div>

                <!-- 武器类型过滤 -->
                <div class="flex flex-wrap gap-2 justify-center">
                  <button
                    v-for="weaponType in weaponTypes"
                    :key="'weapon-' + weaponType.value"
                    @click="toggleFilter('weaponTypes', weaponType.value)"
                    class="btn btn-circle border border-base-300 p-0"
                    :class="{ 'bg-neutral text-neutral-content': filters.weaponTypes.includes(weaponType.value) }"
                    :title="weaponType.label"
                  >
                    <img :src="weaponType.icon" :alt="weaponType.label" class="w-10 h-10 object-contain" />
                  </button>
                </div>
              </div>

              <!-- 角色列表区 -->
              <div>
                <div v-if="filteredAndSortedAgents.length === 0" class="text-center py-10 text-base-content/50">
                  <div class="text-4xl mb-2">🔍</div>
                  <p>没有找到符合条件的代理人</p>
                </div>
                
                <div class="flex flex-wrap justify-center gap-4">
                  <div
                    v-for="agent in filteredAndSortedAgents"
                    :key="agent.id"
                    class="cursor-pointer transform-gpu transition-transform duration-200 hover:scale-105"
                    :class="{ 'ring-4 ring-primary ring-offset-2 ring-offset-base-200 rounded-box': selectedAgentId === agent.id }"
                    @click="selectAgent(agent.id)"
                  >
                    <AgentCard :agent="agent" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content: 角色详情 -->
        <div class="lg:col-span-3">
          <div v-if="selectedAgent" class="max-w-4xl mx-auto">
            <AgentInfoCard
              :agent="selectedAgent"
              @click-avatar="openFullImageModal"
            />
          </div>
          <div v-else class="card bg-base-100 shadow-xl min-h-[600px]">
            <div class="card-body flex flex-col items-center justify-center h-full text-base-content/50 text-xl">
              <div class="text-6xl mb-4">👈</div>
              <p>请选择角色查看详情</p>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 全身立绘模态框 -->
    <dialog class="modal" :class="{ 'modal-open': showFullImageModal }">
      <div class="modal-box max-w-7xl p-0 overflow-hidden">
        <!-- 图片容器 -->
        <div
          ref="imageContainer"
          class="relative w-full h-[85vh] flex items-center justify-center bg-gradient-radial from-primary/10 to-transparent overflow-hidden"
          @wheel.prevent="handleWheel"
        >
          <div
            class="relative"
            :style="{
              transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`
            }"
          >
            <img
              v-if="selectedAgent"
              ref="fullImage"
              :src="getCharacterFullImage(selectedAgent)"
              :alt="selectedAgent.name_cn"
              class="max-w-[90vw] max-h-[85vh] object-contain drop-shadow-2xl transition-transform duration-75 ease-out select-none cursor-grab active:cursor-grabbing"
              :style="{
                transform: `scale(${imageScale})`
              }"
              draggable="false"
              @mousedown="handleMouseDown"
              @dragstart.prevent
            />
          </div>
        </div>

        <!-- 悬浮控制按钮 -->
        <div class="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button class="btn btn-circle btn-sm btn-ghost bg-base-100/80 backdrop-blur" @click="zoomIn" :disabled="imageScale >= 5" title="放大">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button class="btn btn-circle btn-sm btn-ghost bg-base-100/80 backdrop-blur" @click="resetImage" title="重置">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button class="btn btn-circle btn-sm btn-ghost bg-base-100/80 backdrop-blur" @click="zoomOut" :disabled="imageScale <= 0.5" title="缩小">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <div class="divider my-0"></div>
          <button class="btn btn-circle btn-sm bg-base-100/80 backdrop-blur" @click="closeFullImageModal" title="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeFullImageModal">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSaveStore } from '../stores/save.store';
import AgentCard from '../components/business/AgentCard.vue';
import AgentInfoCard from '../components/business/AgentInfoCard.vue';
import { ElementType, WeaponType } from '../model/base';
import { iconService } from '../services/icon.service';
import type { Agent } from '../model/agent';

const saveStore = useSaveStore();

// 状态
const selectedAgentId = ref<string | null>(null);
const showFullImageModal = ref(false);
const sortBy = ref<'rarity'>('rarity'); // 简化排序，默认按稀有度
const sortAscending = ref(false);

// 全身立绘缩放和拖动状态
const imageContainer = ref<HTMLElement | null>(null);
const fullImage = ref<HTMLImageElement | null>(null);
const imageScale = ref(1);
const imagePosition = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

// 筛选条件
const filters = ref({
  elements: [] as ElementType[],
  weaponTypes: [] as WeaponType[],
});

// 筛选选项
const elementTypes = [
  { value: ElementType.PHYSICAL, label: '物理', icon: iconService.getElementIconUrl(ElementType.PHYSICAL) },
  { value: ElementType.FIRE, label: '火', icon: iconService.getElementIconUrl(ElementType.FIRE) },
  { value: ElementType.ICE, label: '冰', icon: iconService.getElementIconUrl(ElementType.ICE) },
  { value: ElementType.ELECTRIC, label: '雷', icon: iconService.getElementIconUrl(ElementType.ELECTRIC) },
  { value: ElementType.ETHER, label: '以太', icon: iconService.getElementIconUrl(ElementType.ETHER) },
];

const weaponTypes = [
  { value: WeaponType.ATTACK, label: '强攻', icon: iconService.getWeaponTypeIconUrl(WeaponType.ATTACK) },
  { value: WeaponType.STUN, label: '击破', icon: iconService.getWeaponTypeIconUrl(WeaponType.STUN) },
  { value: WeaponType.ANOMALY, label: '异常', icon: iconService.getWeaponTypeIconUrl(WeaponType.ANOMALY) },
  { value: WeaponType.SUPPORT, label: '支援', icon: iconService.getWeaponTypeIconUrl(WeaponType.SUPPORT) },
  { value: WeaponType.DEFENSE, label: '防护', icon: iconService.getWeaponTypeIconUrl(WeaponType.DEFENSE) },
];

// 计算属性
const allAgents = computed(() => saveStore.agents);

const filteredAndSortedAgents = computed(() => {
  let result = [...allAgents.value];

  // 应用筛选
  if (filters.value.elements.length > 0) {
    result = result.filter(agent =>
      filters.value.elements.includes(agent.element)
    );
  }

  if (filters.value.weaponTypes.length > 0) {
    result = result.filter(agent =>
      filters.value.weaponTypes.includes(agent.weapon_type)
    );
  }

  // 应用排序
  result.sort((a, b) => {
    let comparison = 0;

    // 稀有度排序（S级=4, A级=3）
    comparison = b.rarity - a.rarity;
    // 稀有度相同时按等级降序
    if (comparison === 0) {
      comparison = b.level - a.level;
    }

    return sortAscending.value ? -comparison : comparison;
  });

  return result;
});

const selectedAgent = computed(() => {
  if (!selectedAgentId.value) return null;
  return allAgents.value.find(agent => agent.id === selectedAgentId.value);
});

const hasActiveFilters = computed(() => {
  return filters.value.elements.length > 0 ||
         filters.value.weaponTypes.length > 0;
});

// 方法
function selectAgent(agentId: string) {
  selectedAgentId.value = agentId;
  // 保存到 localStorage
  localStorage.setItem('zzz_selected_agent_id', agentId);
}

function toggleSortOrder() {
  sortAscending.value = !sortAscending.value;
}

function clearElementFilters() {
  filters.value.elements = [];
}

function clearWeaponFilters() {
  filters.value.weaponTypes = [];
}

function clearFilters() {
  filters.value.elements = [];
  filters.value.weaponTypes = [];
}

function toggleFilter(filterType: 'elements' | 'weaponTypes', value: ElementType | WeaponType) {
  const filterArray = filters.value[filterType] as (ElementType | WeaponType)[];
  const index = filterArray.indexOf(value);
  if (index === -1) {
    filterArray.push(value);
  } else {
    filterArray.splice(index, 1);
  }
}

function getElementIcon(element: ElementType): string {
  return iconService.getElementIconUrl(element);
}

function getWeaponTypeIcon(weaponType: WeaponType): string {
  return iconService.getWeaponTypeIconUrl(weaponType);
}

function getCharacterFullImage(agent: Agent): string {
  // 使用 avatar 类型获取全身立绘
  return iconService.getCharacterAvatarById(agent.game_id);
}

function openFullImageModal() {
  showFullImageModal.value = true;
}

function closeFullImageModal() {
  showFullImageModal.value = false;
  // 关闭时重置图片状态
  resetImage();
}

// 缩放和拖动方法
function zoomIn() {
  if (imageScale.value < 5) {
    imageScale.value = Math.min(5, imageScale.value + 0.25);
  }
}

function zoomOut() {
  if (imageScale.value > 0.5) {
    imageScale.value = Math.max(0.5, imageScale.value - 0.25);
  }
}

function resetImage() {
  imageScale.value = 1;
  imagePosition.value = { x: 0, y: 0 };
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(0.5, Math.min(5, imageScale.value + delta));
  imageScale.value = newScale;
}

function handleMouseDown(event: MouseEvent) {
  event.preventDefault();
  isDragging.value = true;
  dragStart.value = {
    x: event.clientX,
    y: event.clientY
  };

  // 添加全局事件监听器
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return;
  event.preventDefault();

  const deltaX = event.clientX - dragStart.value.x;
  const deltaY = event.clientY - dragStart.value.y;

  imagePosition.value = {
    x: imagePosition.value.x + deltaX,
    y: imagePosition.value.y + deltaY
  };

  // 更新起始点
  dragStart.value = {
    x: event.clientX,
    y: event.clientY
  };
}

function handleMouseUp() {
  isDragging.value = false;

  // 移除全局事件监听器
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
}

// 生命周期
onMounted(() => {
  // 从 localStorage 恢复上次选中的角色
  const savedAgentId = localStorage.getItem('zzz_selected_agent_id');
  if (savedAgentId && allAgents.value.some(agent => agent.id === savedAgentId)) {
    selectedAgentId.value = savedAgentId;
  } else if (allAgents.value.length > 0) {
    // 如果没有保存的选择，默认选中第一个
    selectedAgentId.value = allAgents.value[0].id;
  }
});
</script>

<style scoped>
</style>