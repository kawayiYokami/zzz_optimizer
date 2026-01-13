<template>
  <div class="enemy-config-card card bg-base-200 shadow-xl mb-6">
    <div class="card-body">
      <h3 class="card-title">敌人配置</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 敌人选择 -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">选择敌人 (Lv.70)</span>
          </label>
          <select 
            v-model="localSelectedEnemyId" 
            class="select select-bordered w-full"
            @change="handleEnemySelect"
          >
            <option value="">请选择敌人...</option>
            <option v-for="enemy in availableEnemies" :key="enemy.id" :value="enemy.id">
              {{ enemy.CHS || enemy.EN }}
            </option>
          </select>
        </div>

        <!-- 失衡状态和秽盾 -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">敌人状态</span>
          </label>
          <div class="flex items-center h-12 gap-4">
            <label class="label cursor-pointer">
              <input
                v-model="localEnemyIsStunned"
                type="checkbox"
                class="checkbox checkbox-primary"
                :disabled="!localSelectedEnemyId || !selectedEnemy?.can_stun"
                @change="handleEnemyStunChange"
              />
              <span class="label-text ml-2">已失衡</span>
            </label>
            <label class="label cursor-pointer">
              <input
                v-model="localEnemyHasCorruptionShield"
                type="checkbox"
                class="checkbox checkbox-secondary"
                :disabled="!localSelectedEnemyId"
                @change="handleEnemyCorruptionShieldChange"
              />
              <span class="label-text ml-2">秽盾</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 敌人详情 -->
      <div v-if="selectedEnemy" class="mt-4 p-4 bg-base-100 rounded-lg">
        <h4 class="font-bold mb-3 text-lg">{{ selectedEnemy.CHS || selectedEnemy.EN }} (Lv.70)</h4>

        <!-- 完整属性列表 -->
        <div class="overflow-x-auto">
          <table class="table table-xs w-full">
            <tbody>
              <!-- 基础信息 -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">基础信息</td></tr>
              <tr><td class="w-32">ID</td><td>{{ selectedEnemy.id }}</td></tr>
              <tr v-if="selectedEnemy.index_id"><td>索引ID</td><td>{{ selectedEnemy.index_id }}</td></tr>
              <tr v-if="selectedEnemy.code_name"><td>代号</td><td>{{ selectedEnemy.code_name }}</td></tr>
              <tr v-if="selectedEnemy.tags"><td>标签</td><td>{{ selectedEnemy.tags }}</td></tr>

              <!-- 基础属性 -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">基础属性</td></tr>
              <tr><td>生命值</td><td>{{ formatNumber(selectedEnemy.level_70_max_hp || selectedEnemy.hp) }}</td></tr>
              <tr><td>攻击力</td><td>{{ formatNumber(selectedEnemy.level_70_max_atk || selectedEnemy.atk) }}</td></tr>
              <tr><td>防御力</td><td>{{ formatNumber(selectedEnemy.level_60_plus_defense || selectedEnemy.defense) }}</td></tr>

              <!-- 失衡属性 -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">失衡属性</td></tr>
              <tr><td>可失衡</td><td>{{ selectedEnemy.can_stun ? '是' : '否' }}</td></tr>
              <tr v-if="selectedEnemy.can_stun"><td>失衡值</td><td>{{ formatNumber(selectedEnemy.level_70_max_stun || selectedEnemy.stun_max) }}</td></tr>
              <tr v-if="selectedEnemy.can_stun"><td>失衡易伤倍率</td><td>{{ formatPercent(selectedEnemy.stun_vulnerability_multiplier) }}</td></tr>

              <!-- 伤害抗性 -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">伤害抗性</td></tr>
              <tr><td>物理</td><td :class="getResistanceClass(selectedEnemy.physical_dmg_resistance)">{{ formatPercent(selectedEnemy.physical_dmg_resistance) }}</td></tr>
              <tr><td>火</td><td :class="getResistanceClass(selectedEnemy.fire_dmg_resistance)">{{ formatPercent(selectedEnemy.fire_dmg_resistance) }}</td></tr>
              <tr><td>冰</td><td :class="getResistanceClass(selectedEnemy.ice_dmg_resistance)">{{ formatPercent(selectedEnemy.ice_dmg_resistance) }}</td></tr>
              <tr><td>电</td><td :class="getResistanceClass(selectedEnemy.electric_dmg_resistance)">{{ formatPercent(selectedEnemy.electric_dmg_resistance) }}</td></tr>
              <tr><td>以太</td><td :class="getResistanceClass(selectedEnemy.ether_dmg_resistance)">{{ formatPercent(selectedEnemy.ether_dmg_resistance) }}</td></tr>

              <!-- 异常抗性 -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">异常抗性</td></tr>
              <tr><td>物理</td><td :class="getResistanceClass(selectedEnemy.physical_anomaly_resistance)">{{ formatPercent(selectedEnemy.physical_anomaly_resistance) }}</td></tr>
              <tr><td>火</td><td :class="getResistanceClass(selectedEnemy.fire_anomaly_resistance)">{{ formatPercent(selectedEnemy.fire_anomaly_resistance) }}</td></tr>
              <tr><td>冰</td><td :class="getResistanceClass(selectedEnemy.ice_anomaly_resistance)">{{ formatPercent(selectedEnemy.ice_anomaly_resistance) }}</td></tr>
              <tr><td>电</td><td :class="getResistanceClass(selectedEnemy.electric_anomaly_resistance)">{{ formatPercent(selectedEnemy.electric_anomaly_resistance) }}</td></tr>
              <tr><td>以太</td><td :class="getResistanceClass(selectedEnemy.ether_anomaly_resistance)">{{ formatPercent(selectedEnemy.ether_anomaly_resistance) }}</td></tr>

              <!-- 失衡抗性 -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">失衡抗性</td></tr>
              <tr><td>物理</td><td :class="getResistanceClass(selectedEnemy.physical_stun_resistance)">{{ formatPercent(selectedEnemy.physical_stun_resistance) }}</td></tr>
              <tr><td>火</td><td :class="getResistanceClass(selectedEnemy.fire_stun_resistance)">{{ formatPercent(selectedEnemy.fire_stun_resistance) }}</td></tr>
              <tr><td>冰</td><td :class="getResistanceClass(selectedEnemy.ice_stun_resistance)">{{ formatPercent(selectedEnemy.ice_stun_resistance) }}</td></tr>
              <tr><td>电</td><td :class="getResistanceClass(selectedEnemy.electric_stun_resistance)">{{ formatPercent(selectedEnemy.electric_stun_resistance) }}</td></tr>
              <tr><td>以太</td><td :class="getResistanceClass(selectedEnemy.ether_stun_resistance)">{{ formatPercent(selectedEnemy.ether_stun_resistance) }}</td></tr>

              <!-- 异常条ID -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">异常条ID</td></tr>
              <tr v-if="selectedEnemy.physical_anomaly_bar"><td>物理</td><td>{{ selectedEnemy.physical_anomaly_bar }}</td></tr>
              <tr v-if="selectedEnemy.fire_anomaly_bar"><td>火</td><td>{{ selectedEnemy.fire_anomaly_bar }}</td></tr>
              <tr v-if="selectedEnemy.ice_anomaly_bar"><td>冰</td><td>{{ selectedEnemy.ice_anomaly_bar }}</td></tr>
              <tr v-if="selectedEnemy.electric_anomaly_bar"><td>电</td><td>{{ selectedEnemy.electric_anomaly_bar }}</td></tr>
              <tr v-if="selectedEnemy.ether_anomaly_bar"><td>以太</td><td>{{ selectedEnemy.ether_anomaly_bar }}</td></tr>

              <!-- 其他属性 -->
              <tr class="bg-base-200"><td colspan="2" class="font-bold">其他属性</td></tr>
              <tr v-if="selectedEnemy.crit_dmg"><td>暴击伤害</td><td>{{ formatPercent(selectedEnemy.crit_dmg) }}</td></tr>
              <tr v-if="selectedEnemy.chain_attack_count"><td>连携攻击次数</td><td>{{ selectedEnemy.chain_attack_count }}</td></tr>
              <tr v-if="selectedEnemy.base_poise_level"><td>基础韧性等级</td><td>{{ selectedEnemy.base_poise_level }}</td></tr>
              <tr v-if="selectedEnemy.freeze_time_resistance"><td>冻结时间抗性</td><td>{{ formatPercent(selectedEnemy.freeze_time_resistance) }}</td></tr>
              <tr v-if="selectedEnemy.base_buildup_coefficient"><td>基础积累系数</td><td>{{ selectedEnemy.base_buildup_coefficient }}</td></tr>
            </tbody>
          </table>
        </div>

        <!-- 失衡状态 -->
        <div v-if="selectedEnemy.can_stun && localEnemyIsStunned" class="mt-3">
          <div class="alert alert-warning">
            <span>⚠️ 敌人已失衡</span>
          </div>
        </div>
      </div>

      <div v-if="!localSelectedEnemyId" class="text-center text-gray-500 py-8">
        请选择敌人
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// Props
interface Props {
  availableEnemies: any[];
  selectedEnemyId: string;
  enemyIsStunned: boolean;
  enemyHasCorruptionShield: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  (e: 'enemy-select', enemyId: string): void;
  (e: 'enemy-stun-change', isStunned: boolean): void;
  (e: 'enemy-corruption-shield-change', hasShield: boolean): void;
}>();

// Local state
const localSelectedEnemyId = ref(props.selectedEnemyId);
const localEnemyIsStunned = ref(props.enemyIsStunned);
const localEnemyHasCorruptionShield = ref(props.enemyHasCorruptionShield);

// Watch for prop changes
watch(() => props.selectedEnemyId, (newValue) => {
  localSelectedEnemyId.value = newValue;
  if (!newValue) {
    localEnemyIsStunned.value = false;
    emit('enemy-stun-change', false);
  }
});

watch(() => props.enemyIsStunned, (newValue) => {
  localEnemyIsStunned.value = newValue;
});

watch(() => props.enemyHasCorruptionShield, (newValue) => {
  localEnemyHasCorruptionShield.value = newValue;
});

// Computed properties
const selectedEnemy = computed(() => {
  return props.availableEnemies.find(e => e.id === localSelectedEnemyId.value) || null;
});

// 如果选中的敌人不能失衡，则自动取消失衡状态
watch(
  () => selectedEnemy.value?.can_stun,
  (canStun) => {
    if (!canStun) {
      localEnemyIsStunned.value = false;
      emit('enemy-stun-change', false);
    }
  }
);

// 格式化数字
function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '0';
  return Math.round(value).toLocaleString();
}

// 格式化百分比
function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

// 获取抗性样式类
function getResistanceClass(value: number | undefined): string {
  if (!value) return '';
  if (value > 0) return 'text-error';
  if (value < 0) return 'text-success';
  return '';
}

// Methods
function handleEnemySelect() {
  emit('enemy-select', localSelectedEnemyId.value);
}

function handleEnemyStunChange() {
  emit('enemy-stun-change', localEnemyIsStunned.value);
}

function handleEnemyCorruptionShieldChange() {
  emit('enemy-corruption-shield-change', localEnemyHasCorruptionShield.value);
}
</script>

<style scoped>
.enemy-config-card {
  width: 100%;
}
</style>