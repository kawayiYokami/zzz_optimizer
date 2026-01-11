<template>
  <div class="data-import-export">
    <h2 class="text-2xl font-bold mb-4">数据导入/导出</h2>

    <!-- Import Section -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h3 class="card-title">导入数据</h3>
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
          <button class="btn btn-primary" @click="exportCurrentSave">
            导出当前存档
          </button>
          <button class="btn btn-secondary" @click="exportAllSaves">
            导出所有存档
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSaveStore } from '../../stores/save.store';

const saveStore = useSaveStore();
const importError = ref<string | null>(null);
const importSuccess = ref(false);

function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const data = JSON.parse(content);

      saveStore.importZodData(data)
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
    downloadJson(data, `save_${Date.now()}.json`);
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