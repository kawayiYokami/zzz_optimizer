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
                <th>音擎</th>
                <th>1号位</th>
                <th>2号位</th>
                <th>3号位</th>
                <th>4号位</th>
                <th>5号位</th>
                <th>6号位</th>
                <th>操作</th>
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
                <td>
                  <button
                    @click="openEquipmentDialog(char, 'wengine')"
                    class="btn btn-xs btn-outline"
                  >
                    {{ getWeaponNameByLocation(char.equippedWengine) || '未装备' }}
                  </button>
                </td>
                <td v-for="slot in 6" :key="slot">
                  <button
                    @click="openEquipmentDialog(char, 'disk', slot)"
                    class="btn btn-xs btn-outline"
                  >
                    {{ getDiskNameByLocation(char.equippedDiscs, slot) || '未装备' }}
                  </button>
                </td>
                <td>
                  <button
                    @click="showCharacterBuff(char)"
                    class="btn btn-sm btn-outline"
                  >
                    查看属性
                  </button>
                </td>
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
                <th>操作</th>
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
                <td>
                  <button
                    @click="showDriveDiskStats(disk)"
                    class="btn btn-sm btn-outline"
                  >
                    查看属性
                  </button>
                </td>
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
                <th>操作</th>
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
                <td>
                  <button
                    @click="showWengineStats(wengine)"
                    class="btn btn-sm btn-outline"
                  >
                    查看属性
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 装备选择对话框 -->
    <dialog id="equipment-dialog" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">选择{{ equipmentDialogTitle }}</h3>
        <div class="max-h-96 overflow-y-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>名称</th>
                <th>等级</th>
                <th>当前装备者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in availableEquipment" :key="item.id">
                <td>{{ getEquipmentDisplayName(item) }}</td>
                <td>{{ item.level }}</td>
                <td>{{ getEquipmentEquippedBy(item) }}</td>
                <td>
                  <button
                    @click="selectEquipment(item)"
                    class="btn btn-sm btn-primary"
                  >
                    装备
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn">取消</button>
          </form>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSaveStore } from '../../stores/save.store-simple';
import { useGameDataStore } from '../../stores/game-data.store';
import { dataLoaderService } from '../../services/data-loader.service';

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

// 装备选择对话框状态
const equipmentDialogState = ref({
  character: null as any,
  type: '' as 'wengine' | 'disk',
  slot: 0,
});

const availableEquipment = computed(() => {
  if (equipmentDialogState.value.type === 'wengine') {
    return wengines.value;
  } else {
    const slot = equipmentDialogState.value.slot;
    return driveDisks.value.filter(d => parseInt(d.slotKey) === slot);
  }
});

const equipmentDialogTitle = computed(() => {
  if (equipmentDialogState.value.type === 'wengine') {
    return '音擎';
  } else {
    return `${equipmentDialogState.value.slot}号位驱动盘`;
  }
});

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
  if (!wengineId) return '';

  // 在ZOD数据中找对应的音擎
  const wengine = wengines.value.find(w => w.id === wengineId);
  if (!wengine) return '';

  // 再通过key获取中文名
  return getWeaponName(wengine.key);
}

// 通过驱动盘实例ID获取驱动盘中文名
function getDiskNameByLocation(equippedDiscs: Record<string, string>, slot: number): string {
  const diskId = equippedDiscs?.[slot.toString()];
  if (!diskId) return '';

  const disk = driveDisks.value.find(d => d.id === diskId);
  if (!disk) return '';

  return getEquipmentName(disk.setKey);
}

// 获取装备显示名称
function getEquipmentDisplayName(item: any): string {
  if (equipmentDialogState.value.type === 'wengine') {
    return getWeaponName(item.key);
  } else {
    return getEquipmentName(item.setKey);
  }
}

// 获取装备当前装备者
function getEquipmentEquippedBy(item: any): string {
  if (equipmentDialogState.value.type === 'wengine') {
    const char = characters.value.find(c => c.equippedWengine === item.id);
    return char ? getCharacterName(char.key) : '未装备';
  } else {
    for (const char of characters.value) {
      if (char.equippedDiscs?.[equipmentDialogState.value.slot.toString()] === item.id) {
        return getCharacterName(char.key);
      }
    }
    return '未装备';
  }
}

// 打开装备选择对话框
function openEquipmentDialog(char: any, type: 'wengine' | 'disk', slot?: number) {
  equipmentDialogState.value = {
    character: char,
    type,
    slot: slot || 0,
  };
  const dialog = document.getElementById('equipment-dialog') as HTMLDialogElement;
  dialog.showModal();
}

// 选择装备
function selectEquipment(item: any) {
  const char = equipmentDialogState.value.character;
  const type = equipmentDialogState.value.type;
  const slot = equipmentDialogState.value.slot;

  // 卸下原装备
  if (type === 'wengine') {
    if (char.equippedWengine) {
      const oldWengine = wengines.value.find(w => w.id === char.equippedWengine);
      if (oldWengine) oldWengine.location = null;
    }
    char.equippedWengine = item.id;
    item.location = char.id;
  } else {
    if (char.equippedDiscs?.[slot.toString()]) {
      const oldDisk = driveDisks.value.find(d => d.id === char.equippedDiscs[slot.toString()]);
      if (oldDisk) oldDisk.location = null;
    }
    if (!char.equippedDiscs) char.equippedDiscs = {};
    char.equippedDiscs[slot.toString()] = item.id;
    item.location = char.id;
  }

  // 保存到store
  saveStore.saveToStorage();

  // 关闭对话框
  const dialog = document.getElementById('equipment-dialog') as HTMLDialogElement;
  dialog.close();
}

// 查看角色自身属性
async function showCharacterBuff(char: any) {
  try {
    // 1. 创建 Agent 对象
    const { Agent } = await import('../../model/agent');

    const agent = await Agent.fromZodData(char, dataLoaderService);

    // 2. 获取基础属性（局外属性）
    const bareStats = agent.getBareStats();

    // 3. 转换为JSON对象
    const statsJson = bareStats.toJSON();

    // 4. 输出JSON到控制台和弹窗
    console.log(`角色 ${char.key} 的自身属性:`, statsJson);
    alert(`角色 ${char.key} 的自身属性已输出到控制台\n\nJSON:\n${JSON.stringify(statsJson, null, 2)}`);
  } catch (error) {
    console.error('获取自身属性失败:', error);
    alert('获取自身属性失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 查看驱动盘属性
async function showDriveDiskStats(disk: any) {
  try {
    // 1. 创建 DriveDisk 对象
    const { DriveDisk } = await import('../../model/drive-disk');

    const driveDisk = await DriveDisk.fromZodData(disk, dataLoaderService);

    // 2. 获取属性
    const stats = driveDisk.getStats();

    // 3. 转换为JSON对象
    const statsJson = stats.toJSON();

    // 4. 输出JSON到控制台和弹窗
    console.log(`驱动盘 ${disk.setKey} 的属性:`, statsJson);
    alert(`驱动盘 ${disk.setKey} 的属性已输出到控制台\n\nJSON:\n${JSON.stringify(statsJson, null, 2)}`);
  } catch (error) {
    console.error('获取驱动盘属性失败:', error);
    alert('获取驱动盘属性失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 查看音擎属性
async function showWengineStats(wengine: any) {
  try {
    // 1. 创建 WEngine 对象
    const { WEngine } = await import('../../model/wengine');

    const engine = await WEngine.fromZodData(wengine, dataLoaderService);

    // 2. 获取属性
    const stats = engine.getBaseStats();

    // 3. 转换为JSON对象
    const statsJson = stats.toJSON();

    // 4. 输出JSON到控制台和弹窗
    console.log(`音擎 ${wengine.key} 的属性:`, statsJson);
    alert(`音擎 ${wengine.key} 的属性已输出到控制台\n\nJSON:\n${JSON.stringify(statsJson, null, 2)}`);
  } catch (error) {
    console.error('获取音擎属性失败:', error);
    alert('获取音擎属性失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}
</script>

<style scoped>
.data-inspector {
  width: 100%;
}
</style>
