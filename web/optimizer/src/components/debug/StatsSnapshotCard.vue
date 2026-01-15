<template>
  <div class="stats-snapshot-card card bg-base-200 shadow-xl mt-6">
    <div class="card-body">
      <div class="flex justify-between items-center cursor-pointer hover:bg-base-300 rounded-lg p-2 -m-2 transition-colors" @click="isStatsSnapshotExpanded = !isStatsSnapshotExpanded">
        <h3 class="card-title">属性快照</h3>
        <button class="btn btn-ghost btn-sm">
          <span v-if="isStatsSnapshotExpanded">▼ 收起</span>
          <span v-else>▶ 展开</span>
        </button>
      </div>

      <div v-show="isStatsSnapshotExpanded" class="mt-4">
        <div v-if="frontAgent" class="space-y-4">
          <!-- 角色基础属性面板 -->
          <div class="card bg-base-100">
            <div class="card-body p-4">
              <h4 class="font-bold mb-3">角色自身属性</h4>
              <pre class="text-xs overflow-auto bg-base-200 p-4 rounded">{{ frontAgent.getCharacterBaseStats().format(0, 'separate') }}</pre>
            </div>
          </div>

          <!-- 角色战斗属性面板 -->
          <div class="card bg-base-100">
            <div class="card-body p-4">
              <h4 class="font-bold mb-3">角色战斗属性</h4>
              <pre class="text-xs overflow-auto bg-base-200 p-4 rounded">{{ frontAgent.getCharacterCombatStats().format(0, 'separate') }}</pre>
            </div>
          </div>

          <!-- 局内非转换面板 -->
          <div class="card bg-base-100">
            <div class="card-body p-4">
              <h4 class="font-bold mb-3">局内非转换属性</h4>
              <pre class="text-xs overflow-auto bg-base-200 p-4 rounded">{{ battleService.getMergedInCombatProperties().format(0, 'in_combat') }}</pre>
            </div>
          </div>

          <!-- 局内转换面板 -->
          <div class="card bg-base-100">
            <div class="card-body p-4">
              <h4 class="font-bold mb-3">局内转换属性</h4>
              <pre class="text-xs overflow-auto bg-base-200 p-4 rounded">{{ PropertyCollection.formatMap(battleService.getMergedInCombatProperties().conversion) }}</pre>
            </div>
          </div>

          <!-- 局内最终面板 -->
          <div class="card bg-base-100">
            <div class="card-body p-4">
              <h4 class="font-bold mb-3">最终属性</h4>
              <pre class="text-xs overflow-auto bg-base-200 p-4 rounded">{{ PropertyCollection.formatMap(battleService.getFinalStats()) }}</pre>
            </div>
          </div>

          <!-- 装备信息 -->
          <div class="card bg-base-100">
            <div class="card-body p-4">
              <h4 class="font-bold mb-3">装备信息</h4>

              <!-- 音擎 -->
              <div v-if="equipmentDetails.some(detail => detail.type === 'wengine')" class="mb-4">
                <div class="font-semibold mb-2">音擎</div>
                <div v-for="(detail, index) in equipmentDetails.filter(d => d.type === 'wengine')" :key="index" class="ml-2">
                  <div class="flex justify-between items-center mb-1">
                    <div class="text-xs font-medium">{{ detail.name || `音擎 ${index}` }}</div>
                    <button
                      class="btn btn-xs btn-ghost"
                      @click="showRawData = showRawData === `wengine-${index}` ? null : `wengine-${index}`"
                    >
                      {{ showRawData === `wengine-${index}` ? '隐藏原始数据' : '显示原始数据' }}
                    </button>
                  </div>
                  <pre class="text-xs overflow-auto bg-base-200 p-2 rounded">{{ detail.stats.format() }}</pre>
                  <!-- 原始数据 -->
                  <div v-if="showRawData === `wengine-${index}`" class="mt-2">
                    <div class="text-xs text-gray-600 mb-1">原始数据:</div>
                    <pre class="text-xs overflow-auto bg-base-200 p-2 rounded max-h-40">{{ JSON.stringify(detail.rawData, null, 2) }}</pre>
                  </div>
                </div>
              </div>

              <!-- 驱动盘 -->
              <div v-if="equipmentDetails.some(detail => detail.type === 'drive_disk')" class="mb-4">
                <div class="font-semibold mb-2">驱动盘</div>
                <div v-for="(detail, index) in equipmentDetails.filter(d => d.type === 'drive_disk')" :key="index" class="ml-2 mt-3">
                  <div class="flex justify-between items-center mb-1">
                    <div class="text-xs font-medium">{{ detail.name || `驱动盘 ${index}` }}</div>
                    <button
                      class="btn btn-xs btn-ghost"
                      @click="showRawData = showRawData === `disk-${index}` ? null : `disk-${index}`"
                    >
                      {{ showRawData === `disk-${index}` ? '隐藏原始数据' : '显示原始数据' }}
                    </button>
                  </div>
                  <pre class="text-xs overflow-auto bg-base-200 p-2 rounded">{{ detail.stats.format() }}</pre>
                  <!-- 原始数据 -->
                  <div v-if="showRawData === `disk-${index}`" class="mt-2">
                    <div class="text-xs text-gray-600 mb-1">原始数据:</div>
                    <pre class="text-xs overflow-auto bg-base-200 p-2 rounded max-h-40">{{ JSON.stringify(detail.rawData, null, 2) }}</pre>
                  </div>
                </div>
              </div>

              <!-- 套装效果 -->
              <div v-if="equipmentDetails.some(detail => detail.type === 'set_bonus')" class="mb-4">
                <div class="font-semibold mb-2">套装效果</div>
                <div v-for="(detail, index) in equipmentDetails.filter(d => d.type === 'set_bonus')" :key="index" class="ml-2">
                  <div class="text-xs font-medium mb-1">{{ detail.name || `套装效果 ${index}` }}</div>
                  <pre class="text-xs overflow-auto bg-base-200 p-2 rounded">{{ detail.stats.format() }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-gray-500 py-8">
          无法加载属性数据
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Agent } from '../../model/agent';
import { PropertyCollection } from '../../model/property-collection';
import type { CombatStats } from '../../model/combat-stats';

// 导入BattleService类型
import type { BattleService } from '../../services/battle.service';

// Props
interface AgentInterface {
  id: string;
  game_id: string;
  name_cn: string;
  name_en: string;
  equipped_wengine: string | null;
  equipped_drive_disks: (string | null)[];
  getBareStats: () => any;
  getSelfProperties: () => any;
  getAllBuffs: () => any;
  getCharacterBaseStats: () => any;
  getCharacterEquipmentStats: () => any;
  getCharacterCombatStats: () => any;
}

// 装备详细信息接口
interface EquipmentDetail {
  type: 'wengine' | 'drive_disk' | 'set_bonus';
  stats: PropertyCollection;
  rawData?: any; // 原始数据
  name?: string; // 名称
}

interface Props {
  frontAgent: AgentInterface | null;
  frontCharacterId: string;
  availableCharacters: Array<{ id: string; agent: AgentInterface }>;
  saveStore: any;
  isExpanded: boolean;
  combatStatsSnapshot?: CombatStats | null; // 可选属性
  equipmentStats: PropertyCollection[];
  equipmentDetails: EquipmentDetail[];
  battleService: BattleService; // 战斗服务实例
}

const props = withDefaults(defineProps<Props>(), {
  combatStatsSnapshot: null, // 默认值为 null
  equipmentStats: () => [], // 默认值为空数组
  equipmentDetails: () => [] // 默认值为空数组
});

// Local state
const isStatsSnapshotExpanded = ref<boolean>(props.isExpanded);
const showRawData = ref<string | null>(null); // 跟踪哪个装备的原始数据正在显示

// Watch for expand prop changes
watch(() => props.isExpanded, (newValue) => {
  isStatsSnapshotExpanded.value = newValue;
});
</script>

<style scoped>
.stats-snapshot-card {
  width: 100%;
}
</style>