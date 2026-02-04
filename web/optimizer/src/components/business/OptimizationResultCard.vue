<template>
  <div class="card bg-base-100 shadow-sm min-h-150">
    <div class="card-body">
      <h2 class="card-title flex justify-between items-center">
        <span>优化结果</span>
        <span class="text-sm font-normal text-base-content/70" v-if="results.length">
          Top {{ results.length }} / 耗时 {{ (totalTime / 1000).toFixed(2) }}s
        </span>
      </h2>

      <!-- 空状态：未开始 -->
      <div v-if="results.length === 0 && !isRunning" class="flex flex-col items-center justify-center h-96 text-base-content/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>请在左侧配置并开始优化</p>
      </div>

      <!-- 加载状态：计算中 -->
      <div v-else-if="results.length === 0 && isRunning" class="flex flex-col items-center justify-center h-96 text-base-content/50">
        <span class="loading loading-dots loading-lg"></span>
        <p class="mt-4">正在计算最优搭配...</p>
      </div>

      <!-- 结果列表 -->
      <div v-else class="space-y-4">
        <div v-for="(build, index) in results" :key="index" class="card bg-base-200 border border-base-300">
          <div class="card-body p-4">
            <!-- 头部：排名、伤害、操作 -->
            <div class="flex justify-between items-center mb-4">
              <div class="flex items-center gap-4">
                <div class="badge badge-lg badge-primary font-mono">#{{ index + 1 }}</div>
                <div>
                  <div class="flex items-baseline gap-2">
                    <div class="font-mono font-bold text-2xl text-primary">{{ Math.round(build.damage).toLocaleString() }}</div>
                    <div
                      v-if="objective === 'skill' && getComparisonInlineText(build.damage)"
                      class="font-mono font-bold text-2xl"
                      :class="getComparisonClass(build.damage)"
                    >
                      ({{ getComparisonInlineText(build.damage) }})
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="isDev"
                  class="btn btn-ghost btn-sm"
                  @click="toggleDebug(index)"
                >
                  调试
                </button>
                <button 
                  class="btn btn-primary"
                  @click="$emit('equip-build', build)"
                >
                  装备此方案
                </button>
              </div>
            </div>

            <!-- 调试信息（只求可查，不追求样式） -->
            <div v-if="debugOpenIndex === index" class="mb-4">
              <pre class="text-xs whitespace-pre-wrap bg-base-100 border border-base-300 rounded p-3 overflow-auto max-h-96">{{ formatBuildDebug(build) }}</pre>
            </div>

            <!-- 6个驱动盘卡片 -->
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3">
              <template v-for="(discId, slotIndex) in build.discIds" :key="`${index}-${slotIndex}`">
                <DriveDiskCard
                  v-if="getDiscInfo(discId)"
                  :disk="getDiscInfo(discId)!"
                  readonly
                />
                <div v-else class="card bg-base-100 shadow-sm border border-base-300 w-52">
                  <div class="card-body p-3 flex items-center justify-center text-base-content/40">
                    <span>位置 {{ slotIndex + 1 }} 未装备</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OptimizationBuild } from '../../optimizer/services';
import { useSaveStore } from '../../stores/save.store';
import DriveDiskCard from './DriveDiskCard.vue';
import { ref } from 'vue';

declare const __DEV__: boolean;
const isDev = __DEV__;

const props = defineProps<{
  results: OptimizationBuild[];
  isRunning: boolean;
  totalTime: number;
  currentDamage: number;
  objective: 'skill' | 'atk' | 'hp';
}>();

const emit = defineEmits<{
  (e: 'equip-build', build: OptimizationBuild): void;
}>();

const saveStore = useSaveStore();
const debugOpenIndex = ref<number | null>(null);

const toggleDebug = (index: number) => {
  debugOpenIndex.value = debugOpenIndex.value === index ? null : index;
};

const formatBuildDebug = (build: OptimizationBuild) => {
  // OptimizationBuild 是主线程兼容结构，尽量把关键字段都 dump 出来
  const payload: any = {
    damage: build.damage,
    discIds: build.discIds,
    weaponId: build.weaponId,
    setBonusInfo: build.setBonusInfo,
    damageBreakdown: build.damageBreakdown,
    damageMultipliers: build.damageMultipliers,
    defMult: (build as any).defMult,
    snapshots: (build as any).snapshots,
    finalStats: build.finalStats,
  };
  return JSON.stringify(payload, null, 2);
};

const getDiscInfo = (discId: string) => {
  if (!discId) return null;
  return saveStore.driveDisks.find(d => d.id === discId);
};

const getComparisonClass = (damage: number) => {
  if (props.currentDamage === 0) return 'text-base-content/50';
  const diff = damage - props.currentDamage;
  if (diff > 0) return 'text-success';
  if (diff < 0) return 'text-error';
  return 'text-base-content/50';
};

const getComparisonText = (damage: number) => {
  if (props.currentDamage === 0) return '无基准';
  const diff = damage - props.currentDamage;
  const percent = (diff / props.currentDamage) * 100;
  if (diff > 0) return `+${percent.toFixed(1)}%`;
  if (diff < 0) return `${percent.toFixed(1)}%`;
  return '0.0%';
};

const getComparisonInlineText = (damage: number) => {
  // 结果卡片希望展示为：1,115,707 (+30.0%)
  // 仅当 objective === 'skill' 才会调用
  return getComparisonText(damage);
};
</script>
