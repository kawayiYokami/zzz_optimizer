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
              :disabled="isBusy"
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
              :disabled="isBusy"
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

      <!-- 目标存档选择 -->
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text font-semibold">目标存档</span>
        </label>
        <select v-model="targetSaveName" class="select select-bordered w-full" :disabled="isBusy">
          <option v-if="canCreateNew !== false" :value="suggestedSaveName">{{ suggestedSaveName }} (新建)</option>
          <option v-for="name in saveNames" :key="name" :value="name">
            {{ name }} (覆盖/合并)
          </option>
        </select>
      </div>

      <!-- 预览与错误列表 -->
      <div class="space-y-3 mb-4">
        <div v-if="isParsingPreview" class="alert alert-info">
          <span class="loading loading-spinner loading-sm"></span>
          <span>正在解析并生成预览...</span>
        </div>

        <div v-if="previewError" class="alert alert-error">
          <span>{{ previewError }}</span>
        </div>

        <div v-if="previewResult" class="space-y-3">
          <div class="text-sm text-base-content/70">
            将新增：
            <span class="font-semibold text-success">+{{ previewResult.discs.new.length }}</span> 驱动盘，
            <span class="font-semibold text-success">+{{ previewResult.wengines.new.length }}</span> 音擎，
            <span class="font-semibold text-success">+{{ previewResult.characters.new.length }}</span> 角色
            <span v-if="parseErrors.length" class="text-warning ml-2">
              （{{ parseErrors.length }}条解析失败将被跳过）
            </span>
          </div>

          <!-- 三张统计卡片（并排 + 底色 base-200） -->
          <div class="stats stats-horizontal shadow w-full bg-base-200">
            <div class="stat">
              <div class="stat-title">驱动盘</div>
              <div class="stat-value text-lg">{{ previewResult.discs.import }}</div>
              <div class="stat-desc">
                <span v-if="previewResult.discs.new.length" class="text-success">+{{ previewResult.discs.new.length }}新</span>
                <span v-if="previewResult.discs.upgraded.length" class="text-info ml-1">↑{{ previewResult.discs.upgraded.length }}升级</span>
                <span v-if="previewResult.discs.unchanged.length" class="text-base-content/60 ml-1">={{ previewResult.discs.unchanged.length }}重复</span>
                <span v-if="previewResult.discs.remove.length" class="text-error ml-1">-{{ previewResult.discs.remove.length }}删除</span>
                <span v-if="previewResult.discs.invalid.length" class="text-warning ml-1">!{{ previewResult.discs.invalid.length }}无效</span>
              </div>
            </div>

            <div class="stat">
              <div class="stat-title">音擎</div>
              <div class="stat-value text-lg">{{ previewResult.wengines.import }}</div>
              <div class="stat-desc">
                <span v-if="previewResult.wengines.new.length" class="text-success">+{{ previewResult.wengines.new.length }}新</span>
                <span v-if="previewResult.wengines.upgraded.length" class="text-info ml-1">↑{{ previewResult.wengines.upgraded.length }}升级</span>
                <span v-if="previewResult.wengines.unchanged.length" class="text-base-content/60 ml-1">={{ previewResult.wengines.unchanged.length }}重复</span>
                <span v-if="previewResult.wengines.remove.length" class="text-error ml-1">-{{ previewResult.wengines.remove.length }}删除</span>
                <span v-if="previewResult.wengines.invalid.length" class="text-warning ml-1">!{{ previewResult.wengines.invalid.length }}无效</span>
              </div>
            </div>

            <div class="stat">
              <div class="stat-title">角色</div>
              <div class="stat-value text-lg">{{ previewResult.characters.import }}</div>
              <div class="stat-desc">
                <span v-if="previewResult.characters.new.length" class="text-success">+{{ previewResult.characters.new.length }}新</span>
                <span v-if="previewResult.characters.upgraded.length" class="text-info ml-1">↑{{ previewResult.characters.upgraded.length }}升级</span>
                <span v-if="previewResult.characters.unchanged.length" class="text-base-content/60 ml-1">={{ previewResult.characters.unchanged.length }}重复</span>
                <span v-if="previewResult.characters.remove.length" class="text-error ml-1">-{{ previewResult.characters.remove.length }}删除</span>
                <span v-if="previewResult.characters.invalid.length" class="text-warning ml-1">!{{ previewResult.characters.invalid.length }}无效</span>
              </div>
            </div>
          </div>

          <details v-if="parseErrors.length" class="collapse collapse-arrow bg-base-200">
            <summary class="collapse-title text-sm font-semibold">
              解析失败条目 ({{ parseErrors.length }})
            </summary>
            <div class="collapse-content">
              <div class="max-h-60 overflow-auto space-y-2">
                <div v-for="(e, idx) in parseErrors" :key="idx" class="text-xs">
                  <div class="font-mono break-all">
                    {{ e.type }}: {{ e.displayName }} ({{ e.id }})
                  </div>
                  <div class="text-error/80 break-all">
                    {{ e.errorMessage }}
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="modal-action">
        <button class="btn" @click="handleCancel">取消</button>
        <button
          class="btn btn-primary"
          :disabled="isBusy || isParsingPreview || !fileData || !previewResult || !!previewError"
          @click="handleConfirm"
        >
          确认导入
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
  suggestedSaveName: string;
  saveNames: string[];
  canCreateNew?: boolean;
  defaultTargetSaveName?: string;
  isBusy?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [payload: { options: ImportOptions; targetSaveName: string }];
}>();

const saveStore = useSaveStore();

const options = ref<ImportOptions>({ ...DEFAULT_IMPORT_OPTIONS });
const targetSaveName = ref('');
const previewResult = ref<ImportResult | null>(null);
const isParsingPreview = ref(false);
const previewError = ref<string | null>(null);

const isBusy = computed(() => !!props.isBusy);
const fileData = computed(() => props.fileData);

const parseErrors = computed(() => previewResult.value?.parseErrors ?? []);

// 重置状态
watch(
  () => props.show,
  (show) => {
    if (!show) return;

    options.value = { ...DEFAULT_IMPORT_OPTIONS };
    if (props.defaultTargetSaveName) {
      targetSaveName.value = props.defaultTargetSaveName;
    } else if (props.canCreateNew === false) {
      targetSaveName.value = props.saveNames[0] ?? props.suggestedSaveName;
    } else {
      targetSaveName.value = props.suggestedSaveName;
    }
    previewResult.value = null;
    previewError.value = null;
  }
);

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

// 是否有变更（用于决定是否展示统计块）
const hasDiscChanges = computed(() => {
  if (!previewResult.value) return false;
  const c = previewResult.value.discs;
  return c.import > 0 || c.remove.length > 0 || c.invalid.length > 0;
});

const hasWengineChanges = computed(() => {
  if (!previewResult.value) return false;
  const c = previewResult.value.wengines;
  return c.import > 0 || c.remove.length > 0 || c.invalid.length > 0;
});

const hasCharacterChanges = computed(() => {
  if (!previewResult.value) return false;
  const c = previewResult.value.characters;
  return c.import > 0 || c.remove.length > 0 || c.invalid.length > 0;
});

function handleCancel() {
  emit('cancel');
}

function handleConfirm() {
  emit('confirm', { options: options.value, targetSaveName: targetSaveName.value });
}

let previewReqId = 0;
async function generatePreview() {
  if (!props.show || !props.fileData) {
    previewResult.value = null;
    previewError.value = null;
    return;
  }

  const reqId = ++previewReqId;
  isParsingPreview.value = true;
  previewError.value = null;

  try {
    const { result } = await saveStore.previewZodImportWithOptions(
      props.fileData,
      options.value,
      targetSaveName.value
    );

    // 忽略过期请求（避免 watch + async 竞态）
    if (reqId !== previewReqId) return;

    previewResult.value = result;
  } catch (err) {
    if (reqId !== previewReqId) return;
    previewResult.value = null;
    previewError.value = err instanceof Error ? err.message : '预览失败';
  } finally {
    if (reqId === previewReqId) {
      isParsingPreview.value = false;
    }
  }
}

watch(
  () => [props.show, props.fileData, targetSaveName.value, options.value.detectDups, options.value.deleteNotInImport] as const,
  async ([show]) => {
    if (!show) return;
    if (isBusy.value) return;
    await generatePreview();
  }
);
</script>
