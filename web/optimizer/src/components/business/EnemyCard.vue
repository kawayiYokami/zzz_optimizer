<template>
  <div
    class="card bg-base-100 shadow-xl compact-card border border-base-300 overflow-hidden transition-all"
    :class="{
      'cursor-pointer hover:shadow-2xl hover:scale-[1.02]': clickable
    }"
    @click="clickable ? $emit('click', enemy.id) : null"
  >
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
      <div class="grid grid-cols-2 gap-2 p-2 rounded text-xs">
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
            <!-- Icon -->
            <span :class="['w-2 h-2 rounded-full mb-1', ele.color]"></span>
            <span class="scale-90">{{ ele.label }}</span>
            <span :class="getResClass(enemy.getDmgResistance(ele.key))">
                {{ formatPercent(enemy.getDmgResistance(ele.key)) }}
            </span>
        </div>
      </div>

      <!-- Anomaly Bars -->
      <div v-if="hasAnomalyBars" class="divider my-0 text-xs">异常条</div>
      <div v-if="hasAnomalyBars" class="space-y-1 text-xs bg-base-200 p-2 rounded">
        <div v-for="ele in elements" :key="ele.key" class="flex items-center gap-2">
            <!-- Icon -->
            <span :class="['w-2 h-2 rounded-full flex-shrink-0', ele.color]"></span>
            
            <!-- Element Name -->
            <span class="w-8 flex-shrink-0">{{ ele.label }}</span>
            
            <!-- Anomaly Bar Progress -->
            <div class="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
                <div 
                    class="h-full rounded-full transition-all duration-300"
                    :style="{ 
                        width: (getAnomalyBarValue(ele.key) / maxAnomalyBarValue * 100) + '%',
                        backgroundColor: getProgressColor(ele.key)
                    }"
                ></div>
            </div>
            
            <!-- Anomaly Bar Value -->
            <span class="w-12 text-right font-semibold">{{ getAnomalyBarValue(ele.key) }}</span>
        </div>
      </div>
      
      <!-- Stun Vulnerability -->
      <div v-if="enemy.can_stun" class="text-xs flex justify-between bg-base-200 p-1 px-2 rounded mt-2">
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
import { useGameDataStore } from '../../stores/game-data.store';

const props = defineProps<{
  enemy: Enemy;
  clickable?: boolean;
}>();

const emit = defineEmits<{
  click: [enemyId: string];
}>();

const gameDataStore = useGameDataStore();

const enemyIconUrl = computed(() => {
    // 使用 id 获取敌人图标
    return iconService.getEnemyIconById(props.enemy.id);
});

// 检查是否有异常条
const hasAnomalyBars = computed(() => {
    const elements = ['physical', 'fire', 'ice', 'electric', 'ether'];
    return elements.some(ele => getAnomalyBarValue(ele) > 0);
});

// 获取最大异常条值（用于进度条上限）
const maxAnomalyBarValue = computed(() => {
    const elements = ['physical', 'fire', 'ice', 'electric', 'ether'];
    let maxValue = 0;
    for (const ele of elements) {
        const value = getAnomalyBarValue(ele);
        if (value > maxValue) {
            maxValue = value;
        }
    }
    return maxValue || 5000; // 如果没有异常条，默认5000
});

// 获取异常条数值
const getAnomalyBarValue = (element: string): number => {
  const anomalyBarId = props.enemy[`${element}_anomaly_bar` as keyof Enemy] as string;
  if (!anomalyBarId) return 0;
  
  const anomalyBar = gameDataStore.getAnomalyBarInfo(anomalyBarId);
  // 返回基础异常积蓄需求（第一个值）
  return anomalyBar?.buildup_requirements?.[0] || 0;
};

// 获取进度条颜色（返回十六进制颜色值）
const getProgressColor = (element: string): string => {
  const colorMap: Record<string, string> = {
    physical: '#eab308', // yellow-500
    fire: '#ef4444',    // red-500
    ice: '#22d3ee',     // cyan-400
    electric: '#2563eb', // blue-600
    ether: '#ec4899',   // pink-500
  };
  return colorMap[element] || '#3b82f6'; // primary blue
};

// 获取异常条颜色类
const getAnomalyBarColor = (element: string): string => {
  const colorMap: Record<string, string> = {
    physical: 'progress-warning',
    fire: 'progress-error',
    ice: 'progress-info',
    electric: 'progress-primary',
    ether: 'progress-secondary',
  };
  return colorMap[element] || 'progress-primary';
};

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
  min-height: 220px;
}
</style>