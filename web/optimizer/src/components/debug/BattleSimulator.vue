<template>
  <div class="battle-simulator">
    <h2 class="text-2xl font-bold mb-4">战场模拟</h2>

    <!-- 队伍配置卡片 -->
    <TeamConfigCard
      :available-teams="availableTeams"
      :selected-team-id="selectedTeamId"
      :available-characters="availableCharacters"
      @team-select="onTeamSelect"
      @set-front-character="setFrontCharacter"
    />

    <!-- 敌人配置卡片 -->
    <EnemyConfigCard
      :available-enemies="availableEnemies"
      :selected-enemy-id="selectedEnemyId"
      :enemy-is-stunned="enemyIsStunned"
      :enemy-has-corruption-shield="enemyHasCorruptionShield"
      @enemy-select="onEnemySelect"
      @enemy-stun-change="onEnemyStunChange"
      @enemy-corruption-shield-change="onEnemyCorruptionShieldChange"
    />

    <!-- 战斗属性卡片 -->
    <CombatZonesCard
      :is-expanded="isCombatZonesExpanded"
      :battle-service="battleService"
      :front-agent="frontAgent as Agent | null"
      :enemy="selectedEnemy"
      :enemy-is-stunned="enemyIsStunned"
      :enemy-has-corruption-shield="enemyHasCorruptionShield"
      @toggle-expand="isCombatZonesExpanded = !isCombatZonesExpanded"
    />

    <!-- 属性快照卡片 -->
    <StatsSnapshotCard
      :front-agent="frontAgent"
      :front-character-id="frontCharacterId"
      :available-characters="availableCharacters"
      :save-store="saveStore"
      :is-expanded="isStatsSnapshotExpanded"
      :combat-stats-snapshot="combatStatsSnapshot"
      :equipment-stats="equipmentStats"
      :equipment-details="equipmentDetails"
      :raw-save-data="saveStore.currentRawSave"
      :battle-service="battleService"
      @toggle-expand="isStatsSnapshotExpanded = !isStatsSnapshotExpanded"
    />

    <!-- Buff列表卡片 -->
    <BuffListCard
      :all-buffs="allBuffs"
      :is-expanded="isBuffListExpanded"
      @toggle-expand="isBuffListExpanded = !isBuffListExpanded"
      @toggle-buff-active="toggleBuffActive"
      @refresh-buffs="updateBattleService"
    />

    <!-- 技能列表卡片 -->
    <SkillListCard
      :front-character-id="frontCharacterId"
      :available-characters="availableCharacters"
      :is-expanded="isSkillListExpanded"
      @toggle-expand="isSkillListExpanded = !isSkillListExpanded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Ref } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import { useGameDataStore } from '../../stores/game-data.store';
import { dataLoaderService } from '../../services/data-loader.service';
import { Agent } from '../../model/agent';
import { Team } from '../../model/team';
import { PropertyCollection } from '../../model/property-collection';
import type { CombatStats } from '../../model/combat-stats';
import type { ZodTeamData } from '../../model/save-data-zod';
import { BattleService } from '../../services/battle.service';
import { PropertyType } from '../../model/base';

// 导入新的卡片组件
import TeamConfigCard from './TeamConfigCard.vue';
import EnemyConfigCard from './EnemyConfigCard.vue';
import CombatZonesCard from './CombatZonesCard.vue';
import StatsSnapshotCard from './StatsSnapshotCard.vue';
import BuffListCard from './BuffListCard.vue';
import SkillListCard from './SkillListCard.vue';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// 创建战场服务实例
const battleService = new BattleService();

// Buff刷新触发器（用于强制Vue重新计算allBuffs）
const buffRefreshTrigger = ref(0);

// 队伍选择
const selectedTeamId = ref<string>('');

const frontCharacterId = ref<string>('');
const frontAgent = ref<Agent | null>(null); // 前台角色实例
const backCharacter1Id = ref<string>('');
const backCharacter2Id = ref<string>('');

// 敌人配置
const selectedEnemyId = ref<string>('');
const enemyIsStunned = ref<boolean>(false);
const enemyHasCorruptionShield = ref<boolean>(false);
const enemyLevel = 70; // 敌人固定为70级

// 折叠状态
const isBuffListExpanded = ref<boolean>(false);
const isSkillListExpanded = ref<boolean>(false);
const isStatsSnapshotExpanded = ref<boolean>(false);
const isCombatZonesExpanded = ref<boolean>(true);

// 可用角色列表（直接使用实例）
const availableCharacters = computed<Array<{ id: string; name: string; level: number; agent: Agent }>>(() => {
  return saveStore.agents.map(agent => ({
    id: agent.id,
    name: agent.name_cn || agent.name_en,
    level: agent.level,
    agent: agent, // 直接存储实例
  }));
});

// 直接使用saveStore的teams计算属性
// 可用队伍列表
const availableTeams = computed(() => {
  return saveStore.teams;
});

// 当前存档
const currentSave = computed(() => saveStore.currentSave);

// 当前选中的队伍
const selectedTeam = computed(() => {
  return availableTeams.value.find(t => t.id === selectedTeamId.value) || null;
});



// 获取角色名称
function getCharacterName(agentId: string): string {
  if (!agentId) return '未选择';
  const agent = availableCharacters.value.find(c => c.id === agentId);
  return agent?.name || agentId;
}

// 可用敌人列表
const availableEnemies = computed(() => {
  return gameDataStore.allEnemies || [];
});

// 选中的敌人
const selectedEnemy = computed(() => {
  if (!selectedEnemyId.value) return null;
  return availableEnemies.value.find(e => e.id === selectedEnemyId.value) || null;
});

// 显示的抗性列表（仅显示非0的抗性）
const displayedResistances = computed(() => {
  if (!selectedEnemy.value) return [];

  const elements = [
    { key: 'ice', name: '冰' },
    { key: 'fire', name: '火' },
    { key: 'electric', name: '电' },
    { key: 'physical', name: '物理' },
    { key: 'ether', name: '以太' },
  ];

  return elements
    .map(element => ({
      name: element.name,
      value: selectedEnemy.value![`${element.key}_dmg_resistance`] || 0,
    }))
    .filter(res => res.value !== 0);
});

// 前台角色名称
const frontCharacterName = computed(() => {
  if (!frontCharacterId.value) return '';
  const agent = availableCharacters.value.find(c => c.id === frontCharacterId.value);
  return agent?.name || '';
});

// 后台角色1名称
const backCharacter1Name = computed(() => {
  if (!backCharacter1Id.value) return '';
  const agent = availableCharacters.value.find(c => c.id === backCharacter1Id.value);
  return agent?.name || '';
});

// 后台角色2名称
const backCharacter2Name = computed(() => {
  if (!backCharacter2Id.value) return '';
  const agent = availableCharacters.value.find(c => c.id === backCharacter2Id.value);
  return agent?.name || '';
});

// 前台角色的技能数据
const frontCharacterSkills = computed(() => {
  if (!frontCharacterId.value) return null;

  const char = availableCharacters.value.find(c => c.id === frontCharacterId.value);
  if (!char) return null;

  // 从agent获取名称
  const agentName = char.agent.name_cn || char.agent.name_en;

  // 从dataLoaderService获取技能数据
  return dataLoaderService.getAgentSkills(agentName);
});

// 监听队伍选择变化
watch(selectedTeamId, (newTeamId) => {
  if (newTeamId) {
    const team = availableTeams.value.find(t => t.id === newTeamId);
    if (team) {
      frontCharacterId.value = team.frontCharacterId;
      backCharacter1Id.value = team.backCharacter1Id;
      backCharacter2Id.value = team.backCharacter2Id;
    }
  }
});

// 设置前台角色
function setFrontCharacter(newFrontCharId: string) {
  if (!selectedTeamId.value || !currentSave.value) return;
  
  const team = availableTeams.value.find(t => t.id === selectedTeamId.value);
  if (!team) return;
  
  // 获取当前队伍的三个角色ID
  const currentChars = [team.frontCharacterId, team.backCharacter1Id, team.backCharacter2Id];
  
  // 确保新前台角色是队伍中的一员
  if (!currentChars.includes(newFrontCharId)) return;
  
  // 确定新的角色分配，保持角色顺序
  let newFront = newFrontCharId;
  let newBack1 = '';
  let newBack2 = '';
  
  // 找到新前台角色在当前顺序中的索引
  const newFrontIndex = currentChars.indexOf(newFrontCharId);
  
  if (newFrontIndex === 0) {
    // 没有变化
    return;
  } else {
    // 重新排列角色顺序，保持原有顺序不变
    const reorderedChars = [
      ...currentChars.slice(newFrontIndex),
      ...currentChars.slice(0, newFrontIndex)
    ];
    
    newFront = reorderedChars[0];
    newBack1 = reorderedChars[1];
    newBack2 = reorderedChars[2];
  }
  
  // 更新队伍数据
  const updatedTeam = {
    ...team,
    frontCharacterId: newFront,
    backCharacter1Id: newBack1,
    backCharacter2Id: newBack2
  };
  
  // 删除旧队伍，添加新队伍
  currentSave.value.deleteTeam(team.id);
  currentSave.value.addTeam(updatedTeam);
  
  // 同步实例数据到rawSaves
  saveStore.syncInstanceToRawSave();
  
  // 保存到存储
  saveStore.saveToStorage();
  
  // 更新当前选中的角色ID
  frontCharacterId.value = newFront;
  backCharacter1Id.value = newBack1;
  backCharacter2Id.value = newBack2;
}

// 更新战场服务的角色和buff
let isUpdating = false;

async function updateBattleService() {
  if (isUpdating) return;
  isUpdating = true;
  
  try {
    if (frontAgent.value) {
    // 构建队伍成员列表
    const teamMembers: Agent[] = [frontAgent.value as Agent];
    
    // 添加后台角色
    if (backCharacter1Id.value) {
      const agent1 = availableCharacters.value.find(c => c.id === backCharacter1Id.value)?.agent;
      if (agent1) teamMembers.push(agent1);
    }
    if (backCharacter2Id.value) {
      const agent2 = availableCharacters.value.find(c => c.id === backCharacter2Id.value)?.agent;
      if (agent2) teamMembers.push(agent2);
    }
    
    // 创建队伍实例
    const team = new Team(teamMembers);
    
    // 设置队伍到战场服务（异步）
    await battleService.setTeam(team);
  }
  
    // 触发Buff刷新，强制Vue重新计算allBuffs
    buffRefreshTrigger.value++;
  } finally {
    isUpdating = false;
  }
}

// 装备详细信息（包含原始数据，用于StatsSnapshotCard）
interface EquipmentDetail {
  type: 'wengine' | 'drive_disk' | 'set_bonus';
  stats: PropertyCollection;
  rawData?: any; // 原始数据
  name?: string; // 名称
}

const equipmentDetails = computed(() => {
  if (!frontAgent.value || !frontCharacterId.value) {
    return [];
  }

  const char = availableCharacters.value.find(c => c.id === frontCharacterId.value);
  if (!char) {
    return [];
  }

  const details: EquipmentDetail[] = [];

  // 1. 获取音擎属性
  if (char.agent.equipped_wengine) {
    const wengine = saveStore.wengines.find(w => w.id === char.agent.equipped_wengine);
    if (wengine) {
      const wengineStats = wengine.getStatsAtLevel(wengine.level, wengine.breakthrough);
      details.push({
        type: 'wengine',
        stats: wengineStats,
        rawData: wengine,
        name: wengine.name
      });
    }
  }

  // 2. 获取驱动盘属性
  const driveDisks = char.agent.equipped_drive_disks
    .map(diskId => diskId ? saveStore.driveDisks.find(d => d.id === diskId) : null)
    .filter(d => d !== null && d !== undefined);

  for (const disk of driveDisks) {
    const diskStats = disk!.getStats();
    details.push({
      type: 'drive_disk',
      stats: diskStats,
      rawData: disk,
      name: disk!.set_name
    });
  }

  // 3. 计算套装效果（2件套）
  if (driveDisks.length > 0) {
    const setCounts: Record<string, number> = {};
    for (const disk of driveDisks) {
      if (disk!.set_name) {
        setCounts[disk!.set_name] = (setCounts[disk!.set_name] || 0) + 1;
      }
    }

    const processedSets = new Set<string>();
    for (const disk of driveDisks) {
      if (!disk!.set_name) continue;
      if (processedSets.has(disk!.set_name)) continue;
      processedSets.add(disk!.set_name);

      const count = setCounts[disk!.set_name] || 0;
      if (count >= 2 && disk!.two_piece_buffs.length > 0) {
        for (const buff of disk!.two_piece_buffs) {
          details.push({
            type: 'set_bonus',
            stats: buff.toPropertyCollection(),
            name: `${disk!.set_name} 2件套`
          });
        }
      }
    }
  }

  return details;
});

// 装备属性（兼容旧接口，用于StatsSnapshotCard）
const equipmentStats = computed(() => {
  return equipmentDetails.value.map(detail => detail.stats);
});

// 属性快照（computed，直接使用实例）
const combatStatsSnapshot = computed(() => {
  if (!frontAgent.value || !frontCharacterId.value) {
    return null;
  }

  const char = availableCharacters.value.find(c => c.id === frontCharacterId.value);
  if (!char) {
    return null;
  }

  // 计算基础战斗属性（角色+装备，考虑buff）
  const activeBuffs = battleService.getActiveBuffs();
  return frontAgent.value.getCombatStats(activeBuffs);
});



// 组件事件处理函数
function onTeamSelect(teamId: string) {
  selectedTeamId.value = teamId;
}

function onEnemySelect(enemyId: string) {
  selectedEnemyId.value = enemyId;
}

function onEnemyStunChange(isStunned: boolean) {
  enemyIsStunned.value = isStunned;
}

function onEnemyCorruptionShieldChange(hasShield: boolean) {
  enemyHasCorruptionShield.value = hasShield;
}

// 所有Buff，从战斗服务类获取包含开关状态的buff列表
const allBuffs = computed(() => {
  buffRefreshTrigger.value; // 触发响应式依赖
  return battleService.getBuffInfos();
});

// 监听敌人选择变化，重置失衡状态
watch(selectedEnemyId, () => {
  enemyIsStunned.value = false;
});

// 如果选中的敌人不能失衡，则自动取消失衡状态
watch(
  () => selectedEnemy.value?.can_stun,
  (canStun) => {
    if (!canStun) {
      enemyIsStunned.value = false;
    }
  }
);

// 监听前台角色变化
watch(frontCharacterId, (newId) => {
  if (newId) {
    const char = availableCharacters.value.find(c => c.id === newId);
    if (char) {
      frontAgent.value = char.agent;
    }
  } else {
    frontAgent.value = null;
  }
  updateBattleService();
});

// 监听后台角色变化
watch([backCharacter1Id, backCharacter2Id], () => {
  updateBattleService();
});

// 切换Buff激活状态
const toggleBuffActive = (buffListType: 'all', buffId: string) => {
  // 直接调用战斗服务类的方法
  const currentStatus = battleService.getBuffIsActive(buffId);
  battleService.updateBuffStatus(buffId, !currentStatus);
};
</script>

<style scoped>
.battle-simulator {
  width: 100%;
}
</style>
