<template>
  <div class="card bg-base-100 border border-base-300 overflow-hidden">
    <div class="flex min-h-28">
      <figure class="relative w-28 self-stretch bg-base-200 shrink-0">
        <img
          v-if="enemyIconUrl"
          :src="enemyIconUrl"
          class="absolute w-full h-full object-cover object-center"
          :alt="enemy.full_name"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-base-content/20 text-4xl font-bold">?</div>
      </figure>

      <div class="flex-1 p-3 flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-bold text-sm truncate">{{ enemy.full_name }}</h3>
            <div class="flex gap-1 mt-1 flex-wrap">
              <span v-if="enemy.isBoss" class="badge badge-xs badge-error">首领</span>
              <span v-if="enemy.isElite" class="badge badge-xs badge-warning">精英</span>
              <span class="badge badge-xs badge-ghost">Lv.60</span>
            </div>
          </div>

          <div class="text-xs text-base-content/70 shrink-0">
            <span v-if="enemy.can_stun" class="text-yellow-600">可失衡</span>
            <span v-else class="text-base-content/40">不可失衡</span>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-2 text-xs bg-base-200/50 rounded p-2 text-center">
          <div class="flex flex-col">
            <span class="opacity-60">生命</span>
            <span class="font-semibold">{{ formatNumber(enemy.hp) }}</span>
          </div>
          <div class="flex flex-col">
            <span class="opacity-60">防御</span>
            <span class="font-semibold">
              <span>{{ formatNumber(enemy.defense) }}</span>
              <span v-if="hasShield" class="opacity-60"> -> </span>
              <span v-if="hasShield" :key="finalDefenseKey">{{ formatNumber(finalDefense) }}</span>
            </span>
          </div>
          <div class="flex flex-col">
            <span class="opacity-60">攻击</span>
            <span class="font-semibold">{{ formatNumber(enemy.atk) }}</span>
          </div>
          <div class="flex flex-col">
            <span class="opacity-60">失衡易伤</span>
            <span class="font-semibold">{{ formatPercent(enemy.stun_vulnerability_multiplier) }}</span>
          </div>
        </div>

        <div class="grid grid-cols-5 gap-1 text-center text-xs">
          <div
            v-for="ele in elements"
            :key="ele.key"
            class="flex flex-col items-center p-1 rounded bg-base-200"
          >
            <span :class="['w-2 h-2 rounded-full mb-1', ele.color]"></span>
            <span class="scale-90">{{ ele.label }}</span>
            <span :class="getResClass(enemy.getDmgResistance(ele.key))">
              {{ formatPercent(enemy.getDmgResistance(ele.key)) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Enemy } from '../../model/enemy';
import { iconService } from '../../services/icon.service';
import type { BattleService } from '../../services/battle.service';

const props = defineProps<{
  enemy: Enemy;
  battleService: BattleService;
}>();

const enemyIconUrl = computed(() => iconService.getEnemyIconById(props.enemy.id));
const finalEnemyStats = computed(() => props.battleService.getEnemyCombatStats());
const finalDefense = computed(() => finalEnemyStats.value?.defense ?? props.enemy.defense);
const hasShield = computed(() => props.battleService.getEnemyHasCorruptionShield());
const finalDefenseKey = computed(() => `${props.enemy.id}_${Number(hasShield.value)}`);

const elements = [
  { key: 'physical', label: '物理', color: 'bg-yellow-500' },
  { key: 'fire', label: '火', color: 'bg-red-500' },
  { key: 'ice', label: '冰', color: 'bg-cyan-400' },
  { key: 'electric', label: '电', color: 'bg-blue-600' },
  { key: 'ether', label: '以太', color: 'bg-pink-500' },
];

function formatNumber(num: number) {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  return num.toFixed(0);
}

function formatPercent(val: number) {
  if (val === 0) return '-';
  const percent = (val * 100).toFixed(0) + '%';
  return val > 0 ? `+${percent}` : percent;
}

function getResClass(val: number) {
  if (val < 0) return 'text-red-500 font-bold';
  if (val > 0) return 'text-green-600';
  return 'opacity-40';
}
</script>
