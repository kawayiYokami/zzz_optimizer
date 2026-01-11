<template>
  <div class="buff-data-inspector">
    <h2 class="text-2xl font-bold mb-4">Buff数据查看器</h2>

    <!-- 数据类型选择 -->
    <div class="flex gap-4 mb-6">
      <div class="form-control flex-1">
        <label class="label">
          <span class="label-text">数据类型</span>
        </label>
        <select v-model="dataType" class="select select-bordered w-full">
          <option value="character">角色Buff</option>
          <option value="weapon">音擎Buff</option>
          <option value="equipment">驱动盘套装Buff</option>
        </select>
      </div>

      <div class="form-control flex-1">
        <label class="label">
          <span class="label-text">选择{{ dataTypeLabel }}</span>
        </label>
        <select v-model="selectedId" class="select select-bordered w-full">
          <option value="">请选择...</option>
          <option v-for="item in availableItems" :key="item.id" :value="item.id">
            {{ item.name }} ({{ item.id }})
          </option>
        </select>
      </div>

      <div v-if="loading" class="flex items-end pb-2">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="alert alert-error mb-4">
      <span>{{ error }}</span>
    </div>

    <!-- Buff数据展示 -->
    <div v-if="buffData" class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="flex justify-between items-center mb-2">
          <h3 class="card-title">Buff数据 - {{ currentItemName }}</h3>
          <button @click="copyToClipboard" class="btn btn-sm btn-ghost">
            复制JSON
          </button>
        </div>
        <pre class="bg-base-300 p-4 rounded-lg overflow-x-auto text-sm">{{ formattedBuffData }}</pre>
      </div>
    </div>

    <div v-else-if="!error" class="text-center text-gray-500 mt-8">
      请选择数据类型和具体项目，然后点击"加载Buff数据"按钮
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGameDataStore } from '../../stores/game-data.store';
import { dataLoaderService } from '../../services/data-loader.service';

const gameDataStore = useGameDataStore();

const dataType = ref<'character' | 'weapon' | 'equipment'>('character');
const selectedId = ref<string>('');
const buffData = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const dataTypeLabel = computed(() => {
  switch (dataType.value) {
    case 'character': return '角色';
    case 'weapon': return '音擎';
    case 'equipment': return '驱动盘套装';
  }
});

const availableItems = computed(() => {
  switch (dataType.value) {
    case 'character': {
      const data = dataLoaderService.characterData;
      if (!data) return [];
      // 从Map.entries()获取ID和对象
      return Array.from(data.entries()).map(([id, c]) => ({
        id: id,
        name: c.CHS || c.EN,
      }));
    }
    case 'weapon': {
      const data = dataLoaderService.weaponData;
      if (!data) return [];
      // 从Map.entries()获取ID和对象
      return Array.from(data.entries()).map(([id, w]) => ({
        id: id,
        name: w.CHS || w.EN,
      }));
    }
    case 'equipment': {
      const data = dataLoaderService.equipmentData;
      if (!data) return [];
      // 从Map.entries()获取ID和对象
      return Array.from(data.entries()).map(([id, e]) => ({
        id: id,
        name: e.CHS?.name || e.EN?.name || id,
      }));
    }
    default:
      return [];
  }
});

const currentItemName = computed(() => {
  const item = availableItems.value.find(i => i.id === selectedId.value);
  return item ? item.name : selectedId.value;
});

const formattedBuffData = computed(() => {
  if (!buffData.value) return '';
  return JSON.stringify(buffData.value, null, 2);
});

// 当数据类型改变时，重置选择
watch(dataType, () => {
  selectedId.value = '';
  buffData.value = null;
  error.value = null;
});

// 当选中ID改变时，自动加载buff数据
watch(selectedId, (newId) => {
  if (newId) {
    loadBuffData();
  } else {
    buffData.value = null;
    error.value = null;
  }
});

async function loadBuffData() {
  if (!selectedId.value) return;

  loading.value = true;
  error.value = null;
  buffData.value = null;

  try {
    let data: any;
    switch (dataType.value) {
      case 'character':
        data = await gameDataStore.getCharacterBuff(selectedId.value);
        break;
      case 'weapon':
        data = await gameDataStore.getWeaponBuff(selectedId.value);
        break;
      case 'equipment':
        data = await gameDataStore.getEquipmentBuff(selectedId.value);
        break;
    }
    buffData.value = data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
    console.error('Failed to load buff data:', err);
  } finally {
    loading.value = false;
  }
}

function copyToClipboard() {
  if (!buffData.value) return;

  const text = JSON.stringify(buffData.value, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    alert('已复制到剪贴板');
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('复制失败');
  });
}
</script>

<style scoped>
.buff-data-inspector {
  width: 100%;
}

pre {
  max-height: 600px;
  overflow-y: auto;
}
</style>
