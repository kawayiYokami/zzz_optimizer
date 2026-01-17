<template>
  <div class="card bg-base-100 shadow-xl compact-card border border-base-300 w-72 overflow-hidden">
    <!-- Image Section -->
    <figure class="relative h-24 w-full bg-base-200">
        <img
            v-if="enemyIconUrl"
            :src="enemyIconUrl"
            class="absolute w-full h-full object-cover object-center"
            :alt="enemy.full_name"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-base-content/20 text-4xl font-bold">?</div>
    </figure>

    <div class="card-body p-3 gap-2">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div class="flex flex-col">
          <h3 class="font-bold text-sm">{{ enemy.full_name }}</h3>
          <div class="flex gap-1 mt-1">
            <span v-if="enemy.isBoss" class="badge badge-xs badge-error">首领</span>
            <span v-if="enemy.isElite" class="badge badge-xs badge-warning">精英</span>
            <span class="badge badge-xs badge-ghost">Lv.60</span> <!-- TODO: Dynamic Level -->
          </div>
        </div>
        <!-- Stun Indicator -->
        <div class="flex flex-col items-end text-xs text-base-content/70">
            <span v-if="enemy.can_stun" class="text-yellow-600 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                </svg>
                可失衡
            </span>
            <span v-else class="text-base-content/40">不可失衡</span>
        </div>
      </div>

      <!-- Base Stats Grid -->
      <div class="grid grid-cols-2 gap-2 bg-base-200 p-2 rounded text-xs">
        <div>
            <span class="block opacity-60">生命值</span>
            <span class="font-semibold">{{ formatNumber(enemy.hp) }}</span>
        </div>
        <div>
            <span class="block opacity-60">防御力</span>
            <span class="font-semibold">{{ formatNumber(enemy.defense) }}</span>
        </div>
        <div>
            <span class="block opacity-60">攻击力</span>
            <span class="font-semibold">{{ formatNumber(enemy.atk) }}</span>
        </div>
        <div v-if="enemy.can_stun">
            <span class="block opacity-60">失衡值</span>
            <span class="font-semibold">{{ formatNumber(enemy.stun_max) }}</span>
        </div>
      </div>

      <!-- Resistances -->
      <div class="divider my-0 text-xs">抗性与弱点</div>
      <div class="grid grid-cols-5 gap-1 text-center text-xs">
        <div v-for="ele in elements" :key="ele.key" class="flex flex-col items-center p-1 rounded bg-base-200">
            <!-- Icon placeholder -->
            <span :class="['w-2 h-2 rounded-full mb-1', ele.color]"></span>
            <span class="scale-90">{{ ele.label }}</span>
            <span :class="getResClass(enemy.getDmgResistance(ele.key))">
                {{ formatPercent(enemy.getDmgResistance(ele.key)) }}
            </span>
        </div>
      </div>
      
      <!-- Stun Vulnerability -->
      <div v-if="enemy.can_stun" class="text-xs flex justify-between bg-yellow-50 dark:bg-yellow-900/20 p-1 px-2 rounded text-yellow-700 dark:text-yellow-500">
        <span>失衡易伤倍率</span>
        <span class="font-bold">{{ (enemy.stun_vulnerability_multiplier * 100).toFixed(0) }}%</span>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Enemy } from '../../model/enemy';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  enemy: Enemy;
}>();

const enemyIconUrl = computed(() => {
    // 使用 id 获取敌人图标
    return iconService.getEnemyIconById(props.enemy.id);
});

const elements = [
    { key: 'physical', label: '物理', color: 'bg-yellow-500' },
    { key: 'fire', label: '火', color: 'bg-red-500' },
    { key: 'ice', label: '冰', color: 'bg-cyan-400' },
    { key: 'electric', label: '电', color: 'bg-blue-600' },
    { key: 'ether', label: '以太', color: 'bg-pink-500' },
];

function formatNumber(num: number) {
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + 'w';
    }
    return num.toFixed(0);
}

function formatPercent(val: number) {
    if (val === 0) return '-';
    const percent = (val * 100).toFixed(0) + '%';
    return val > 0 ? `+${percent}` : percent;
}

function getResClass(val: number) {
    if (val < 0) return 'text-red-500 font-bold'; // Weakness
    if (val > 0) return 'text-green-600'; // Resistance
    return 'opacity-40';
}
</script>

<style scoped>
.compact-card {
  min-height: 280px;
}
</style>