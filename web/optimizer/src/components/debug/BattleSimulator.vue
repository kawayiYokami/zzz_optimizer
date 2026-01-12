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
      @enemy-select="onEnemySelect"
      @enemy-stun-change="onEnemyStunChange"
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
      :front-character-id="frontCharacterId"
      :front-character-name="frontCharacterName"
      :front-character-buffs="frontCharacterBuffs"
      :back-character-1-id="backCharacter1Id"
      :back-character-1-name="backCharacter1Name"
      :back-character-1-buffs="backCharacter1Buffs"
      :back-character-2-id="backCharacter2Id"
      :back-character-2-name="backCharacter2Name"
      :back-character-2-buffs="backCharacter2Buffs"
      :is-expanded="isBuffListExpanded"
      @toggle-expand="isBuffListExpanded = !isBuffListExpanded"
      @toggle-buff-active="toggleBuffActive"
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
import { PropertyCollection } from '../../model/property-collection';
import type { CombatStats } from '../../model/combat-stats';
import type { ZodTeamData } from '../../model/save-data-zod';
import { BattleService } from '../../services/battle.service';

// 导入新的卡片组件
import TeamConfigCard from './TeamConfigCard.vue';
import EnemyConfigCard from './EnemyConfigCard.vue';
import StatsSnapshotCard from './StatsSnapshotCard.vue';
import BuffListCard from './BuffListCard.vue';
import SkillListCard from './SkillListCard.vue';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

// 创建战场服务实例
const battleService = new BattleService();

// 队伍选择
const selectedTeamId = ref<string>('');

const frontCharacterId = ref<string>('');
const frontAgent = ref<Agent | null>(null); // 前台角色实例
const backCharacter1Id = ref<string>('');
const backCharacter2Id = ref<string>('');

// 敌人配置
const selectedEnemyId = ref<string>('');
const enemyIsStunned = ref<boolean>(false);
const enemyLevel = 70; // 敌人固定为70级

// 折叠状态
const isBuffListExpanded = ref<boolean>(true);
const isSkillListExpanded = ref<boolean>(true);
const isStatsSnapshotExpanded = ref<boolean>(true);

// 可用角色列表（直接使用实例）
const availableCharacters = computed<Array<{ id: string; name: string; level: number; agent: Agent }>>(() => {
  return saveStore.agents.map(agent => ({
    id: agent.id,
    name: agent.name_cn || agent.name_en,
    level: agent.level,
    agent: agent, // 直接存储实例
  }));
});

// 可用队伍列表
const availableTeams = computed(() => {
  return saveStore.currentSave ? saveStore.currentSave.getAllTeams() : [];
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
async function updateBattleService() {
  // 设置前台角色
  if (frontAgent.value) {
    battleService.setFrontAgent(frontAgent.value);
  }
  
  // 设置后台角色
  const backAgents: Agent[] = [];
  if (backCharacter1Id.value) {
    const agent1 = availableCharacters.value.find(c => c.id === backCharacter1Id.value)?.agent;
    if (agent1) backAgents.push(agent1);
  }
  if (backCharacter2Id.value) {
    const agent2 = availableCharacters.value.find(c => c.id === backCharacter2Id.value)?.agent;
    if (agent2) backAgents.push(agent2);
  }
  battleService.setBackAgents(backAgents);
  
  // 重新加载所有buff（异步）
  await battleService.loadBuffsFromAllAgentsAsync();
  
  // 同步buff激活状态
  syncBuffStatusToBattleService();
}

// 将所有buff状态同步到战场服务
function syncBuffStatusToBattleService() {
  // 同步前台角色buff
  frontCharacterBuffs.value.forEach(buff => {
    battleService.updateBuffStatus(buff.id, buff.isActive);
  });
  
  // 同步后台角色1buff
  backCharacter1Buffs.value.forEach(buff => {
    battleService.updateBuffStatus(buff.id, buff.isActive);
  });
  
  // 同步后台角色2buff
  backCharacter2Buffs.value.forEach(buff => {
    battleService.updateBuffStatus(buff.id, buff.isActive);
  });
  
  console.log('战场服务buff状态已更新:', battleService.getStatus());
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
        name: wengine.name_cn || wengine.name_en
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
      name: disk!.name_cn || disk!.name_en
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

// Buff数据结构
interface BuffInfo {
  id: string;
  name: string;
  description: string;
  source: 'character' | 'weapon' | 'equipment';
  sourceType: string;
  context: string;
  stats: Record<string, number>;
  target: any;
  isActive: boolean; // 是否激活
}

// 前台角色的Buff
const frontCharacterBuffs = ref<BuffInfo[]>([]);
// 后台角色1的Buff
const backCharacter1Buffs = ref<BuffInfo[]>([]);
// 后台角色2的Buff
const backCharacter2Buffs = ref<BuffInfo[]>([]);

// 从Agent实例的Buff对象创建BuffInfo
function createBuffInfoFromAgentBuff(buff: any): BuffInfo {
  // 将BuffSource枚举转换为中文名称
  const buffSourceMap: Record<number, string> = {
    1: '角色被动',
    2: '角色天赋',
    9: '核心被动',
    10: '影画',
    11: '天赋',
    3: '角色核心',
    4: '音擎',
    5: '音擎天赋',
    6: '驱动盘2件套',
    7: '驱动盘4件套',
    8: '队友'
  };
  
  // 确定buff来源类型
  let source: 'character' | 'weapon' | 'equipment' = 'character';
  let sourceType = buffSourceMap[buff.source] || '未知';
  
  if (buff.source === 4 || buff.source === 5) {
    source = 'weapon';
  } else if (buff.source === 6 || buff.source === 7) {
    source = 'equipment';
    sourceType = buff.source === 6 ? '驱动盘2件套' : '驱动盘4件套';
  }
  
  // 合并局内和局外属性
  const stats: Record<string, number> = {};
  buff.out_of_combat_stats.forEach((value: number, key: string) => {
    stats[key] = value;
  });
  buff.in_combat_stats.forEach((value: number, key: string) => {
    stats[key] = value;
  });
  
  return {
    id: buff.id,
    name: buff.name,
    description: buff.description || '',
    source: source,
    sourceType: sourceType,
    context: 'in_combat', // 暂时默认，后续可从buff数据中获取
    stats: stats,
    target: buff.target,
    isActive: buff.is_active,
  };
}

// 检查buff是否适合当前角色位置
function isBuffSuitableForPosition(buff: any, isOnField: boolean): boolean {
  const targetSelf = buff.target?.target_self || false;
  const targetTeammate = buff.target?.target_teammate || false;
  
  // 前台：只选择对自己生效的
  // 后台：只选择对队友或全体生效的
  return isOnField ? targetSelf : targetTeammate;
}

// 从Agent实例获取buff数据
async function getBuffsFromAgent(agent: Agent, isOnField: boolean): Promise<BuffInfo[]> {
  // 确保buff已加载
  await agent.getAllBuffs();
  
  // 获取所有buff
  const allBuffs = agent.getAllBuffsSync();
  
  // 根据角色位置筛选buff
  const suitableBuffs = allBuffs.filter(buff => isBuffSuitableForPosition(buff, isOnField));
  
  // 转换为BuffInfo格式
  return suitableBuffs.map(buff => createBuffInfoFromAgentBuff(buff));
}

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
watch(frontCharacterId, async (newId) => {
  if (newId) {
    // 直接使用Agent实例的buff数据
    const char = availableCharacters.value.find(c => c.id === newId);
    if (char) {
      frontAgent.value = char.agent;
      frontCharacterBuffs.value = await getBuffsFromAgent(char.agent, true);
    }
    
    // 更新战场服务
    updateBattleService();
  } else {
    frontCharacterBuffs.value = [];
    frontAgent.value = null;
    
    // 更新战场服务
    updateBattleService();
  }
});

// 监听后台角色1变化
watch(backCharacter1Id, async (newId) => {
  if (newId) {
    const char = availableCharacters.value.find(c => c.id === newId);
    if (char) {
      backCharacter1Buffs.value = await getBuffsFromAgent(char.agent, false);
    }
  } else {
    backCharacter1Buffs.value = [];
  }
  
  // 更新战场服务
  updateBattleService();
});

// 监听后台角色2变化
watch(backCharacter2Id, async (newId) => {
  if (newId) {
    const char = availableCharacters.value.find(c => c.id === newId);
    if (char) {
      backCharacter2Buffs.value = await getBuffsFromAgent(char.agent, false);
    }
  } else {
    backCharacter2Buffs.value = [];
  }
  
  // 更新战场服务
  updateBattleService();
});

// 切换Buff激活状态
const toggleBuffActive = (buffListType: 'front' | 'back1' | 'back2', buffId: string) => {
  let buffList;
  let agent;
  
  switch (buffListType) {
    case 'front':
      buffList = frontCharacterBuffs;
      agent = frontAgent.value;
      break;
    case 'back1':
      buffList = backCharacter1Buffs;
      agent = availableCharacters.value.find(c => c.id === backCharacter1Id.value)?.agent || null;
      break;
    case 'back2':
      buffList = backCharacter2Buffs;
      agent = availableCharacters.value.find(c => c.id === backCharacter2Id.value)?.agent || null;
      break;
  }
  
  if (buffList && agent) {
    const buffIndex = buffList.value.findIndex(b => b.id === buffId);
    if (buffIndex !== -1) {
      // 更新UI显示
      buffList.value[buffIndex].isActive = !buffList.value[buffIndex].isActive;
      
      // 更新Agent实例中的buff状态
      const allBuffs = agent.getAllBuffsSync();
      const agentBuff = allBuffs.find(b => b.id === buffId);
      if (agentBuff) {
        agentBuff.is_active = buffList.value[buffIndex].isActive;
      }
      
      // 同步到战场服务
      battleService.updateBuffStatus(buffId, buffList.value[buffIndex].isActive);
      
      console.log(`Buff ${buffId} 状态已更新为 ${buffList.value[buffIndex].isActive}`);
    }
  }
};
</script>

<style scoped>
.battle-simulator {
  width: 100%;
}
</style>
