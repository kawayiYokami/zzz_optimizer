<template>
  <div class="card bg-base-100 shadow-sm border border-base-200 w-64 text-sm">
    <div class="card-body p-4">
        <div class="flex justify-between items-start mb-1">
            <h4 class="font-bold text-sm">{{ buff.name }}</h4>
            <span v-if="buff.max_stacks > 1" class="badge badge-xs badge-neutral">
                层数: {{ buff.max_stacks }}
            </span>
        </div>
        
        <p class="text-xs opacity-70 mb-2">{{ buff.description }}</p>
        
        <div class="flex flex-wrap gap-1">
            <span class="badge badge-xs badge-ghost text-[10px]">{{ formatSource(buff.source) }}</span>
        </div>

        <!-- Stats Preview -->
        <div v-if="buff.in_combat_stats.size > 0" class="mt-2 space-y-1.5 text-xs">
            <div v-for="[prop, val] in buff.in_combat_stats" :key="prop" class="flex justify-between">
                <span>{{ getPropName(prop) }}</span>
                <span class="font-mono">{{ formatValue(val, isPercent(prop)) }}</span>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Buff, BuffSource } from '../../model/buff';
import { getPropertyCnName, isPercentageProperty, PropertyType } from '../../model/base';

defineProps<{
  buff: Buff;
}>();

function formatSource(source: BuffSource) {
    return BuffSource[source];
}

function getPropName(prop: PropertyType) {
  return getPropertyCnName(prop);
}

function isPercent(prop: PropertyType) {
    return isPercentageProperty(prop);
}

function formatValue(value: number, isPercent: boolean) {
  if (isPercent) {
    return (value * 100).toFixed(1) + '%';
  }
  return value.toFixed(1);
}
</script>
