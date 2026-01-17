<template>
  <div class="card bg-base-100 shadow-xl compact-card border border-base-300 w-64 overflow-hidden">
    <!-- Image Section with Rarity Gradient -->
    <figure :class="['relative h-32 w-full', rarityGradientClass]">
        <img
            v-if="wengineIconUrl"
            :src="wengineIconUrl"
            class="absolute w-full h-full object-cover object-center"
            :alt="wengine.name"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-white/50 text-2xl font-bold bg-black/20">
            {{ wengine.name[0] }}
        </div>
        <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2">
            <h3 class="text-white font-bold text-sm truncate">{{ wengine.name }}</h3>
            <div class="flex items-center gap-1 text-white/80 text-xs">
                <span class="badge badge-sm badge-ghost border-white/30 text-white">Lv.{{ wengine.level }}</span>
                <span>R{{ wengine.refinement }}</span>
            </div>
        </div>
    </figure>

    <div class="card-body p-3 gap-2">
      <!-- Base Stats -->
      <div class="flex justify-between items-center bg-base-200 p-2 rounded">
        <div class="flex flex-col">
            <span class="text-xs text-base-content/60">基础攻击力</span>
            <span class="font-bold text-lg">{{ wengine.base_atk.toFixed(0) }}</span>
        </div>
        <div class="flex flex-col items-end" v-if="wengine.rand_stat_type">
            <span class="text-xs text-base-content/60">{{ getPropName(wengine.rand_stat_type) }}</span>
            <span class="font-bold text-lg text-secondary">{{ formatValue(wengine.rand_stat, isPercent(wengine.rand_stat_type)) }}</span>
        </div>
      </div>

      <!-- Talent (Collapsible) -->
      <div class="collapse collapse-arrow border border-base-200 bg-base-100 rounded-box">
        <input type="checkbox" /> 
        <div class="collapse-title text-xs font-medium p-2 min-h-0 flex items-center">
          <span class="text-primary mr-1">天赋</span>
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
import { getPropertyCnName, isPercentageProperty, PropertyType } from '../../model/base';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  wengine: WEngine;
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

const activeTalent = computed(() => {
    return props.wengine.talents.find(t => t.level === props.wengine.refinement);
});

const activeTalentName = computed(() => activeTalent.value?.name || '未知天赋');
const activeTalentDesc = computed(() => activeTalent.value?.description || '无描述');

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
  min-height: 280px;
}
</style>