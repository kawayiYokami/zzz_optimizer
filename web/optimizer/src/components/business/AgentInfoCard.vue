<template>
  <div class="card bg-base-100 shadow border border-base-300 w-full max-w-4xl mx-auto overflow-hidden flex flex-col">
    <!-- Header: Character Basic Info -->
    <div class="bg-base-200 p-6 flex items-center gap-6 relative overflow-hidden">
        <!-- Background Decoration (Optional) -->
        <div class="absolute inset-0 opacity-10 pointer-events-none" :style="{ background: `linear-gradient(to right, ${rarityColor}, transparent)` }"></div>

        <!-- Avatar -->
        <div class="avatar relative z-10 cursor-pointer transform-gpu transition-transform hover:scale-105" @click="emit('clickAvatar')">
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
            <div class="flex items-center gap-2">
                <span class="text-sm opacity-60 min-w-12">Lv.{{ agent.level }}</span>
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
        </div>

        <!-- 影画按钮 -->
        <div class="flex flex-col gap-1 z-10 shrink-0">
            <div class="text-center font-bold text-lg">
                影画{{ agent.cinema }}
            </div>
            <div class="flex gap-1">
                <button
                    v-for="level in 6"
                    :key="level"
                    @click="setCinemaLevel(level)"
                    class="btn btn-square btn-lg btn-ghost"
                    :title="`影画 ${level}`"
                >
                    <i :class="agent.cinema >= level ? 'ri-movie-2-fill' : 'ri-movie-2-line'" class="text-2xl"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="tabs tabs-lifted px-4 pt-2 bg-base-200/50">
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'stats' }" @click="activeTab = 'stats'">属性</a>
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'skills' }" @click="activeTab = 'skills'">技能</a>
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'buffs' }" @click="activeTab = 'buffs'">增益</a>
      <a class="tab tab-lg" :class="{ 'tab-active': activeTab === 'equipment' }" @click="activeTab = 'equipment'">装备</a>
    </div>

    <!-- Tab Content Container -->
    <div class="card-body p-0 bg-base-100 border-t border-base-300 flex-1 overflow-hidden relative">
        <div v-if="isLoadingDetails" class="h-full flex items-center justify-center p-6">
            <div class="text-center text-base-content/60">
                <span class="loading loading-spinner loading-md"></span>
                <div class="mt-3">正在加载角色数据...</div>
            </div>
        </div>

        <template v-else>
            <!-- Tab 1: Stats -->
            <div v-show="activeTab === 'stats'" class="h-full overflow-y-auto p-6">
                <PropertySetCard
                    :property-collection="agent.getCharacterCombatStats()"
                    :conversion-buffs="agent.conversion_buffs"
                />
            </div>

            <!-- Tab 2: Skills -->
            <div v-show="activeTab === 'skills'" class="h-full overflow-y-auto p-6">
                <SkillList :agent="agent" />
            </div>

            <!-- Tab 3: Buffs -->
            <div v-show="activeTab === 'buffs'" class="h-full overflow-y-auto p-6 space-y-6">
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
                    <div v-else class="flex flex-wrap gap-3">
                        <BuffCard v-for="(buff, idx) in allBuffs" :key="idx" :buff="buff" />
                    </div>
                </section>
            </div>

            <!-- Tab 3: Equipment -->

                    <div v-show="activeTab === 'equipment'" class="h-full overflow-y-auto p-6 space-y-6">

                    <!-- W-Engine + Effective Stats Section -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <!-- W-Engine Section -->
                      <section class="lg:col-span-1">
                          <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                              <span class="w-1 h-6 bg-accent rounded"></span>
                              音擎
                          </h3>

                          <WEngineCard
                              v-if="equippedWEngine"
                              :wengine="equippedWEngine"
                              class="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                              @click="openEquipmentSelector('wengine')"
                          />
                          <div v-else class="card bg-base-200 border border-base-300 cursor-pointer hover:border-primary transition-colors" @click="openEquipmentSelector('wengine')">
                              <div class="card-body p-6 items-center text-center">
                                  <i class="ri-disc-line text-4xl opacity-30"></i>
                                  <span class="text-sm opacity-50">点击装备音擎</span>
                              </div>
                          </div>
                      </section>

                      <!-- Effective Stats Section - 占用2列 -->
                      <section class="lg:col-span-2">
                          <EffectiveStatsSelector
                              :selected-stats="props.agent.effective_stats"
                              :default-stats="props.agent.getDefaultEffectiveStats()"
                              @update:selected-stats="updateEffectiveStats"
                          />
                      </section>
                    </div>

                    <div class="divider"></div>



                    <!-- Drive Disks Section -->

                    <section>

                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-bold flex items-center gap-2">
                                <span class="w-1 h-6 bg-info rounded"></span>
                                驱动盘
                            </h3>
                            <button
                                class="btn btn-sm btn-ghost gap-2 hover:bg-base-200 text-base-content/70 hover:text-base-content"
                                @click="lockBetterDisks"
                                title="锁定同部位同套装且有效词条更高的驱动盘"
                            >
                                <i class="ri-lock-2-line text-base"></i>
                                <span>一键锁定更好的</span>
                            </button>
                        </div>
                        <div class="flex justify-center">
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <template v-for="(disk, idx) in equippedDriveDisks" :key="idx">
                                    <DriveDiskCard
                                        v-if="disk"
                                        :disk="disk"
                                        class="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                        @click="openEquipmentSelector('drive-disk', idx as DriveDiskPosition)"
                                    />
                                    <div v-else class="aspect-4/3 bg-base-200 rounded-lg border border-base-300 flex flex-col items-center justify-center relative p-2 hover:border-primary transition-colors cursor-pointer group" @click="openEquipmentSelector('drive-disk', idx as DriveDiskPosition)">
                                        <span class="absolute top-2 left-2 text-xs font-mono opacity-40">{{ idx + 1 }}</span>
                                        <span class="text-2xl opacity-20 font-bold">+</span>
                                        <span class="text-xs opacity-40">点击装备</span>
                                    </div>
                                </template>
                            </div>
                        </div>

                    </section>



                </div>
        </template>

    </div>

            <!-- 装备选择弹窗 -->



                <EquipmentSelector



                  :is-open="showEquipmentSelector"



                  :type="equipmentSelectorType"



                  :position="selectedDriveDiskPosition"



                  :agent-id="agent.id"



                  @close="showEquipmentSelector = false"



                  @select="selectEquipment"



                />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Agent } from '../../model/agent';
import { PropertyType, WeaponType, getPropertyCnName, isPercentageProperty, getWeaponCnName } from '../../model/base';
import { BuffSource, Buff } from '../../model/buff';
import { PropertyCollection } from '../../model/property-collection';
import { iconService } from '../../services/icon.service';
import { useSaveStore } from '../../stores/save.store';
import PropertySetCard from './PropertySetCard.vue';
import SkillList from './SkillList.vue';
import EquipmentSelector from './EquipmentSelector.vue';
import WEngineCard from './WEngineCard.vue';
import DriveDiskCard from './DriveDiskCard.vue';
import BuffCard from './BuffCard.vue';
import EffectiveStatsSelector from './EffectiveStatsSelector.vue';
import { DriveDiskPosition } from '../../model/drive-disk';

const saveStore = useSaveStore();

const props = defineProps<{
  agent: Agent;
}>();

// (debug logs removed)

const emit = defineEmits<{
  clickAvatar: [];
}>();

const activeTab = ref('stats');
const isLoadingDetails = ref(true);

// Icons
const avatarUrl = computed(() => iconService.getCharacterAvatarById(props.agent.game_id));
const elementUrl = computed(() => iconService.getElementIconUrl(props.agent.element));

// Rarity Color
const rarityColor = computed(() => {
    return props.agent.rarity === 4 ? 'rgba(249, 115, 22, 0.2)' : 'rgba(168, 85, 247, 0.2)';
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

// 加载 Buff 数据
async function loadBuffs() {
    try {
        allBuffs.value = await props.agent.getAllBuffs();
    } catch (error) {
        console.error('加载 Buff 失败:', error);
        allBuffs.value = [];
    }
}

// 已装备的音擎
const equippedWEngine = computed(() => {
    if (!props.agent.equipped_wengine) return null;
    return saveStore.wengines.find(w => w.id === props.agent.equipped_wengine) || null;
});

// 已装备的驱动盘
const equippedDriveDisks = computed(() => {
    return props.agent.equipped_drive_disks.map(diskId => {
        if (!diskId) return null;
        return saveStore.driveDisks.find(d => d.id === diskId) || null;
    });
});

// 装备选择弹窗状态
const showEquipmentSelector = ref(false);
const equipmentSelectorType = ref<'drive-disk' | 'wengine'>('drive-disk');
const selectedDriveDiskPosition = ref<DriveDiskPosition | undefined>(undefined);

// 打开装备选择弹窗
function openEquipmentSelector(type: 'drive-disk' | 'wengine', position?: number) {
    equipmentSelectorType.value = type;
    // position 是数组索引 (0-5)，转换为 DriveDiskPosition (1-6)
    if (type === 'drive-disk' && position !== undefined) {
        selectedDriveDiskPosition.value = (position + 1) as DriveDiskPosition;
    } else {
        selectedDriveDiskPosition.value = undefined;
    }
    showEquipmentSelector.value = true;
}

// 选择装备
function selectEquipment(item: any) {
    if (equipmentSelectorType.value === 'wengine') {
        if (item === null) {
            // 卸载音擎
            saveStore.equipWengine(props.agent.id, null);
        } else {
            // 装备音擎
            saveStore.equipWengine(props.agent.id, item.id);
        }
        // 清除属性缓存
        props.agent.clearPropertyCache();
    } else {
        if (item === null) {
            // 卸载驱动盘
            if (selectedDriveDiskPosition.value !== undefined) {
                saveStore.equipDriveDisk(props.agent.id, null);
              }        } else {
            // 装备驱动盘
            if (selectedDriveDiskPosition.value !== undefined) {
                saveStore.equipDriveDisk(props.agent.id, item.id);
              }        }
        // 清除属性缓存
        props.agent.clearPropertyCache();
    }
}

// 更新有效词条
function updateEffectiveStats(stats: PropertyType[]) {
    saveStore.updateAgentEffectiveStats(props.agent.id, stats);
}

async function ensureAgentReady() {
    isLoadingDetails.value = true;
    try {
        await props.agent.ensureDetailsLoaded();
        await props.agent.ensureEquippedDetailsLoaded();
        await loadBuffs();
    } catch (err) {
        console.error('Failed to load agent details:', err);
    } finally {
        isLoadingDetails.value = false;
    }
}

onMounted(async () => {
    await ensureAgentReady();
});

// 监听 agent 变化，重新加载详情与 BUFF
watch(() => props.agent, async () => {
    await ensureAgentReady();
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
    if (props.agent.cinema === level) {
        // 如果点击当前等级，则降级到0
        props.agent.adjustCinemaLevel(-props.agent.cinema);
    } else {
        // 否则设置到点击的等级
        const delta = level - props.agent.cinema;
        if (delta !== 0) {
            props.agent.adjustCinemaLevel(delta);
        }
    }
}

// 一键锁定比当前更好的驱动盘
async function lockBetterDisks() {
    const effectiveStats = props.agent.effective_stats;
    if (effectiveStats.length === 0) {
        alert('请先设置有效词条');
        return;
    }

    // 收集需要锁定的驱动盘
    const disksToLock: Array<{ diskId: string; diskScore: number }> = [];

    // 遍历当前装备的6个驱动盘
    for (let i = 0; i < 6; i++) {
        const currentDiskId = props.agent.equipped_drive_disks[i];
        if (!currentDiskId) continue;

        const currentDisk = saveStore.driveDisks.find(d => d.id === currentDiskId);
        if (!currentDisk) continue;

        const currentScore = currentDisk.getEffectiveStatCounts(effectiveStats);

        // 找出同部位、同套装、得分更高的驱动盘
        const betterDisks = saveStore.driveDisks.filter(d =>
            d.position === currentDisk.position &&
            d.game_id === currentDisk.game_id &&
            d.id !== currentDisk.id &&
            !d.locked &&
            d.getEffectiveStatCounts(effectiveStats) > currentScore
        );

        // 收集这些驱动盘
        for (const disk of betterDisks) {
            disksToLock.push({ diskId: disk.id, diskScore: disk.getEffectiveStatCounts(effectiveStats) });
        }
    }

    if (disksToLock.length === 0) {
        alert('没有找到更好的驱动盘');
        return;
    }

    // 并行锁定所有驱动盘
    try {
        const lockPromises = disksToLock.map(({ diskId }) =>
            saveStore.updateDriveDiskLocked(diskId, true)
        );

        const results = await Promise.allSettled(lockPromises);

        let lockedCount = 0;
        const failures: string[] = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (result.value) {
                    lockedCount++;
                } else {
                    failures.push(`驱动盘 ${disksToLock[index].diskId} 持久化失败`);
                }
            } else {
                failures.push(`驱动盘 ${disksToLock[index].diskId}: ${result.reason}`);
            }
        });

        // 显示结果提示
        if (failures.length > 0) {
            console.error('锁定失败:', failures);
            alert(`已锁定 ${lockedCount}/${disksToLock.length} 个驱动盘\n失败: ${failures.join(', ')}`);
        } else {
            alert(`已成功锁定 ${lockedCount} 个更好的驱动盘`);
        }
    } catch (error) {
        console.error('锁定驱动盘时出错:', error);
        alert(`锁定过程出错: ${error instanceof Error ? error.message : '未知错误'}`);
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
