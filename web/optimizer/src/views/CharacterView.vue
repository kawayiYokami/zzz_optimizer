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
              <div ref="characterListContainer" class="max-h-[70vh] overflow-y-auto">
                <div v-if="filteredAndSortedAgents.length === 0" class="text-center py-10 text-base-content/50">
                  <div class="text-4xl mb-2">🔍</div>
                  <p>没有找到符合条件的代理人</p>
                </div>
                
                <div class="flex flex-wrap justify-center gap-4">
                  <div
                    v-for="item in filteredAndSortedAgents"
                    :key="item.agent.game_id"
                    class="cursor-pointer transform-gpu transition-transform duration-200 hover:scale-105"
                    :class="{ 'ring-4 ring-primary ring-offset-2 ring-offset-base-200 rounded-box': selectedAgentId === item.agent.game_id }"
                    @click="selectAgent(item.agent.game_id, item.isOwned)"
                  >
                    <AgentCard :agent="item.agent" :grayscale="!item.isOwned" />
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
          <div v-else class="card bg-base-100 shadow min-h-150">
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

    <!-- 创建角色弹窗 -->
    <dialog class="modal" :class="{ 'modal-open': showCreateAgentModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">创建角色</h3>
        
        <div v-if="selectedCharacterInfo" class="space-y-4">
          <!-- 角色信息 -->
          <div class="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
            <img :src="createModalAvatarUrl" :alt="selectedCharacterInfo.CHS" class="w-16 h-16 rounded" />
            <div>
              <h4 class="font-bold text-xl">{{ selectedCharacterInfo.CHS }}</h4>
              <p class="text-sm text-base-content/70">{{ selectedCharacterInfo.EN }}</p>
            </div>
          </div>

          <!-- 影画选择 -->
          <div>
            <label class="label">
              <span class="label-text font-bold">影画等级</span>
            </label>
            <div class="grid grid-cols-7 gap-2">
              <button
                v-for="cinema in cinemaOptions"
                :key="cinema"
                @click="selectedCinema = cinema"
                class="btn btn-sm"
                :class="{
                  'btn-primary': selectedCinema === cinema,
                  'btn-outline': selectedCinema !== cinema
                }"
              >
                {{ cinema }}
              </button>
            </div>
          </div>

          <!-- 默认信息提示 -->
          <div class="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 class="font-bold">默认配置</h4>
              <p class="text-xs">等级: 60 | 突破: 5 | 技能等级: 1</p>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn" @click="closeCreateAgentModal">取消</button>
          <button class="btn btn-primary" @click="createAgent">创建</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeCreateAgentModal">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useSaveStore } from '../stores/save.store';
import { useGameDataStore } from '../stores/game-data.store';
import AgentCard from '../components/business/AgentCard.vue';
import AgentInfoCard from '../components/business/AgentInfoCard.vue';
import { ElementType, WeaponType } from '../model/base';
import { iconService } from '../services/icon.service';
import { dataLoaderService } from '../services/data-loader.service';
import type { Agent } from '../model/agent';
import type { CharacterInfo } from '../services/data-loader.service';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// 状态
const selectedAgentId = ref<string | null>(null);
const selectedOrderStack = ref<string[]>([]); // 选中顺序栈，最近选中的在前
const characterListContainer = ref<HTMLElement | null>(null);
const showFullImageModal = ref(false);
const showCreateAgentModal = ref(false);
const selectedCharacterInfo = ref<CharacterInfo | null>(null);
const selectedCharacterGameId = ref<string | null>(null);
const selectedCinema = ref(0);
const sortBy = ref<'rarity'>('rarity');
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
  { value: WeaponType.RUPTURE, label: '命破', icon: iconService.getWeaponTypeIconUrl(WeaponType.RUPTURE) },
];

// 影画选项
const cinemaOptions = [0, 1, 2, 3, 4, 5, 6];

// 计算属性
const ownedAgents = computed(() => saveStore.agents);

// 创建一个映射，快速判断角色是否拥有
const ownedAgentIdsMap = computed(() => {
  const map = new Map<string, string>();
  ownedAgents.value.forEach(agent => {
    map.set(agent.game_id, agent.id);
  });
  return map;
});

// 获取所有可显示的角色列表
const displayAgentList = computed(() => {
  const result: { agent: Agent; isOwned: boolean }[] = [];
  if (!gameDataStore.isInitialized) return result;
  const characterData = dataLoaderService.characterData;

  if (!characterData) return result;

  // 遍历所有游戏角色（使用 Map 的键和值）
  characterData.forEach((charInfo, gameId) => {
    const ownedAgentId = ownedAgentIdsMap.value.get(gameId);
    
    if (ownedAgentId) {
      // 已拥有的角色
      const ownedAgent = ownedAgents.value.find(a => a.id === ownedAgentId);
      if (ownedAgent) {
        result.push({ agent: ownedAgent, isOwned: true });
      }
    } else {
      // 未拥有的角色，创建一个临时的 Agent 对象用于显示
      const tempAgent: Agent = {
        id: gameId,
        game_id: gameId,
        name_cn: charInfo.CHS,
        name_en: charInfo.EN,
        level: 0,
        breakthrough: 0,
        cinema: 0,
        rarity: charInfo.rank === 4 ? 4 : 3,
        element: ElementType.PHYSICAL, // 默认值，会从 charInfo 覆盖
        weapon_type: WeaponType.ATTACK, // 默认值，会从 charInfo 覆盖
        element_value: charInfo.element,
        weapon_type_value: charInfo.type,
        hp: 0,
        atk: 0,
        def: 0,
        impact: 0,
        anomaly_mastery: 0,
        crit_rate: 0,
        crit_dmg: 0,
        hp_bonus: 0,
        atk_bonus: 0,
        def_bonus: 0,
        impact_bonus: 0,
        anomaly_mastery_bonus: 0,
        energy_regeneration: 0,
        skill: 0,
        skill1: 0,
        skill2: 0,
        skill3: 0,
        skills: { normal: 0, dodge: 0, assist: 0, special: 0, chain: 0 },
        equipped_wengine: null,
        equipped_drive_disks: [null, null, null, null, null, null],
      } as any;
      
      // 根据角色信息设置属性（游戏数据中元素值为 200/201/202/203/205）
      if (charInfo.element === ElementType.PHYSICAL) tempAgent.element = ElementType.PHYSICAL;
      else if (charInfo.element === ElementType.FIRE) tempAgent.element = ElementType.FIRE;
      else if (charInfo.element === ElementType.ICE) tempAgent.element = ElementType.ICE;
      else if (charInfo.element === ElementType.ELECTRIC) tempAgent.element = ElementType.ELECTRIC;
      else if (charInfo.element === ElementType.ETHER) tempAgent.element = ElementType.ETHER;
      
      if (charInfo.type === 1) tempAgent.weapon_type = WeaponType.ATTACK;
      else if (charInfo.type === 2) tempAgent.weapon_type = WeaponType.STUN;
      else if (charInfo.type === 3) tempAgent.weapon_type = WeaponType.ANOMALY;
      else if (charInfo.type === 4) tempAgent.weapon_type = WeaponType.SUPPORT;
      else if (charInfo.type === 5) tempAgent.weapon_type = WeaponType.DEFENSE;
      else if (charInfo.type === 6) tempAgent.weapon_type = WeaponType.RUPTURE;
      
      result.push({ agent: tempAgent, isOwned: false });
    }
  });

  return result;
});

const filteredAndSortedAgents = computed(() => {
  let result = [...displayAgentList.value];

  // 应用筛选
  if (filters.value.elements.length > 0) {
    result = result.filter(item =>
      filters.value.elements.includes(item.agent.element)
    );
  }

  if (filters.value.weaponTypes.length > 0) {
    result = result.filter(item =>
      filters.value.weaponTypes.includes(item.agent.weapon_type)
    );
  }

  // (debug logs removed)

  // 应用排序
  result.sort((a, b) => {
    let comparison = 0;

    // 首先按选中顺序排序（选中栈中的角色优先，越晚选中的越靠前）
    const aSelectedIndex = selectedOrderStack.value.indexOf(a.agent.game_id);
    const bSelectedIndex = selectedOrderStack.value.indexOf(b.agent.game_id);
    const aInStack = aSelectedIndex !== -1;
    const bInStack = bSelectedIndex !== -1;

    if (aInStack && !bInStack) return -1;
    if (!aInStack && bInStack) return 1;
    if (aInStack && bInStack) {
      // 两者都在栈中，索引小的（后选中的）排前面
      return aSelectedIndex - bSelectedIndex;
    }

    // 然后按是否拥有排序（拥有的在前）
    if (a.isOwned !== b.isOwned) {
      return a.isOwned ? -1 : 1;
    }

    // 稀有度排序（S级=4, A级=3）
    comparison = b.agent.rarity - a.agent.rarity;
    // 稀有度相同时按等级降序
    if (comparison === 0) {
      comparison = b.agent.level - a.agent.level;
    }

    return sortAscending.value ? -comparison : comparison;
  });

  return result;
});

const selectedAgent = computed(() => {
  if (!selectedAgentId.value) return null;
  return ownedAgents.value.find(agent => agent.game_id === selectedAgentId.value);
});

const hasActiveFilters = computed(() => {
  return filters.value.elements.length > 0 ||
         filters.value.weaponTypes.length > 0;
});

// 创建弹窗中的角色头像 URL
const createModalAvatarUrl = computed(() => {
  if (!selectedCharacterInfo.value) return '';
  return iconService.getCharacterPortraitById(selectedCharacterGameId.value || '');
});

// 方法
function selectAgent(agentId: string, isOwned: boolean) {
  if (isOwned) {
    // agentId 是 game_id
    selectedAgentId.value = agentId;
    // 保存到 localStorage
    localStorage.setItem('zzz_selected_agent_id', agentId);

    // 更新选中顺序栈：移除已存在的，然后加到最前面
    const existingIndex = selectedOrderStack.value.indexOf(agentId);
    if (existingIndex !== -1) {
      selectedOrderStack.value.splice(existingIndex, 1);
    }
    selectedOrderStack.value.unshift(agentId);

    // 滚动到顶部
    nextTick(() => {
      if (characterListContainer.value) {
        characterListContainer.value.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  } else {
    // 打开创建角色弹窗
    selectedCharacterGameId.value = agentId;
    selectedCharacterInfo.value = dataLoaderService.characterData?.get(agentId) || null;
    selectedCinema.value = 0;
    showCreateAgentModal.value = true;
  }
}

async function createAgent() {
  if (!selectedCharacterInfo.value || !selectedCharacterGameId.value) return;
  
  try {
    // 创建新角色，默认满级（等级 60）
    const newAgentId = `agent_${Date.now()}`;
    const characterKey = selectedCharacterInfo.value.code || selectedCharacterGameId.value;
    
    // 构建 ZodCharacterData
    const newCharacter = {
      id: newAgentId,
      key: characterKey,
      level: 60,
      promotion: 5, // 满突破
      mindscape: selectedCinema.value, // 用户选择的影画
      core: 1,
      basic: 1,
      dodge: 1,
      assist: 1,
      special: 1,
      chain: 1,
      equippedWengine: '',
      equippedDiscs: {
        '1': '',
        '2': '',
        '3': '',
        '4': '',
        '5': '',
        '6': '',
      },
    };

    // 获取当前存档并添加角色
    if (!saveStore.currentSaveName) {
      console.error('No current save');
      return;
    }

    const rawSave = saveStore.rawSaves.get(saveStore.currentSaveName);
    if (!rawSave) {
      console.error('No raw save found');
      return;
    }

    // 确保 characters 数组存在
    if (!rawSave.characters) {
      rawSave.characters = [];
    }

    rawSave.characters.push(newCharacter);
    
    // 保存并刷新
    await saveStore.switchSave(saveStore.currentSaveName);
    
    // 关闭弹窗并选中新建的角色
    showCreateAgentModal.value = false;
    selectedCharacterInfo.value = null;
    selectedCharacterGameId.value = null;
    selectedCinema.value = 0;
    
    // 找到新建的角色并选中
    const createdAgent = saveStore.agents.find(a => a.game_id === selectedCharacterGameId.value);
    if (createdAgent) {
      selectAgent(createdAgent.game_id, true);
    }
  } catch (error) {
    console.error('Failed to create agent:', error);
  }
}

function closeCreateAgentModal() {
  showCreateAgentModal.value = false;
  selectedCharacterInfo.value = null;
  selectedCharacterGameId.value = null;
  selectedCinema.value = 0;
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
  // 使用全身立绘类型获取全身立绘
  return iconService.getCharacterFullBodyById(agent.game_id);
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
onMounted(async () => {
  // 初始化游戏数据
  if (!gameDataStore.isInitialized) {
    await gameDataStore.initialize();
  }
  
  // 从 localStorage 恢复上次选中的角色
  const savedAgentId = localStorage.getItem('zzz_selected_agent_id');
  if (savedAgentId && ownedAgents.value.some(agent => agent.game_id === savedAgentId)) {
    selectedAgentId.value = savedAgentId;
  } else if (ownedAgents.value.length > 0) {
    // 如果没有保存的选择，默认选中第一个
    selectedAgentId.value = ownedAgents.value[0].game_id;
  }
});
</script>

<style scoped>
</style>
