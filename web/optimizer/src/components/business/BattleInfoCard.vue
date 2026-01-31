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

      <!-- Tab: buffs (todo) -->
      <div v-else class="text-sm text-base-content/60 text-center py-10">
        TODO: 自选BUFF（暂不实现）
      </div>
    </div>
  </div>

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
          @select="(enemyId) => { showEnemySelector = false; emit('update:selectedEnemyId', enemyId); envVersion.value++; emit('update:envVersion', envVersion.value); emit('change'); }"
        />
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click.prevent="showEnemySelector = false">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Enemy } from '../../model/enemy';
import type { BattleService } from '../../services/battle.service';
import EnemyList from './EnemyList.vue';
import EnemyCardHorizontal from './EnemyCardHorizontal.vue';

interface Props {
  battleService: BattleService;
  enemy: Enemy | null;
  selectedAgent?: unknown;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:selectedEnemyId': [enemyId: string];
  'change': [];
  'update:envVersion': [envVersion: number];
}>();

const activeTab = ref<'enemy' | 'buffs'>('enemy');
const showEnemySelector = ref(false);
const envVersion = ref(0);

const battleService = computed(() => props.battleService);
const enemy = computed(() => props.enemy);

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
</script>
