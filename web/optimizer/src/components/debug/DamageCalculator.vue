<template>
  <div class="damage-calculator">
    <h2 class="text-2xl font-bold mb-4">伤害计算器</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Input Section -->
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <h3 class="card-title">输入</h3>

          <div class="form-control">
            <label class="label">
              <span class="label-text">角色</span>
            </label>
            <select v-model="selectedAgentId" class="select select-bordered">
              <option value="">选择角色</option>
              <option v-for="agent in agents" :key="agent.id" :value="agent.id">
                {{ agent.name_cn }} (Lv.{{ agent.level }})
              </option>
            </select>
          </div>

          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">技能伤害倍率 (%)</span>
            </label>
            <input
              v-model="skillDamageRatio"
              type="number"
              step="0.1"
              class="input input-bordered"
              placeholder="例如：250"
            />
          </div>

          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">敌人等级</span>
            </label>
            <input
              v-model="enemyLevel"
              type="number"
              class="input input-bordered"
              placeholder="例如：60"
            />
          </div>

          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary" @click="calculateDamage" :disabled="isCalculating">
              <span v-if="isCalculating" class="loading loading-spinner"></span>
              计算
            </button>
          </div>

          <div v-if="calcError" class="alert alert-error mt-4">
            <span>{{ calcError }}</span>
          </div>
        </div>
      </div>

      <!-- Result Section -->
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <h3 class="card-title">结果</h3>

          <div v-if="result" class="space-y-4">
            <div class="stat">
              <div class="stat-title">伤害（无暴击）</div>
              <div class="stat-value text-primary">{{ result.damageNoCrit.toFixed(0) }}</div>
            </div>

            <div class="stat">
              <div class="stat-title">伤害（暴击）</div>
              <div class="stat-value text-secondary">{{ result.damageCrit.toFixed(0) }}</div>
            </div>

            <div class="stat">
              <div class="stat-title">期望伤害</div>
              <div class="stat-value">{{ result.damageExpected.toFixed(0) }}</div>
            </div>

            <div class="divider"></div>

            <div class="font-bold mb-2">伤害区间</div>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>区间</th>
                    <th>数值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(value, zone) in result.zones" :key="zone">
                    <td>{{ zone }}</td>
                    <td>{{ (value * 100).toFixed(2) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="text-gray-500">
            选择角色并点击计算查看结果
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSaveStore } from '../../stores/save.store';
import { DamageCalculatorService } from '../../services/damage-calculator.service';

const saveStore = useSaveStore();

const selectedAgentId = ref('');
const skillDamageRatio = ref(250);
const enemyLevel = ref(60);
const result = ref<any>(null);
const calcError = ref<string | null>(null);
const isCalculating = ref(false);

const agents = computed(() => saveStore.agents);

async function calculateDamage() {
  isCalculating.value = true;
  calcError.value = null;
  result.value = null;

  try {
    if (!selectedAgentId.value) {
      throw new Error('请选择角色');
    }

    const agent = agents.value.find(a => a.id === selectedAgentId.value);
    if (!agent) {
      throw new Error('角色未找到');
    }

    // TODO: 实现实际的伤害计算
    // 这是一个占位实现
    result.value = {
      damageNoCrit: 0,
      damageCrit: 0,
      damageExpected: 0,
      zones: {
        '基础伤害': 0,
        '伤害加成': 0,
        '暴击': 0,
        '防御': 0,
        '抗性': 0,
      }
    };

    calcError.value = '伤害计算尚未实现。即将推出！';
  } catch (err) {
    calcError.value = err instanceof Error ? err.message : '未知错误';
  } finally {
    isCalculating.value = false;
  }
}
</script>

<style scoped>
.damage-calculator {
  width: 100%;
}
</style>