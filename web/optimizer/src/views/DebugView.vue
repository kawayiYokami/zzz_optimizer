<template>
  <div class="min-h-screen bg-base-200 p-4 md:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
      
      <!-- 简单的标题栏 -->
      <div class="navbar bg-base-100 rounded-box shadow-sm">
        <a class="btn btn-ghost text-xl">调试控制台</a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <!-- Sidebar -->
        <div class="lg:col-span-1">
          <div class="card bg-base-100 shadow-sm h-fit">
            <div class="card-body p-4">
              <ul class="menu w-full rounded-box p-0">
                <li v-for="tab in tabs" :key="tab.id">
                  <a 
                    @click="currentTab = tab.id"
                    :class="{ 'active': currentTab === tab.id }"
                  >
                    {{ tab.label }}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="lg:col-span-3">
          <div class="card bg-base-100 shadow-xl min-h-[600px]">
             <div class="card-body">
               <KeepAlive>
                 <component :is="activeComponent" />
               </KeepAlive>
             </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useGameDataStore } from '../stores/game-data.store';
import DataImportExport from '../components/debug/DataImportExport-simple.vue';
import DataInspector from '../components/debug/DataInspector-simple.vue';
import ApiTester from '../components/debug/ApiTester.vue';
import BattleSimulator from '../components/debug/BattleSimulator.vue';
import GameWiki from '../components/debug/GameWiki.vue';
import SkillsData from '../components/debug/SkillsData.vue';
import BuffDataInspector from '../components/debug/BuffDataInspector.vue';

const gameDataStore = useGameDataStore();

const tabs = [
  { id: 'import-export', label: '存档管理', component: DataImportExport },
  { id: 'inspector', label: '存档查看', component: DataInspector },
  { id: 'wiki', label: '游戏WIKI', component: GameWiki },
  { id: 'skills', label: '技能数据', component: SkillsData },
  { id: 'buff', label: 'Buff数据', component: BuffDataInspector },
  { id: 'battle', label: '战场模拟', component: BattleSimulator },
  { id: 'api', label: 'API 测试', component: ApiTester },
];

const currentTab = ref(tabs[0].id);

const activeComponent = computed(() => {
  return tabs.find(t => t.id === currentTab.value)?.component;
});

onMounted(async () => {
  try {
    await gameDataStore.initialize();
  } catch (error) {
    console.error('Failed to initialize game data:', error);
  }
});
</script>