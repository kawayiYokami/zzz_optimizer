<template>
  <div class="card bg-base-100 shadow compact-card border border-base-300 w-52 overflow-hidden">
    <!-- Image Section -->
    <figure :class="['relative h-32 w-full', rarityGradientClass]">
        <img
            v-if="bangbooIconUrl"
            :src="bangbooIconUrl"
            class="absolute w-full h-full object-cover object-center"
            :alt="bangboo.name_cn"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-white/50 text-2xl font-bold bg-black/20">
            {{ bangboo.name_cn[0] }}
        </div>
        <div class="absolute bottom-0 left-0 w-full bg-linear-to-t from-black/80 to-transparent p-2">
            <h3 class="text-white font-bold text-sm truncate">{{ bangboo.name_cn }}</h3>
        </div>
    </figure>

    <div class="card-body p-3 gap-2">
      <!-- Base Stats -->
      <div class="grid grid-cols-3 gap-1 bg-base-200 p-2 rounded text-xs text-center">
        <div>
            <span class="block opacity-60">生命</span>
            <span class="font-bold">{{ bangboo.base_hp }}</span>
        </div>
        <div>
            <span class="block opacity-60">攻击</span>
            <span class="font-bold">{{ bangboo.base_atk }}</span>
        </div>
        <div>
            <span class="block opacity-60">防御</span>
            <span class="font-bold">{{ bangboo.base_def }}</span>
        </div>
      </div>

      <!-- Skills (Placeholder for now) -->
      <div class="text-xs space-y-1 mt-1">
        <div v-if="bangboo.active_skill">
            <span class="font-bold text-primary">主动技:</span>
            <span class="opacity-80 line-clamp-2">{{ bangboo.active_skill }}</span>
        </div>
        <div v-if="bangboo.passive_skill">
            <span class="font-bold text-secondary">额外能力:</span>
            <span class="opacity-80 line-clamp-2">{{ bangboo.passive_skill }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Bangboo } from '../../model/bangboo';
import { iconService } from '../../services/icon.service';

const props = defineProps<{
  bangboo: Bangboo;
}>();

const rarityGradientClass = computed(() => {
    switch (props.bangboo.rarity) {
        case 'S': return 'bg-gradient-to-br from-orange-600 to-orange-900';
        case 'A': return 'bg-gradient-to-br from-purple-600 to-purple-900';
        default: return 'bg-gradient-to-br from-gray-600 to-gray-900';
    }
});

const bangbooIconUrl = computed(() => {
    // 使用 id 获取邦布图标
    return iconService.getBangbooIconById(props.bangboo.id);
});
</script>

<style scoped>
.compact-card {
  min-height: 220px;
}
</style>