<template>
  <div class="skills-data">
    <h2 class="text-2xl font-bold mb-4">技能数据 (手动测试)</h2>

    <p class="text-sm text-gray-500 mb-4">
      ⚠️ 以下数据均为手动测试结果，是珍贵的数据资源
    </p>

    <!-- Tab导航 -->
    <div class="tabs tabs-boxed mb-4">
      <a
        class="tab"
        :class="{ 'tab-active': currentTab === 'agent' }"
        @click="currentTab = 'agent'"
      >
        代理人技能 ({{ agentSkillsCount }})
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': currentTab === 'bangboo' }"
        @click="currentTab = 'bangboo'"
      >
        邦布技能 ({{ bangbooSkillsCount }})
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': currentTab === 'anomaly' }"
        @click="currentTab = 'anomaly'"
      >
        异常条数据 ({{ anomalyBarsCount }})
      </a>
    </div>

    <!-- 代理人技能 -->
    <div v-if="currentTab === 'agent'" class="mb-6">
      <div class="flex gap-4 mb-4">
        <div class="form-control flex-1">
          <label class="label">
            <span class="label-text">搜索代理人</span>
          </label>
          <input
            v-model="agentSearchText"
            type="text"
            placeholder="输入代理人名称搜索..."
            class="input input-bordered w-full"
          />
        </div>
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" v-model="showAllSkills" class="checkbox checkbox-primary" />
            <span class="label-text">显示全部</span>
          </label>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>代理人</th>
              <th>技能</th>
              <th>段</th>
              <th>伤害倍率</th>
              <th>伤害成长</th>
              <th>失衡倍率</th>
              <th>失衡成长</th>
              <th>能量回复</th>
              <th>异常积蓄</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="skill in filteredAgentSkills" :key="skill.key">
              <td>{{ skill.agent_name }}</td>
              <td class="text-xs">{{ skill.skill_name }}</td>
              <td>{{ skill.stage || '-' }}</td>
              <td>{{ formatPercent(skill.dmg_ratio) }}</td>
              <td>{{ formatPercent(skill.dmg_ratio_growth) }}</td>
              <td>{{ formatPercent(skill.stun_ratio) }}</td>
              <td>{{ formatPercent(skill.stun_ratio_growth) }}</td>
              <td>{{ skill.energy_recovery.toFixed(2) }}</td>
              <td>{{ skill.anomaly_buildup.toFixed(0) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredAgentSkills.length === 0" class="text-center py-4 text-gray-500">
          没有找到匹配的技能数据
        </div>
        <div v-if="!showAllSkills && !agentSearchText && agentSkillsList.length > 100" class="text-sm text-gray-500 mt-2">
          显示前 100 条，共 {{ agentSkillsList.length }} 条技能 - <a @click="showAllSkills = true" class="link link-primary">显示全部</a>
        </div>
      </div>
    </div>

    <!-- 邦布技能 -->
    <div v-if="currentTab === 'bangboo'" class="mb-6">
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>邦布</th>
              <th>技能</th>
              <th>伤害倍率</th>
              <th>伤害成长</th>
              <th>失衡倍率</th>
              <th>失衡成长</th>
              <th>异常积蓄</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="skill in bangbooSkillsList" :key="skill.key">
              <td>{{ skill.bangboo_name }}</td>
              <td class="text-xs">{{ skill.skill_name }}</td>
              <td>{{ formatPercent(skill.dmg_ratio) }}</td>
              <td>{{ formatPercent(skill.dmg_ratio_growth) }}</td>
              <td>{{ formatPercent(skill.stun_ratio) }}</td>
              <td>{{ formatPercent(skill.stun_ratio_growth) }}</td>
              <td>{{ skill.anomaly_buildup.toFixed(0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 异常条数据 -->
    <div v-if="currentTab === 'anomaly'" class="mb-6">
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>异常条ID</th>
              <th>属性</th>
              <th>备注</th>
              <th>异常CD</th>
              <th>第1次积蓄需求</th>
              <th>第10次积蓄需求</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bar in anomalyBarsList" :key="bar.id">
              <td>{{ bar.id }}</td>
              <td>{{ bar.element }}</td>
              <td class="text-xs">{{ bar.note }}</td>
              <td>{{ bar.anomaly_cd }}s</td>
              <td>{{ bar.buildup_requirements[0] }}</td>
              <td>{{ bar.buildup_requirements[9] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const currentTab = ref('agent');
const agentSearchText = ref('');
const showAllSkills = ref(false);

// 技能数据
const agentSkills = ref<Record<string, any>>({});
const bangbooSkills = ref<Record<string, any>>({});
const anomalyBars = ref<Record<string, any>>({});

// 数据计数
const agentSkillsCount = computed(() => Object.keys(agentSkills.value).length);
const bangbooSkillsCount = computed(() => Object.keys(bangbooSkills.value).length);
const anomalyBarsCount = computed(() => Object.keys(anomalyBars.value).length);

// 代理人技能列表
const agentSkillsList = computed(() => {
  return Object.entries(agentSkills.value).map(([key, skill]) => ({
    key,
    ...skill
  }));
});

// 过滤后的代理人技能
const filteredAgentSkills = computed(() => {
  let result = agentSkillsList.value;

  // 搜索过滤
  if (agentSearchText.value) {
    const searchLower = agentSearchText.value.toLowerCase();
    result = result.filter(skill =>
      skill.agent_name.toLowerCase().includes(searchLower)
    );
  }

  // 显示数量限制
  if (!showAllSkills.value && !agentSearchText.value) {
    return result.slice(0, 100); // 默认只显示前100条
  }

  return result;
});

// 邦布技能列表
const bangbooSkillsList = computed(() => {
  return Object.entries(bangbooSkills.value).map(([key, skill]) => ({
    key,
    ...skill
  }));
});

// 异常条列表
const anomalyBarsList = computed(() => {
  return Object.entries(anomalyBars.value).map(([key, bar]) => ({
    key,
    ...bar
  }));
});

// 格式化百分比
function formatPercent(value: number): string {
  if (value === 0) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

// 加载数据
async function loadSkillsData() {
  try {
    const [agentRes, bangbooRes, anomalyRes] = await Promise.all([
      fetch('/game-data/agent_skills.json'),
      fetch('/game-data/bangboo_skills.json'),
      fetch('/game-data/anomaly_bars.json')
    ]);

    if (agentRes.ok) {
      agentSkills.value = await agentRes.json();
    }

    if (bangbooRes.ok) {
      bangbooSkills.value = await bangbooRes.json();
    }

    if (anomalyRes.ok) {
      anomalyBars.value = await anomalyRes.json();
    }
  } catch (error) {
    console.error('Failed to load skills data:', error);
  }
}

onMounted(() => {
  loadSkillsData();
});
</script>

<style scoped>
.skills-data {
  width: 100%;
}
</style>
