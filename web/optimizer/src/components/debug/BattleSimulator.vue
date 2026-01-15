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
      :selected-skill="currentSelectedSkill"
      @toggle-expand="isCombatZonesExpanded = !isCombatZonesExpanded"
      @update:selected-skill="onSelectedSkillChange"
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
      :selected-skills="targetSkills"
      @toggle-expand="isSkillListExpanded = !isSkillListExpanded"
      @toggle-skill="onToggleSkill"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type Ref } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import { useGameDataStore } from '../../stores/game-data.store';
import { dataLoaderService } from '../../services/data-loader.service';
import { Agent } from '../../model/agent';
import { Enemy } from '../../model/enemy';
import { Team } from '../../model/team';
import { PropertyCollection } from '../../model/property-collection';
import type { CombatStats } from '../../model/combat-stats';
import type { ZodTeamData, ZodBattleData } from '../../model/save-data-zod';
import { BattleService, type EquipmentDetail } from '../../services/battle.service';
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
const currentSelectedSkill = ref<string>(''); // 当前在战斗属性卡片选中的技能
const enemyLevel = 70; // 敌人固定为70级

// 可用敌人列表
const availableEnemies = computed(() => {
  return gameDataStore.allEnemies || [];
});

// 选中的敌人
const selectedEnemy = computed(() => {
  if (!selectedEnemyId.value) return null;
  return availableEnemies.value.find(e => e.id === selectedEnemyId.value) || null;
});

// 折叠状态
const isBuffListExpanded = ref<boolean>(false);
const isSkillListExpanded = ref<boolean>(false);
const isStatsSnapshotExpanded = ref<boolean>(false);
const isCombatZonesExpanded = ref<boolean>(true);

// 自动保存标志，防止加载时触发保存
const isAutoLoading = ref(false);

// 保存战场状态
function saveBattleState() {
  if (isAutoLoading.value) return;
  if (!selectedTeamId.value || !saveStore.currentRawSave) return;
  
  // 仅在服务已就绪时保存（有队伍和敌人）
  if (battleService.getTeam() && battleService.getEnemy()) {
    try {
      const battleId = `battle_${selectedTeamId.value}`;
      const battleName = `Battle for ${selectedTeamId.value}`;
      
      // 更新Service中的敌人状态
      battleService.setEnemyStatus(enemyIsStunned.value, enemyHasCorruptionShield.value);
      
      // 生成ZOD数据 (Logic completely in Service now)
      const zodData = battleService.toZod(battleId, battleName);
      
      // 更新到store
      const existingIndex = saveStore.currentRawSave.battles.findIndex(b => b.id === battleId);
      if (existingIndex >= 0) {
        console.log(`[BattleSimulator] Updating existing save for ${battleId}`, zodData);
        saveStore.currentRawSave.battles[existingIndex] = zodData;
      } else {
        console.log(`[BattleSimulator] Creating new save for ${battleId}`, zodData);
        saveStore.currentRawSave.battles.push(zodData);
      }
      
      // 持久化
      saveStore.saveToStorage();
      console.log('[BattleSimulator] Save to storage called');
    } catch (e) {
      console.warn('Auto-save battle state failed:', e);
    }
  }
}

// 加载战场状态
async function loadBattleState(teamId: string) {
  if (!saveStore.currentRawSave) return;
  
  console.log(`[BattleSimulator] Loading battle state for ${teamId}`);
  const battleId = `battle_${teamId}`;
  const battleData = saveStore.currentRawSave.battles.find(b => b.id === battleId);
  
  if (battleData) {
    console.log(`[BattleSimulator] Found save data for ${battleId}`, battleData);
    isAutoLoading.value = true;
    try {
      // 1. 恢复敌人选择
      if (battleData.enemyId) {
        selectedEnemyId.value = battleData.enemyId;
      }
      
      // 2. 等待服务更新完成
      await updateBattleService();
      
      // 3. 恢复服务内部状态
      const team = battleService.getTeam();
      const enemyInfo = availableEnemies.value.find(e => e.id === battleData.enemyId);
      
      if (team && enemyInfo) {
        const enemy = Enemy.fromGameData(enemyInfo);
        battleService.setEnemy(enemy);
        await battleService.loadFromZod(battleData, team, enemy);
        
        // 从Service同步UI状态
        enemyIsStunned.value = battleService.getIsEnemyStunned();
        enemyHasCorruptionShield.value = battleService.getEnemyHasCorruptionShield();
        currentSelectedSkill.value = battleService.getSelectedSkill();
        
        // 强制刷新UI
        buffRefreshTrigger.value++; 
      }
    } finally {
      // 延迟重置Loading标志
      setTimeout(() => {
        isAutoLoading.value = false;
      }, 500);
    }
  }
}

// 监听敌人变化，同步到BattleService
watch(selectedEnemy, (newEnemy) => {
  if (newEnemy) {
    const enemy = Enemy.fromGameData(newEnemy);
    battleService.setEnemy(enemy);
    // 触发保存
    saveBattleState();
  }
});

// 监听状态变化触发自动保存 (保留其他触发器)
watch([enemyIsStunned, enemyHasCorruptionShield, buffRefreshTrigger], () => {
   saveBattleState();
});

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

// 初始化：尝试加载上次的战场或默认队伍
onMounted(() => {
    // 简单的策略：如果当前存档有队伍，默认选中第一个，并尝试加载其战场状态
    if (availableTeams.value.length > 0) {
        // 优先检查是否有任何已保存的战场，如果有，使用最近的一个（这里简化为第一个找到的）
        if (saveStore.currentRawSave && saveStore.currentRawSave.battles.length > 0) {
            const lastBattle = saveStore.currentRawSave.battles[0];
            // 检查该战场的teamId是否存在
            if (availableTeams.value.some(t => t.id === lastBattle.teamId)) {
                selectedTeamId.value = lastBattle.teamId;
                // watcher 会触发 loadBattleState ??? 
                // 不，selectedTeamId watcher 目前只更新角色ID。我们需要修改 watcher
            } else {
                 selectedTeamId.value = availableTeams.value[0].id;
            }
        } else {
            selectedTeamId.value = availableTeams.value[0].id;
        }
    }
});



// 获取角色名称
function getCharacterName(agentId: string): string {
  if (!agentId) return '未选择';
  const agent = availableCharacters.value.find(c => c.id === agentId);
  return agent?.name || agentId;
}



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
watch(selectedTeamId, async (newTeamId) => {
  if (newTeamId) {
    const team = availableTeams.value.find(t => t.id === newTeamId);
    if (team) {
      // 先更新角色ID
      frontCharacterId.value = team.frontCharacterId;
      backCharacter1Id.value = team.backCharacter1Id;
      backCharacter2Id.value = team.backCharacter2Id;
      
      // 然后尝试加载该队伍的战场存档
      await loadBattleState(newTeamId);
    }
  }
});

// 设置前台角色
function setFrontCharacter(newFrontCharId: string) {
  if (!selectedTeamId.value || !saveStore.currentSave) return;
  
  const teamData = availableTeams.value.find(t => t.id === selectedTeamId.value);
  if (!teamData) return;
  
  // 临时构建Team对象来利用其逻辑
  // 我们需要构建包含完整Agent对象的数组，因为Team构造函数需要
  const agentMap = new Map<string, Agent>();
  for (const char of availableCharacters.value) {
      agentMap.set(char.id, char.agent);
  }
  
  let tempTeam: Team;
  try {
      tempTeam = Team.fromZod(teamData, agentMap);
  } catch (e) {
      console.error('Failed to create temp team', e);
      return;
  }

  const newFrontAgent = agentMap.get(newFrontCharId);
  if (!newFrontAgent) return;

  try {
      // 使用Team模型的逻辑重排
      tempTeam.frontAgent = newFrontAgent;
      
      // 获取新的数据并更新Store
      const newTeamData = tempTeam.toZodData();
      
      // 删除旧队伍，添加新队伍
      saveStore.currentSave.deleteTeam(teamData.id);
      saveStore.currentSave.addTeam(newTeamData);
      
      // 同步实例数据到rawSaves
      saveStore.syncInstanceToRawSave();
      
      // 保存到存储
      saveStore.saveToStorage();
      
      // 更新当前本地状态
      frontCharacterId.value = newTeamData.frontCharacterId;
      backCharacter1Id.value = newTeamData.backCharacter1Id;
      backCharacter2Id.value = newTeamData.backCharacter2Id;
  } catch (e) {
      console.error('Failed to set front character', e);
  }
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
    
    // 更新完成后尝试保存
    saveBattleState();
  } finally {
    isUpdating = false;
  }
}

const equipmentDetails = computed(() => {
  if (!frontAgent.value || !frontCharacterId.value) {
    return [];
  }

  // 调用Service获取详情
  // 注意：需要传递saveStore中的列表，因为Business Logic不直接持有Store
  return battleService.getEquipmentDetails(
      frontCharacterId.value, 
      saveStore.wengines, 
      saveStore.driveDisks
  );
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
  saveBattleState();
};

// 目标技能列表 (响应式)
const targetSkills = computed(() => {
  buffRefreshTrigger.value; // 依赖刷新触发器
  return battleService.getTargetSkills();
});

// 切换目标技能
function onToggleSkill(skillId: string) {
  console.log('[BattleSimulator] onToggleSkill received:', skillId);
  battleService.toggleTargetSkill(skillId);
  buffRefreshTrigger.value++; // 强制刷新UI
  saveBattleState();
}

// 选中技能变化
function onSelectedSkillChange(skill: string) {
  currentSelectedSkill.value = skill;
  battleService.setSelectedSkill(skill);
  saveBattleState();
}
</script>

<style scoped>
.battle-simulator {
  width: 100%;
}
</style>
