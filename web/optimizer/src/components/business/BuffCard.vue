<template>
  <div class="card bg-base-100 shadow-sm border border-base-200 w-64 text-sm">
    <div class="card-body p-4">
        <div class="flex justify-between items-start gap-2 mb-1">
            <h4 class="font-bold text-sm">{{ buff.name }}</h4>
            <span class="badge badge-xs badge-neutral shrink-0">
                {{ buff.max_stacks }} 层
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

        <!-- Conversion Preview -->
        <div v-if="buff.conversion" class="mt-2 pt-2 border-t border-base-200 text-xs">
            <div class="flex items-center gap-1 text-base-content/70">
                <span>{{ getPropName(buff.conversion.from_property) }}</span>
                <span class="opacity-50">→</span>
                <span class="text-primary">{{ getPropName(buff.conversion.to_property) }}</span>
                <span class="ml-auto font-mono">{{ (buff.conversion.conversion_ratio * 100).toFixed(1) }}%</span>
            </div>
            <div v-if="buff.conversion.max_value" class="text-[10px] opacity-50 mt-1">
                上限: {{ formatValue(buff.conversion.max_value, isPercent(buff.conversion.to_property)) }}
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
    const sourceMap: Record<BuffSource, string> = {
        [BuffSource.AGENT_PASSIVE]: '被动',
        [BuffSource.AGENT_TALENT]: '天赋',
        [BuffSource.TALENT]: '天赋',
        [BuffSource.AGENT_CORE]: '核心技能',
        [BuffSource.WENGINE]: '音擎',
        [BuffSource.WENGINE_TALENT]: '音擎',
        [BuffSource.DRIVE_DISK_2PC]: '2件套',
        [BuffSource.DRIVE_DISK_4PC]: '4件套',
        [BuffSource.TEAM_MATE]: '队友',
        [BuffSource.CORE_PASSIVE]: '核心被动',
        [BuffSource.POTENTIAL]: '潜能',
    };
    return sourceMap[source] ?? BuffSource[source];
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
