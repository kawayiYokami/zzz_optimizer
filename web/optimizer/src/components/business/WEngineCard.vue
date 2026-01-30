<template>
  <div
    class="card bg-base-100 shadow-xl compact-card border border-base-300 w-52 overflow-hidden cursor-pointer hover:border-primary hover:shadow-2xl transition-all"
    @click="$emit('edit', wengine.id)"
  >
    <!-- Image Section with Rarity Gradient -->
    <figure :class="['relative h-32 w-full', rarityGradientClass]">
        <!-- Weapon Type Icon (Top Left) -->
        <div class="absolute top-2 left-2 w-8 h-8 rounded z-10">
            <img
                :src="getWeaponTypeIconUrl()"
                class="w-full h-full object-contain"
                :alt="getWeaponTypeName()"
            />
        </div>

        <img
            v-if="wengineIconUrl"
            :src="wengineIconUrl"
            class="absolute w-full h-full object-cover object-center"
            :alt="wengine.name"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-white/50 text-2xl font-bold bg-black/20">
            {{ wengine.name[0] }}
        </div>
        <div class="absolute bottom-0 left-0 w-full bg-linear-to-t from-black/80 to-transparent p-2">
            <div class="flex items-center gap-2 text-white/80 text-sm">
                <span class="font-bold text-white truncate flex-1">{{ wengine.name }}</span>
                <span class="font-bold">Lv.{{ wengine.level }}</span>
                <span class="font-bold">R{{ wengine.refinement }}</span>
            </div>
        </div>
    </figure>

    <div class="card-body p-3 gap-2">
      <!-- Base Stats -->
      <div class="flex justify-between items-center p-2 rounded">
        <div class="flex flex-col">
            <span class="text-xs text-base-content/60">基础攻击力</span>
            <span class="font-bold text-lg">{{ baseAtk.toFixed(0) }}</span>
        </div>
        <div class="flex flex-col items-end" v-if="randStatType">
            <span class="text-xs text-base-content/60">{{ getPropName(randStatType) }}</span>
            <span class="font-bold text-lg">{{ formatValue(randStat, isPercent(randStatType)) }}</span>
        </div>
      </div>

      <!-- Talent (Collapsible) -->
      <div class="collapse collapse-arrow border border-base-200 bg-base-200 rounded-box">
        <input type="checkbox" />
        <div class="collapse-title text-xs font-medium p-2 min-h-0 flex items-center">
          <span class="truncate">{{ activeTalentName }}</span>
        </div>
        <div class="collapse-content text-xs p-2 pt-0">
          <p class="opacity-80">{{ activeTalentDesc }}</p>
        </div>
      </div>

      <!-- Footer: Equipped -->
      <div v-if="wengine.equipped_agent" class="mt-auto pt-2 border-t border-base-200 flex items-center gap-1 text-xs text-base-content/60">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>已装备</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { WEngine } from '../../model/wengine';
import { PropertyType, getPropertyCnName, isPercentageProperty, getWeaponCnName } from '../../model/base';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  wengine: WEngine;
}>();

defineEmits<{
  edit: [wengineId: string];
}>();

const rarityGradientClass = computed(() => {
    // Determine rarity based on some logic (e.g. from ID or if we have rarity in model)
    // Currently WEngine model doesn't explicitly store rarity on the instance directly
    // unless we look up metadata, but usually S-rank engines have higher base stats.
    // For now, let's assume a default or pass it in.
    // We can infer S-rank if base_atk > 600 at max level or something, but let's just use neutral for now
    // until we link it properly with metadata.
    return 'bg-gradient-to-br from-gray-700 to-gray-900';
});

const wengineIconUrl = computed(() => {
    // 使用 wengine_id 获取武器图标
    return iconService.getWeaponIconById(props.wengine.wengine_id);
});

function getWeaponTypeIconUrl() {
    return iconService.getWeaponTypeIconUrl(props.wengine.weapon_type);
}

function getWeaponTypeName() {
    return getWeaponCnName(props.wengine.weapon_type);
}

const activeTalent = computed(() => {
    return props.wengine.talents.find(t => t.level === props.wengine.refinement);
});

const activeTalentName = computed(() => activeTalent.value?.name || '未知天赋');
const activeTalentDesc = computed(() => activeTalent.value?.description || '无描述');

// 使用 getBaseStats() 获取基础属性
const baseStats = computed(() => props.wengine.getBaseStats());

// 从属性集合中获取基础攻击力
const baseAtk = computed(() => {
  return baseStats.value.out_of_combat.get(PropertyType.ATK_BASE) || 0;
});

// 从属性集合中获取随机属性
const randStatType = computed(() => {
  // 遍历所有属性，找到非基础攻击力的属性
  for (const [prop, value] of baseStats.value.out_of_combat.entries()) {
    if (prop !== PropertyType.ATK_BASE && value !== 0) {
      return prop;
    }
  }
  return null;
});

const randStat = computed(() => {
  if (randStatType.value === null) return 0;
  return baseStats.value.out_of_combat.get(randStatType.value) || 0;
});

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
  return value.toFixed(0);
}
</script>

<style scoped>
.compact-card {
  min-height: 220px;
}
</style>
