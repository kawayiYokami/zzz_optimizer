<template>
  <div class="p-8 space-y-8 bg-base-200 min-h-screen">
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
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <PropertySetCard
                v-if="realAgent"
                :property-collection="realAgent.getCharacterCombatStats()"
                :conversion-buffs="realAgent.conversion_buffs"
              />
              <div v-else class="alert alert-warning">未找到角色数据，请确保已加载存档。</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 1.7: Skill List -->
      <section>
        <h2 class="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">技能列表 (SkillList)</h2>
        <div class="w-full">
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <SkillList v-if="realAgent" :agent="realAgent" />
              <div v-else class="alert alert-warning">未找到角色数据，请确保已加载存档。</div>
            </div>
          </div>
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

    <!-- Section 7: Optimization Result Card -->
    <section>
      <h2 class="text-2xl font-bold mb-4 border-l-4 border-primary pl-3">优化结果卡片 (OptimizationResultCard)</h2>
      <div class="w-full">
        <OptimizationResultCard
          :results="mockOptimizationResults"
          :is-running="false"
          :total-time="5000"
          :current-damage="850000"
          objective="skill"
        />
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
import OptimizationResultCard from '../components/business/OptimizationResultCard.vue';
import { MockData } from '../utils/mock-data';
import { useSaveStore } from '../stores/save.store';
import { dataLoaderService } from '../services/data-loader.service';
import { Enemy } from '../model/enemy';
import { Bangboo } from '../model/bangboo';
import type { OptimizationBuild } from '../optimizer/types';
import { PropertyType } from '../model/base';

const saveStore = useSaveStore();

// Instantiate mock data for BuffCard as it's not tied to save data directly in this context
const mockBuff = ref(MockData.buff());

// Mock optimization results for OptimizationResultCard
const mockOptimizationResults = computed<OptimizationBuild[]>(() => {
  // 使用真实的驱动盘数据
  const discs = saveStore.driveDisks;
  if (discs.length < 18) {
    // 如果驱动盘不够，返回空数组
    return [];
  }

  // 创建3个模拟方案，每个方案使用6个不同的驱动盘
  return [
    {
      weaponId: '',
      discIds: [
        discs[0]?.id || '',
        discs[1]?.id || '',
        discs[2]?.id || '',
        discs[3]?.id || '',
        discs[4]?.id || '',
        discs[5]?.id || '',
      ],
      damage: 950000,
      finalStats: {
        [PropertyType.ATK]: 2500,
        [PropertyType.ATK_]: 0.75,
        [PropertyType.CRIT_]: 0.65,
        [PropertyType.CRIT_DMG_]: 1.5,
        [PropertyType.ANOM_PROF]: 120,
      },
      setBonusInfo: {
        twoPieceSets: ['101', '102'],
        fourPieceSet: '103',
      },
    },
    {
      weaponId: '',
      discIds: [
        discs[6]?.id || '',
        discs[7]?.id || '',
        discs[8]?.id || '',
        discs[9]?.id || '',
        discs[10]?.id || '',
        discs[11]?.id || '',
      ],
      damage: 880000,
      finalStats: {
        [PropertyType.ATK]: 2400,
        [PropertyType.ATK_]: 0.72,
        [PropertyType.CRIT_]: 0.60,
        [PropertyType.CRIT_DMG_]: 1.45,
        [PropertyType.ANOM_PROF]: 115,
      },
      setBonusInfo: {
        twoPieceSets: ['104'],
        fourPieceSet: '105',
      },
    },
    {
      weaponId: '',
      discIds: [
        discs[12]?.id || '',
        discs[13]?.id || '',
        discs[14]?.id || '',
        discs[15]?.id || '',
        discs[16]?.id || '',
        discs[17]?.id || '',
      ],
      damage: 820000,
      finalStats: {
        [PropertyType.ATK]: 2350,
        [PropertyType.ATK_]: 0.70,
        [PropertyType.CRIT_]: 0.58,
        [PropertyType.CRIT_DMG_]: 1.40,
        [PropertyType.ANOM_PROF]: 110,
      },
      setBonusInfo: {
        twoPieceSets: ['106', '107'],
        fourPieceSet: null,
      },
    },
  ];
});

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
