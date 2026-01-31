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
  <!-- 最终面板：四大面板（快照1基础 + 战斗内增量） -->
  <div v-if="activeTab === 'final' && snapshots && snapshotDeltaRows.length > 0" class="p-2">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
      <div v-for="row in snapshotDeltaRows" :key="row.prop" class="rounded">
        <div class="flex justify-between items-baseline">
          <span class="text-xs text-base-content/70">{{ getPropName(row.prop) }}</span>
          <span class="font-bold">
            <template v-if="Math.round(row.delta) !== 0">
              {{ formatValue(row.base, false) }} + {{ formatValue(row.delta, false) }}
              <span class="text-primary font-extrabold">({{ formatValue(row.base + row.delta, false) }})</span>
            </template>
            <template v-else>
              <span class="text-primary font-extrabold">{{ formatValue(row.base + row.delta, false) }}</span>
            </template>
          </span>
        </div>
      </div>
    </div>
    <div class="divider my-2 text-xs text-base-content/40">其它最终属性</div>
  </div>
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
  snapshots?: {
    snapshot1: { atk: number; hp: number; def: number; impact: number };
    snapshot2: { atk: number; hp: number; def: number; impact: number };
    snapshot3: { atk: number; hp: number; def: number; impact: number };
  };
}>(), {
  conversionBuffs: () => [],
  noCard: true,
  defaultActiveTab: 'out',
  finalStats: undefined,
  snapshots: undefined
});

const activeTab = ref<'out' | 'in' | 'final' | 'conversion'>('out');

// 如果提供了 defaultActiveTab，则使用它
if (props.defaultActiveTab) {
  activeTab.value = props.defaultActiveTab;
}

const tabNames = computed<Record<'out' | 'in' | 'final' | 'conversion', string>>(() => ({
  'out': '局外属性',
  'in': '局内属性',
  'final': props.snapshots ? '最终面板' : '最终属性',
  'conversion': '转换类属性'
}));

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

const snapshotDelta = computed(() => {
  const s = props.snapshots;
  if (!s) return null;
  return [
    { prop: PropertyType.HP, base: s.snapshot1.hp, delta: s.snapshot3.hp - s.snapshot1.hp },
    { prop: PropertyType.ATK, base: s.snapshot1.atk, delta: s.snapshot3.atk - s.snapshot1.atk },
    { prop: PropertyType.DEF, base: s.snapshot1.def, delta: s.snapshot3.def - s.snapshot1.def },
    { prop: PropertyType.IMPACT, base: s.snapshot1.impact, delta: s.snapshot3.impact - s.snapshot1.impact },
  ];
});

const snapshotDeltaRows = computed(() => snapshotDelta.value ?? []);

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

  let allProps = Array.from(stats.entries()).filter(([_, value]) => value !== 0);

  // 最终面板：如果传入了 snapshots，说明调用方希望用“快照1基础 + (快照3-快照1)增量”来展示四大面板，
  // 因此这里要先把 finalStats 里残留的“三元组维度”过滤掉，避免出现 ATK_%/HP_% 等不应出现在最终面板的字段。
  if (activeTab.value === 'final' && props.snapshots) {
    const triadProps = new Set<PropertyType>([
      PropertyType.HP_BASE,
      PropertyType.HP_,
      PropertyType.HP,
      PropertyType.ATK_BASE,
      PropertyType.ATK_,
      PropertyType.ATK,
      PropertyType.DEF_BASE,
      PropertyType.DEF_,
      PropertyType.DEF,
      PropertyType.IMPACT_,
      PropertyType.IMPACT,
    ]);
    allProps = allProps.filter(([p]) => !triadProps.has(p));
  }

  // (debug logs removed)

  // (debug logs removed)

  // 最终面板（快照模式）：四大面板在模板里单独展示；这里仅负责“其它最终属性”
  // 即：从 finalStats 中剔除四大三元组维度后展示剩余属性。
  if (activeTab.value === 'final' && props.snapshots) {
    // keep going; handled by allProps filtering above
  }

  // 分离核心属性和其他属性
  let leftProps = allProps.filter(([prop]) => CORE_PROPS.includes(prop));
  let rightProps = allProps.filter(([prop]) => !CORE_PROPS.includes(prop));

  // (final snapshots handled above)

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
  return String(Math.round(val));
}
</script>
