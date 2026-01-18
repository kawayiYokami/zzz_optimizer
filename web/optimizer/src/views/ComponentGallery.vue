<template>
  <div class="p-8 space-y-8 bg-base-100 min-h-screen">
    <div class="max-w-4xl mx-auto space-y-8">
      <div class="prose">
        <h1>组件画廊 (Component Gallery)</h1>
        <p class="text-lg opacity-80">展示绝区零 (ZZZ) 核心业务实体卡片组件。</p>
      </div>

      <!-- Section 1: Agent Card -->
      <section>
        <h2 class="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">角色卡片 (AgentCard)</h2>
        <div class="flex flex-wrap gap-4">
          <AgentCard v-if="realAgent" :agent="realAgent" />
          <div v-else class="alert alert-warning">未找到角色数据，请确保已加载存档。</div>
        </div>
      </section>

      <!-- Section 1.5: Agent Info Card -->
      <section>
        <h2 class="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">角色详情卡片 (AgentInfoCard)</h2>
        <div class="w-full">
          <AgentInfoCard v-if="realAgent" :agent="realAgent" />
          <div v-else class="alert alert-warning">未找到角色数据，请确保已加载存档。</div>
        </div>
      </section>

      <!-- Section 1.6: Team List -->
      <section>
        <h2 class="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">队伍管理 (TeamList)</h2>
        <div class="w-full">
          <TeamList />
        </div>
      </section>

      <!-- Section 1.7: Property Set Card -->
      <section>
        <h2 class="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">属性集卡片 (PropertySetCard)</h2>
        <div class="w-full">
          <PropertySetCard
            v-if="realAgent"
            :property-collection="realAgent.getCharacterCombatStats()"
            :conversion-buffs="realAgent.conversion_buffs"
          />
          <div v-else class="alert alert-warning">未找到角色数据，请确保已加载存档。</div>
        </div>
      </section>

      <!-- Section 1.7: Skill List -->
      <section>
        <h2 class="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">技能列表 (SkillList)</h2>
        <div class="w-full">
          <SkillList v-if="realAgent" :agent="realAgent" />
          <div v-else class="alert alert-warning">未找到角色数据，请确保已加载存档。</div>
        </div>
      </section>

      <!-- Section 2: W-Engine Card -->
      <section>
        <h2 class="text-2xl font-bold mb-4 border-l-4 border-secondary pl-3">音擎卡片 (WEngineCard)</h2>
      <div class="flex flex-wrap gap-4">
        <WEngineCard v-if="realWEngine" :wengine="realWEngine" />
         <div v-else class="alert alert-warning">未找到音擎数据，请确保已加载存档。</div>
      </div>
    </section>

    <!-- Section 3: Drive Disk Card -->
    <section>
      <h2 class="text-2xl font-bold mb-4 border-l-4 border-accent pl-3">驱动盘卡片 (DriveDiskCard)</h2>
      <div class="flex flex-wrap gap-4">
        <DriveDiskCard v-if="realDriveDisk" :disk="realDriveDisk" />
         <div v-else class="alert alert-warning">未找到驱动盘数据，请确保已加载存档。</div>
      </div>
    </section>

    <!-- Section 4: Bangboo Card -->
    <section>
      <h2 class="text-2xl font-bold mb-4 border-l-4 border-info pl-3">邦布卡片 (BangbooCard)</h2>
      <div class="flex flex-wrap gap-4">
        <BangbooCard v-if="realBangboo" :bangboo="realBangboo" />
         <div v-else class="alert alert-warning">未找到邦布数据，请确保已加载存档。</div>
      </div>
    </section>

    <!-- Section 5: Enemy Card -->
    <section>
      <h2 class="text-2xl font-bold mb-4 border-l-4 border-error pl-3">敌人卡片 (EnemyCard)</h2>
      <div class="flex flex-wrap gap-4">
        <EnemyCard v-if="realEnemy" :enemy="realEnemy" />
         <div v-else class="alert alert-warning">未找到敌人数据，请确保已加载存档。</div>
      </div>
    </section>

    <!-- Section 6: Buff Card -->
    <section>
      <h2 class="text-2xl font-bold mb-4 border-l-4 border-success pl-3">Buff 卡片 (BuffCard)</h2>
      <div class="flex flex-wrap gap-4">
        <BuffCard :buff="mockBuff" />
      </div>
    </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AgentCard from '../components/business/AgentCard.vue';
import AgentInfoCard from '../components/business/AgentInfoCard.vue';
import PropertySetCard from '../components/business/PropertySetCard.vue';
import SkillList from '../components/business/SkillList.vue';
import WEngineCard from '../components/business/WEngineCard.vue';
import DriveDiskCard from '../components/business/DriveDiskCard.vue';
import BangbooCard from '../components/business/BangbooCard.vue';
import EnemyCard from '../components/business/EnemyCard.vue';
import BuffCard from '../components/business/BuffCard.vue';
import TeamList from '../components/business/TeamList.vue';
import { MockData } from '../utils/mock-data';
import { useSaveStore } from '../stores/save.store';
import { dataLoaderService } from '../services/data-loader.service';
import { Enemy } from '../model/enemy';
import { Bangboo } from '../model/bangboo';

const saveStore = useSaveStore();

// Instantiate mock data for BuffCard as it's not tied to save data directly in this context
const mockBuff = ref(MockData.buff());

const realAgent = computed(() => {
    const agent = saveStore.agents.length > 0 ? saveStore.agents[0] : null;
    console.log('[ComponentGallery] realAgent computed:', agent ? {
        id: agent.id,
        name: agent.name_cn,
        hasAgent: true
    } : { hasAgent: false });
    return agent;
});

const realWEngine = computed(() => {
    return saveStore.wengines.length > 0 ? saveStore.wengines[0] : null;
});

const realDriveDisk = computed(() => {
    return saveStore.driveDisks.length > 0 ? saveStore.driveDisks[0] : null;
});

// For Enemy and Bangboo, they are not in saveStore (user save), but in gameData (static data).
// We need to fetch from dataLoaderService.
const realEnemy = ref<Enemy | null>(null);
const realBangboo = ref<Bangboo | null>(null);

onMounted(async () => {
    console.log('[ComponentGallery] onMounted - Starting initialization');
    console.log('[ComponentGallery] saveStore.agents.length:', saveStore.agents.length);

    // Ensure data is loaded
    if (!dataLoaderService.isInitialized) {
        console.log('[ComponentGallery] Initializing dataLoaderService...');
        await dataLoaderService.initialize();
        console.log('[ComponentGallery] dataLoaderService initialized');
    } else {
        console.log('[ComponentGallery] dataLoaderService already initialized');
    }

    // Get enemy with ID 900011861 for testing (恶名·冥宁芙)
    const enemyInfo = dataLoaderService.enemyData?.get('900011861');
    console.log('[ComponentGallery] Enemy 900011861 found:', !!enemyInfo);
    if (enemyInfo) {
        realEnemy.value = Enemy.fromGameData(enemyInfo);
        console.log('[ComponentGallery] Enemy 900011861 loaded:', realEnemy.value?.full_name, 'CHS:', enemyInfo.CHS, 'code_name:', enemyInfo.code_name);
    }

    // Get bangboo with ID 54021 for testing
    const bangbooInfo = dataLoaderService.bangbooData?.get('54021');
    console.log('[ComponentGallery] Bangboo 54021 found:', !!bangbooInfo);
    if (bangbooInfo) {
        realBangboo.value = Bangboo.fromInfo(bangbooInfo);
        // Set some display defaults
        if (realBangboo.value) {
            realBangboo.value.level = 60;
            realBangboo.value.refinement = 5;
            console.log('[ComponentGallery] Bangboo 54021 loaded:', realBangboo.value.name_cn, 'ID:', realBangboo.value.id);
        }
    }

    console.log('[ComponentGallery] onMounted - Completed');
});

</script>

<style scoped>
</style>