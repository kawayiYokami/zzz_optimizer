<template>
  <div class="card bg-base-100 shadow-sm min-h-64">
    <div class="card-body p-4 gap-3">
      <div class="flex items-center justify-between border-b border-base-200 pb-2">
        <h3 class="card-title text-base">
          <span>战斗环境</span>
          <span v-if="!canConfigure" class="text-xs text-error font-normal">(需配置队伍与敌人)</span>
        </h3>
      </div>

      <!-- tabs: mimic BattleEvaluatorCard style -->
      <div class="tabs tabs-border rounded-box p-1">
        <label class="tab gap-2">
          <input
            type="radio"
            name="battle_env_tabs"
            :checked="activeTab === 'enemy'"
            @change="activeTab = 'enemy'"
          />
          敌人
        </label>
        <label class="tab gap-2">
          <input
            type="radio"
            name="battle_env_tabs"
            :checked="activeTab === 'buffs'"
            @change="activeTab = 'buffs'"
          />
          自选BUFF
        </label>
      </div>

      <!-- Tab: enemy -->
      <div v-if="activeTab === 'enemy'" class="flex flex-col gap-3">
        <div class="text-xs text-base-content/60">
          点击敌人卡片可更换敌人，并配置失衡状态
        </div>

        <EnemyCardHorizontal
          v-if="enemy"
          :key="`enemy_card_${envVersion}`"
          :enemy="enemy"
          :battle-service="battleService"
          class="cursor-pointer hover:shadow-md transition-shadow"
          @click="showEnemySelector = true"
        />
        <div v-else class="text-sm text-base-content/60 text-center py-6 space-y-2">
          <div>暂无敌人，请选择敌人</div>
          <button class="btn btn-xs btn-base-200 w-full" @click="showEnemySelector = true">
            选择敌人
          </button>
        </div>

        <div class="flex items-center justify-between bg-base-200/50 rounded-box p-3 border border-base-200">
          <div class="flex flex-col">
            <div class="text-xs font-medium">失衡状态</div>
            <div class="text-[11px] text-base-content/60">
              仅影响「可失衡」敌人
            </div>
          </div>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-warning"
            :checked="isStunned"
            :disabled="!canToggleStun"
            @change="toggleStun"
          />
        </div>

        <div class="flex items-center justify-between bg-base-200/50 rounded-box p-3 border border-base-200">
          <div class="flex flex-col">
            <div class="text-xs font-medium">侵蚀护盾</div>
            <div class="text-[11px] text-base-content/60">
              侵蚀类效果的护盾开关
            </div>
          </div>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-error"
            :checked="hasShield"
            :disabled="!canConfigure"
            @change="toggleShield"
          />
        </div>
      </div>

      <!-- Tab: buffs -->
      <div v-else class="flex flex-col gap-3">
        <!-- 提示信息 -->
        <div class="text-xs text-base-content/60">
          添加自定义BUFF，用于模拟特定战斗场景
        </div>

        <!-- 已添加的BUFF列表 -->
        <div v-if="customBuffs.length > 0" class="space-y-2">
          <div
            v-for="buff in customBuffs"
            :key="buff.id"
            class="flex items-start justify-between bg-base-200/30 rounded-box p-3 border border-base-200"
          >
            <!-- 左侧：名称 + 标签化属性 -->
            <div class="flex flex-col gap-2 flex-1 min-w-0 mr-3">
              <div class="text-xs font-medium">{{ buff.name }}</div>
              <!-- 属性标签化展示 -->
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="stat in getBuffStats(buff)"
                  :key="stat.key"
                  class="badge badge-xs badge-ghost text-[11px]"
                >
                  {{ stat.label }}+{{ stat.value }}{{ stat.unit }}
                </span>
              </div>
            </div>

            <!-- 右侧：开关 + 删除 -->
            <div class="flex items-center gap-2 shrink-0">
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                :checked="buff.isActive"
                @change="handleToggleBuff(buff.id, $event)"
              />
              <button
                class="btn btn-xs btn-circle btn-ghost hover:bg-error/10 text-error"
                @click="handleDeleteBuff(buff.id)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-sm text-base-content/60 text-center py-6 border border-dashed border-base-300 rounded-box">
          暂无自选BUFF，点击下方按钮添加
        </div>

        <!-- 添加按钮 -->
        <button
          class="btn btn-sm btn-primary w-full"
          @click="showCreateModal = true"
          :disabled="!teamId"
        >
          + 添加自选BUFF
        </button>

        <div v-if="!teamId" class="text-xs text-warning text-center">
          请先选择队伍
        </div>
      </div>
    </div>
  </div>

  <!-- 敌人选择弹窗 -->
  <dialog v-if="showEnemySelector" class="modal modal-open">
    <div class="modal-box w-150 max-w-full relative flex flex-col max-h-[85vh]">
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
        @click="showEnemySelector = false"
      >
        ✕
      </button>
      <h3 class="font-bold text-lg mb-4 shrink-0">选择敌人</h3>
      <div class="flex-1 overflow-y-auto min-h-0 pr-2">
        <EnemyList
          @select="handleSelectEnemy"
        />
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click.prevent="showEnemySelector = false">
      <button>close</button>
    </form>
  </dialog>

  <!-- 自选BUFF创建弹窗 -->
  <CustomBuffCreateModal
    :show="showCreateModal"
    @cancel="showCreateModal = false"
    @created="handleCreateBuff"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Enemy } from '../../model/enemy';
import type { BattleService } from '../../services/battle.service';
import type { ZodCustomBuff } from '../../model/save-data-zod';
import { PropertyType, getPropertyCnName, isPercentageProperty } from '../../model/base';
import { useSaveStore } from '../../stores/save.store';
import EnemyList from './EnemyList.vue';
import EnemyCardHorizontal from './EnemyCardHorizontal.vue';
import CustomBuffCreateModal from './CustomBuffCreateModal.vue';

interface Props {
  battleService: BattleService;
  enemy: Enemy | null;
  selectedAgent?: unknown;
  teamId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:selectedEnemyId': [enemyId: string];
  'change': [];
  'update:envVersion': [envVersion: number];
}>();

const saveStore = useSaveStore();

const activeTab = ref<'enemy' | 'buffs'>('enemy');
const showEnemySelector = ref(false);
const showCreateModal = ref(false);
const envVersion = ref(0);

const battleService = computed(() => props.battleService);
const enemy = computed(() => props.enemy);
const teamId = computed(() => props.teamId);

// 获取当前队伍的自选BUFF列表
const customBuffs = computed<ZodCustomBuff[]>(() => {
  if (!teamId.value) return [];
  return saveStore.getTeamCustomBuffs(teamId.value);
});

const canConfigure = computed(() => {
  return !!props.selectedAgent && !!props.enemy;
});

const canToggleStun = computed(() => {
  return !!props.enemy && props.enemy.can_stun;
});

const isStunned = computed(() => props.battleService.getIsEnemyStunned());
const hasShield = computed(() => props.battleService.getEnemyHasCorruptionShield());

const toggleStun = (event: Event) => {
  const target = event.target as HTMLInputElement;
  props.battleService.updateEnemyStatus('stun', target.checked);
  envVersion.value++;
  emit('update:envVersion', envVersion.value);
  emit('change');
};

const toggleShield = (event: Event) => {
  const target = event.target as HTMLInputElement;
  props.battleService.updateEnemyStatus('shield', target.checked);
  envVersion.value++;
  emit('update:envVersion', envVersion.value);
  emit('change');
};

const handleSelectEnemy = (enemyId: string) => {
  showEnemySelector.value = false;
  emit('update:selectedEnemyId', enemyId);
  envVersion.value++;
  emit('update:envVersion', envVersion.value);
  emit('change');
};

// 格式化BUFF属性显示（保留用于兼容）
function formatBuffStats(buff: ZodCustomBuff): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(buff.in_combat_stats)) {
    const propType = (PropertyType as any)[key];
    if (propType === undefined) continue;

    const propName = getPropertyCnName(propType);
    if (isPercentageProperty(propType)) {
      parts.push(`${propName} +${(value * 100).toFixed(1)}%`);
    } else {
      parts.push(`${propName} +${value.toFixed(0)}`);
    }
  }
  return parts.join(', ') || '无属性';
}

// 获取BUFF属性数组（用于标签化展示）
function getBuffStats(buff: ZodCustomBuff): Array<{ key: string; label: string; value: string; unit: string }> {
  const stats: Array<{ key: string; label: string; value: string; unit: string }> = [];

  for (const [key, value] of Object.entries(buff.in_combat_stats)) {
    const propType = (PropertyType as any)[key];
    if (propType === undefined || value === 0 || value === null || value === undefined) continue;

    const label = getPropertyCnName(propType);
    const unit = isPercentageProperty(propType) ? '%' : '';

    // 格式化数值
    let formattedValue: string;
    if (isPercentageProperty(propType)) {
      formattedValue = (value * 100).toFixed(1).replace(/\.0$/, '');
    } else {
      formattedValue = value.toFixed(0);
    }

    stats.push({
      key,
      label,
      value: formattedValue,
      unit
    });
  }

  return stats;
}

// 创建BUFF
async function handleCreateBuff(buffData: { name: string; description?: string; in_combat_stats: Record<string, number>; isActive: boolean }) {
  if (!teamId.value) return;

  const buffId = await saveStore.addCustomBuff(teamId.value, buffData);
  if (buffId) {
    showCreateModal.value = false;
    envVersion.value++;
    emit('update:envVersion', envVersion.value);
    emit('change');
  }
}

// 切换BUFF激活状态
async function handleToggleBuff(buffId: string, event: Event) {
  if (!teamId.value) return;

  const target = event.target as HTMLInputElement;
  await saveStore.toggleCustomBuffActive(teamId.value, buffId, target.checked);
  envVersion.value++;
  emit('update:envVersion', envVersion.value);
  emit('change');
}

// 删除BUFF
async function handleDeleteBuff(buffId: string) {
  if (!teamId.value) return;

  await saveStore.deleteCustomBuff(teamId.value, buffId);
  envVersion.value++;
  emit('update:envVersion', envVersion.value);
  emit('change');
}
</script>
