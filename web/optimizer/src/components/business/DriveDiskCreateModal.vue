<template>
  <dialog class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      <h3 class="font-bold text-lg mb-4">添加驱动盘</h3>
      
      <div class="flex-1 overflow-y-auto space-y-4">
        <!-- 套装选择 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">选择套装</span>
          </label>
          <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <button
              v-for="set in allEquipments.filter(e => e.id)"
              :key="set.id"
              @click="selectedSetId = set.id"
              class="btn btn-sm p-0 border border-base-300 flex flex-col items-center gap-1"
              :class="{
                'btn-primary': selectedSetId === set.id,
                'btn-outline': selectedSetId !== set.id
              }"
              :title="set.CHS?.name"
            >
              <img :src="iconService.getEquipmentIconById(set.id)" :alt="set.CHS?.name" class="w-8 h-8 object-contain" />
              <span class="text-[10px] truncate w-full">{{ set.CHS?.name }}</span>
            </button>
          </div>
        </div>

        <!-- 部位选择 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">选择部位</span>
          </label>
          <div class="grid grid-cols-6 gap-2">
            <button
              v-for="position in positions"
              :key="position.value"
              @click="selectedSlot = position.value"
              class="btn btn-sm"
              :class="{
                'btn-primary': selectedSlot === position.value,
                'btn-outline': selectedSlot !== position.value
              }"
            >
              {{ position.label }}
            </button>
          </div>
        </div>

        <!-- 稀有度选择 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">稀有度</span>
          </label>
          <div class="flex gap-2">
            <button
              v-for="rarity in rarityOptions"
              :key="rarity.value"
              @click="selectedRarity = rarity.value"
              class="btn btn-sm"
              :class="{
                'btn-primary': selectedRarity === rarity.value,
                'btn-outline': selectedRarity !== rarity.value
              }"
            >
              {{ rarity.label }}
            </button>
          </div>
        </div>

        <!-- 主词条 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">主词条</span>
          </label>
          <select class="select select-bordered w-full" v-model="selectedMainStat">
            <option v-for="opt in availableMainStatOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- 副词条（左：类型；右：加减条数） -->
        <div>
          <label class="label">
            <span class="label-text font-bold">副词条（4条）</span>
          </label>

          <div class="grid grid-cols-1 gap-2">
            <div v-for="i in 4" :key="i" class="grid grid-cols-[1fr_9rem] gap-2 items-center">

              <select
                class="select select-bordered w-full"
                :value="subStats[i - 1].key"
                @change="onChangeSubStatKey(i - 1, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">（无）</option>
                <option
                  v-for="opt in availableSubStatOptions(i - 1)"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>

              <div class="flex items-center justify-end gap-2">
                <button
                  class="btn btn-xs btn-outline"
                  :disabled="!canDecrease(i - 1)"
                  @click="decrease(i - 1)"
                  type="button"
                >
                  -
                </button>
                <div class="w-8 text-center text-xs">
                  +{{ Math.max(0, (subStats[i - 1].upgrades ?? 1) - 1) }}
                </div>
                <button
                  class="btn btn-xs btn-outline"
                  :disabled="!canIncrease(i - 1)"
                  @click="increase(i - 1)"
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- 错误提示（提交错误） -->
        <div v-if="errorMessage" class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 实时校验 -->
        <div class="alert" :class="validationErrors.length ? 'alert-warning' : 'alert-success'">
          <div>
            <h4 class="font-bold">实时校验</h4>
            <div v-if="validationErrors.length" class="text-xs space-y-1">
              <div v-for="msg in validationErrors" :key="msg">- {{ msg }}</div>
            </div>
            <div v-else class="text-xs">已满足创建条件，可以添加。</div>
          </div>
        </div>

      </div>

      <div class="modal-action">
        <button class="btn" @click="$emit('cancel')">取消</button>
        <button class="btn btn-primary" @click="handleCreate" :disabled="!canCreate">添加</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="$emit('cancel')">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import { iconService } from '../../services/icon.service';
import { DriveDiskPosition } from '../../model/drive-disk';
import { DataLoaderService } from '../../services/data-loader.service';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  created: [];
}>();

const saveStore = useSaveStore();

const selectedSetId = ref<string | null>(null);
const selectedSlot = ref(DriveDiskPosition.SLOT_1);
const selectedRarity = ref('S');
const selectedLevel = ref<number>(15);
const selectedMainStat = ref<string>('');
const subStats = ref<Array<{ key: string; upgrades: number }>>([
  { key: '', upgrades: 1 },
  { key: '', upgrades: 1 },
  { key: '', upgrades: 1 },
  { key: '', upgrades: 1 },
]);
const errorMessage = ref<string | null>(null);

const positions = [
  { value: DriveDiskPosition.SLOT_1, label: '1' },
  { value: DriveDiskPosition.SLOT_2, label: '2' },
  { value: DriveDiskPosition.SLOT_3, label: '3' },
  { value: DriveDiskPosition.SLOT_4, label: '4' },
  { value: DriveDiskPosition.SLOT_5, label: '5' },
  { value: DriveDiskPosition.SLOT_6, label: '6' },
];

const rarityOptions = [
  { value: 'S', label: 'S级' },
  { value: 'A', label: 'A级' },
];

const maxDiscLevel = computed(() => {
  return selectedRarity.value === 'S' ? 15 : 12;
});

type StatOption = { value: string; label: string };

const statLabelMap: Record<string, string> = {
  hp: '生命值',
  atk: '攻击力',
  def: '防御力',
  hp_: '生命%',
  atk_: '攻击%',
  def_: '防御%',
  crit_: '暴击率',
  crit_dmg_: '暴击伤害',
  pen: '穿透值',
  pen_: '穿透率%',
  anomProf: '异常掌控',
  anomMas_: '异常精通%',
  impact_: '冲击力%',
  enerRegen_: '能量恢复%',
  energyRegen_: '能量恢复%',
  fire_dmg_: '火伤%',
  ice_dmg_: '冰伤%',
  electric_dmg_: '雷伤%',
  physical_dmg_: '物伤%',
  ether_dmg_: '以太%',
};

const mainAllowedBySlot: Record<number, string[]> = {
  1: ['hp'],
  2: ['atk'],
  3: ['def'],
  4: ['hp_', 'atk_', 'def_', 'crit_', 'crit_dmg_', 'anomProf'],
  5: ['hp_', 'atk_', 'def_', 'pen_', 'fire_dmg_', 'ice_dmg_', 'electric_dmg_', 'physical_dmg_', 'ether_dmg_'],
  6: ['hp_', 'atk_', 'def_', 'anomMas_', 'impact_', 'enerRegen_', 'energyRegen_'],
};

const subStatPool: string[] = [
  'hp',
  'atk',
  'def',
  'pen',
  'anomProf',
  'hp_',
  'atk_',
  'def_',
  'crit_',
  'crit_dmg_',
];

function toOptions(keys: string[]): StatOption[] {
  return keys.map((k) => ({ value: k, label: statLabelMap[k] ?? k }));
}

const availableMainStatOptions = computed<StatOption[]>(() => {
  const keys = mainAllowedBySlot[selectedSlot.value] ?? [];
  return toOptions(keys);
});

watch(
  [selectedSlot, availableMainStatOptions],
  () => {
    const allowed = new Set((mainAllowedBySlot[selectedSlot.value] ?? []));
    if (!selectedMainStat.value || !allowed.has(selectedMainStat.value)) {
      selectedMainStat.value = (availableMainStatOptions.value[0]?.value ?? '');
    }

    // If main stat changes, clear any conflicting substats
    subStats.value = subStats.value.map((s) => (s.key === selectedMainStat.value ? { key: '', upgrades: 1 } : s));
  },
  { immediate: true }
);

function availableSubStatOptions(index: number): StatOption[] {
  const current = subStats.value[index].key;
  const used = new Set(subStats.value.filter((s, i) => s.key && i !== index).map((s) => s.key));
  const main = selectedMainStat.value;

  const filtered = subStatPool.filter((k) => {
    if (k === main) return false;
    if (used.has(k)) return false;
    return true;
  });

  // keep current selection visible
  if (current && !filtered.includes(current) && current !== main) {
    filtered.unshift(current);
  }

  return toOptions(filtered);
}

function onChangeSubStatKey(index: number, value: string) {
  const prev = subStats.value;
  const next = prev.map((s, i) => {
    if (i === index) return { key: value, upgrades: 1 };
    if (value && s.key === value) return { key: '', upgrades: 1 };
    return s;
  });

  const same = prev.length === next.length && prev.every((s, i) => s.key === next[i].key && s.upgrades === next[i].upgrades);
  if (!same) subStats.value = next;
}

const selectedSubTypes = computed(() => subStats.value.filter((s) => s.key).map((s) => s.key));
const selectedSubTypeCount = computed(() => new Set(selectedSubTypes.value).size);

const totalSubLines = computed(() => {
  return subStats.value
    .filter((s) => s.key)
    .reduce((sum, s) => sum + (Number(s.upgrades) || 0), 0);
});

const extraLines = computed(() => Math.min(5, Math.floor(selectedLevel.value / 3)));
const maxTotalLines = computed(() => 4 + extraLines.value);

const canEditSubStatUpgrades = computed(() => selectedSubTypeCount.value === 4);

function canIncrease(index: number): boolean {
  if (!canEditSubStatUpgrades.value) return false;
  if (!subStats.value[index].key) return false;
  if (totalSubLines.value >= maxTotalLines.value) return false;
  return true;
}

function canDecrease(index: number): boolean {
  if ((subStats.value[index].upgrades ?? 1) <= 1) return false;
  return true;
}

function increase(index: number) {
  if (!canIncrease(index)) return;
  subStats.value = subStats.value.map((s, i) => (i === index ? { ...s, upgrades: s.upgrades + 1 } : s));
}

function decrease(index: number) {
  // Allow decrement as long as:
  // - the row has a key
  // - upgrades stays >= 1
  const row = subStats.value[index];
  if (!row?.key) return;
  if ((row.upgrades ?? 1) <= 1) return;

  subStats.value = subStats.value.map((s, i) => (i === index ? { ...s, upgrades: Math.max(1, s.upgrades - 1) } : s));
}

const allEquipments = computed(() => {
  const dataLoader = DataLoaderService.getInstance();
  const data = dataLoader.equipmentData;
  if (!data) return [];
  
  // 从 Map 转换为数组，同时添加 id 字段
  return Array.from(data.entries()).map(([id, equipment]) => ({
    ...equipment,
    id: id
  }));
});

const canCreate = computed(() => {
  if (!selectedSetId.value) return false;
  if (!selectedMainStat.value) return false;

  // Must be a valid main stat for slot
  const allowedMain = new Set(mainAllowedBySlot[selectedSlot.value] ?? []);
  if (!allowedMain.has(selectedMainStat.value)) return false;

  // No duplicate substats and no conflict with main
  const subs = subStats.value.filter((s) => s.key);
  const subKeys = subs.map((s) => s.key);
  if (subKeys.includes(selectedMainStat.value)) return false;
  if (new Set(subKeys).size !== subKeys.length) return false;

  const typeCount = subKeys.length;
  const total = subs.reduce((sum, s) => sum + (Number(s.upgrades) || 0), 0);
  if (total > maxTotalLines.value) return false;
  // Must pick exactly 4 substat types to create (UI assumes 4 fixed types)
  if (typeCount !== 4) return false;
  if (typeCount === 4 && subs.some((s) => (Number(s.upgrades) || 0) < 1)) return false;
  // Total lines must be within [min, max]
  const minTotalLines = 3 + extraLines.value;
  if (total < minTotalLines) return false;

  return true;
});

const validationErrors = computed<string[]>(() => {
  const errors: string[] = [];

  if (!selectedSetId.value) errors.push('请选择套装');

  const allowedMain = new Set(mainAllowedBySlot[selectedSlot.value] ?? []);
  if (!selectedMainStat.value) {
    errors.push('请选择主词条');
  } else if (!allowedMain.has(selectedMainStat.value)) {
    errors.push('主词条不符合当前部位限制');
  }

  const subs = subStats.value.filter((s) => s.key);
  const subKeys = subs.map((s) => s.key);
  if (subKeys.includes(selectedMainStat.value)) {
    errors.push('副词条不能与主词条重复');
  }
  if (new Set(subKeys).size !== subKeys.length) {
    errors.push('副词条不能重复');
  }
  if (subKeys.length !== 4) {
    errors.push(`需要选择4种副词条（当前 ${subKeys.length}/4）`);
  }

  const total = subs.reduce((sum, s) => sum + (Number(s.upgrades) || 0), 0);
  const minTotalLines = 3 + extraLines.value;
  if (total > maxTotalLines.value) {
    errors.push(`总条数超上限：${total} > ${maxTotalLines.value}`);
  }
  if (total < minTotalLines) {
    errors.push(`总条数低于下限：${total} < ${minTotalLines}`);
  }

  return errors;
});

watch(
  () => [selectedMainStat.value, subStats.value.map((s) => s.key).join('|')] as const,
  () => {
    // When not all 4 types selected, upgrades must stay 1 (no extra-line allocation).
    if (selectedSubTypeCount.value < 4) {
      const next = subStats.value.map((s) => ({ key: s.key, upgrades: 1 }));
      // avoid recursive triggering if nothing changes
      const same = subStats.value.every((s, i) => s.upgrades === next[i].upgrades && s.key === next[i].key);
      if (!same) subStats.value = next;
    }
  }
);

watch(
  [selectedRarity, maxDiscLevel],
  () => {
    selectedLevel.value = maxDiscLevel.value;
  },
  { immediate: true }
);

async function handleCreate() {
  if (!canCreate.value) return;

  const set = allEquipments.value.find(e => e.id === selectedSetId.value);
  if (!set) return;

  const setKey = set.EN?.name || set.id;

  errorMessage.value = null;

  try {
    const substats = subStats.value
      .filter((s) => s.key)
      .map((s) => ({ key: s.key, upgrades: s.upgrades }));

    const success = await saveStore.createDriveDisk(
      setKey,
      selectedRarity.value,
      selectedLevel.value,
      `slot${selectedSlot.value}`,
      selectedMainStat.value,
      substats
    );

    if (success) {
      selectedSetId.value = null;
      selectedSlot.value = DriveDiskPosition.SLOT_1;
      selectedRarity.value = 'S';
      selectedLevel.value = 15;
      selectedMainStat.value = '';
      subStats.value = [
        { key: '', upgrades: 1 },
        { key: '', upgrades: 1 },
        { key: '', upgrades: 1 },
        { key: '', upgrades: 1 },
      ];
      emit('created');
    } else {
      errorMessage.value = '创建驱动盘失败，请重试';
    }
  } catch (error) {
    console.error('创建驱动盘失败:', error);
    errorMessage.value = '创建驱动盘失败：' + (error instanceof Error ? error.message : '未知错误');
  }
}
</script>
