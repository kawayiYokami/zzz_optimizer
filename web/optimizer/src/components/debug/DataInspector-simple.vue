<template>
  <div class="data-inspector">
    <h2 class="text-2xl font-bold mb-4">数据查看器</h2>

    <!-- 存档控制栏 -->
    <div class="flex gap-4 mb-4 items-center">
      <div class="form-control flex-1">
        <label class="label">
          <span class="label-text">当前存档</span>
        </label>
        <select v-model="selectedSave" class="select select-bordered w-full">
          <option v-if="saveNames.length === 0" disabled value="">没有存档</option>
          <option v-for="name in saveNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
      <div class="form-control">
        <label class="label">
          <span class="label-text">&nbsp;</span>
        </label>
        <button
          @click="exportCurrentSave"
          class="btn btn-primary"
          :disabled="!currentSave"
        >
          导出当前存档
        </button>
      </div>
    </div>

    <div class="tabs tabs-boxed mb-4">
      <input type="radio" name="inspector_tabs" role="tab" class="tab" aria-label="角色" checked />
      <div role="tabpanel" class="tab-content bg-base-100 border-base-300 rounded-box p-4">
        <div v-if="characters.length === 0" class="text-gray-500">未找到角色数据（请先导入存档）</div>
        <div v-else class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>实例ID</th>
                <th>CodeName</th>
                <th>中文名</th>
                <th>等级</th>
                <th>突破</th>
                <th>影画</th>
                <th>装备音擎</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="char in characters" :key="char.id">
                <td>{{ char.id }}</td>
                <td>{{ char.key }}</td>
                <td>{{ getCharacterName(char.key) }}</td>
                <td>{{ char.level }}</td>
                <td>{{ char.promotion }}</td>
                <td>M{{ char.mindscape }}</td>
                <td>{{ getWeaponNameByLocation(char.equippedWengine) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <input type="radio" name="inspector_tabs" role="tab" class="tab" aria-label="驱动盘" />
      <div role="tabpanel" class="tab-content bg-base-100 border-base-300 rounded-box p-4">
        <div v-if="driveDisks.length === 0" class="text-gray-500">未找到驱动盘数据（请先导入存档）</div>
        <div v-else class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>实例ID</th>
                <th>套装Key</th>
                <th>套装名称</th>
                <th>位置</th>
                <th>等级</th>
                <th>装备角色</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="disk in driveDisks" :key="disk.id">
                <td>{{ disk.id }}</td>
                <td>{{ disk.setKey }}</td>
                <td>{{ getEquipmentName(disk.setKey) }}</td>
                <td>{{ disk.slotKey }}</td>
                <td>{{ disk.level }}</td>
                <td>{{ getCharacterNameByLocation(disk.location) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <input type="radio" name="inspector_tabs" role="tab" class="tab" aria-label="音擎" />
      <div role="tabpanel" class="tab-content bg-base-100 border-base-300 rounded-box p-4">
        <div v-if="wengines.length === 0" class="text-gray-500">未找到音擎数据（请先导入存档）</div>
        <div v-else class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>实例ID</th>
                <th>音擎Key</th>
                <th>中文名</th>
                <th>等级</th>
                <th>精炼</th>
                <th>装备角色</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="wengine in wengines" :key="wengine.id">
                <td>{{ wengine.id }}</td>
                <td>{{ wengine.key }}</td>
                <td>{{ getWeaponName(wengine.key) }}</td>
                <td>{{ wengine.level }}</td>
                <td>R{{ wengine.modification }}</td>
                <td>{{ getCharacterNameByLocation(wengine.location) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '../../stores/save.store-simple';
import { useGameDataStore } from '../../stores/game-data.store';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

const saveNames = computed(() => saveStore.saveNames);
const selectedSave = computed({
  get: () => saveStore.currentSaveName,
  set: (value) => {
    if (value) {
      saveStore.switchSave(value);
    }
  }
});

const currentSave = computed(() => saveStore.currentSave);
const characters = computed(() => saveStore.characters);
const driveDisks = computed(() => saveStore.driveDisks);
const wengines = computed(() => saveStore.wengines);

// 导出当前存档
function exportCurrentSave() {
  if (!currentSave.value) {
    alert('没有可导出的存档');
    return;
  }

  try {
    const jsonStr = saveStore.exportSaveData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSave.value.name}_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 通过CodeName获取角色中文名
function getCharacterName(code: string | null): string {
  if (!code) return '-';
  const char = gameDataStore.getCharacterByCode(code);
  return char?.CHS || code;
}

// 通过key获取音擎中文名
function getWeaponName(key: string | null): string {
  if (!key) return '-';
  const weapon = gameDataStore.getWeaponByName(key);
  return weapon?.CHS || key;
}

// 通过setKey获取驱动盘套装中文名
function getEquipmentName(setKey: string | null): string {
  if (!setKey) return '-';
  const equip = gameDataStore.getEquipmentBySetKey(setKey);
  return equip?.CHS?.name || setKey;
}

// 通过location（角色实例ID）获取角色中文名
function getCharacterNameByLocation(location: string | null): string {
  if (!location) return '-';

  // 在ZOD数据中找对应的角色
  const char = characters.value.find(c => c.id === location);
  if (!char) return location;

  // 再通过code获取中文名
  return getCharacterName(char.key);
}

// 通过音擎实例ID获取音擎中文名
function getWeaponNameByLocation(wengineId: string | null): string {
  if (!wengineId) return '-';

  // 在ZOD数据中找对应的音擎
  const wengine = wengines.value.find(w => w.id === wengineId);
  if (!wengine) return wengineId;

  // 再通过key获取中文名
  return getWeaponName(wengine.key);
}
</script>

<style scoped>
.data-inspector {
  width: 100%;
}
</style>
