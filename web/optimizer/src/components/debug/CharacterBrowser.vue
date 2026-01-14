<template>
  <div class="character-browser">
    <h2 class="text-2xl font-bold mb-4">角色浏览</h2>

    <!-- 角色列表 -->
    <div v-if="agents.length === 0" class="alert alert-info">
      未找到角色数据（请先导入存档）
    </div>
    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          @click="selectedAgentId = agent.id"
          :class="{ 'ring-2 ring-primary': selectedAgentId === agent.id }"
        >
          <div class="card-body p-4">
            <h3 class="card-title">{{ agent.name_cn || agent.name_en }}</h3>
            <p class="text-sm text-gray-500">ID: {{ agent.id }}</p>
            <div class="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div class="flex items-center gap-1">
                <span class="font-bold">等级:</span>
                <span>{{ agent.level }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="font-bold">突破:</span>
                <span>{{ agent.breakthrough }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="font-bold">影画:</span>
                <span>M{{ agent.cinema }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 角色详细信息 -->
      <div v-if="selectedAgent" class="mt-6 card bg-base-100 shadow-lg">
        <div class="card-body p-6">
          <!-- 基本信息 -->
          <h3 class="text-xl font-bold mb-4">{{ selectedAgent.name_cn || selectedAgent.name_en }}</h3>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">实例ID</div>
              <div class="text-xs text-gray-600">{{ selectedAgent.id }}</div>
            </div>
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">GameID</div>
              <div class="text-xs text-gray-600">{{ selectedAgent.game_id }}</div>
            </div>
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">等级</div>
              <div class="text-xs text-gray-600">{{ selectedAgent.level }}</div>
            </div>
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">突破</div>
              <div class="text-xs text-gray-600">{{ selectedAgent.breakthrough }}</div>
            </div>
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">影画</div>
              <div class="text-xs text-gray-600">M{{ selectedAgent.cinema }}</div>
            </div>
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">核心技能</div>
              <div class="text-xs text-gray-600">Lv.{{ selectedAgent.core_skill }}</div>
            </div>
            <div class="card bg-base-200 p-3 col-span-2">
              <div class="text-sm font-bold">核心属性</div>
              <div class="text-xs text-gray-600">{{ getCoreSkillStats(selectedAgent) }}</div>
            </div>
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">稀有度</div>
              <div class="text-xs text-gray-600">{{ selectedAgent.rarity }}</div>
            </div>
            <div class="card bg-base-200 p-3">
              <div class="text-sm font-bold">元素</div>
              <div class="text-xs text-gray-600">{{ selectedAgent.element }}</div>
            </div>
          </div>

          <!-- 技能等级 -->
          <div class="mb-6">
            <h4 class="font-bold mb-2">技能等级</h4>
            <div class="grid grid-cols-5 gap-4">
              <div class="text-center">
                <div class="text-sm font-medium">普通攻击</div>
                <div class="text-lg font-bold">{{ selectedAgent.skills.normal }}</div>
              </div>
              <div class="text-center">
                <div class="text-sm font-medium">闪避反击</div>
                <div class="text-lg font-bold">{{ selectedAgent.skills.dodge }}</div>
              </div>
              <div class="text-center">
                <div class="text-sm font-medium">支援技</div>
                <div class="text-lg font-bold">{{ selectedAgent.skills.assist }}</div>
              </div>
              <div class="text-center">
                <div class="text-sm font-medium">特殊技</div>
                <div class="text-lg font-bold">{{ selectedAgent.skills.special }}</div>
              </div>
              <div class="text-center">
                <div class="text-sm font-medium">连携技</div>
                <div class="text-lg font-bold">{{ selectedAgent.skills.chain }}</div>
              </div>
            </div>
          </div>

          <!-- 装备信息 -->
          <div class="mb-6">
            <h4 class="font-bold mb-2">装备</h4>
            
            <!-- 音擎 -->
            <div class="mb-4">
              <div class="flex justify-between items-center mb-1">
                <span class="font-medium">音擎:</span>
                <button
                  @click="openEquipmentDialog(selectedAgent, 'wengine')"
                  class="btn btn-sm btn-primary"
                >
                  {{ getWeaponNameByInstanceId(selectedAgent.equipped_wengine) || '未装备' }}
                </button>
              </div>
            </div>

            <!-- 驱动盘 -->
            <div>
              <span class="font-medium">驱动盘:</span>
              <div class="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
                <div
                  v-for="slot in 6"
                  :key="slot"
                  class="card bg-base-200 p-2 text-center"
                >
                  <div class="text-xs font-medium">{{ slot }}号位</div>
                  <button
                    @click="openEquipmentDialog(selectedAgent, 'disk', slot)"
                    class="btn btn-xs btn-outline mt-1 w-full truncate"
                  >
                    {{ getDiskNameByInstanceId(selectedAgent.equipped_drive_disks[slot - 1]) || '未装备' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 技能信息 -->
          <div v-if="selectedAgent.agentSkills && selectedAgent.agentSkills.skills.size > 0" class="mb-6">
            <h4 class="font-bold mb-2">技能数据</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="[skillName, skill] in Array.from(selectedAgent.agentSkills.skills.entries())"
                :key="skillName"
                class="card bg-base-200 p-3"
              >
                <h5 class="font-semibold">{{ skillName }}</h5>
                <div class="text-xs mt-1">
                  <div v-for="(segment, index) in skill.segments" :key="index">
                    <div class="flex gap-2 mt-1">
                      <span class="font-bold">{{ segment.segmentName || '单段' }}:</span>
                      <span>伤害倍率: {{ (segment.damageRatio * 100).toFixed(1) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="selectedAgent.agentSkills">
            <div class="alert alert-info">
              当前角色没有技能数据
            </div>
          </div>

          <!-- BUFF信息 -->
          <div class="mb-6">
            <h4 class="font-bold mb-2">角色BUFF</h4>
            <div v-if="isLoadingBuffs">
              <div class="alert alert-info">
                正在加载BUFF数据...
              </div>
            </div>
            <div v-else-if="agentBuffs.length > 0">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  v-for="(buff, index) in agentBuffs"
                  :key="index"
                  class="card bg-base-200 p-3"
                >
                  <h5 class="font-semibold">{{ buff.name || '未知BUFF' }}</h5>
                  <div class="text-xs mt-1 space-y-1">
                    <!-- 基本信息 -->
                    <div class="flex flex-wrap gap-2">
                      <div class="flex gap-1">
                        <span class="font-bold">类型:</span>
                        <span>{{ getBuffType(buff) }}</span>
                      </div>
                      <div class="flex gap-1">
                        <span class="font-bold">ID:</span>
                        <span class="text-gray-500">{{ buff.id }}</span>
                      </div>
                      <div class="flex gap-1">
                        <span class="font-bold">激活:</span>
                        <span :class="buff.is_active ? 'text-green-600' : 'text-red-600'">
                          {{ buff.is_active ? '是' : '否' }}
                        </span>
                      </div>
                    </div>
                    
                    <!-- 描述 -->
                    <div v-if="buff.description" class="text-gray-600">
                      {{ buff.description }}
                    </div>
                    
                    <!-- 作用目标 -->
                    <div>
                      <span class="font-bold">作用目标:</span>
                      <div class="flex flex-wrap gap-1 mt-1">
                        <span v-if="buff.target.target_self" class="badge badge-sm badge-primary">自身</span>
                        <span v-if="buff.target.target_teammate" class="badge badge-sm badge-secondary">队友</span>
                        <span v-if="buff.target.target_enemy" class="badge badge-sm badge-destructive">敌人</span>
                        <span v-if="buff.target.target_bund" class="badge badge-sm badge-accent">邦布</span>
                      </div>
                    </div>
                    
                    <!-- 触发条件 -->
                    <div v-if="buff.trigger_conditions">
                      <span class="font-bold">触发条件:</span>
                      <span class="ml-1">{{ buff.trigger_conditions }}</span>
                    </div>
                    
                    <!-- 叠加机制 -->
                    <div class="flex gap-2">
                      <div class="flex gap-1">
                        <span class="font-bold">最大叠加:</span>
                        <span>{{ buff.max_stacks }}层</span>
                      </div>
                      <div class="flex gap-1">
                        <span class="font-bold">叠加模式:</span>
                        <span>{{ buff.stack_mode === 'linear' ? '线性叠加' : '仅满层生效' }}</span>
                      </div>
                    </div>
                    
                    <!-- 属性效果 -->
                    <div v-if="getBuffStats(buff).length > 0">
                      <div class="font-bold mt-1">属性效果:</div>
                      <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                        <div 
                          v-for="(stat, statIndex) in getBuffStats(buff)" 
                          :key="statIndex" 
                          class="flex justify-between"
                        >
                          <span class="text-left">{{ stat.name }}:</span>
                          <span 
                            :class="stat.isPositive ? 'text-green-600' : 'text-red-600'"
                            class="text-right font-medium"
                          >
                            {{ stat.value }}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- 转换属性 -->
                    <div v-if="buff.conversion" class="border-t border-base-300 pt-1 mt-1">
                      <div class="font-bold">转换效果:</div>
                      <div class="mt-1 space-y-1">
                        <div class="flex gap-2">
                          <span>将</span>
                          <span class="font-medium">{{ getStatName(buff.conversion.from_property) }}</span>
                          <span>转换为</span>
                          <span class="font-medium">{{ getStatName(buff.conversion.to_property) }}</span>
                        </div>
                        <div class="flex gap-1">
                          <span class="font-bold">转换比例:</span>
                          <span>{{ (buff.conversion.conversion_ratio * 100).toFixed(1) }}%</span>
                        </div>
                        <div v-if="buff.conversion.max_value" class="flex gap-1">
                          <span class="font-bold">最大转换值:</span>
                          <span>{{ buff.conversion.max_value }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else>
              <div class="alert alert-info">
                当前角色没有BUFF数据
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 装备选择对话框 -->
    <dialog id="equipment-dialog" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">选择{{ equipmentDialogTitle }}</h3>
        <div class="max-h-96 overflow-y-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>名称</th>
                <th>等级</th>
                <th>当前装备者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in availableEquipment" :key="item.id">
                <td>{{ getEquipmentDisplayName(item) }}</td>
                <td>{{ item.level }}</td>
                <td>{{ getEquipmentEquippedBy(item) }}</td>
                <td>
                  <button
                    @click="selectEquipment(item)"
                    class="btn btn-sm btn-primary"
                  >
                    装备
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn">取消</button>
          </form>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import { useGameDataStore } from '../../stores/game-data.store';
import type { Agent } from '../../model/agent';
import type { DriveDisk } from '../../model/drive-disk';
import type { WEngine } from '../../model/wengine';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// 状态管理
const selectedAgentId = ref<string>('');
const agentBuffs = ref<any[]>([]);
const isLoadingBuffs = ref<boolean>(false);

// 计算属性
const agents = computed(() => saveStore.agents);
const driveDisks = computed(() => saveStore.driveDisks);
const wengines = computed(() => saveStore.wengines);

// 组件挂载时输出日志
console.log('[DEBUG] CharacterBrowser组件已挂载，agents数量:', agents.value.length);

// 显示所有可用角色的名称
console.log('[DEBUG] 可用角色列表:', agents.value.map(agent => agent.name_cn).join(', '));

const selectedAgent = computed(() => {
  return agents.value.find(agent => agent.id === selectedAgentId.value) || null;
});

// 监听角色选择变化，加载BUFF数据
watch(selectedAgent, async (newAgent: Agent | null) => {
  if (newAgent) {
    console.log(`[DEBUG] 开始加载角色 ${newAgent.name_cn} 的BUFF数据`);
    isLoadingBuffs.value = true;
    const buffs = await getAllBuffs(newAgent);
    console.log(`[DEBUG] 成功加载角色 ${newAgent.name_cn} 的BUFF数据，共 ${buffs.length} 个BUFF`);
    agentBuffs.value = buffs;
    isLoadingBuffs.value = false;
  } else {
    agentBuffs.value = [];
    isLoadingBuffs.value = false;
  }
});

// 装备选择对话框状态
const equipmentDialogState = ref({
  agent: null as Agent | null,
  type: '' as 'wengine' | 'disk',
  slot: 0,
});

const availableEquipment = computed(() => {
  if (equipmentDialogState.value.type === 'wengine') {
    return wengines.value;
  } else {
    const slot = equipmentDialogState.value.slot;
    return driveDisks.value.filter(d => d.position === slot);
  }
});

const equipmentDialogTitle = computed(() => {
  if (equipmentDialogState.value.type === 'wengine') {
    return '音擎';
  } else {
    return `${equipmentDialogState.value.slot}号位驱动盘`;
  }
});

// 辅助方法
function getCharacterName(code: string | null): string {
  if (!code) return '-';
  const char = gameDataStore.getCharacterInfo(code);
  return char?.CHS || code;
}

function getCharacterNameByInstanceId(agentId: string | null): string {
  if (!agentId) return '-';
  const agent = agents.value.find(a => a.id === agentId);
  if (!agent) return agentId;
  return agent.name_cn || getCharacterName(agent.game_id);
}

function getWeaponNameByInstanceId(wengineId: string | null): string {
  if (!wengineId) return '';
  const wengine = wengines.value.find(w => w.id === wengineId);
  if (!wengine) return '';
  return wengine.name;
}

function getDiskNameByInstanceId(diskId: string | null): string {
  if (!diskId) return '';
  const disk = driveDisks.value.find(d => d.id === diskId);
  if (!disk) return '';
  return disk.set_name;
}

function getEquipmentDisplayName(item: any): string {
  if (equipmentDialogState.value.type === 'wengine') {
    return (item as WEngine).name;
  } else {
    const disk = item as DriveDisk;
    return disk.set_name;
  }
}

function getEquipmentEquippedBy(item: any): string {
  return getCharacterNameByInstanceId(item.equipped_agent);
}

// BUFF相关辅助方法
async function getAllBuffs(agent: Agent): Promise<any[]> {
  try {
    return await agent.getAllBuffs() || [];
  } catch (error) {
    console.error('获取BUFF失败:', error);
    return [];
  }
}

function getBuffType(buff: any): string {
  // BuffSource枚举值映射到中文名称
  const buffSourceMap: Record<number, string> = {
    1: '角色被动',
    2: '角色天赋',
    9: '核心被动',
    10: '影画',
    11: '天赋'
  };
  
  return buffSourceMap[buff.source] || '未知';
}

function getCoreSkillStats(agent: Agent): string {
  const bonuses = agent.getCoreSkillBonuses();
  
  // 调试日志
  console.log('[getCoreSkillStats] 获取到的属性数量:', bonuses.length);
  console.log('[getCoreSkillStats] 属性详情:', bonuses);
  
  if (bonuses.length === 0) {
    // 检查是否是数据加载失败
    const charDetail = (agent as any)._charDetail;
    const zodData = (agent as any)._zodData;
    
    if (!charDetail) {
      console.warn('[getCoreSkillStats] 角色详情未加载');
      return '数据加载失败（角色详情未加载）';
    }
    
    if (!charDetail.ExtraLevel) {
      console.warn('[getCoreSkillStats] 角色详情中缺少 ExtraLevel 数据');
      return '数据加载失败（缺少 ExtraLevel 数据）';
    }
    
    if (!zodData || !zodData.core) {
      console.warn('[getCoreSkillStats] 存档数据中核心技能等级未设置');
      return '数据加载失败（核心技能等级未设置）';
    }
    
    const coreKey = zodData.core.toString();
    const extraData = charDetail.ExtraLevel[coreKey];
    
    if (!extraData) {
      console.warn('[getCoreSkillStats] 核心技能等级 ' + coreKey + ' 对应的数据不存在');
      return '数据加载失败（核心技能等级 ' + coreKey + ' 对应的数据不存在）';
    }
    
    if (!extraData.Extra) {
      console.warn('[getCoreSkillStats] 核心技能等级 ' + coreKey + ' 的 Extra 数据不存在');
      return '数据加载失败（核心技能等级 ' + coreKey + ' 的 Extra 数据不存在）';
    }
    
    console.warn('[getCoreSkillStats] 所有属性值都为 0');
    return '无加成（所有属性值都为 0）';
  }
  
  const stats: string[] = [];
  for (const bonus of bonuses) {
    if (bonus.value !== 0) {
      let displayValue: string;
      if (bonus.format?.includes('%')) {
        displayValue = (bonus.value / 100).toFixed(1) + '%';
      } else {
        displayValue = bonus.value.toString();
      }
      stats.push(`${bonus.name}: ${displayValue}`);
    }
  }
  
  if (stats.length === 0) {
    console.warn('[getCoreSkillStats] 所有属性值都为 0');
    return '无加成（所有属性值都为 0）';
  }
  
  return stats.join(', ');
}

function getBuffStats(buff: any): Array<{ name: string; value: string; isPositive: boolean }> {
  const stats: Array<{ name: string; value: string; isPositive: boolean }> = [];
  
  // 合并战斗中和战斗外的属性
  const allStats = new Map([
    ...(buff.out_of_combat_stats?.entries() || []),
    ...(buff.in_combat_stats?.entries() || [])
  ]);
  
  allStats.forEach((value, key) => {
    // 确保value是number类型
    const numValue = typeof value === 'number' ? value : Number(value) || 0;
    const statName = getStatName(key);
    const formattedValue = formatStatValue(key, numValue);
    const isPositive = numValue > 0;
    stats.push({ name: statName, value: formattedValue, isPositive });
  });
  
  return stats;
}

function getStatName(statKey: any): string {
  const statNames: Record<string, string> = {
    'HP': '生命值',
    'HP_': '生命值%',
    'ATK': '攻击力',
    'ATK_': '攻击力%',
    'DEF': '防御力',
    'DEF_': '防御力%',
    'CRIT_': '暴击率',
    'CRIT_DMG_': '暴击伤害',
    'PEN': '穿透',
    'PEN_': '穿透%',
    'ANOM_PROF': '异常精通',
    'ANOM_MAS': '异常质量',
    'IMPACT': '冲击力',
    'IMPACT_': '冲击力%',
    'ENER_REGEN': '能量回复',
    'PHYSICAL_DMG_': '物理伤害%',
    'FIRE_DMG_': '火元素伤害%',
    'ICE_DMG_': '冰元素伤害%',
    'ELECTRIC_DMG_': '电元素伤害%',
    'ETHER_DMG_': '以太伤害%',
  };
  return statNames[statKey] || String(statKey);
}

function formatStatValue(statKey: any, value: number): string {
  // 处理百分比属性
  if (String(statKey).endsWith('_')) {
    return `${(value * 100).toFixed(1)}%`;
  }
  // 处理整数属性
  if (Number.isInteger(value)) {
    return value.toString();
  }
  // 处理小数属性
  return value.toFixed(2);
}

// 装备更换功能
function openEquipmentDialog(agent: Agent, type: 'wengine' | 'disk', slot?: number) {
  equipmentDialogState.value = {
    agent: agent,
    type,
    slot: slot || 0,
  };
  const dialog = document.getElementById('equipment-dialog') as HTMLDialogElement;
  dialog.showModal();
}

function selectEquipment(item: any) {
  const agent = equipmentDialogState.value.agent;
  if (!agent) return;

  const type = equipmentDialogState.value.type;
  const slot = equipmentDialogState.value.slot;

  // 1. 处理原装备（如果有，设为未装备）
  if (type === 'wengine') {
    if (agent.equipped_wengine) {
      const oldWengine = wengines.value.find(w => w.id === agent.equipped_wengine);
      if (oldWengine) oldWengine.equipped_agent = null;
    }
  } else {
    // 数组索引
    const diskId = agent.equipped_drive_disks[slot - 1];
    if (diskId) {
      const oldDisk = driveDisks.value.find(d => d.id === diskId);
      if (oldDisk) oldDisk.equipped_agent = null;
    }
  }

  // 2. 处理新装备（如果已被其他人装备，先卸下）
  if (item.equipped_agent) {
    const otherAgent = agents.value.find(a => a.id === item.equipped_agent);
    if (otherAgent) {
      if (type === 'wengine') {
        otherAgent.equipped_wengine = null;
      } else {
        // 找到对应的槽位并置空
        const otherSlotIndex = otherAgent.equipped_drive_disks.indexOf(item.id);
        if (otherSlotIndex !== -1) {
          otherAgent.equipped_drive_disks[otherSlotIndex] = null;
        }
      }
    }
  }

  // 3. 建立新连接
  if (type === 'wengine') {
    agent.equipped_wengine = item.id;
    (item as WEngine).equipped_agent = agent.id;
  } else {
    agent.equipped_drive_disks[slot - 1] = item.id;
    (item as DriveDisk).equipped_agent = agent.id;
  }

  // 4. 同步实例数据到rawSaves
  saveStore.syncInstanceToRawSave();
  
  // 5. 保存到store
  saveStore.saveToStorage();

  // 5. 关闭对话框
  const dialog = document.getElementById('equipment-dialog') as HTMLDialogElement;
  dialog.close();
}
</script>

<style scoped>
.character-browser {
  width: 100%;
}
</style>
