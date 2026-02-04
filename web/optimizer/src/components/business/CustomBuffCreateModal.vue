<template>
  <dialog class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
      <h3 class="font-bold text-lg mb-4">添加自选BUFF</h3>

      <div class="flex-1 overflow-y-auto space-y-4">
        <!-- BUFF名称 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">BUFF名称</span>
          </label>
          <input
            type="text"
            class="input input-bordered w-full"
            v-model="buffName"
            placeholder="输入BUFF名称"
          />
        </div>

        <!-- BUFF描述（可选） -->
        <div>
          <label class="label">
            <span class="label-text font-bold">描述（可选）</span>
          </label>
          <input
            type="text"
            class="input input-bordered w-full"
            v-model="buffDescription"
            placeholder="输入BUFF描述"
          />
        </div>

        <!-- 属性加成 -->
        <div>
          <label class="label">
            <span class="label-text font-bold">属性加成</span>
          </label>

          <div class="space-y-2">
            <div
              v-for="(stat, index) in stats"
              :key="index"
              class="grid grid-cols-[1fr_8rem_2rem] gap-2 items-center"
            >
              <!-- 属性选择 -->
              <select
                class="select select-bordered select-sm w-full"
                :value="stat.key"
                @change="onChangeStatKey(index, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">（选择属性）</option>
                <optgroup v-for="group in propertyGroups" :key="group.label" :label="group.label">
                  <option
                    v-for="prop in group.properties"
                    :key="prop.key"
                    :value="prop.key"
                    :disabled="isPropertyUsed(prop.key, index)"
                  >
                    {{ prop.label }}
                  </option>
                </optgroup>
              </select>

              <!-- 数值输入 -->
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(stat)"
                  @input="onChangeStatValue(index, ($event.target as HTMLInputElement).value)"
                  :step="isPercentProperty(stat.key) ? 0.1 : 1"
                  :placeholder="isPercentProperty(stat.key) ? '0.0' : '0'"
                />
                <span v-if="isPercentProperty(stat.key)" class="text-xs text-base-content/60">%</span>
              </div>

              <!-- 删除按钮 -->
              <button
                class="btn btn-xs btn-circle btn-ghost text-error hover:bg-error/10"
                @click="removeStat(index)"
                :disabled="stats.length <= 1"
              >
                ✕
              </button>
            </div>

            <!-- 添加属性按钮 -->
            <button
              class="btn btn-sm btn-outline btn-primary w-full"
              @click="addStat"
              :disabled="stats.length >= 10"
            >
              + 添加属性
            </button>
          </div>
        </div>

        <!-- 实时校验 -->
        <div class="alert" :class="validationErrors.length ? 'alert-warning' : 'alert-success'">
          <div>
            <h4 class="font-bold">实时校验</h4>
            <div v-if="validationErrors.length" class="text-xs space-y-1">
              <div v-for="msg in validationErrors" :key="msg">- {{ msg }}</div>
            </div>
            <div v-else class="text-xs">已满足创建条件，可以添加。</div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="handleCancel">取消</button>
        <button class="btn btn-primary" @click="handleCreate" :disabled="!canCreate">添加</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="handleCancel">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { PropertyType, getPropertyCnName, isPercentageProperty } from '../../model/base';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  created: [buff: { name: string; description?: string; in_combat_stats: Record<string, number>; isActive: boolean }];
}>();

// 表单状态
const buffName = ref('');
const buffDescription = ref('');
const stats = ref<Array<{ key: string; value: number }>>([{ key: '', value: 0 }]);

// 属性分组定义
const propertyGroups = computed(() => [
  {
    label: '基础属性',
    properties: [
      { key: 'HP_', label: '生命值%' },
      { key: 'ATK_', label: '攻击力%' },
      { key: 'DEF_', label: '防御力%' },
      { key: 'HP', label: '生命值' },
      { key: 'ATK', label: '攻击力' },
      { key: 'DEF', label: '防御力' },
    ],
  },
  {
    label: '暴击属性',
    properties: [
      { key: 'CRIT_', label: '暴击率' },
      { key: 'CRIT_DMG_', label: '暴击伤害' },
    ],
  },
  {
    label: '穿透/贯穿',
    properties: [
      { key: 'PEN_', label: '穿透率' },
      { key: 'PEN', label: '穿透值' },
      { key: 'SHEER_FORCE', label: '贯穿值' },
      { key: 'SHEER_DMG_', label: '贯穿伤害' },
    ],
  },
  {
    label: '元素伤害',
    properties: [
      { key: 'PHYSICAL_DMG_', label: '物理伤害加成' },
      { key: 'FIRE_DMG_', label: '火属性伤害加成' },
      { key: 'ICE_DMG_', label: '冰属性伤害加成' },
      { key: 'ELECTRIC_DMG_', label: '电属性伤害加成' },
      { key: 'ETHER_DMG_', label: '以太伤害加成' },
    ],
  },
  {
    label: '技能伤害',
    properties: [
      { key: 'NORMAL_ATK_DMG_', label: '普通攻击伤害加成' },
      { key: 'SPECIAL_ATK_DMG_', label: '特殊技伤害加成' },
      { key: 'ENHANCED_SPECIAL_DMG_', label: '强化特殊技伤害加成' },
      { key: 'CHAIN_ATK_DMG_', label: '连携技伤害加成' },
      { key: 'ULTIMATE_ATK_DMG_', label: '终结技伤害加成' },
      { key: 'DASH_ATK_DMG_', label: '冲刺攻击伤害加成' },
      { key: 'DODGE_COUNTER_DMG_', label: '闪避反击伤害加成' },
      { key: 'ASSIST_ATK_DMG_', label: '支援攻击伤害加成' },
      { key: 'ADDL_ATK_DMG_', label: '追加攻击伤害加成' },
    ],
  },
  {
    label: '通用伤害',
    properties: [
      { key: 'DMG_', label: '伤害加成' },
      { key: 'COMMON_DMG_', label: '通用伤害加成' },
      { key: 'FLAT_DMG', label: '固定伤害加成' },
    ],
  },
  {
    label: '异常属性',
    properties: [
      { key: 'ANOM_MAS', label: '异常掌控' },
      { key: 'ANOM_PROF', label: '异常精通' },
      { key: 'ANOM_BUILDUP_', label: '异常积蓄效率' },
      { key: 'ANOM_CRIT_', label: '异常暴击率' },
      { key: 'ANOM_CRIT_DMG_', label: '异常暴击伤害' },
      { key: 'ANOM_MV_MULT_', label: '异常伤害倍率提升' },
      { key: 'ANOM_BASE_', label: '异常基础伤害提升' },
      { key: 'ADDL_DISORDER_', label: '额外紊乱倍率' },
    ],
  },
  {
    label: '异常伤害加成',
    properties: [
      { key: 'BURN_DMG_', label: '灼烧伤害加成' },
      { key: 'SHOCK_DMG_', label: '感电伤害加成' },
      { key: 'CORRUPTION_DMG_', label: '侵蚀伤害加成' },
      { key: 'SHATTER_DMG_', label: '碎冰伤害加成' },
      { key: 'ASSAULT_DMG_', label: '强击伤害加成' },
      { key: 'ANOMALY_DMG_', label: '属性异常伤害加成' },
      { key: 'DISORDER_DMG_', label: '紊乱伤害加成' },
    ],
  },
  {
    label: '敌人Debuff',
    properties: [
      { key: 'DEF_RED_', label: '敌人防御降低' },
      { key: 'ENEMY_RES_RED_', label: '敌人属性抗性降低' },
      { key: 'PHYSICAL_RES_RED_', label: '敌人物理抗性降低' },
      { key: 'FIRE_RES_RED_', label: '敌人火属性抗性降低' },
      { key: 'ICE_RES_RED_', label: '敌人冰属性抗性降低' },
      { key: 'ELECTRIC_RES_RED_', label: '敌人电属性抗性降低' },
      { key: 'ETHER_RES_RED_', label: '敌人以太属性抗性降低' },
      { key: 'DMG_INC_', label: '敌人易伤' },
    ],
  },
  {
    label: '其他',
    properties: [
      { key: 'IMPACT_', label: '冲击力' },
      { key: 'ENER_EFF_', label: '能量获得效率' },
      { key: 'SHIELD_', label: '护盾效果' },
      { key: 'DAZE_INC_', label: '失衡值提升' },
      { key: 'RES_IGN_', label: '无视属性抗性' },
      { key: 'DEF_IGN_', label: '无视防御' },
    ],
  },
]);

// 判断属性是否为百分比类型
function isPercentProperty(key: string): boolean {
  if (!key) return false;
  const propType = (PropertyType as any)[key];
  if (propType === undefined) return false;
  return isPercentageProperty(propType);
}

// 获取显示值（百分比属性显示为百分比形式）
function getDisplayValue(stat: { key: string; value: number }): string {
  if (!stat.key) return '';
  if (isPercentProperty(stat.key)) {
    return (stat.value * 100).toFixed(1);
  }
  return stat.value.toString();
}

// 检查属性是否已被使用
function isPropertyUsed(key: string, currentIndex: number): boolean {
  return stats.value.some((s, i) => i !== currentIndex && s.key === key);
}

// 修改属性类型
function onChangeStatKey(index: number, key: string) {
  stats.value[index].key = key;
  stats.value[index].value = 0;
}

// 修改属性值
function onChangeStatValue(index: number, valueStr: string) {
  const value = parseFloat(valueStr) || 0;
  if (isPercentProperty(stats.value[index].key)) {
    // 百分比属性：用户输入的是百分比形式，需要转换为小数
    stats.value[index].value = value / 100;
  } else {
    stats.value[index].value = value;
  }
}

// 添加属性
function addStat() {
  if (stats.value.length < 10) {
    stats.value.push({ key: '', value: 0 });
  }
}

// 删除属性
function removeStat(index: number) {
  if (stats.value.length > 1) {
    stats.value.splice(index, 1);
  }
}

// 校验错误
const validationErrors = computed<string[]>(() => {
  const errors: string[] = [];

  if (!buffName.value.trim()) {
    errors.push('请输入BUFF名称');
  }

  const validStats = stats.value.filter(s => s.key && s.value !== 0);
  if (validStats.length === 0) {
    errors.push('请至少添加一条有效的属性加成');
  }

  // 检查重复属性
  const keys = stats.value.filter(s => s.key).map(s => s.key);
  if (new Set(keys).size !== keys.length) {
    errors.push('存在重复的属性');
  }

  return errors;
});

// 是否可以创建
const canCreate = computed(() => validationErrors.value.length === 0);

// 取消
function handleCancel() {
  resetForm();
  emit('cancel');
}

// 创建
function handleCreate() {
  if (!canCreate.value) return;

  // 构建属性对象
  const inCombatStats: Record<string, number> = {};
  for (const stat of stats.value) {
    if (stat.key && stat.value !== 0) {
      inCombatStats[stat.key] = stat.value;
    }
  }

  emit('created', {
    name: buffName.value.trim(),
    description: buffDescription.value.trim() || undefined,
    in_combat_stats: inCombatStats,
    isActive: true,
  });

  resetForm();
}

// 重置表单
function resetForm() {
  buffName.value = '';
  buffDescription.value = '';
  stats.value = [{ key: '', value: 0 }];
}
</script>
