<template>
  <div class="card bg-base-100 shadow-sm border border-base-300 w-28 overflow-hidden relative hover:border-primary transition-colors">
    <!-- Main Image Container -->
    <figure :class="['relative aspect-square w-full bg-base-200', rarityGradientClass]">
        <!-- Avatar -->
        <img
            v-if="agentIconUrl"
            :src="agentIconUrl"
            class="w-full h-full object-cover"
            :alt="agent.name_cn"
            @error="handleImageError"
            @load="handleImageLoad"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-white/50 text-4xl font-bold bg-black/20">
            {{ agent.name_cn[0] }}
        </div>
        
        <!-- Element Icon (Top Left) -->
        <div class="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/40 p-0.5 backdrop-blur-sm">
            <img
                v-if="elementIconUrl"
                :src="elementIconUrl"
                class="w-full h-full object-contain"
                @error="handleElementIconError"
                @load="handleElementIconLoad"
            />
        </div>

        <!-- Level (Bottom Right inside image) -->
        <div class="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
            Lv.{{ agent.level }}
        </div>
    </figure>

    <!-- Name (Bottom) -->
    <div class="p-1.5 text-center bg-base-100 border-t border-base-200">
        <h3 class="text-sm font-bold truncate leading-tight text-base-content/90">{{ agent.name_cn }}</h3>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Agent } from '../../model/agent';
import { ElementType, WeaponType } from '../../model/base';
import { iconService, CharacterIconType } from '../../services/icon.service';

const props = defineProps<{
  agent: Agent;
}>();

const rarityGradientClass = computed(() => {
    // Rarity enum: S=4, A=3, B=2 (from base.ts)
    const isS = props.agent.rarity === 4;
    return isS ? 'bg-gradient-to-br from-orange-600 to-orange-900' : 'bg-gradient-to-br from-purple-600 to-purple-900';
});

const agentIconUrl = computed(() => {
    console.log(`[AgentCard] Getting icon for agent:`, {
        game_id: props.agent.game_id,
        name: props.agent.name_cn
    });
    
    // 使用 game_id 获取半身像图标
    const url = iconService.getCharacterCropById(props.agent.game_id);
    console.log(`[AgentCard] Icon URL:`, url);
    return url;
});

const elementIconUrl = computed(() => {
    const url = iconService.getElementIconUrl(props.agent.element);
    console.log(`[AgentCard] Element icon URL:`, url);
    return url;
});

function getElementText(ele: ElementType) {
    // Map ElementType enum/string to text/icon
    // Assuming ElementType values or we can just return the enum value if it's readable
    return ele;
}

function getWeaponTypeText(type: WeaponType) {
    return type;
}

function getSkillLabel(key: string) {
    const map: Record<string, string> = {
        normal: '普攻',
        dodge: '闪避',
        assist: '支援',
        special: '特殊',
        chain: '连携'
    };
    return map[key] || key;
}

function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    console.error(`[AgentCard] Failed to load agent icon:`, {
        src: img.src,
        agent: props.agent.name_cn,
        agentId: props.agent.id
    });
}

function handleImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    console.log(`[AgentCard] Successfully loaded agent icon:`, {
        src: img.src,
        agent: props.agent.name_cn
    });
}

function handleElementIconError(event: Event) {
    const img = event.target as HTMLImageElement;
    console.error(`[AgentCard] Failed to load element icon:`, {
        src: img.src,
        element: props.agent.element,
        agent: props.agent.name_cn
    });
}

function handleElementIconLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    console.log(`[AgentCard] Successfully loaded element icon:`, {
        src: img.src,
        element: props.agent.element
    });
}
</script>

<style scoped>
</style>