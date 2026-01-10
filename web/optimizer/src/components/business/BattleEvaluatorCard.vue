<template>
  <div class="card bg-base-100 shadow-sm border border-base-200">
    <div class="card-body p-2">
      <div class="tabs tabs-border rounded-box p-2">
        <label class="tab">
          <input type="radio" name="battle_tabs_eval" checked="checked" />
          伤害期望
        </label>
        <div class="tab-content">
          <div class="divider text-xs font-bold text-base-content/50 my-2">伤害</div>
          <div class="grid grid-cols-4 gap-3">
            <div class="col-span-2 card bg-base-200/30 shadow">
              <div class="card-body p-4">
                <div class="font-bold text-sm text-primary">总伤害期望</div>
                <div class="font-bold font-mono text-3xl mt-1 text-primary">{{ debugData?.fastDamage?.toFixed(0) || '-' }}</div>
              </div>
            </div>
            <div class="col-span-2 card bg-base-200/30 shadow">
              <div class="card-body p-4">
                <div class="flex items-center gap-1.5">
                  <img v-if="elementIconUrl" :src="elementIconUrl" class="w-5 h-5" :alt="skillInfo?.element" />
                  <span class="font-bold">{{ skillInfo?.name || '-' }}</span>
                </div>
                <div class="flex flex-wrap gap-2 mt-2">
                  <div class="badge badge-primary">倍率 {{ ((skillInfo?.ratio || 0) * 100).toFixed(0) }}%</div>
                  <div class="badge badge-accent">积蓄 {{ skillInfo?.anomaly?.toFixed(0) || '0' }}</div>
                  <div v-if="skillInfo?.isPenetration" class="badge badge-warning">贯穿</div>
                </div>
              </div>
            </div>

            <div class="card bg-base-200/30 shadow">
              <div class="card-body p-3">
                <div class="text-xs text-base-content/50">直伤</div>
                <div class="font-bold font-mono text-lg">{{ debugData?.directDamage?.toFixed(0) || '-' }}</div>
              </div>
            </div>
            <div class="card bg-base-200/30 shadow">
              <div class="card-body p-3">
                <div class="text-xs text-base-content/50">异常</div>
                <div class="font-bold font-mono text-lg">{{ debugData?.anomalyDamage?.toFixed(0) || '-' }}</div>
              </div>
            </div>
            <div class="card bg-base-200/30 shadow">
              <div class="card-body p-3">
                <div class="text-xs text-base-content/50">紊乱</div>
                <div class="font-bold font-mono text-lg">{{ debugData?.disorderDamage?.toFixed(0) || '-' }}</div>
              </div>
            </div>
            <div class="card bg-base-200/30 shadow">
              <div class="card-body p-3">
                <div class="text-xs text-base-content/50">烈霜</div>
                <div class="font-bold font-mono text-lg">{{ (debugData?.lieshuangDamage ?? 0).toFixed(0) }}</div>
              </div>
            </div>
          </div>
        </div>

        <label class="tab">
          <input type="radio" name="battle_tabs_eval" />
          战斗面板
        </label>
        <div class="tab-content">
          <div class="divider text-xs font-bold text-base-content/50 my-2">面板</div>
          <div class="card bg-base-200/30 shadow w-full">
            <div class="card-body p-4">
              <PropertySetCard
                :property-collection="finalStatsPc"
                :final-stats="finalStatsPc.final"
                :no-card="true"
                default-active-tab="final"
              />
            </div>
          </div>

          <div class="divider text-xs font-bold text-base-content/50 my-2">BUFF</div>
          <div class="grid grid-cols-2 gap-3">
            <BuffCard :buff="mergedBuffCard" />
            <ConversionBuffCard :rules="debugRequest?.precomputed?.conversionBuffs || []" />
          </div>

          <div class="divider text-xs font-bold text-base-content/50 my-2">驱动盘</div>
          <div class="grid grid-cols-3 gap-3">
            <DriveDiskCard v-for="disc in equippedDiscs" :key="disc.id" :disk="disc" readonly />
          </div>

          <div v-if="isDev" class="mt-4">
            <div class="divider text-xs font-bold text-base-content/50 my-2">调试</div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div class="card bg-base-200/30 shadow w-full">
                <div class="card-body p-4">
                  <div class="font-bold text-sm">预计算底座属性（mergedStats，不含驱动盘）</div>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                    <div>ATK_BASE: <span class="font-mono">{{ debugData?.atkBase?.toFixed(0) || '-' }}</span></div>
                    <div>ATK: <span class="font-mono">{{ debugData?.atk?.toFixed(0) || '-' }}</span></div>
                    <div>ATK_: <span class="font-mono">{{ ((debugData?.atkPercent || 0) * 100).toFixed(1) }}%</span></div>
                    <div>CRIT_: <span class="font-mono">{{ ((debugData?.critRate || 0) * 100).toFixed(1) }}%</span></div>
                    <div>CRIT_DMG_: <span class="font-mono">{{ ((debugData?.critDmg || 0) * 100).toFixed(1) }}%</span></div>
                    <div>DMG_: <span class="font-mono">{{ ((debugData?.dmgBonus || 0) * 100).toFixed(1) }}%</span></div>
                    <div>PEN_: <span class="font-mono">{{ ((debugData?.penRate || 0) * 100).toFixed(1) }}%</span></div>
                    <div>异常精通: <span class="font-mono">{{ debugData?.anomalyProf?.toFixed(0) || '-' }}</span></div>
                  </div>
                </div>
              </div>

              <div class="card bg-base-200/30 shadow w-full">
                <div class="card-body p-4">
                  <div class="font-bold text-sm">快照对照</div>
                  <div class="text-xs text-base-content/60 mt-1">用于检查转换类 Buff 是否影响 ATK</div>
                  <div class="text-sm mt-2 space-y-1">
                    <div>底座攻击力（手算）: <span class="font-mono">{{ debugData?.finalAtkManual?.toFixed(0) || '-' }}</span></div>
                    <div>最终攻击力（转换后）: <span class="font-mono">{{ debugData?.finalAtk?.toFixed(0) || '-' }}</span></div>
                  </div>
                </div>
              </div>

              <div class="card bg-base-200/30 shadow w-full">
                <div class="card-body p-4">
                  <div class="font-bold text-sm">目标套装（Worker 复用输入）</div>
                  <div class="text-xs text-base-content/60 mt-1">2件套静态属性 + 4件套普通 Buff</div>
                  <div class="mt-3 space-y-3">
                    <div class="bg-base-100 rounded p-3">
                      <div class="font-bold text-sm">目标2件套（静态属性集）</div>
                      <div class="mt-2 text-sm space-y-1">
                        <div v-for="row in targetTwoPieceRows" :key="row.key">
                          {{ row.key }}: {{ row.value }}
                        </div>
                        <div v-if="targetTwoPieceRows.length === 0" class="opacity-60">（空）</div>
                      </div>
                    </div>
                    <BuffCard :buff="targetFourPieceBuffCard" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <label class="tab">
          <input type="radio" name="battle_tabs_eval" @change="onEnterZonesTab" />
          乘区
        </label>
        <div class="tab-content">
          <div class="divider text-xs font-bold text-base-content/50 my-2">乘区</div>
          <div class="grid grid-cols-1 gap-4">
            <div>
              <div class="divider text-xs font-bold text-base-content/50 my-2">直伤 / 贯穿</div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">基础区（直伤）</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.baseDamage?.toFixed(0) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">暴击区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.critZone?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div v-if="!skillInfo?.isPenetration" class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">防御区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.defMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div v-if="skillInfo?.isPenetration" class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">贯穿增伤区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.pierceDmgMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div v-if="skillInfo?.isPenetration" class="hidden md:block"></div>
                <div v-if="!skillInfo?.isPenetration" class="hidden md:block"></div>
              </div>
            </div>

            <div>
              <div class="divider text-xs font-bold text-base-content/50 my-2">通用</div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">增伤区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.dmgBonusZone?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">抗性区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.resMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">承伤区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.dmgTakenMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">失衡易伤区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.stunVulnMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">等级区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.levelMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="divider text-xs font-bold text-base-content/50 my-2">异常 / 紊乱 / 烈霜</div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">异常基础区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.baseAnomalyDamage?.toFixed(0) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">紊乱基础区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.baseDisorderDamage?.toFixed(0) || '-' }}</div>
                  </div>
                </div>
                <div v-if="(debugData?.baseLieshuangDamage ?? 0) > 0" class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">烈霜基础区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.baseLieshuangDamage?.toFixed(0) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">异常精通区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.anomalyProfMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">异常暴击区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.anomalyCritMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">异常增伤区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.anomalyDmgMult?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">积蓄区</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.accumulationZone?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
                <div class="card bg-base-200/30 shadow">
                  <div class="card-body p-3">
                    <div class="text-xs text-base-content/60">积蓄比例</div>
                    <div class="font-bold font-mono text-base">{{ debugData?.procsPerSkill?.toFixed(4) || '-' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FastEvaluator } from '../../optimizer/workers/fast-evaluator';
import { OptimizerContext } from '../../optimizer/services/optimizer-context';
import { PROP_IDX, IDX_TO_PROP_TYPE } from '../../optimizer/types/property-index';
import type { DiscData } from '../../optimizer/types/precomputed';
import type { Agent } from '../../model/agent';
import type { WEngine } from '../../model/wengine';
import type { DriveDisk } from '../../model/drive-disk';
import type { Enemy } from '../../model/enemy';
import type { Buff } from '../../model/buff';
import { ElementType, PropertyType } from '../../model/base';
import { PropertyCollection } from '../../model/property-collection';
import { iconService } from '../../services/icon.service';
import BuffCard from './BuffCard.vue';
import ConversionBuffCard from './ConversionBuffCard.vue';
import PropertySetCard from './PropertySetCard.vue';
import DriveDiskCard from './DriveDiskCard.vue';

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
  finalAtkManual: number;
  baseDamage: number;
  baseAnomalyDamage: number;
  baseDisorderDamage: number;
  baseLieshuangDamage?: number;
  anomalyProfMult: number;
  accumulationZone: number;
  procsPerSkill: number;
  directDamage: number;
  anomalyDamage: number;
  disorderDamage: number;
  lieshuangDamage: number;
  anomalyCritMult: number;
  anomalyDmgMult: number;
  pierceDmgMult: number;
  defMult: number;
  critZone: number;
  dmgBonusZone: number;
  resMult: number;
  dmgTakenMult: number;
  stunVulnMult: number;
  distanceMult: number;
  levelMult: number;
  resElementKey: string;
  enemyResUsed: number;
  totalResRedUsed: number;
  finalAtk3: number;
  finalHp3: number;
  finalDef3: number;
  finalImpact3: number;
  critRate3: number;
  critDmg3: number;
  dmg3: number;
  pen3: number;
  anomalyProf3: number;
  _finalStats3?: Float64Array;
}

interface DiscInfo {
  setName: string;
  mainStat: string;
  level: number;
  subStats: string;
}

const debugData = ref<DebugData | null>(null);
const discInfo = ref<DiscInfo[]>([]);
const debugRequest = ref<ReturnType<typeof OptimizerContext.buildFastRequest> | null>(null);
const onEnterZonesTab = () => runDebugCalc();
const isDev = import.meta.env.DEV;

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

const elementIconUrl = computed(() => {
  if (!props.agent) return '';
  return iconService.getElementIconUrl(props.agent.element);
});

const equippedDiscs = computed(() => {
  if (!props.agent) return [];
  return props.discs.filter(d => props.agent!.equipped_drive_disks.includes(d.id));
});

const finalStatsPc = computed(() => {
  const finalStats = (debugData.value as any)?._finalStats3 as Float64Array | undefined;
  if (!finalStats) return new PropertyCollection();
  return PropertyCollection.fromOptimizerFinalStatsArray(finalStats, IDX_TO_PROP_TYPE);
});

const mergedBuffCard = computed(() => {
  const merged = new Map<PropertyType, number>();
  const raw = debugRequest.value?.precomputed?.mergedBuff;
  if (raw) {
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (!v) continue;
      const prop = IDX_TO_PROP_TYPE[i];
      if (prop === undefined) continue;
      merged.set(prop, v);
    }
  }
  return {
    id: '__merged_buff__',
    name: '已激活的增益效果',
    description: '包含角色天赋、音擎、套装等所有已激活BUFF的属性加成',
    source: 0,
    max_stacks: 1,
    is_active: true,
    out_of_combat_stats: new Map(),
    in_combat_stats: merged,
    conversion: null,
  } as unknown as Buff;
});

const targetTwoPieceRows = computed(() => {
  const rows: { key: string; value: string }[] = [];
  const raw = debugRequest.value?.precomputed?.targetSetTwoPiece;
  if (!raw) return rows;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (!v) continue;
    const prop = IDX_TO_PROP_TYPE[i];
    if (prop === undefined) continue;
    rows.push({ key: PropertyType[prop] ?? String(prop), value: formatValue(prop, v) });
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows;
});

const targetFourPieceBuffCard = computed(() => {
  const merged = new Map<PropertyType, number>();
  const raw = debugRequest.value?.precomputed?.targetSetFourPieceBuff;
  if (raw) {
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (!v) continue;
      const prop = IDX_TO_PROP_TYPE[i];
      if (prop === undefined) continue;
      merged.set(prop, v);
    }
  }
  return {
    id: '__target_4pc_buff__',
    name: '目标4件套（普通BUFF）',
    description: 'Worker 初始化阶段预合并到 mergedBuff 合并表。',
    source: 0,
    max_stacks: 1,
    is_active: true,
    out_of_combat_stats: new Map(),
    in_combat_stats: merged,
    conversion: null,
  } as unknown as Buff;
});

const formatValue = (prop: PropertyType, value: number): string => {
  if (prop.toString().includes('_')) return `${(value * 100).toFixed(1)}%`;
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(4);
};

const runDebugCalc = () => {
  if (!props.agent || !props.enemy) return;

  const equipped = equippedDiscs.value;
  const sortedDiscs = [...equipped].sort((a, b) => a.position - b.position);
  discInfo.value = sortedDiscs.map(disc => ({
    setName: disc.set_name || '未知套装',
    mainStat: PropertyType[disc.main_stat] || '未知',
    level: disc.level,
    subStats: Array.from(disc.sub_stats?.entries() || []).map(([prop]) => `${PropertyType[prop]}`).join(', '),
  }));

  if (sortedDiscs.length !== 6) return;

  const setCount: Record<string, number> = {};
  for (const d of sortedDiscs) setCount[d.game_id] = (setCount[d.game_id] ?? 0) + 1;
  let targetSetId = '';
  for (const [setId, count] of Object.entries(setCount)) {
    if (count >= 4) { targetSetId = setId; break; }
  }

  const skillParams = [{
    id: 'battle-skill',
    name: props.skillName || '技能',
    element: props.agent.element,
    ratio: props.skillRatio,
    tags: [props.skillType || 'normal'],
    isPenetration: props.agent.isPenetrationAgent?.() || false,
    anomalyBuildup: props.skillAnomaly,
  }];

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
      targetSetId,
    },
    externalBuffs: props.externalBuffs || [],
    buffStatusMap: props.buffStatusMap,
  });
  debugRequest.value = request;

  const evaluator = new FastEvaluator(request.precomputed);
  const discDataArray: DiscData[] = [];
  for (let slot = 0; slot < 6; slot++) {
    const slotDiscs = request.precomputed.discsBySlot[slot];
    if (!slotDiscs || slotDiscs.length === 0) return;
    discDataArray.push(slotDiscs[0]);
  }

  const result = evaluator.calculateDamageWithMultipliers(discDataArray);
  if (result === null) return;

  const fullResult = evaluator.createFullResult(discDataArray, result.damage, result.multipliers);
  const baseStats = request.precomputed.mergedStats;

  const atkBase = baseStats[PROP_IDX.ATK_BASE];
  const atk = baseStats[PROP_IDX.ATK];
  const atkPercent = baseStats[PROP_IDX.ATK_];
  const critRate = baseStats[PROP_IDX.CRIT_];
  const critDmg = baseStats[PROP_IDX.CRIT_DMG_];
  const dmgBonus = baseStats[PROP_IDX.DMG_];
  const anomalyProf = baseStats[PROP_IDX.ANOM_PROF];
  const penRate = baseStats[PROP_IDX.PEN_];

  const { baseDirectDamage: finalAtkAfterConv, critZone, dmgBonus: dmgBonusZone } = fullResult.multipliers;
  const finalAtkManual = atkBase * (1 + atkPercent) + atk;
  const baseDamage = finalAtkAfterConv * props.skillRatio;
  const baseAnomalyDamage = finalAtkAfterConv * (request.precomputed.anomalyTotalRatioAtT ?? 0);
  const baseDisorderDamage = finalAtkAfterConv * (request.precomputed.disorderTotalRatioAtT ?? 0);
  const baseLieshuangDamage =
    request.precomputed.specialAnomalyConfig?.element === 'lieshuang'
      ? finalAtkAfterConv * (request.precomputed.specialAnomalyConfig?.ratio ?? 0)
      : undefined;

  const defMult = fullResult.defMult ?? 1;
  const fixed = evaluator.getFixedMultipliersSnapshot?.();
  const resMult = fixed?.resMult ?? 1;
  const dmgTakenMult = fixed?.dmgTakenMult ?? 1;
  const stunVulnMult = fixed?.stunVulnMult ?? 1;
  const distanceMult = fixed?.distanceMult ?? 1;
  const levelMult = fixed?.levelMult ?? 1;
  const resElementKey = fixed?.resElementKey ?? '';
  const enemyResUsed = fixed?.enemyResUsed ?? 0;
  const totalResRedUsed = fixed?.totalResRedUsed ?? 0;

  const finalStats3 = fullResult.finalStats;
  const directDamage = fullResult.breakdown?.direct ?? 0;
  const anomalyDamage = fullResult.breakdown?.anomaly ?? 0;
  const disorderDamage = fullResult.breakdown?.disorder ?? 0;
  const lieshuangDamage =
    request.precomputed.specialAnomalyConfig?.element === 'lieshuang'
      ? Math.max(0, fullResult.damage - directDamage - anomalyDamage - disorderDamage)
      : 0;

  const anomalyProfMult = fullResult.multipliers.anomalyProfMult ?? Math.max(0, Math.min(10, finalStats3[PROP_IDX.ANOM_PROF] / 100));
  const accumulationZone = fullResult.multipliers.accumulationZone ?? 1;
  const anomalyCritMult = fixed?.anomalyCritMult ?? 1;
  const anomalyDmgMult = fixed?.anomalyDmgMult ?? 1;
  const pierceDmgMult = 1 + (finalStats3[PROP_IDX.SHEER_DMG_] ?? 0);

  const threshold = request.precomputed.enemyStats?.anomaly_thresholds?.[resElementKey] ?? 1000;
  const buildupPerSkill = (props.skillAnomaly || 0) * accumulationZone;
  const procsPerSkill = threshold > 0 ? Math.max(0, Math.min(1, buildupPerSkill / threshold)) : 0;

  debugData.value = {
    agentName: props.agent.name_cn || props.agent.id,
    atkBase,
    atk,
    atkPercent,
    critRate,
    critDmg,
    dmgBonus: dmgBonusZone - 1,
    penRate,
    anomalyProf,
    fastDamage: fullResult.damage,
    uiDamage: props.uiDamage,
    ratio: props.uiDamage > 0 ? fullResult.damage / props.uiDamage : 0,
    finalAtk: finalAtkAfterConv,
    finalAtkManual,
    baseDamage,
    baseAnomalyDamage,
    baseDisorderDamage,
    baseLieshuangDamage,
    anomalyProfMult,
    accumulationZone,
    procsPerSkill,
    directDamage,
    anomalyDamage,
    disorderDamage,
    lieshuangDamage,
    anomalyCritMult,
    anomalyDmgMult,
    pierceDmgMult,
    defMult,
    critZone,
    dmgBonusZone,
    resMult,
    dmgTakenMult,
    stunVulnMult,
    distanceMult,
    levelMult,
    resElementKey,
    enemyResUsed,
    totalResRedUsed,
    finalAtk3: finalStats3[PROP_IDX.ATK],
    finalHp3: finalStats3[PROP_IDX.HP],
    finalDef3: finalStats3[PROP_IDX.DEF],
    finalImpact3: finalStats3[PROP_IDX.IMPACT],
    critRate3: finalStats3[PROP_IDX.CRIT_],
    critDmg3: finalStats3[PROP_IDX.CRIT_DMG_],
    dmg3: finalStats3[PROP_IDX.DMG_],
    pen3: finalStats3[PROP_IDX.PEN_],
    anomalyProf3: finalStats3[PROP_IDX.ANOM_PROF],
    _finalStats3: finalStats3,
  };
};

watch([() => props.agent, () => props.enemy, () => props.skillRatio, () => props.uiDamage], () => {
  runDebugCalc();
}, { immediate: true });

defineExpose({ runDebugCalc });
</script>

