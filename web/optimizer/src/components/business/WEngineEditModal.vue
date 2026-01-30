<template>
  <dialog class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
      <h3 class="font-bold text-lg mb-4">编辑音擎</h3>

      <div v-if="!wengine" class="flex-1 flex items-center justify-center text-base-content/60">
        未选择音擎
      </div>

      <div v-else class="flex-1 overflow-y-auto space-y-4">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-3">
            <div class="text-xs text-base-content/60">名称</div>
            <div class="font-semibold truncate" :title="wengine.name">{{ wengine.name }}</div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-3">
            <div class="text-xs text-base-content/60">等级（不可修改）</div>
            <div class="font-semibold">Lv.{{ wengine.level }}</div>
          </div>
        </div>

        <div>
          <label class="label">
            <span class="label-text font-bold">精炼等级</span>
          </label>
          <div class="join">
            <button
              v-for="r in [1, 2, 3, 4, 5]"
              :key="r"
              class="btn btn-sm join-item"
              :class="selectedRefinement === r ? 'btn-primary' : 'btn-outline'"
              type="button"
              @click="selectedRefinement = r"
            >
              R{{ r }}
            </button>
          </div>
        </div>

        <div class="alert" :class="validationErrors.length ? 'alert-warning' : 'alert-success'">
          <div>
            <h4 class="font-bold">实时校验</h4>
            <div v-if="validationErrors.length" class="text-xs space-y-1">
              <div v-for="msg in validationErrors" :key="msg">- {{ msg }}</div>
            </div>
            <div v-else class="text-xs">已满足保存条件。</div>
          </div>
        </div>

        <div v-if="errorMessage" class="alert alert-error">
          <span class="text-sm">{{ errorMessage }}</span>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="$emit('cancel')">取消</button>
        <button class="btn btn-primary" :disabled="!canSave" @click="handleSave">保存</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="$emit('cancel')">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import type { WEngine } from '../../model/wengine';

const props = defineProps<{
  show: boolean;
  wengineId: string | null;
}>();

const emit = defineEmits<{
  cancel: [];
  saved: [];
}>();

const saveStore = useSaveStore();
const errorMessage = ref<string | null>(null);
const selectedRefinement = ref<number>(1);

const wengine = computed<WEngine | null>(() => {
  if (!props.wengineId) return null;
  return saveStore.wengines.find((w) => w.id === props.wengineId) ?? null;
});

watch(
  () => [props.show, props.wengineId] as const,
  () => {
    errorMessage.value = null;
    if (!props.show || !wengine.value) return;
    selectedRefinement.value = Math.min(5, Math.max(1, Number(wengine.value.refinement) || 1));
  },
  { immediate: true }
);

const validationErrors = computed<string[]>(() => {
  const errors: string[] = [];
  if (!wengine.value) return errors;
  if (!Number.isFinite(selectedRefinement.value) || selectedRefinement.value < 1 || selectedRefinement.value > 5) {
    errors.push('精炼等级必须在 1~5 之间');
  }
  return errors;
});

const canSave = computed(() => {
  if (!wengine.value) return false;
  if (validationErrors.value.length) return false;
  return selectedRefinement.value !== (Number(wengine.value.refinement) || 1);
});

async function handleSave() {
  if (!wengine.value) return;
  if (!canSave.value) return;
  errorMessage.value = null;

  const ok = await saveStore.updateWEngineRefinement(wengine.value.id, selectedRefinement.value);
  if (!ok) {
    errorMessage.value = '保存失败';
    return;
  }
  emit('saved');
}
</script>

