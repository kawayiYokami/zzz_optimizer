<template>
  <div class="card bg-base-100 shadow-xl border border-base-300 w-full max-w-4xl mx-auto overflow-hidden flex flex-col h-full">
    <!-- Header: Character Basic Info -->
    <div class="bg-base-200 p-4 flex items-center gap-6 relative overflow-hidden">
        <!-- Background Decoration (Optional) -->
        <div :class="['absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-r', rarityGradientFrom]"></div>

        <!-- Avatar -->
        <div class="avatar relative z-10">
            <div class="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden bg-base-300">
                <img v-if="avatarUrl" :src="avatarUrl" :alt="agent.name_cn" class="object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-4xl font-bold opacity-50">{{ agent.name_cn[0] }}</div>
            </div>
            <!-- Element Icon Badge -->
            <div class="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-base-100 p-1 shadow-md">
                <img v-if="elementUrl" :src="elementUrl" class="w-full h-full object-contain" />
            </div>
        </div>

        <!-- Info Text -->
        <div class="flex-1 z-10">
            <!-- 第一行：角色名 + 武器类型 -->
            <div class="flex items-center gap-3 mb-2">
                <h2 class="text-3xl font-bold">{{ agent.name_cn }}</h2>
                <div class="w-7 h-7 p-0.5 opacity-80">
                    <img :src="iconService.getWeaponTypeIconUrl(agent.weapon_type)" :alt="getWeaponTypeText(agent.weapon_type)" class="w-full h-full object-contain" />
                </div>
            </div>

            <!-- 第二行：等级控制 -->
            <div class="flex items-center gap-2 mb-1.5">
                <span class="text-sm opacity-60 min-w-[3rem]">Lv.{{ agent.level }}</span>
                <input
                    type="range"
                    min="1"
                    max="60"
                    :value="agent.level"
                    @input="adjustCharacterLevel"
                    class="range range-xs w-32"
                    step="1"
                />
            </div>

            <!-- 第三行：影画控制 -->
            <div class="flex items-center gap-2">
                <span class="text-sm opacity-60">影画</span>
                <div class="rating rating-sm">
                    <input type="radio" name="cinema-rating" class="rating-hidden" :checked="agent.cinema === 0" @change="setCinemaLevel(0)" />
                    <input type="radio" name="cinema-rating" class="mask mask-heart bg-base-content" :checked="agent.cinema === 1" @change="setCinemaLevel(1)" />
                    <input type="radio" name="cinema-rating" class="mask mask-heart bg-base-content" :checked="agent.cinema === 2" @change="setCinemaLevel(2)" />
                    <input type="radio" name="cinema-rating" class="mask mask-heart bg-base-content" :checked="agent.cinema === 3" @change="setCinemaLevel(3)" />
                    <input type="radio" name="cinema-rating" class="mask mask-heart bg-base-content" :checked="agent.cinema === 4" @change="setCinemaLevel(4)" />
                    <input type="radio" name="cinema-rating" class="mask mask-heart bg-base-content" :checked="agent.cinema === 5" @change="setCinemaLevel(5)" />
                    <input type="radio" name="cinema-rating" class="mask mask-heart bg-base-content" :checked="agent.cinema === 6" @change="setCinemaLevel(6)" />
                </div>
            </div>
        </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="tabs tabs-lifted px-4 pt-2 bg-base-200/50">
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'stats' }" @click="activeTab = 'stats'">属性面板</a>
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'skills' }" @click="activeTab = 'skills'">技能</a>
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'buffs' }" @click="activeTab = 'buffs'">BUFF</a>
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'equipment' }" @click="activeTab = 'equipment'">装备方案</a>
    </div>

    <!-- Tab Content Container -->
    <div class="card-body p-0 bg-base-100 border-t border-base-300 flex-1 overflow-hidden relative">
        
        <!-- Tab 1: Stats -->
        <div v-if="activeTab === 'stats'" class="h-full overflow-y-auto p-6">
            <PropertySetCard :agent="agent" display-type="in" />
        </div>

        <!-- Tab 2: Skills -->
        <div v-if="activeTab === 'skills'" class="h-full overflow-y-auto p-6">
            <SkillList :agent="agent" />
        </div>

        <!-- Tab 3: Buffs -->
        <div v-if="activeTab === 'buffs'" class="h-full overflow-y-auto p-6 space-y-6">
            <!-- Core Skill Level -->
            <section>
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                    <span class="w-1 h-6 bg-accent rounded"></span>
                    核心技能
                </h3>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 p-2">
                        <img :src="iconService.getSkillIconUrl('core')" alt="核心技" class="w-full h-full object-contain" />
                    </div>
                    <span class="text-sm opacity-60 flex-shrink-0 w-12">Lv.{{ agent.core_skill }}</span>
                    <div class="flex-1 max-w-xs">
                        <input
                            type="range"
                            min="1"
                            max="7"
                            :value="agent.core_skill"
                            @input="adjustCoreSkill"
                            class="range range-xs"
                            step="1"
                        />
                    </div>
                </div>
            </section>

            <div class="divider"></div>

            <!-- Active Buffs -->
            <section>
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                    <span class="w-1 h-6 bg-secondary rounded"></span>
                    BUFF
                </h3>
                <!-- Placeholder for buffs list -->
                <div v-if="allBuffs.length === 0" class="text-center opacity-50 py-8 bg-base-200 rounded-lg border border-dashed border-base-300">
                    暂无激活的 Buff
                </div>
                <div v-else class="grid gap-3">
                    <div v-for="(buff, idx) in allBuffs" :key="idx" class="collapse collapse-arrow bg-base-200 rounded-box border border-base-300">
                        <input type="checkbox" />
                        <div class="collapse-title font-medium">
                            {{ buff.description || buff.name || '未知效果' }}
                        </div>
                        <div class="collapse-content text-sm">
                            <div v-if="buff.stats && Object.keys(buff.stats).length > 0" class="overflow-x-auto mt-2">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>属性名称</th>
                                            <th class="text-right">属性值</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(value, prop) in buff.stats" :key="prop" class="hover">
                                            <td>{{ formatPropName(prop) }}</td>
                                            <td class="text-right font-mono font-bold">{{ formatValue(value, isPercent(Number(prop))) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-if="buff.conversion" class="mt-2 p-2 bg-base-300 rounded">
                                <div class="text-sm font-semibold mb-1">转换类属性</div>
                                <div class="text-sm space-y-1">
                                    <div>{{ formatPropName(buff.conversion.from_property) }} → {{ formatPropName(buff.conversion.to_property) }} ({{ (buff.conversion.conversion_ratio * 100).toFixed(1) }}%)</div>
                                    <div v-if="buff.conversion.from_property_threshold" class="text-xs opacity-70">起始值: {{ buff.conversion.from_property_threshold }}</div>
                                    <div v-if="buff.conversion.max_value" class="text-xs opacity-70">上限: {{ buff.conversion.max_value }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <!-- Tab 3: Equipment -->
        <div v-if="activeTab === 'equipment'" class="h-full overflow-y-auto p-6 space-y-6">
            
            <!-- W-Engine Section -->
            <section>
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                    <span class="w-1 h-6 bg-accent rounded"></span>
                    音擎 (W-Engine)
                </h3>
                <div v-if="agent.equipped_wengine" class="bg-base-200 p-4 rounded-xl flex items-center gap-4 border border-base-300">
                    <div class="w-16 h-16 bg-base-300 rounded-lg flex items-center justify-center font-bold text-2xl text-base-content/20">W</div>
                    <!-- Detailed WEngine Card or Component would go here. For now simpler display -->
                    <div>
                        <div class="font-bold text-lg">ID: {{ agent.equipped_wengine }}</div>
                        <div class="text-sm opacity-60">需要关联详细音擎数据以显示更多信息</div>
                    </div>
                </div>
                <div v-else class="alert alert-warning shadow-sm">
                    <span>未装备音擎</span>
                </div>
            </section>

            <div class="divider"></div>

            <!-- Drive Disks Section -->
            <section>
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                    <span class="w-1 h-6 bg-info rounded"></span>
                    驱动盘 (Drive Disks)
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div v-for="(diskId, idx) in agent.equipped_drive_disks" :key="idx" 
                         class="aspect-[4/3] bg-base-200 rounded-lg border border-base-300 flex flex-col items-center justify-center relative p-2 hover:border-primary transition-colors cursor-pointer group">
                        <span class="absolute top-2 left-2 text-xs font-mono opacity-40">{{ idx + 1 }}</span>
                        <template v-if="diskId">
                            <span class="font-bold text-sm">已装备</span>
                            <span class="text-xs opacity-50 truncate w-full text-center">{{ diskId }}</span>
                        </template>
                        <template v-else>
                            <span class="text-2xl opacity-20 font-bold">+</span>
                            <span class="text-xs opacity-40">空置</span>
                        </template>
                    </div>
                </div>
            </section>

        </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Agent } from '../../model/agent';
import { PropertyType, WeaponType, getPropertyCnName, isPercentageProperty, getWeaponCnName } from '../../model/base';
import { BuffSource, Buff } from '../../model/buff';
import { iconService } from '../../services/icon.service';
import PropertySetCard from './PropertySetCard.vue';
import SkillList from './SkillList.vue';

const props = defineProps<{
  agent: Agent;
}>();

const activeTab = ref('stats');

// Icons
const avatarUrl = computed(() => iconService.getCharacterCircleById(props.agent.game_id));
const elementUrl = computed(() => iconService.getElementIconUrl(props.agent.element));

// Rarity Color
const rarityGradientFrom = computed(() => {
    // Should be based on rarity, hardcoded for now
    return 'from-orange-500/20 to-transparent';
});
// Stats Helpers
const finalStats = computed(() => {
    // 使用 Agent 类封装好的方法获取角色+装备的站街面板属性
    return props.agent.getCharacterEquipmentStats().out_of_combat;
});

const advancedProps = computed(() => {
    const propsList: PropertyType[] = [
        PropertyType.ATK_BASE, PropertyType.HP_BASE, PropertyType.DEF_BASE, PropertyType.IMPACT,
        PropertyType.CRIT_, PropertyType.CRIT_DMG_,
        PropertyType.PEN_,
        PropertyType.ANOM_PROF, PropertyType.ANOM_MAS,
        PropertyType.ENER_REGEN,
    ];

    // 根据角色元素添加对应的属性伤害
    if (props.agent?.element) {
        const elementDmgMap: Record<string, PropertyType> = {
            'Physical': PropertyType.PHYSICAL_DMG_,
            'Fire': PropertyType.FIRE_DMG_,
            'Ice': PropertyType.ICE_DMG_,
            'Electric': PropertyType.ELECTRIC_DMG_,
            'Ether': PropertyType.ETHER_DMG_,
        };

        const elementDmg = elementDmgMap[props.agent.element];
        if (elementDmg) {
            propsList.push(elementDmg);
        }
    }

    return propsList;
});

// Buffs
const allBuffs = ref<Buff[]>([]);

// 异步加载Buff数据
onMounted(async () => {
    allBuffs.value = await props.agent.getAllBuffs();
});

// Helper Functions
function getWeaponTypeText(type: WeaponType) {
    return getWeaponCnName(type);
}

function getPropName(prop: PropertyType) {
    return getPropertyCnName(prop);
}

function isPercent(prop: PropertyType) {
    return isPercentageProperty(prop);
}

function formatNumber(val: number | undefined) {
    if (val === undefined) return '-';
    return Math.floor(val).toLocaleString();
}

function formatValue(val: number | undefined, isPct: boolean) {
    if (val === undefined || val === null) val = 0;
    if (isPct) return (val * 100).toFixed(1) + '%';
    // 如果是小数，保留一位小数；如果是整数，显示整数
    return val % 1 === 0 ? Math.floor(val).toLocaleString() : val.toFixed(1);
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

function getBuffSourceBadgeClass(source: BuffSource | string) {
    // Simple logic to color code buff sources
    const s = typeof source === 'string' ? source : BuffSource[source];
    
    if (s === 'AGENT_CORE' || s === 'CORE_PASSIVE') return 'badge-warning';
    if (s === 'AGENT_TALENT' || s === 'TALENT') return 'badge-info';
    if (s === 'WENGINE' || s === 'WENGINE_TALENT') return 'badge-accent';
    if (s === 'DRIVE_DISK_2PC' || s === 'DRIVE_DISK_4PC') return 'badge-success';
    
    return 'badge-ghost';
}

function getBuffSourceName(source: BuffSource | string) {
    return typeof source === 'string' ? source : BuffSource[source];
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

function adjustCoreSkill(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newLevel = parseInt(target.value);
    const delta = newLevel - props.agent.core_skill;
    if (delta !== 0) {
        props.agent.adjustCoreSkillLevel(delta);
    }
}

function adjustCharacterLevel(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newLevel = parseInt(target.value);
    const delta = newLevel - props.agent.level;
    if (delta !== 0) {
        props.agent.adjustCharacterLevel(delta);
    }
}

function setCinemaLevel(level: number): void {
    const delta = level - props.agent.cinema;
    if (delta !== 0) {
        props.agent.adjustCinemaLevel(delta);
    }
}
</script>

<style scoped>
/* Custom scrollbar for content areas */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}
.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>