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
                <th>实例ID</th>
                <th>GameID</th>
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
              <tr v-for="agent in agents" :key="agent.id">
                <td>{{ agent.id }}</td>
                <td>{{ agent.game_id }}</td>
                <td>{{ agent.name_cn || getCharacterName(agent.game_id) }}</td>
                <td>{{ agent.level }}</td>
                <td>{{ agent.breakthrough }}</td>
                <td>M{{ agent.cinema }}</td>
                <td>
                  <button
                    @click="openEquipmentDialog(agent, 'wengine')"
                    class="btn btn-xs btn-outline"
                  >
                    {{ getWeaponNameByInstanceId(agent.equipped_wengine) || '未装备' }}
                  </button>
                </td>
                <td v-for="slot in 6" :key="slot">
                  <button
                    @click="openEquipmentDialog(agent, 'disk', slot)"
                    class="btn btn-xs btn-outline"
                  >
                    {{ getDiskNameByInstanceId(agent.equipped_drive_disks[slot - 1]) || '未装备' }}
                  </button>
                </td>
                <td>
                  <button
                    @click="showCharacterStats(agent)"
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
                <th>套装名</th>
                <th>中文名</th>
                <th>位置</th>
                <th>等级</th>
                <th>装备角色</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="disk in driveDisks" :key="disk.id">
                <td>{{ disk.id }}</td>
                <td>{{ disk.set_name }}</td>
                <td>{{ disk.set_name_cn }}</td>
                <td>{{ disk.position }}</td>
                <td>{{ disk.level }}</td>
                <td>{{ getCharacterNameByInstanceId(disk.equipped_agent) }}</td>
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
                <th>GameID</th>
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
                <td>{{ wengine.wengine_id }}</td>
                <td>{{ wengine.name }}</td>
                <td>{{ wengine.level }}</td>
                <td>R{{ wengine.refinement }}</td>
                <td>{{ getCharacterNameByInstanceId(wengine.equipped_agent) }}</td>
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
import { useSaveStore } from '../../stores/save.store';
import { useGameDataStore } from '../../stores/game-data.store';
import type { Agent } from '../../model/agent';
import type { DriveDisk } from '../../model/drive-disk';
import type { WEngine } from '../../model/wengine';

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

// 装备选择对话框状态
const equipmentDialogState = ref({
  agent: null as Agent | null,
  type: '' as 'wengine' | 'disk',
  slot: 0,
});

const availableEquipment = computed(() => {
  if (equipmentDialogState.value.type === 'wengine') {
    return wengines.value;
  } else {
    const slot = equipmentDialogState.value.slot;
    return driveDisks.value.filter(d => d.position === slot);
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

// 通过CodeName/GameID获取角色中文名
function getCharacterName(code: string | null): string {
  if (!code) return '-';
  const char = gameDataStore.getCharacterInfo(code);
  return char?.CHS || code;
}

// 通过实例ID获取角色中文名
function getCharacterNameByInstanceId(agentId: string | null): string {
  if (!agentId) return '-';
  const agent = agents.value.find(a => a.id === agentId);
  if (!agent) return agentId;
  return agent.name_cn || getCharacterName(agent.game_id);
}

// 通过实例ID获取音擎中文名
function getWeaponNameByInstanceId(wengineId: string | null): string {
  if (!wengineId) return '';
  const wengine = wengines.value.find(w => w.id === wengineId);
  if (!wengine) return '';
  return wengine.name;
}

// 通过实例ID获取驱动盘中文名
function getDiskNameByInstanceId(diskId: string | null): string {
  if (!diskId) return '';
  const disk = driveDisks.value.find(d => d.id === diskId);
  if (!disk) return '';
  return disk.set_name_cn || disk.set_name;
}

// 获取装备显示名称
function getEquipmentDisplayName(item: any): string {
  if (equipmentDialogState.value.type === 'wengine') {
    return (item as WEngine).name;
  } else {
    const disk = item as DriveDisk;
    return disk.set_name_cn || disk.set_name;
  }
}

// 获取装备当前装备者
function getEquipmentEquippedBy(item: any): string {
  return getCharacterNameByInstanceId(item.equipped_agent);
}

// 打开装备选择对话框
function openEquipmentDialog(agent: Agent, type: 'wengine' | 'disk', slot?: number) {
  equipmentDialogState.value = {
    agent: agent,
    type,
    slot: slot || 0,
  };
  const dialog = document.getElementById('equipment-dialog') as HTMLDialogElement;
  dialog.showModal();
}

// 选择装备
function selectEquipment(item: any) {
  const agent = equipmentDialogState.value.agent;
  if (!agent) return;

  const type = equipmentDialogState.value.type;
  const slot = equipmentDialogState.value.slot;

  // 1. 处理原装备（如果有，设为未装备）
  if (type === 'wengine') {
    if (agent.equipped_wengine) {
      const oldWengine = wengines.value.find(w => w.id === agent.equipped_wengine);
      if (oldWengine) oldWengine.equipped_agent = null;
    }
  } else {
    // 数组索引
    const diskId = agent.equipped_drive_disks[slot - 1];
    if (diskId) {
      const oldDisk = driveDisks.value.find(d => d.id === diskId);
      if (oldDisk) oldDisk.equipped_agent = null;
    }
  }

  // 2. 处理新装备（如果已被其他人装备，先卸下）
  if (item.equipped_agent) {
    const otherAgent = agents.value.find(a => a.id === item.equipped_agent);
    if (otherAgent) {
      if (type === 'wengine') {
        otherAgent.equipped_wengine = null;
      } else {
        // 找到对应的槽位并置空
        const otherSlotIndex = otherAgent.equipped_drive_disks.indexOf(item.id);
        if (otherSlotIndex !== -1) {
          otherAgent.equipped_drive_disks[otherSlotIndex] = null;
        }
      }
    }
  }

  // 3. 建立新连接
  if (type === 'wengine') {
    agent.equipped_wengine = item.id;
    (item as WEngine).equipped_agent = agent.id;
  } else {
    agent.equipped_drive_disks[slot - 1] = item.id;
    (item as DriveDisk).equipped_agent = agent.id;
  }

  // 4. 保存到store
  saveStore.saveToStorage();

  // 5. 关闭对话框
  const dialog = document.getElementById('equipment-dialog') as HTMLDialogElement;
  dialog.close();
}

// 查看角色属性
function showCharacterStats(agent: Agent) {
  try {
    const stats = agent.getBareStats();
    const statsJson = stats.toJSON();
    console.log(`角色 ${agent.name_cn} 的自身属性:`, statsJson);
    alert(`角色 ${agent.name_cn} 的自身属性已输出到控制台\n\nJSON:\n${JSON.stringify(statsJson, null, 2)}`);
  } catch (error) {
    console.error('获取属性失败:', error);
    alert('获取属性失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 查看驱动盘属性
function showDriveDiskStats(disk: DriveDisk) {
  try {
    const stats = disk.getStats();
    const statsJson = stats.toJSON();
    console.log(`驱动盘 ${disk.set_name_cn} 的属性:`, statsJson);
    alert(`驱动盘 ${disk.set_name_cn} 的属性已输出到控制台\n\nJSON:\n${JSON.stringify(statsJson, null, 2)}`);
  } catch (error) {
    console.error('获取属性失败:', error);
    alert('获取属性失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 查看音擎属性
function showWengineStats(wengine: WEngine) {
  try {
    const stats = wengine.getBaseStats();
    const statsJson = stats.toJSON();
    console.log(`音擎 ${wengine.name} 的属性:`, statsJson);
    alert(`音擎 ${wengine.name} 的属性已输出到控制台\n\nJSON:\n${JSON.stringify(statsJson, null, 2)}`);
  } catch (error) {
    console.error('获取属性失败:', error);
    alert('获取属性失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}
</script>

<style scoped>
.data-inspector {
  width: 100%;
}
</style>