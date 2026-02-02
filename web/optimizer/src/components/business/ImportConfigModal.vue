<template>
  <dialog class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg mb-4">导入配置</h3>

      <!-- 导入选项 -->
      <div class="space-y-4 mb-6">
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              v-model="options.detectDups"
              class="checkbox checkbox-primary"
            />
            <div>
              <span class="label-text font-semibold">检测更新/重复 (Detect Updates/Dupes)</span>
              <p class="text-xs text-base-content/60">
                识别导入数据中与本地相同或升级的项目，避免创建重复条目
              </p>
            </div>
          </label>
        </div>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              v-model="options.deleteNotInImport"
              class="checkbox checkbox-error"
            />
            <div>
              <span class="label-text font-semibold">删除导入中不存在的项 (Delete items not in import)</span>
              <p class="text-xs text-base-content/60">
                删除本地有但导入文件中没有的项目（谨慎使用）
              </p>
            </div>
          </label>
        </div>
      </div>

      <!-- 模式说明 -->
      <div class="alert mb-4" :class="modeAlertClass">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h4 class="font-bold">{{ modeTitle }}</h4>
          <p class="text-xs">{{ modeDescription }}</p>
        </div>
      </div>

      <!-- 导入预览（导入后显示） -->
      <div v-if="importResult" class="space-y-3 mb-4">
        <h4 class="font-semibold">导入结果</h4>

        <!-- 驱动盘统计 -->
        <div v-if="hasDiscChanges" class="stats stats-vertical lg:stats-horizontal shadow w-full">
          <div class="stat">
            <div class="stat-title">驱动盘</div>
            <div class="stat-value text-lg">{{ importResult.discs.import }}</div>
            <div class="stat-desc">
              <span v-if="importResult.discs.new.length" class="text-success">+{{ importResult.discs.new.length }}新</span>
              <span v-if="importResult.discs.upgraded.length" class="text-info ml-1">↑{{ importResult.discs.upgraded.length }}升级</span>
              <span v-if="importResult.discs.unchanged.length" class="text-base-content/60 ml-1">={{ importResult.discs.unchanged.length }}重复</span>
              <span v-if="importResult.discs.remove.length" class="text-error ml-1">-{{ importResult.discs.remove.length }}删除</span>
            </div>
          </div>
        </div>

        <!-- 音擎统计 -->
        <div v-if="hasWengineChanges" class="stats stats-vertical lg:stats-horizontal shadow w-full">
          <div class="stat">
            <div class="stat-title">音擎</div>
            <div class="stat-value text-lg">{{ importResult.wengines.import }}</div>
            <div class="stat-desc">
              <span v-if="importResult.wengines.new.length" class="text-success">+{{ importResult.wengines.new.length }}新</span>
              <span v-if="importResult.wengines.upgraded.length" class="text-info ml-1">↑{{ importResult.wengines.upgraded.length }}升级</span>
              <span v-if="importResult.wengines.unchanged.length" class="text-base-content/60 ml-1">={{ importResult.wengines.unchanged.length }}重复</span>
              <span v-if="importResult.wengines.remove.length" class="text-error ml-1">-{{ importResult.wengines.remove.length }}删除</span>
            </div>
          </div>
        </div>

        <!-- 角色统计 -->
        <div v-if="hasCharacterChanges" class="stats stats-vertical lg:stats-horizontal shadow w-full">
          <div class="stat">
            <div class="stat-title">角色</div>
            <div class="stat-value text-lg">{{ importResult.characters.import }}</div>
            <div class="stat-desc">
              <span v-if="importResult.characters.new.length" class="text-success">+{{ importResult.characters.new.length }}新</span>
              <span v-if="importResult.characters.upgraded.length" class="text-info ml-1">↑{{ importResult.characters.upgraded.length }}升级</span>
              <span v-if="importResult.characters.unchanged.length" class="text-base-content/60 ml-1">={{ importResult.characters.unchanged.length }}重复</span>
              <span v-if="importResult.characters.remove.length" class="text-error ml-1">-{{ importResult.characters.remove.length }}删除</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="errorMessage" class="alert alert-error mb-4">
        <span>{{ errorMessage }}</span>
      </div>

      <!-- 操作按钮 -->
      <div class="modal-action">
        <button class="btn" @click="handleCancel">取消</button>
        <button
          class="btn btn-primary"
          :disabled="isImporting"
          @click="handleConfirm"
        >
          <span v-if="isImporting" class="loading loading-spinner loading-sm"></span>
          {{ importResult ? '完成' : '确认导入' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="handleCancel">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import type { ImportOptions, ImportResult } from '../../model/import-result';
import { DEFAULT_IMPORT_OPTIONS } from '../../model/import-result';

const props = defineProps<{
  show: boolean;
  fileData: any | null;
  targetSaveName?: string;
}>();

const emit = defineEmits<{
  cancel: [];
  imported: [result: ImportResult];
}>();

const saveStore = useSaveStore();

const options = ref<ImportOptions>({ ...DEFAULT_IMPORT_OPTIONS });
const importResult = ref<ImportResult | null>(null);
const isImporting = ref(false);
const errorMessage = ref<string | null>(null);

// 重置状态
watch(() => props.show, (show) => {
  if (show) {
    options.value = { ...DEFAULT_IMPORT_OPTIONS };
    importResult.value = null;
    errorMessage.value = null;
  }
});

// 计算模式说明
const modeTitle = computed(() => {
  const { detectDups, deleteNotInImport } = options.value;
  if (detectDups && deleteNotInImport) return '完全替换模式';
  if (detectDups && !deleteNotInImport) return '合并模式（推荐）';
  if (!detectDups && deleteNotInImport) return '清空+导入模式';
  return '追加模式';
});

const modeDescription = computed(() => {
  const { detectDups, deleteNotInImport } = options.value;
  if (detectDups && deleteNotInImport) {
    return '检测重复/升级，删除本地多余项。导入后本地数据将与导入文件完全一致。';
  }
  if (detectDups && !deleteNotInImport) {
    return '检测重复/升级，保留本地多余项。智能合并，不会丢失数据。';
  }
  if (!detectDups && deleteNotInImport) {
    return '全部作为新增，删除本地多余项。警告：可能产生重复数据！';
  }
  return '全部作为新增，保留本地多余项。适合首次导入或追加数据。';
});

const modeAlertClass = computed(() => {
  const { detectDups, deleteNotInImport } = options.value;
  if (detectDups && deleteNotInImport) return 'alert-warning';
  if (detectDups && !deleteNotInImport) return 'alert-success';
  if (!detectDups && deleteNotInImport) return 'alert-error';
  return 'alert-info';
});

// 是否有变更
const hasDiscChanges = computed(() => {
  if (!importResult.value) return false;
  const c = importResult.value.discs;
  return c.import > 0 || c.remove.length > 0;
});

const hasWengineChanges = computed(() => {
  if (!importResult.value) return false;
  const c = importResult.value.wengines;
  return c.import > 0 || c.remove.length > 0;
});

const hasCharacterChanges = computed(() => {
  if (!importResult.value) return false;
  const c = importResult.value.characters;
  return c.import > 0 || c.remove.length > 0;
});

function handleCancel() {
  emit('cancel');
}

async function handleConfirm() {
  if (importResult.value) {
    // 已导入完成，关闭对话框
    emit('imported', importResult.value);
    return;
  }

  if (!props.fileData) {
    errorMessage.value = '没有可导入的数据';
    return;
  }

  isImporting.value = true;
  errorMessage.value = null;

  try {
    const { result } = await saveStore.importZodDataWithOptions(
      props.fileData,
      options.value,
      props.targetSaveName
    );
    importResult.value = result;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '导入失败';
  } finally {
    isImporting.value = false;
  }
}
</script>
