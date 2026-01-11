<template>
  <div class="data-import-export">
    <h2 class="text-2xl font-bold mb-4">存档管理</h2>

    <!-- 存档列表 -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h3 class="card-title">存档列表（最多5个）</h3>

        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>存档名</th>
                <th>角色数</th>
                <th>音擎数</th>
                <th>驱动盘数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="name in saveNames" :key="name" :class="{ 'bg-primary/20': name === currentSaveName }">
                <td>
                  <span class="font-bold">{{ name }}</span>
                  <span v-if="name === currentSaveName" class="badge badge-primary ml-2">当前</span>
                </td>
                <td>{{ getSaveStats(name).characters }}</td>
                <td>{{ getSaveStats(name).wengines }}</td>
                <td>{{ getSaveStats(name).discs }}</td>
                <td>
                  <div class="flex gap-2">
                    <button
                      v-if="name !== currentSaveName"
                      @click="switchToSave(name)"
                      class="btn btn-sm btn-primary"
                    >
                      切换
                    </button>
                    <button
                      @click="deleteSave(name)"
                      class="btn btn-sm btn-error"
                      :disabled="saveNames.length === 1"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="saveNames.length === 0">
                <td colspan="5" class="text-center text-gray-500">暂无存档</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex gap-4 mt-4">
          <button
            @click="createNewSave"
            class="btn btn-secondary"
            :disabled="saveNames.length >= 5"
          >
            创建新存档
          </button>
          <span v-if="saveNames.length >= 5" class="text-warning self-center">
            已达到存档数量上限（5个）
          </span>
        </div>
      </div>
    </div>

    <!-- Import Section -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h3 class="card-title">导入ZOD数据</h3>
        <p class="text-sm text-gray-500 mb-2">
          从ZZZ Scanner等工具导出的JSON文件导入
        </p>
        <input
          type="file"
          accept=".json"
          @change="handleFileImport"
          class="file-input file-input-bordered w-full max-w-xs"
        />
        <div v-if="importError" class="alert alert-error mt-4">
          <span>{{ importError }}</span>
        </div>
        <div v-if="importSuccess" class="alert alert-success mt-4">
          <span>数据导入成功！</span>
        </div>
      </div>
    </div>

    <!-- Export Section -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h3 class="card-title">导出数据</h3>
        <div class="flex gap-4">
          <button class="btn btn-primary" @click="exportCurrentSave" :disabled="!currentSave">
            导出当前存档
          </button>
          <button class="btn btn-secondary" @click="exportAllSaves" :disabled="saveNames.length === 0">
            导出所有存档
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../../stores/save.store';

const saveStore = useSaveStore();
const importError = ref<string | null>(null);
const importSuccess = ref(false);

const saveNames = computed(() => saveStore.saveNames);
const currentSaveName = computed(() => saveStore.currentSaveName);
const currentSave = computed(() => saveStore.currentSave);

function getSaveStats(name: string) {
  const save = saveStore.saves.get(name);
  if (!save) return { characters: 0, wengines: 0, discs: 0 };

  return {
    characters: save.getAllAgents().length,
    wengines: save.getAllWEngines().length,
    discs: save.getAllDriveDisks().length,
  };
}

function createNewSave() {
  if (saveNames.value.length >= 5) {
    alert('最多只能创建5个存档');
    return;
  }

  const name = prompt('请输入存档名称：');
  if (!name) return;

  if (saveNames.value.includes(name)) {
    alert('存档名称已存在');
    return;
  }

  try {
    saveStore.createSave(name);
  } catch (err) {
    alert('创建存档失败: ' + (err instanceof Error ? err.message : '未知错误'));
  }
}

function switchToSave(name: string) {
  saveStore.switchSave(name);
}

function deleteSave(name: string) {
  if (!confirm(`确定要删除存档"${name}"吗？此操作无法撤销！`)) {
    return;
  }

  saveStore.deleteSave(name);
}

function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  if (saveNames.value.length >= 5) {
    importError.value = '已达到存档数量上限（5个），请先删除一个存档';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const data = JSON.parse(content);

      // 生成存档名
      const saveName = prompt('请输入存档名称：', `导入_${new Date().toLocaleString()}`);
      if (!saveName) return;

      if (saveNames.value.includes(saveName)) {
        importError.value = '存档名称已存在';
        return;
      }

      saveStore.importZodData(data, saveName)
        .then(() => {
          importSuccess.value = true;
          importError.value = null;
          setTimeout(() => {
            importSuccess.value = false;
          }, 3000);
        })
        .catch((err) => {
          importError.value = err.message;
          importSuccess.value = false;
        });
    } catch (err) {
      importError.value = err instanceof Error ? err.message : 'JSON解析失败';
      importSuccess.value = false;
    }
  };

  reader.readAsText(file);
}

function exportCurrentSave() {
  try {
    const data = saveStore.exportSaveData();
    downloadJson(data, `${currentSaveName.value}_${Date.now()}.json`);
  } catch (err) {
    alert('导出存档失败: ' + (err instanceof Error ? err.message : '未知错误'));
  }
}

function exportAllSaves() {
  try {
    const data = saveStore.exportAllSaves();
    downloadJson(data, `all_saves_${Date.now()}.json`);
  } catch (err) {
    alert('导出存档失败: ' + (err instanceof Error ? err.message : '未知错误'));
  }
}

function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.data-import-export {
  width: 100%;
}
</style>
