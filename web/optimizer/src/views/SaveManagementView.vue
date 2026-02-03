<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <!-- 导入进度遮罩 -->
    <div v-if="isImporting" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div class="card bg-base-100 shadow-xl w-96">
        <div class="card-body items-center text-center">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <h3 class="card-title mt-4">正在导入存档</h3>
          <p class="text-sm text-base-content/70">{{ importStatus }}</p>
          <progress class="progress progress-primary w-full mt-2" :value="importProgress" max="100"></progress>
          <p class="text-xs text-base-content/50 mt-2">请勿离开此页面...</p>
        </div>
      </div>
    </div>

    <div class="max-w-4xl mx-auto space-y-6">
      <!-- 存档列表 -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h3 class="card-title">存档列表 ({{ saveNames.length }}/5)</h3>
            <button
              @click="createNewSave"
              class="btn btn-primary btn-sm"
              :disabled="saveNames.length >= 5 || isImporting"
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
                        :disabled="isImporting"
                      >
                        切换
                      </button>
                      <button
                        @click="exportSave(name)"
                        class="btn btn-sm btn-secondary"
                        :disabled="isImporting"
                      >
                        导出
                      </button>
                      <button
                        @click="deleteSave(name)"
                        class="btn btn-sm btn-error"
                        :disabled="saveNames.length === 1 || isImporting"
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
            从JSON文件导入存档数据，支持检测重复和升级
          </p>
          <input
            type="file"
            accept=".json"
            @change="handleFileSelect"
            class="file-input file-input-bordered w-full max-w-xs"
            :disabled="isImporting"
          />
          <div v-if="saveNames.length >= 5" class="text-warning mt-2">
            存档已满（5个），只能覆盖现有存档，不能新建
          </div>
          <div v-if="importError" class="alert alert-error mt-4">
            <span>{{ importError }}</span>
          </div>
          <div v-if="importSuccess" class="alert alert-success mt-4">
            <span>{{ importSuccessMessage }}</span>
          </div>
        </div>
      </div>
    </div>

    <ImportConfigModal
      :show="showConfigModal"
      :fileData="pendingFileData"
      :suggestedSaveName="pendingSaveName"
      :saveNames="saveNames"
      :canCreateNew="saveNames.length < 5"
      :defaultTargetSaveName="currentSaveName || undefined"
      :isBusy="isImporting"
      @cancel="closeConfigModal"
      @confirm="handleModalConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../stores/save.store';
import type { ImportOptions, ImportResult } from '../model/import-result';
import { DEFAULT_IMPORT_OPTIONS } from '../model/import-result';
import ImportConfigModal from '../components/business/ImportConfigModal.vue';

const saveStore = useSaveStore();

// 基础状态
const importError = ref<string | null>(null);
const importSuccess = ref(false);
const importSuccessMessage = ref('数据导入成功！');

// 进度状态
const isImporting = ref(false);
const importStatus = ref('准备中...');
const importProgress = ref(0);

// 配置对话框状态
const showConfigModal = ref(false);
const pendingFileData = ref<any>(null);
const pendingSaveName = ref('');
const targetSaveName = ref('');
const importOptions = ref<ImportOptions>({ ...DEFAULT_IMPORT_OPTIONS });

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

// 选择文件后，先解析数据再弹出配置对话框
async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  importError.value = null;
  importSuccess.value = false;

  try {
    const content = await readFileAsText(file);
    const data = JSON.parse(content);

    // 生成新的存档名
    const originalName = data.name || '导入存档';
    let saveName = originalName;
    let counter = 1;

    while (saveNames.value.includes(saveName)) {
      saveName = `${originalName}_${counter}`;
      counter++;
    }

    // 设置待导入数据并打开配置对话框
    pendingFileData.value = data;
    pendingSaveName.value = saveName;
    targetSaveName.value = saveName; // 默认新建
    importOptions.value = { ...DEFAULT_IMPORT_OPTIONS };
    showConfigModal.value = true;
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'JSON解析失败';
  }

  target.value = '';
}

function closeConfigModal() {
  showConfigModal.value = false;
  pendingFileData.value = null;
}

function handleModalConfirm(payload: { options: ImportOptions; targetSaveName: string }) {
  importOptions.value = payload.options;
  targetSaveName.value = payload.targetSaveName;
  void confirmImport();
}

// 确认导入，显示进度条并执行
async function confirmImport() {
  if (!pendingFileData.value) return;

  showConfigModal.value = false;
  isImporting.value = true;
  importProgress.value = 10;
  importStatus.value = '准备导入...';

  try {
    importProgress.value = 30;
    importStatus.value = '验证数据格式...';
    await new Promise(resolve => setTimeout(resolve, 200));

    importProgress.value = 50;
    importStatus.value = '合并数据...';

    // 使用带选项的导入方法
    const { result } = await saveStore.importZodDataWithOptions(
      pendingFileData.value,
      importOptions.value,
      targetSaveName.value
    );

    importProgress.value = 90;
    importStatus.value = '完成处理...';
    await new Promise(resolve => setTimeout(resolve, 200));

    importProgress.value = 100;
    importStatus.value = '导入完成！';
    await new Promise(resolve => setTimeout(resolve, 300));

    // 生成成功消息
    importSuccessMessage.value = formatResultMessage(result);
    importSuccess.value = true;
    importError.value = null;

    setTimeout(() => {
      importSuccess.value = false;
    }, 5000);

  } catch (err) {
    importError.value = err instanceof Error ? err.message : '导入失败';
    importSuccess.value = false;
  } finally {
    isImporting.value = false;
    importProgress.value = 0;
    importStatus.value = '准备中...';
    pendingFileData.value = null;
  }
}

function formatResultMessage(result: ImportResult): string {
  const parts: string[] = [];

  const discNew = result.discs.new.length;
  const discUpgraded = result.discs.upgraded.length;
  const discUnchanged = result.discs.unchanged.length;
  const discRemoved = result.discs.remove.length;

  if (discNew > 0 || discUpgraded > 0 || discUnchanged > 0 || discRemoved > 0) {
    const discParts: string[] = [];
    if (discNew > 0) discParts.push(`+${discNew}新`);
    if (discUpgraded > 0) discParts.push(`↑${discUpgraded}升级`);
    if (discUnchanged > 0) discParts.push(`=${discUnchanged}重复`);
    if (discRemoved > 0) discParts.push(`-${discRemoved}删除`);
    parts.push(`驱动盘: ${discParts.join(' ')}`);
  }

  const wengineNew = result.wengines.new.length;
  const wengineUpgraded = result.wengines.upgraded.length;
  if (wengineNew > 0 || wengineUpgraded > 0) {
    const wengineParts: string[] = [];
    if (wengineNew > 0) wengineParts.push(`+${wengineNew}新`);
    if (wengineUpgraded > 0) wengineParts.push(`↑${wengineUpgraded}升级`);
    parts.push(`音擎: ${wengineParts.join(' ')}`);
  }

  const charNew = result.characters.new.length;
  const charUpgraded = result.characters.upgraded.length;
  if (charNew > 0 || charUpgraded > 0) {
    const charParts: string[] = [];
    if (charNew > 0) charParts.push(`+${charNew}新`);
    if (charUpgraded > 0) charParts.push(`↑${charUpgraded}升级`);
    parts.push(`角色: ${charParts.join(' ')}`);
  }

  return parts.length > 0 ? `导入成功！${parts.join('，')}` : '导入成功！';
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
    reader.readAsText(file);
  });
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
