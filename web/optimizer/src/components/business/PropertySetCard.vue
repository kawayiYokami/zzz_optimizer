<template>
<div :class="noCard ? '' : 'card bg-base-100 shadow border border-base-300'">
<div :class="noCard ? '' : 'card-body p-4'">
<!-- 标签切换 (仅在多个标签页时显示) -->
<div v-if="availableTabs.length > 1" class="tabs tabs-boxed mb-4">
<a v-for="tab in availableTabs" :key="tab" class="tab" :class="{ 'tab-active': activeTab === tab }" @click="activeTab = tab">
{{ tabNames[tab] }}
</a>
</div>

<!-- 属性表格 -->
<div v-if="activeTab !== 'conversion'" class="overflow-x-auto">
  <div class="grid grid-cols-2 gap-x-8 gap-y-1 text-sm p-2">
    <!-- 左列：核心属性 -->
    <div class="space-y-1">
      <template v-for="[prop, value] in filteredProps.leftProps" :key="prop">
        <div class="flex justify-between items-center w-full border-b border-base-200/50 pb-1">
          <span class="text-base-content/80 truncate pr-2" :title="getPropName(prop)">{{ getPropName(prop) }}</span>
          <span class="text-right font-mono font-bold shrink-0">{{ formatValue(value, isPercent(prop)) }}</span>
        </div>
      </template>
    </div>
    <!-- 右列：其他属性 -->
    <div class="space-y-1">
      <template v-for="[prop, value] in filteredProps.rightProps" :key="prop">
        <div class="flex justify-between items-center w-full border-b border-base-200/50 pb-1">
          <span class="text-base-content/80 truncate pr-2" :title="getPropName(prop)">{{ getPropName(prop) }}</span>
          <span class="text-right font-mono font-bold shrink-0">{{ formatValue(value, isPercent(prop)) }}</span>
        </div>
      </template>
    </div>
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
  defaultActiveTab?: 'out' | 'in' | 'final' | 'conversion';
  finalStats?: Map<PropertyType, number>;
}>(), {
  conversionBuffs: () => [],
  noCard: true,
  defaultActiveTab: 'out',
  finalStats: undefined
});

const activeTab = ref<'out' | 'in' | 'final' | 'conversion'>('out');

// 如果提供了 defaultActiveTab，则使用它
if (props.defaultActiveTab) {
  activeTab.value = props.defaultActiveTab;
}

const tabNames: Record<'out' | 'in' | 'final' | 'conversion', string> = {
  'out': '局外属性',
  'in': '局内属性',
  'final': '最终属性',
  'conversion': '转换类属性'
};

// 检测哪些标签页有数据
const availableTabs = computed(() => {
  const tabs: Array<'out' | 'in' | 'final' | 'conversion'> = [];

  // 检查局外属性
  if (Array.from(props.propertyCollection.out_of_combat.entries()).some(([_, value]) => value !== 0)) {
    tabs.push('out');
  }

  // 检查局内属性
  if (Array.from(props.propertyCollection.in_combat.entries()).some(([_, value]) => value !== 0)) {
    tabs.push('in');
  }

  // 检查最终属性
  if (props.finalStats && Array.from(props.finalStats.entries()).some(([_, value]) => value !== 0)) {
    tabs.push('final');
  }

  // 检查转换类属性
  if (props.conversionBuffs.length > 0) {
    tabs.push('conversion');
  }

  return tabs;
});

// 核心属性列表（显示在左侧）
const CORE_PROPS = [
  PropertyType.HP_BASE,
  PropertyType.HP,
  PropertyType.HP_,
  PropertyType.DEF_BASE,
  PropertyType.DEF,
  PropertyType.DEF_,
  PropertyType.ATK_BASE,
  PropertyType.ATK,
  PropertyType.ATK_,
  PropertyType.IMPACT,
  PropertyType.IMPACT_,
  PropertyType.CRIT_,
  PropertyType.CRIT_DMG_,
  PropertyType.PEN,
  PropertyType.PEN_,
  PropertyType.ENER_REGEN,
  PropertyType.ENER_REGEN_,
  PropertyType.ANOM_PROF,
  PropertyType.ANOM_MAS,
  PropertyType.ANOM_MAS_
];

// 根据当前标签页过滤属性
const filteredProps = computed(() => {
  let stats: Map<PropertyType, number>;

  if (activeTab.value === 'out') {
    stats = props.propertyCollection.out_of_combat;
  } else if (activeTab.value === 'in') {
    stats = props.propertyCollection.in_combat;
  } else if (activeTab.value === 'final') {
    stats = props.finalStats || new Map();
  } else {
    stats = props.propertyCollection.conversion;
  }

  const allProps = Array.from(stats.entries()).filter(([_, value]) => value !== 0);
  
  // 分离核心属性和其他属性
  let leftProps = allProps.filter(([prop]) => CORE_PROPS.includes(prop));
  let rightProps = allProps.filter(([prop]) => !CORE_PROPS.includes(prop));

  // 如果右侧没有属性，将左侧属性分一半到右侧
  if (rightProps.length === 0 && leftProps.length > 1) {
    const half = Math.ceil(leftProps.length / 2);
    rightProps = leftProps.slice(half);
    leftProps = leftProps.slice(0, half);
  }

  // 自定义排序顺序：基础属性 -> 暴击 -> 穿透 -> 能量 -> 异常
  const sortOrder = CORE_PROPS;
  // 只有在没有进行分割的情况下才需要对左侧进行完整排序（如果分割了，其实是按顺序切分的，这里再排一次也没问题）
  const sortFunc = (a: [PropertyType, number], b: [PropertyType, number]) => {
    return sortOrder.indexOf(a[0]) - sortOrder.indexOf(b[0]);
  };
  
  // 注意：如果分割了，rightProps 其实也是 CORE_PROPS 的一部分，也应该排序
  // 但由于 filter 出来的顺序本来就不确定，所以最好是先把 allProps 排好序，然后再分
  
  // 更好的做法：先排序，再分割
  const allCoreProps = allProps.filter(([prop]) => CORE_PROPS.includes(prop));
  allCoreProps.sort(sortFunc);
  
  const otherProps = allProps.filter(([prop]) => !CORE_PROPS.includes(prop));

  if (otherProps.length === 0 && allCoreProps.length > 1) {
    const half = Math.ceil(allCoreProps.length / 2);
    leftProps = allCoreProps.slice(0, half);
    rightProps = allCoreProps.slice(half);
  } else {
    leftProps = allCoreProps;
    rightProps = otherProps;
  }

  return { leftProps, rightProps };
});

// 自动切换到第一个可用的标签页
watch(availableTabs, (newTabs) => {
  if (newTabs.length > 0 && !newTabs.includes(activeTab.value)) {
    // 优先尝试使用 defaultActiveTab
    if (newTabs.includes(props.defaultActiveTab)) {
      activeTab.value = props.defaultActiveTab;
    } else {
      activeTab.value = newTabs[0];
    }
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
