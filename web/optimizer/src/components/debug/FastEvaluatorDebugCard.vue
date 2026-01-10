<template>
  <div class="card bg-base-100 shadow-xl border-2 border-warning">
    <div class="card-body">
      <h2 class="card-title text-warning">FastEvaluator 调试</h2>

      <!-- 计算结果对比 -->
      <div class="stats stats-horizontal shadow mb-4">
        <div class="stat">
          <div class="stat-title">FastEvaluator</div>
          <div class="stat-value text-error text-2xl">{{ debugData?.fastDamage?.toFixed(0) || '-' }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">UI 显示</div>
          <div class="stat-value text-success text-2xl">{{ debugData?.uiDamage?.toFixed(0) || '-' }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">差异倍数</div>
          <div class="stat-value text-warning text-2xl">{{ debugData?.ratio?.toFixed(2) || '-' }}x</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- 左侧 -->
        <div class="space-y-4">
          <!-- 目标技能信息 -->
          <div class="bg-base-200 p-3 rounded">
            <h3 class="font-bold text-primary mb-2">目标技能</h3>
            <div class="text-sm space-y-1">
              <div>名称: {{ skillInfo?.name || '-' }}</div>
              <div>类型: {{ skillInfo?.type || '-' }}</div>
              <div>倍率: {{ ((skillInfo?.ratio || 0) * 100).toFixed(0) }}%</div>
              <div>异常积蓄: {{ skillInfo?.anomaly?.toFixed(0) || '0' }}</div>
              <div>元素: {{ skillInfo?.element || '-' }}</div>
              <div>是否贯穿: {{ skillInfo?.isPenetration ? '是' : '否' }}</div>
            </div>
          </div>

          <!-- 敌人信息 -->
          <div class="bg-base-200 p-3 rounded">
            <h3 class="font-bold text-primary mb-2">敌人信息</h3>
            <div class="text-sm space-y-1">
              <div>名称: {{ enemyInfo?.name || '-' }}</div>
              <div>等级: {{ enemyInfo?.level || '-' }}</div>
              <div>防御: {{ enemyInfo?.defense?.toFixed(0) || '-' }}</div>
              <div>物理抗性: {{ ((enemyInfo?.physicalRes || 0) * 100).toFixed(0) }}%</div>
              <div>火抗性: {{ ((enemyInfo?.fireRes || 0) * 100).toFixed(0) }}%</div>
              <div>冰抗性: {{ ((enemyInfo?.iceRes || 0) * 100).toFixed(0) }}%</div>
              <div>雷抗性: {{ ((enemyInfo?.electricRes || 0) * 100).toFixed(0) }}%</div>
              <div>以太抗性: {{ ((enemyInfo?.etherRes || 0) * 100).toFixed(0) }}%</div>
              <div>是否失衡: {{ enemyInfo?.isStunned ? '是' : '否' }}</div>
            </div>
          </div>
        </div>

        <!-- 右侧 -->
        <div class="space-y-4">
          <!-- 角色属性 -->
          <div class="bg-base-200 p-3 rounded">
            <h3 class="font-bold text-primary mb-2">最终属性 (含驱动盘)</h3>
            <div class="text-sm space-y-1">
              <div>角色: {{ debugData?.agentName || '-' }}</div>
              <div>ATK_BASE: {{ debugData?.atkBase?.toFixed(0) || '-' }}</div>
              <div>ATK: {{ debugData?.atk?.toFixed(0) || '-' }}</div>
              <div>ATK_: {{ ((debugData?.atkPercent || 0) * 100).toFixed(1) }}%</div>
              <div>CRIT_: {{ ((debugData?.critRate || 0) * 100).toFixed(1) }}%</div>
              <div>CRIT_DMG_: {{ ((debugData?.critDmg || 0) * 100).toFixed(1) }}%</div>
              <div>DMG_: {{ ((debugData?.dmgBonus || 0) * 100).toFixed(1) }}%</div>
              <div>PEN_: {{ ((debugData?.penRate || 0) * 100).toFixed(1) }}%</div>
              <div>异常精通: {{ debugData?.anomalyProf?.toFixed(0) || '-' }}</div>
            </div>
          </div>

          <!-- 计算中间值 -->
          <div class="bg-base-200 p-3 rounded">
            <h3 class="font-bold text-primary mb-2">FastEvaluator 乘区</h3>
            <div class="text-sm space-y-1">
              <div>finalAtk (转换后): {{ debugData?.finalAtk?.toFixed(0) || '-' }}</div>
              <div>finalAtk (手动): {{ debugData?.finalAtkManual?.toFixed(0) || '-' }}</div>
              <div>baseDamage: {{ debugData?.baseDamage?.toFixed(0) || '-' }}</div>
              <div>defMult: {{ debugData?.defMult?.toFixed(4) || '-' }}</div>
              <div>critZone: {{ debugData?.critZone?.toFixed(4) || '-' }}</div>
              <div>dmgBonusZone: {{ debugData?.dmgBonusZone?.toFixed(4) || '-' }}</div>
              <div>resMult: {{ debugData?.resMult?.toFixed(4) || '-' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 激活的 BUFF -->
      <div class="bg-base-200 p-3 rounded mt-4">
        <h3 class="font-bold text-primary mb-2">激活的 BUFF ({{ activeBuffs.length }}个)</h3>
        <div class="text-xs max-h-40 overflow-y-auto">
          <div v-if="activeBuffs.length === 0" class="text-gray-500">无激活的 BUFF</div>
          <div v-for="buff in activeBuffs" :key="buff.id" class="flex justify-between border-b border-base-300 py-1">
            <span>{{ buff.name }}</span>
            <span class="text-gray-500">{{ formatBuffStats(buff) }}</span>
          </div>
        </div>
      </div>

      <!-- 当前驱动盘 -->
      <div class="bg-base-200 p-3 rounded mt-4">
        <h3 class="font-bold text-primary mb-2">当前驱动盘</h3>
        <div class="grid grid-cols-6 gap-2">
          <div v-for="(disc, idx) in discInfo" :key="idx" class="text-xs bg-base-300 p-2 rounded">
            <div class="font-bold">{{ idx + 1 }}号位</div>
            <div class="truncate text-primary">{{ disc.setName }}</div>
            <div>主: {{ disc.mainStat }}</div>
            <div>Lv.{{ disc.level }}</div>
            <div class="text-gray-500 truncate">{{ disc.subStats }}</div>
          </div>
        </div>
      </div>

      <div class="card-actions justify-end mt-4">
        <button class="btn btn-warning btn-sm" @click="runDebugCalc">
          重新计算
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { FastEvaluator } from '../../optimizer/workers/fast-evaluator';
import { OptimizerContext } from '../../optimizer/services/optimizer-context';
import { PROP_IDX } from '../../optimizer/types/property-index';
import type { DiscData } from '../../optimizer/types/precomputed';
import type { Agent } from '../../model/agent';
import type { WEngine } from '../../model/wengine';
import type { DriveDisk } from '../../model/drive-disk';
import type { Enemy } from '../../model/enemy';
import type { Buff } from '../../model/buff';
import { ElementType, PropertyType } from '../../model/base';

const props = defineProps<{
  agent: Agent | null;
  weapon: WEngine | null;
  enemy: Enemy | null;
  discs: DriveDisk[];
  skillRatio: number;
  skillAnomaly: number;
  skillName?: string;
  skillType?: string;
  uiDamage: number;
  externalBuffs?: Buff[];
  buffStatusMap?: Map<string, { isActive: boolean }>;
}>();

interface DebugData {
  agentName: string;
  atkBase: number;
  atk: number;
  atkPercent: number;
  critRate: number;
  critDmg: number;
  dmgBonus: number;
  penRate: number;
  anomalyProf: number;
  fastDamage: number;
  uiDamage: number;
  ratio: number;
  finalAtk: number;
  baseDamage: number;
  defMult: number;
  critZone: number;
  dmgBonusZone: number;
  resMult: number;
}

interface DiscInfo {
  setName: string;
  mainStat: string;
  level: number;
  subStats: string;
}

const debugData = ref<DebugData | null>(null);
const discInfo = ref<DiscInfo[]>([]);

// 技能信息
const skillInfo = computed(() => {
  if (!props.agent) return null;
  return {
    name: props.skillName || '未知技能',
    type: props.skillType || 'normal',
    ratio: props.skillRatio,
    anomaly: props.skillAnomaly,
    element: ElementType[props.agent.element] || 'PHYSICAL',
    isPenetration: props.agent.isPenetrationAgent?.() || false,
  };
});

// 敌人信息
const enemyInfo = computed(() => {
  if (!props.enemy) return null;
  return {
    name: props.enemy.name_cn || props.enemy.id,
    level: 60,
    defense: props.enemy.defense,
    physicalRes: props.enemy.physical_dmg_resistance,
    fireRes: props.enemy.fire_dmg_resistance,
    iceRes: props.enemy.ice_dmg_resistance,
    electricRes: props.enemy.electric_dmg_resistance,
    etherRes: props.enemy.ether_dmg_resistance,
    isStunned: false,
  };
});

// 激活的 BUFF
const activeBuffs = computed(() => {
  const buffs: Buff[] = [];

  // 角色自身 Buff
  if (props.agent) {
    const agentBuffs = props.agent.getAllBuffsSync?.() || [];
    for (const buff of agentBuffs) {
      if (isBuffActive(buff)) {
        buffs.push(buff);
      }
    }
  }

  // 武器 Buff
  if (props.weapon) {
    const weaponBuffs = props.weapon.getActiveBuffs?.() || [];
    for (const buff of weaponBuffs) {
      if (isBuffActive(buff)) {
        buffs.push(buff);
      }
    }
  }

  // 外部 Buff
  if (props.externalBuffs) {
    for (const buff of props.externalBuffs) {
      if (isBuffActive(buff)) {
        buffs.push(buff);
      }
    }
  }

  return buffs;
});

const isBuffActive = (buff: Buff): boolean => {
  if (props.buffStatusMap) {
    const status = props.buffStatusMap.get(buff.id);
    if (status) {
      return status.isActive;
    }
  }
  return buff.is_active;
};

const formatBuffStats = (buff: Buff): string => {
  const parts: string[] = [];

  if (buff.out_of_combat_stats) {
    for (const [prop, value] of buff.out_of_combat_stats.entries()) {
      parts.push(`${PropertyType[prop]}:${formatValue(prop, value)}`);
    }
  }
  if (buff.in_combat_stats) {
    for (const [prop, value] of buff.in_combat_stats.entries()) {
      parts.push(`${PropertyType[prop]}:${formatValue(prop, value)}`);
    }
  }

  return parts.slice(0, 3).join(', ') + (parts.length > 3 ? '...' : '');
};

const formatValue = (prop: PropertyType, value: number): string => {
  // 百分比属性
  if (prop.toString().includes('_')) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(0);
};

const runDebugCalc = () => {
  if (!props.agent || !props.enemy) {
    console.warn('[FastEvaluatorDebug] Missing agent or enemy');
    return;
  }

  // 获取当前角色装备的驱动盘
  const equippedDiscs = props.discs.filter(d =>
    props.agent!.equipped_drive_disks.includes(d.id)
  );

  // 更新驱动盘信息显示
  const sortedDiscs = [...equippedDiscs].sort((a, b) => a.position - b.position);
  discInfo.value = sortedDiscs.map(disc => ({
    setName: disc.set_name || '未知套装',
    mainStat: PropertyType[disc.main_stat] || '未知',
    level: disc.level,
    subStats: Array.from(disc.sub_stats?.entries() || [])
      .map(([prop, val]) => `${PropertyType[prop]}`)
      .join(', '),
  }));

  if (equippedDiscs.length !== 6) {
    console.warn('[FastEvaluatorDebug] Not all 6 discs equipped, got:', equippedDiscs.length);
    return;
  }

  // 构建技能参数
  const skillParams = [{
    id: 'debug-skill',
    name: props.skillName || '调试技能',
    element: ElementType[props.agent.element]?.toLowerCase() || 'physical',
    ratio: props.skillRatio,
    tags: [props.skillType || 'normal'],
    isPenetration: props.agent.isPenetrationAgent?.() || false,
    anomalyBuildup: props.skillAnomaly,
  }];

  console.log('[FastEvaluatorDebug] === 开始调试计算 ===');
  console.log('[FastEvaluatorDebug] 技能参数:', skillParams);

  // 构建预计算请求
  const request = OptimizerContext.buildFastRequest({
    agent: props.agent,
    weapon: props.weapon,
    skills: skillParams,
    enemy: props.enemy,
    discs: sortedDiscs,
    constraints: {
      mainStatFilters: {},
      requiredSets: [],
      pinnedSlots: {},
      setMode: 'any',
      selectedWeaponIds: [],
      activeDiskSets: [],
    },
    externalBuffs: props.externalBuffs || [],
    buffStatusMap: props.buffStatusMap,
  });

  console.log('[FastEvaluatorDebug] 预计算 agentStats:', request.precomputed.agentStats);
  console.log('[FastEvaluatorDebug] 预计算 skillsParams:', request.precomputed.skillsParams);
  console.log('[FastEvaluatorDebug] 预计算 fixedMultipliers:', request.precomputed.fixedMultipliers);

  // 创建评估器
  const evaluator = new FastEvaluator(request.precomputed);

  // 构建 DiscData 数组 - 确保每个槽位都有盘
  const discDataArray: DiscData[] = [];
  for (let slot = 0; slot < 6; slot++) {
    const slotDiscs = request.precomputed.discsBySlot[slot];
    if (!slotDiscs || slotDiscs.length === 0) {
      console.warn(`[FastEvaluatorDebug] 槽位 ${slot + 1} 没有驱动盘，跳过调试计算`);
      return;
    }
    discDataArray.push(slotDiscs[0]);
  }

  if (discDataArray.length !== 6) {
    console.warn('[FastEvaluatorDebug] discDataArray length:', discDataArray.length);
    return;
  }

  // 计算伤害
  const result = evaluator.calculateDamageWithMultipliers(discDataArray);

  // 目标盘数不足4，跳过
  if (result === null) {
    console.warn('[FastEvaluatorDebug] 目标盘数不足4，跳过调试计算');
    return;
  }

  const fullResult = evaluator.createFullResult(discDataArray, result.damage, result.multipliers);

  console.log('[FastEvaluatorDebug] calculateDamageWithMultipliers 结果:', result);
  console.log('[FastEvaluatorDebug] createFullResult 结果:', fullResult);

  // 从 finalStats 提取最终属性（包含驱动盘 + 套装）
  const finalStats = fullResult.finalStats;
  const atkBase = finalStats[PROP_IDX.ATK_BASE];
  const atk = finalStats[PROP_IDX.ATK];
  const atkPercent = finalStats[PROP_IDX.ATK_];
  const critRate = finalStats[PROP_IDX.CRIT_];
  const critDmg = finalStats[PROP_IDX.CRIT_DMG_];
  const dmgBonus = finalStats[PROP_IDX.DMG_];
  const anomalyProf = finalStats[PROP_IDX.ANOM_PROF];
  const penRate = finalStats[PROP_IDX.PEN_];

  // 使用 FastEvaluator 返回的实际乘区值
  const { baseDirectDamage: finalAtkAfterConv, critZone, dmgBonus: dmgBonusZone } = fullResult.multipliers;

  // 手动计算的 finalAtk（用于对比）
  const finalAtkManual = atkBase * (1 + atkPercent) + atk;
  const baseDamage = finalAtkAfterConv * props.skillRatio;
  const levelBase = props.agent.level * 10 + 100;
  const effectiveDef = props.enemy.defense * (1 - penRate);
  const defMult = levelBase / (effectiveDef + levelBase);
  const resMult = request.precomputed.fixedMultipliers.resMult;

  debugData.value = {
    agentName: props.agent.name_cn || props.agent.id,
    atkBase,
    atk,
    atkPercent,
    critRate,
    critDmg,
    dmgBonus: dmgBonusZone - 1, // 还原为增伤百分比
    penRate,
    anomalyProf,
    fastDamage: fullResult.damage,
    uiDamage: props.uiDamage,
    ratio: props.uiDamage > 0 ? fullResult.damage / props.uiDamage : 0,
    finalAtk: finalAtkAfterConv, // 使用转换后的最终攻击力
    finalAtkManual, // 手动计算的（用于对比转换Buff影响）
    baseDamage,
    defMult,
    critZone,
    dmgBonusZone,
    resMult,
  };

  console.log('[FastEvaluatorDebug] 调试数据:', debugData.value);
  console.log('[FastEvaluatorDebug] === 调试计算完成 ===');
};

// 监听属性变化自动重算
watch([() => props.agent, () => props.enemy, () => props.skillRatio, () => props.uiDamage], () => {
  runDebugCalc();
}, { immediate: true });

defineExpose({ runDebugCalc });
</script>
