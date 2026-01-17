<template>
  <div :class="noCard ? '' : 'card bg-base-100 shadow-xl border border-base-300'">
    <div :class="noCard ? '' : 'card-body p-4'">
      <!-- 标签切换 (仅在未指定displayType时显示) -->
      <div v-if="!displayType" class="tabs tabs-boxed mb-4">
        <a class="tab" :class="{ 'tab-active': activeTab === 'out' }" @click="activeTab = 'out'">局外属性</a>
        <a class="tab" :class="{ 'tab-active': activeTab === 'in' }" @click="activeTab = 'in'">局内属性</a>
        <a class="tab" :class="{ 'tab-active': activeTab === 'conversion' }" @click="activeTab = 'conversion'">转换类属性</a>
      </div>

      <!-- 属性表格 -->
      <div v-if="currentTab !== 'conversion'" class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>属性名称</th>
              <th class="text-right">属性值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="[prop, value] in filteredProps" :key="prop" class="hover">
              <td>{{ getPropName(prop) }}</td>
              <td class="text-right font-mono font-bold">{{ formatValue(value, isPercent(prop)) }}</td>
            </tr>
          </tbody>
        </table>
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
import { ref, computed } from 'vue';
import { Agent } from '../../model/agent';
import { PropertyType, getPropertyCnName, isPercentageProperty } from '../../model/base';

const props = withDefaults(defineProps<{
  agent: Agent;
  displayType?: 'out' | 'in' | 'conversion';
  noCard?: boolean;
}>(), {
  noCard: true
});

const activeTab = ref<'out' | 'in' | 'conversion'>('out');

const currentTab = computed(() => {
  return props.displayType || activeTab.value;
});

const propertyCollection = computed(() => {
  // 如果要显示局内属性，需要调用 getCharacterCombatStats()
  if (props.displayType === 'in' || (!props.displayType && activeTab.value === 'in')) {
    return props.agent.getCharacterCombatStats();
  }
  return props.agent.getCharacterEquipmentStats();
});

const filteredProps = computed(() => {
  let stats: Map<PropertyType, number>;

  if (currentTab.value === 'out') {
    stats = propertyCollection.value.out_of_combat;
  } else if (currentTab.value === 'in') {
    stats = propertyCollection.value.in_combat;
  } else {
    stats = propertyCollection.value.conversion;
  }

  return Array.from(stats.entries()).filter(([_, value]) => value !== 0);
});

const conversionBuffs = computed(() => {
  return props.agent.conversion_buffs || [];
});

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
