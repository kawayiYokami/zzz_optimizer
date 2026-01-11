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
        <div v-if="agents.length === 0" class="text-gray-500">未找到角色数据（请先导入存档）</div>
        <div v-else class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>ID</th>
                <th>游戏ID</th>
                <th>中文名</th>
                <th>等级</th>
                <th>突破</th>
                <th>装备音擎</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="agent in agents" :key="agent.id">
                <td>{{ agent.id }}</td>
                <td>{{ agent.game_id }}</td>
                <td>{{ getCharacterName(agent.game_id) }}</td>
                <td>{{ agent.level }}</td>
                <td>{{ agent.breakthrough }}</td>
                <td>{{ getWengineName(agent.equipped_wengine) }}</td>
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
                <th>ID</th>
                <th>游戏ID</th>
                <th>套装名称</th>
                <th>位置</th>
                <th>等级</th>
                <th>装备角色</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="disk in driveDisks" :key="disk.id">
                <td>{{ disk.id }}</td>
                <td>{{ disk.game_id }}</td>
                <td>{{ getEquipmentName(disk.game_id) }}</td>
                <td>{{ disk.position }}</td>
                <td>{{ disk.level }}</td>
                <td>{{ getCharacterNameByInstanceId(disk.equipped_agent) }}</td>
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
                <th>ID</th>
                <th>游戏ID</th>
                <th>中文名</th>
                <th>等级</th>
                <th>精炼</th>
                <th>装备角色</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="wengine in wengines" :key="wengine.id">
                <td>{{ wengine.id }}</td>
                <td>{{ wengine.game_id }}</td>
                <td>{{ getWeaponName(wengine.game_id) }}</td>
                <td>{{ wengine.level }}</td>
                <td>R{{ wengine.refinement }}</td>
                <td>{{ getCharacterNameByInstanceId(wengine.equipped_agent) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useSaveStore } from '../../stores/save.store';
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
const agents = computed(() => saveStore.agents);
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

// 根据game_id获取角色中文名
function getCharacterName(gameId: string | null): string {
  if (!gameId) return '-';
  const char = gameDataStore.getCharacterInfo(gameId);
  return char?.CHS || gameId;
}

// 根据实例ID获取角色中文名（从存档中查找agent，再从游戏数据中获取名称）
function getCharacterNameByInstanceId(instanceId: string | null): string {
  if (!instanceId) return '-';

  // 从存档中找到对应的角色
  const agent = agents.value.find(a => a.id === instanceId);
  if (!agent) return instanceId;

  // 再从游戏数据中获取名称
  return getCharacterName(agent.game_id);
}

// 根据game_id获取音擎中文名
function getWeaponName(gameId: string | null): string {
  if (!gameId) return '-';
  const weapon = gameDataStore.getWeaponInfo(gameId);
  return weapon?.CHS || gameId;
}

// 根据game_id获取驱动盘套装中文名
function getEquipmentName(gameId: string | null): string {
  if (!gameId) return '-';
  const equip = gameDataStore.getEquipmentInfo(gameId);
  return equip?.CHS?.name || gameId;
}

// 根据音擎实例ID获取音擎中文名（从存档中查找）
function getWengineName(wengineId: string | null): string {
  if (!wengineId) return '-';

  // 从存档中找到对应的音擎
  const wengine = wengines.value.find(w => w.id === wengineId);
  if (!wengine) return wengineId;

  // 再从游戏数据中获取名称
  return getWeaponName(wengine.game_id);
}
</script>

<style scoped>
.data-inspector {
  width: 100%;
}
</style>