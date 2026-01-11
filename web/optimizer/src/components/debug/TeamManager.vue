<template>
  <div class="team-manager">
    <h2 class="text-2xl font-bold mb-4">队伍管理</h2>

    <!-- 队伍列表 -->
    <div class="mb-6">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-semibold">队伍列表</h3>
        <button 
          @click="openCreateTeamDialog"
          class="btn btn-primary"
        >
          创建新队伍
        </button>
      </div>
      
      <!-- 队伍表格 -->
      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>队伍名称</th>
              <th>前台角色</th>
              <th>后台角色1</th>
              <th>后台角色2</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="teams.length === 0">
              <td colspan="5" class="text-center text-gray-500 py-8">
                暂无队伍，点击"创建新队伍"按钮创建
              </td>
            </tr>
            <tr v-for="team in teams" :key="team.id">
              <td class="font-bold">{{ team.name }}</td>
              <td class="text-primary font-medium">{{ getCharacterName(team.frontCharacterId) }}</td>
              <td>{{ getCharacterName(team.backCharacter1Id) }}</td>
              <td>{{ getCharacterName(team.backCharacter2Id) }}</td>
              <td class="flex gap-2">
                <button 
                  @click="openEditTeamDialog(team)" 
                  class="btn btn-sm btn-secondary"
                >
                  编辑
                </button>
                <button 
                  @click="deleteTeam(team.id)" 
                  class="btn btn-sm btn-error"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 创建/编辑队伍对话框 -->
    <dialog id="team-dialog" class="modal">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">
          {{ editingTeam ? '编辑队伍' : '创建新队伍' }}
        </h3>
        
        <form @submit.prevent="saveTeam">
          <!-- 队伍名称 -->
          <div class="mb-4">
            <label class="label">
              <span class="label-text">队伍名称</span>
            </label>
            <input 
              v-model="teamForm.name" 
              type="text" 
              placeholder="输入队伍名称" 
              class="input input-bordered w-full"
              required
            />
          </div>

          <!-- 前台角色 -->
          <div class="mb-4">
            <label class="label">
              <span class="label-text">前台角色</span>
            </label>
            <select 
              v-model="teamForm.frontCharacterId" 
              class="select select-bordered w-full"
              required
            >
              <option value="" disabled>选择前台角色</option>
              <option 
                v-for="charId in currentTeamChars" 
                :key="charId" 
                :value="charId"
              >
                {{ getCharacterName(charId) }}
              </option>
            </select>
          </div>

          <!-- 后台角色1 -->
          <div class="mb-4">
            <label class="label">
              <span class="label-text">后台角色1</span>
            </label>
            <select 
              v-model="teamForm.backCharacter1Id" 
              class="select select-bordered w-full"
              required
              :disabled="teamForm.frontCharacterId === teamForm.backCharacter2Id"
            >
              <option value="" disabled>选择后台角色1</option>
              <option 
                v-for="charId in currentTeamChars" 
                :key="charId" 
                :value="charId"
                :disabled="charId === teamForm.frontCharacterId"
              >
                {{ getCharacterName(charId) }}
              </option>
            </select>
          </div>

          <!-- 后台角色2 -->
          <div class="mb-6">
            <label class="label">
              <span class="label-text">后台角色2</span>
            </label>
            <select 
              v-model="teamForm.backCharacter2Id" 
              class="select select-bordered w-full"
              required
              :disabled="teamForm.frontCharacterId === teamForm.backCharacter1Id"
            >
              <option value="" disabled>选择后台角色2</option>
              <option 
                v-for="charId in currentTeamChars" 
                :key="charId" 
                :value="charId"
                :disabled="charId === teamForm.frontCharacterId || charId === teamForm.backCharacter1Id"
              >
                {{ getCharacterName(charId) }}
              </option>
            </select>
          </div>

          <!-- 对话框按钮 -->
          <div class="flex justify-end gap-2">
            <button 
              type="button" 
              class="btn btn-secondary"
              @click="closeTeamDialog"
            >
              取消
            </button>
            <button 
              type="submit" 
              class="btn btn-primary"
            >
              {{ editingTeam ? '保存' : '创建' }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>关闭</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import type { ZodTeamData } from '../../model/save-data-zod';

const saveStore = useSaveStore();

// 计算属性
const currentSave = computed(() => saveStore.currentSave);
const agents = computed(() => currentSave.value ? currentSave.value.getAllAgents() : []);
const teams = computed(() => currentSave.value ? currentSave.value.getAllTeams() : []);

// 对话框状态
const editingTeam = ref<ZodTeamData | null>(null);
const teamForm = ref({
  name: '',
  frontCharacterId: '',
  backCharacter1Id: '',
  backCharacter2Id: ''
});

// 当前队伍的角色ID列表（用于编辑时的角色选择）
const currentTeamChars = computed(() => {
  if (!editingTeam.value) {
    // 创建新队伍时，显示所有可用角色
    return agents.value.map(agent => agent.id);
  } else {
    // 编辑现有队伍时，只能选择当前队伍的三个角色
    return [
      editingTeam.value.frontCharacterId,
      editingTeam.value.backCharacter1Id,
      editingTeam.value.backCharacter2Id
    ];
  }
});

// 打开创建队伍对话框
function openCreateTeamDialog() {
  editingTeam.value = null;
  teamForm.value = {
    name: '',
    frontCharacterId: '',
    backCharacter1Id: '',
    backCharacter2Id: ''
  };
  const dialog = document.getElementById('team-dialog') as HTMLDialogElement;
  dialog.showModal();
}

// 打开编辑队伍对话框
function openEditTeamDialog(team: ZodTeamData) {
  editingTeam.value = team;
  teamForm.value = {
    name: team.name,
    frontCharacterId: team.frontCharacterId,
    backCharacter1Id: team.backCharacter1Id,
    backCharacter2Id: team.backCharacter2Id
  };
  const dialog = document.getElementById('team-dialog') as HTMLDialogElement;
  dialog.showModal();
}

// 关闭对话框
function closeTeamDialog() {
  const dialog = document.getElementById('team-dialog') as HTMLDialogElement;
  dialog.close();
}

// 保存队伍
function saveTeam() {
  if (!currentSave.value) return;

  const teamData: ZodTeamData = {
    id: editingTeam.value?.id || '',
    name: teamForm.value.name,
    frontCharacterId: teamForm.value.frontCharacterId,
    backCharacter1Id: teamForm.value.backCharacter1Id,
    backCharacter2Id: teamForm.value.backCharacter2Id
  };

  if (editingTeam.value) {
    // 删除旧队伍
    currentSave.value.deleteTeam(editingTeam.value.id);
  }

  // 添加新队伍
  currentSave.value.addTeam(teamData);

  // 同步实例数据到rawSaves
  saveStore.syncInstanceToRawSave();

  // 保存到存储
  saveStore.saveToStorage();

  closeTeamDialog();
}

// 删除队伍
function deleteTeam(teamId: string) {
  if (!currentSave.value) return;
  
  if (confirm('确定要删除这个队伍吗？删除后无法恢复。')) {
    currentSave.value.deleteTeam(teamId);
    // 同步实例数据到rawSaves
    saveStore.syncInstanceToRawSave();
    saveStore.saveToStorage();
  }
}

// 获取角色名称
function getCharacterName(agentId: string): string {
  const agent = agents.value.find(a => a.id === agentId);
  return agent ? (agent.name_cn || agent.game_id) : '未知角色';
}
</script>

<style scoped>
.team-manager {
  max-width: 100%;
}
</style>