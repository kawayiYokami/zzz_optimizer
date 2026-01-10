<template>
  <dialog class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      <h3 class="font-bold text-lg mb-4">编辑驱动盘</h3>

      <div v-if="!disk" class="flex-1 flex items-center justify-center text-base-content/60">
        未选择驱动盘
      </div>

      <div v-else class="flex-1 overflow-y-auto space-y-4">
        <!-- 固定信息（只读） -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-3">
              <div class="text-xs text-base-content/60">套装</div>
              <div class="font-semibold truncate" :title="disk.set_name">{{ disk.set_name }}</div>
            </div>
          </div>
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-3">
              <div class="text-xs text-base-content/60">部位 / 稀有度 / 等级</div>
              <div class="font-semibold">#{{ disk.position }} / {{ rarityLabel }} / Lv.{{ disk.level }}</div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-3">
            <div class="text-xs text-base-content/60">主词条（不可修改）</div>
            <div class="font-semibold">{{ mainStatLabel }}</div>
          </div>
        </div>

        <!-- 副词条（类型不可改，仅改条数） -->
        <div>
          <label class="label">
            <span class="label-text font-bold">副词条</span>
          </label>

          <div class="grid grid-cols-1 gap-2">
            <div v-for="(row, idx) in rows" :key="row.key" class="grid grid-cols-[1fr_9rem] gap-2 items-center">
              <div class="truncate" :title="row.label">{{ row.label }}</div>

              <div class="flex items-center justify-end gap-2">
                <button class="btn btn-xs btn-outline" type="button" :disabled="row.upgrades <= 1" @click="dec(idx)">
                  -
                </button>
                <div class="w-8 text-center text-xs">+{{ Math.max(0, row.upgrades - 1) }}</div>
                <button class="btn btn-xs btn-outline" type="button" :disabled="totalLines >= maxTotalLines" @click="inc(idx)">
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 实时校验 -->
        <div class="alert" :class="validationErrors.length ? 'alert-warning' : 'alert-success'">
          <div>
            <h4 class="font-bold">实时校验</h4>
            <div v-if="validationErrors.length" class="text-xs space-y-1">
              <div v-for="msg in validationErrors" :key="msg">- {{ msg }}</div>
            </div>
            <div v-else class="text-xs">已满足保存条件。</div>
          </div>
        </div>

        <!-- 提交错误 -->
        <div v-if="errorMessage" class="alert alert-error">
          <span class="text-sm">{{ errorMessage }}</span>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="$emit('cancel')">取消</button>
        <button class="btn btn-error" :disabled="!disk" @click="handleDelete">删除</button>
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
import type { DriveDisk } from '../../model/drive-disk';
import { getPropertyCnName, Rarity } from '../../model/base';

const props = defineProps<{
  show: boolean;
  diskId: string | null;
}>();

const emit = defineEmits<{
  cancel: [];
  saved: [];
  deleted: [];
}>();

const saveStore = useSaveStore();
const errorMessage = ref<string | null>(null);

const disk = computed<DriveDisk | null>(() => {
  if (!props.diskId) return null;
  return saveStore.driveDisks.find((d) => d.id === props.diskId) ?? null;
});

const rarityLabel = computed(() => {
  if (!disk.value) return '';
  if (disk.value.rarity === Rarity.S) return 'S';
  if (disk.value.rarity === Rarity.A) return 'A';
  return String(disk.value.rarity);
});

const mainStatLabel = computed(() => {
  if (!disk.value) return '';
  return getPropertyCnName(disk.value.main_stat);
});

type Row = { key: string; label: string; upgrades: number };
const rows = ref<Row[]>([]);

watch(
  () => [props.show, props.diskId] as const,
  () => {
    errorMessage.value = null;
    if (!props.show || !disk.value) {
      rows.value = [];
      return;
    }

    // Initialize from current disk substats (rolls)
    const current = disk.value.getSubStatsWithRolls();
    rows.value = current.map((s) => ({
      key: String(s.prop),
      label: getPropertyCnName(s.prop),
      // In model, StatValue.value stores rolls count; getSubStatsWithRolls returns displayRolls (rolls-1)
      // We reconstruct upgrades as (displayRolls + 1).
      upgrades: Math.max(1, (s.rolls ?? 0) + 1),
    }));
  },
  { immediate: true }
);

const totalLines = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.upgrades) || 0), 0));

const maxTotalLines = computed(() => {
  // follow the same formula: max = 4 + floor(level/3), capped at +5
  const lv = disk.value?.level ?? 0;
  const extra = Math.min(5, Math.floor(lv / 3));
  return 4 + extra;
});

function inc(index: number) {
  if (!rows.value[index]) return;
  if (totalLines.value >= maxTotalLines.value) return;
  rows.value = rows.value.map((r, i) => (i === index ? { ...r, upgrades: r.upgrades + 1 } : r));
}

function dec(index: number) {
  const row = rows.value[index];
  if (!row) return;
  if (row.upgrades <= 1) return;
  rows.value = rows.value.map((r, i) => (i === index ? { ...r, upgrades: Math.max(1, r.upgrades - 1) } : r));
}

const validationErrors = computed<string[]>(() => {
  const errors: string[] = [];
  if (!disk.value) return errors;
  // Must be exactly 4 distinct substat types (no type editing allowed, but imported data may be incomplete)
  if (rows.value.length !== 4) errors.push(`副词条类型必须为4种（当前 ${rows.value.length}/4）`);

  const minTotalLines = 3 + Math.min(5, Math.floor((disk.value.level ?? 0) / 3));
  if (totalLines.value < minTotalLines) errors.push(`总条数低于下限：${totalLines.value} < ${minTotalLines}`);
  if (totalLines.value > maxTotalLines.value) errors.push(`总条数超上限：${totalLines.value} > ${maxTotalLines.value}`);
  return errors;
});

const canSave = computed(() => {
  return !!disk.value && validationErrors.value.length === 0;
});

async function handleSave() {
  if (!disk.value) return;
  if (!canSave.value) return;
  errorMessage.value = null;

  // Map to ZOD substats: we only preserve the "key" at the storage layer.
  // Since we don't allow changing types here, use the existing raw keys if present; fallback to CN name keys is not possible.
  // We store as { key: <string>, upgrades } where key should be ZOD property key.
  // For now, keep the current disk's ZOD keys by using the existing computed rolls list order is stable.
  const raw = saveStore.currentRawSave?.discs?.find((d) => d.id === disk.value!.id);
  if (!raw) {
    errorMessage.value = '找不到原始驱动盘数据';
    return;
  }

  const nextSubstats = raw.substats.map((s, idx) => ({
    key: s.key,
    upgrades: rows.value[idx]?.upgrades ?? s.upgrades,
  }));

  const ok = await saveStore.updateDriveDiskSubstats(disk.value.id, nextSubstats);
  if (!ok) {
    errorMessage.value = '保存失败';
    return;
  }
  emit('saved');
}

async function handleDelete() {
  if (!disk.value) return;
  errorMessage.value = null;
  const ok = await saveStore.deleteDriveDisk(disk.value.id);
  if (!ok) {
    errorMessage.value = '删除失败';
    return;
  }
  emit('deleted');
}
</script>
