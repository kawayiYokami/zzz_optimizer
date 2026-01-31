<template>
  <div class="card bg-base-100 shadow-sm border border-base-200">
    <div class="card-body p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="font-bold text-sm">{{ title }}</div>
        <div class="text-xs text-base-content/50">{{ rules.length }} 条</div>
      </div>

      <div v-if="rules.length === 0" class="text-sm text-base-content/50 py-6 text-center">
        （无）
      </div>

      <div v-else class="mt-3 space-y-2">
        <div
          v-for="(r, idx) in rules"
          :key="idx"
          class="bg-base-200/30 rounded-lg p-3 space-y-2"
        >
          <!-- 第一行：来源 → 目标 -->
          <div class="flex items-center gap-2">
            <span class="badge badge-ghost badge-sm">{{ propName(r.fromPropIdx) }}</span>
            <span class="flex-1"></span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-base-content/40" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            <span class="flex-1"></span>
            <span class="badge badge-primary badge-sm">{{ propName(r.toPropIdx) }}</span>
          </div>
          <!-- 第二行：阈值 + 比例 + 上限 -->
          <div class="flex items-center text-xs">
            <span class="badge badge-ghost badge-sm">起算点 {{ r.threshold ?? 0 }}</span>
            <span class="flex-1"></span>
            <span class="badge badge-accent badge-sm font-mono">{{ (r.ratio * 100).toFixed(1) }}%</span>
            <span class="flex-1"></span>
            <span class="badge badge-ghost badge-sm">上限 {{ formatMaxValue(r.maxValue) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConversionBuffRule } from '../../optimizer/types/precomputed';
import { IDX_TO_PROP_TYPE } from '../../optimizer/types/property-index';
import { PropertyType, getPropertyCnName } from '../../model/base';

const props = withDefaults(defineProps<{
  rules: ConversionBuffRule[];
  title?: string;
}>(), {
  rules: () => [],
  title: '转换类 BUFF',
});

const propName = (idx: number) => {
  const prop = IDX_TO_PROP_TYPE[idx];
  if (prop === undefined) return `#${idx}`;
  return getPropertyCnName(prop) || (PropertyType[prop] ?? `#${idx}`);
};

const formatMaxValue = (maxValue: number | undefined | null): string => {
  if (maxValue == null) return '无';
  if (Math.abs(maxValue) < 1) return (maxValue * 100).toFixed(1) + '%';
  return maxValue.toFixed(0);
};
</script>
