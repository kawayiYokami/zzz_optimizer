<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- 存档列表 -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h3 class="card-title">存档列表 ({{ saveNames.length }}/5)</h3>
            <button
              @click="createNewSave"
              class="btn btn-primary btn-sm"
              :disabled="saveNames.length >= 5"
            >
              + 新建存档
            </button>
          </div>

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
                        @click="exportSave(name)"
                        class="btn btn-sm btn-secondary"
                      >
                        导出
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
        </div>
      </div>

      <!-- 导入存档 -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h3 class="card-title">导入存档</h3>
          <p class="text-sm text-gray-500 mb-2">
            从JSON文件导入存档数据，将创建新的存档
          </p>
          <input
            type="file"
            accept=".json"
            @change="handleFileImport"
            class="file-input file-input-bordered w-full max-w-xs"
            :disabled="saveNames.length >= 5"
          />
          <div v-if="saveNames.length >= 5" class="text-warning mt-2">
            存档已满（5个），请先删除一个存档
          </div>
          <div v-if="importError" class="alert alert-error mt-4">
            <span>{{ importError }}</span>
          </div>
          <div v-if="importSuccess" class="alert alert-success mt-4">
            <span>数据导入成功！</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../stores/save.store';

const saveStore = useSaveStore();
const importError = ref<string | null>(null);
const importSuccess = ref(false);

const saveNames = computed(() => saveStore.saveNames);
const currentSaveName = computed(() => saveStore.currentSaveName);

function getSaveStats(name: string) {
  const save = saveStore.saves.get(name);
  if (save) {
    return {
      characters: save.getAllAgents().length,
      wengines: save.getAllWEngines().length,
      discs: save.getAllDriveDisks().length,
    };
  }

  const rawSave = saveStore.rawSaves.get(name);
  if (rawSave) {
    return {
      characters: rawSave.characters?.length ?? 0,
      wengines: rawSave.wengines?.length ?? 0,
      discs: rawSave.discs?.length ?? 0,
    };
  }

  return { characters: 0, wengines: 0, discs: 0 };
}

function createNewSave() {
  if (saveNames.value.length >= 5) {
    alert('存档已满（5个），请先删除一个存档');
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

async function switchToSave(name: string) {
  try {
    const success = await saveStore.switchSave(name);
    if (!success) {
      alert('切换存档失败');
    }
  } catch (err) {
    alert('切换存档失败: ' + (err instanceof Error ? err.message : '未知错误'));
  }
}

function deleteSave(name: string) {
  if (!confirm(`确定要删除存档"${name}"吗？此操作无法撤销！`)) {
    return;
  }

  saveStore.deleteSave(name);
}

function exportSave(name: string) {
  try {
    const data = saveStore.exportSingleSave(name);
    downloadJson(data, `${name}_${Date.now()}.json`);
  } catch (err) {
    alert('导出存档失败: ' + (err instanceof Error ? err.message : '未知错误'));
  }
}

function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  // 检查存档数量限制
  if (saveNames.value.length >= 5) {
    importError.value = '存档已满（5个），请先删除一个存档';
    return;
  }

  importError.value = null;
  importSuccess.value = false;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const data = JSON.parse(content);

      // 生成新的存档名
      const originalName = data.name || '导入存档';
      let saveName = originalName;
      let counter = 1;

      // 如果存档名已存在，添加序号
      while (saveNames.value.includes(saveName)) {
        saveName = `${originalName}_${counter}`;
        counter++;
      }

      // 导入数据
      await saveStore.importZodData(data, saveName);

      importSuccess.value = true;
      importError.value = null;
      setTimeout(() => {
        importSuccess.value = false;
      }, 3000);
    } catch (err) {
      importError.value = err instanceof Error ? err.message : 'JSON解析失败';
      importSuccess.value = false;
    }
  };

  reader.readAsText(file);
  // 清空文件选择
  target.value = '';
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