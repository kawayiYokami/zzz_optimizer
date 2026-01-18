<template>
<div :class="noCard ? '' : 'card bg-base-100 shadow-xl border border-base-300'">
<div :class="noCard ? '' : 'card-body p-4'">
<!-- 标签切换 (仅在多个标签页时显示) -->
<div v-if="availableTabs.length > 1" class="tabs tabs-boxed mb-4">
<a v-for="tab in availableTabs" :key="tab" class="tab" :class="{ 'tab-active': activeTab === tab }" @click="activeTab = tab">
{{ tabNames[tab] }}
</a>
</div>

<!-- 属性表格 -->
<div v-if="activeTab !== 'conversion'" class="overflow-x-auto">
<div class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm p-2">
  <template v-for="[prop, value] in filteredProps" :key="prop">
    <div class="text-base-content/80">{{ getPropName(prop) }}</div>
    <div class="text-right font-mono font-bold">{{ formatValue(value, isPercent(prop)) }}</div>
    <div class="col-span-2 border-b border-base-200/50 last:border-0 h-px w-full"></div>
  </template>
</div>
</div>

<!-- 转换类属性 -->
<div v-else class="space-y-2">
<div v-if="conversionBuffs.length === 0" class="text-center opacity-50 py-8">
暂无转换类属性
</div>
<div v-else v-for="(buff, idx) in conversionBuffs" :key="idx" class="p-3 bg-base-200/50 rounded">
<div class="font-semibold mb-1">{{ buff.name || buff.description }}</div>
<div v-if="buff.conversion" class="text-sm opacity-80 space-y-1">
<div>{{ formatPropName(buff.conversion.from_property) }} → {{ formatPropName(buff.conversion.to_property) }} ({{ (buff.conversion.conversion_ratio * 100).toFixed(1) }}%)</div>
<div v-if="buff.conversion.from_property_threshold" class="text-xs opacity-60">起始值: {{ buff.conversion.from_property_threshold }}</div>
<div v-if="buff.conversion.max_value" class="text-xs opacity-60">上限: {{ buff.conversion.max_value }}</div>
</div>
</div>
</div>
</div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { PropertyCollection } from '../../model/property-collection';
import { PropertyType, getPropertyCnName, isPercentageProperty } from '../../model/base';
import { Buff } from '../../model/buff';

const props = withDefaults(defineProps<{
  propertyCollection: PropertyCollection;
  conversionBuffs?: Buff[];
  noCard?: boolean;
}>(), {
  conversionBuffs: () => [],
  noCard: true
});

const activeTab = ref<'out' | 'in' | 'conversion'>('out');

const tabNames: Record<'out' | 'in' | 'conversion', string> = {
  'out': '局外属性',
  'in': '局内属性',
  'conversion': '转换类属性'
};

// 检测哪些标签页有数据
const availableTabs = computed(() => {
  const tabs: Array<'out' | 'in' | 'conversion'> = [];

  // 检查局外属性
  if (Array.from(props.propertyCollection.out_of_combat.entries()).some(([_, value]) => value !== 0)) {
    tabs.push('out');
  }

  // 检查局内属性
  if (Array.from(props.propertyCollection.in_combat.entries()).some(([_, value]) => value !== 0)) {
    tabs.push('in');
  }

  // 检查转换类属性
  if (props.conversionBuffs.length > 0) {
    tabs.push('conversion');
  }

  return tabs;
});

// 根据当前标签页过滤属性
const filteredProps = computed(() => {
  let stats: Map<PropertyType, number>;

  if (activeTab.value === 'out') {
    stats = props.propertyCollection.out_of_combat;
  } else if (activeTab.value === 'in') {
    stats = props.propertyCollection.in_combat;
  } else {
    stats = props.propertyCollection.conversion;
  }

  return Array.from(stats.entries()).filter(([_, value]) => value !== 0);
});

// 自动切换到第一个可用的标签页
watch(availableTabs, (newTabs) => {
  if (newTabs.length > 0 && !newTabs.includes(activeTab.value)) {
    activeTab.value = newTabs[0];
  }
}, { immediate: true });

function getPropName(prop: PropertyType) {
  return getPropertyCnName(prop);
}

function formatPropName(prop: string | number) {
  try {
    if (prop === undefined || prop === null) {
      return `[未定义]`;
    }
    const propNum = Number(prop);
    if (isNaN(propNum)) return `[${String(prop)}]`;
    const name = getPropName(propNum);
    return name || `[未知属性:${prop}]`;
  } catch (e) {
    return `[错误:${prop}]`;
  }
}

function isPercent(prop: PropertyType) {
  return isPercentageProperty(prop);
}

function formatValue(val: number, isPct: boolean) {
  if (isPct) return (val * 100).toFixed(1) + '%';
  return val % 1 === 0 ? Math.floor(val).toLocaleString() : val.toFixed(1);
}
</script>
