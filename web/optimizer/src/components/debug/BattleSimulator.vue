<template>
  <div class="battle-simulator">
    <h2 class="text-2xl font-bold mb-4">战场模拟</h2>

    <!-- 角色选择区 -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h3 class="card-title">队伍配置</h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- 前台角色 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-bold text-primary">前台角色</span>
            </label>
            <select v-model="frontCharacterId" class="select select-bordered select-primary w-full">
              <option value="">请选择前台角色...</option>
              <option v-for="char in availableCharacters" :key="char.id" :value="char.id">
                {{ char.name }} (Lv.{{ char.level }})
              </option>
            </select>
          </div>

          <!-- 后台角色1 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-bold">后台角色1</span>
            </label>
            <select v-model="backCharacter1Id" class="select select-bordered w-full">
              <option value="">请选择后台角色...</option>
              <option
                v-for="char in availableCharacters"
                :key="char.id"
                :value="char.id"
                :disabled="char.id === frontCharacterId || char.id === backCharacter2Id"
              >
                {{ char.name }} (Lv.{{ char.level }})
              </option>
            </select>
          </div>

          <!-- 后台角色2 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-bold">后台角色2</span>
            </label>
            <select v-model="backCharacter2Id" class="select select-bordered w-full">
              <option value="">请选择后台角色...</option>
              <option
                v-for="char in availableCharacters"
                :key="char.id"
                :value="char.id"
                :disabled="char.id === frontCharacterId || char.id === backCharacter1Id"
              >
                {{ char.name }} (Lv.{{ char.level }})
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 敌人配置区 -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h3 class="card-title">敌人配置</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 敌人选择 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-bold">选择敌人 (Lv.70)</span>
            </label>
            <select v-model="selectedEnemyId" class="select select-bordered w-full">
              <option value="">请选择敌人...</option>
              <option v-for="enemy in availableEnemies" :key="enemy.id" :value="enemy.id">
                {{ enemy.CHS || enemy.EN }}
              </option>
            </select>
          </div>

          <!-- 失衡状态 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-bold">失衡状态</span>
            </label>
            <div class="flex items-center h-12">
              <label class="label cursor-pointer">
                <input
                  v-model="enemyIsStunned"
                  type="checkbox"
                  class="checkbox checkbox-primary"
                  :disabled="!selectedEnemyId || !selectedEnemy?.can_stun"
                />
                <span class="label-text ml-2">已失衡</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 敌人详情 -->
        <div v-if="selectedEnemy" class="mt-4 p-4 bg-base-100 rounded-lg">
          <h4 class="font-bold mb-3 text-lg">{{ selectedEnemy.CHS || selectedEnemy.EN }} (Lv.70)</h4>

          <!-- 基础属性 -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div class="stat bg-base-200 rounded p-3">
              <div class="stat-title text-xs">生命值</div>
              <div class="stat-value text-lg">{{ (selectedEnemy.level_70_max_hp || 0).toFixed(0) }}</div>
            </div>
            <div class="stat bg-base-200 rounded p-3">
              <div class="stat-title text-xs">攻击力</div>
              <div class="stat-value text-lg">{{ (selectedEnemy.level_70_max_atk || 0).toFixed(0) }}</div>
            </div>
            <div class="stat bg-base-200 rounded p-3">
              <div class="stat-title text-xs">防御力</div>
              <div class="stat-value text-lg">{{ (selectedEnemy.level_60_plus_defense || 0).toFixed(0) }}</div>
            </div>
            <div class="stat bg-base-200 rounded p-3">
              <div class="stat-title text-xs">失衡值</div>
              <div class="stat-value text-lg">
                {{ selectedEnemy.can_stun ? (selectedEnemy.level_70_max_stun || 0).toFixed(0) : '无法失衡' }}
              </div>
            </div>
          </div>

          <!-- 标签 -->
          <div v-if="selectedEnemy.tags" class="mb-3">
            <span class="text-sm font-semibold">标签: </span>
            <span class="text-sm">{{ selectedEnemy.tags }}</span>
          </div>

          <!-- 抗性列表 -->
          <div v-if="displayedResistances.length > 0">
            <span class="text-sm font-semibold">元素抗性: </span>
            <div class="flex flex-wrap gap-2 mt-2">
              <div
                v-for="res in displayedResistances"
                :key="res.name"
                class="badge"
                :class="{
                  'badge-error': res.value > 0,
                  'badge-success': res.value < 0,
                }"
              >
                {{ res.name }}: {{ res.value > 0 ? '+' : '' }}{{ (res.value * 100).toFixed(1) }}%
              </div>
            </div>
          </div>

          <!-- 失衡状态 -->
          <div v-if="selectedEnemy.can_stun && enemyIsStunned" class="mt-3">
            <div class="alert alert-warning">
              <span>⚠️ 敌人已失衡</span>
            </div>
          </div>
        </div>

        <div v-if="!selectedEnemyId" class="text-center text-gray-500 py-8">
          请选择敌人
        </div>
      </div>
    </div>

    <!-- 属性快照区 -->
    <div v-if="frontCharacterId" class="card bg-base-200 shadow-xl mt-6">
      <div class="card-body">
        <div class="flex justify-between items-center cursor-pointer hover:bg-base-300 rounded-lg p-2 -m-2 transition-colors" @click="isStatsSnapshotExpanded = !isStatsSnapshotExpanded">
          <h3 class="card-title">属性快照</h3>
          <button class="btn btn-ghost btn-sm">
            <span v-if="isStatsSnapshotExpanded">▼ 收起</span>
            <span v-else>▶ 展开</span>
          </button>
        </div>

        <div v-show="isStatsSnapshotExpanded" class="mt-4">
          <div v-if="combatStatsSnapshot" class="space-y-4">
            <!-- 基础属性 vs 最终属性对比 -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <!-- 局内基础属性 -->
              <div class="card bg-base-100">
                <div class="card-body p-4">
                  <h4 class="font-bold mb-3">局内基础属性</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-500">攻击力</span>
                      <span class="font-mono">{{ combatStatsSnapshot.base.atk.toFixed(1) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">生命值</span>
                      <span class="font-mono">{{ combatStatsSnapshot.base.hp.toFixed(0) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">防御力</span>
                      <span class="font-mono">{{ combatStatsSnapshot.base.def.toFixed(1) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">冲击力</span>
                      <span class="font-mono">{{ combatStatsSnapshot.base.impact.toFixed(1) }}</span>
                    </div>
                    <div class="divider my-2"></div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">暴击率</span>
                      <span class="font-mono">{{ (combatStatsSnapshot.base.critRate * 100).toFixed(2) }}%</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">暴击伤害</span>
                      <span class="font-mono">{{ (combatStatsSnapshot.base.critDmg * 100).toFixed(2) }}%</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">伤害加成</span>
                      <span class="font-mono">{{ (combatStatsSnapshot.base.dmgBonus * 100).toFixed(2) }}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 局内最终属性 -->
              <div class="card bg-primary text-primary-content">
                <div class="card-body p-4">
                  <h4 class="font-bold mb-3">局内最终属性</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between items-center">
                      <span>攻击力</span>
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold">{{ combatStatsSnapshot.final.atk.toFixed(1) }}</span>
                        <span v-if="combatStatsSnapshot.diff.atk > 0" class="badge badge-success badge-sm">
                          +{{ combatStatsSnapshot.diff.atk.toFixed(1) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>生命值</span>
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold">{{ combatStatsSnapshot.final.hp.toFixed(0) }}</span>
                        <span v-if="combatStatsSnapshot.diff.hp > 0" class="badge badge-success badge-sm">
                          +{{ combatStatsSnapshot.diff.hp.toFixed(0) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>防御力</span>
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold">{{ combatStatsSnapshot.final.def.toFixed(1) }}</span>
                        <span v-if="combatStatsSnapshot.diff.def > 0" class="badge badge-success badge-sm">
                          +{{ combatStatsSnapshot.diff.def.toFixed(1) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex justify-between items-center">
                      <span>冲击力</span>
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold">{{ combatStatsSnapshot.final.impact.toFixed(1) }}</span>
                        <span v-if="combatStatsSnapshot.diff.impact > 0" class="badge badge-success badge-sm">
                          +{{ combatStatsSnapshot.diff.impact.toFixed(1) }}
                        </span>
                      </div>
                    </div>
                    <div class="divider my-2"></div>
                    <div class="flex justify-between">
                      <span>暴击率</span>
                      <span class="font-mono font-bold">{{ (combatStatsSnapshot.final.critRate * 100).toFixed(2) }}%</span>
                    </div>
                    <div class="flex justify-between">
                      <span>暴击伤害</span>
                      <span class="font-mono font-bold">{{ (combatStatsSnapshot.final.critDmg * 100).toFixed(2) }}%</span>
                    </div>
                    <div class="flex justify-between">
                      <span>伤害加成</span>
                      <span class="font-mono font-bold">{{ (combatStatsSnapshot.final.dmgBonus * 100).toFixed(2) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Buff贡献详情 -->
            <div v-if="combatStatsSnapshot.buffContribution" class="card bg-base-100">
              <div class="card-body p-4">
                <h4 class="font-bold mb-3">Buff贡献</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div v-if="combatStatsSnapshot.buffContribution.atkPercent > 0" class="stat bg-base-200 rounded p-2">
                    <div class="stat-title text-xs">攻击力%</div>
                    <div class="stat-value text-sm text-success">+{{ (combatStatsSnapshot.buffContribution.atkPercent * 100).toFixed(1) }}%</div>
                  </div>
                  <div v-if="combatStatsSnapshot.buffContribution.atkFlat > 0" class="stat bg-base-200 rounded p-2">
                    <div class="stat-title text-xs">攻击力</div>
                    <div class="stat-value text-sm text-success">+{{ combatStatsSnapshot.buffContribution.atkFlat.toFixed(0) }}</div>
                  </div>
                  <div v-if="combatStatsSnapshot.buffContribution.critRate > 0" class="stat bg-base-200 rounded p-2">
                    <div class="stat-title text-xs">暴击率</div>
                    <div class="stat-value text-sm text-success">+{{ (combatStatsSnapshot.buffContribution.critRate * 100).toFixed(2) }}%</div>
                  </div>
                  <div v-if="combatStatsSnapshot.buffContribution.critDmg > 0" class="stat bg-base-200 rounded p-2">
                    <div class="stat-title text-xs">暴击伤害</div>
                    <div class="stat-value text-sm text-success">+{{ (combatStatsSnapshot.buffContribution.critDmg * 100).toFixed(2) }}%</div>
                  </div>
                  <div v-if="combatStatsSnapshot.buffContribution.dmgBonus > 0" class="stat bg-base-200 rounded p-2">
                    <div class="stat-title text-xs">伤害加成</div>
                    <div class="stat-value text-sm text-success">+{{ (combatStatsSnapshot.buffContribution.dmgBonus * 100).toFixed(2) }}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center text-gray-500 py-8">
            无法加载属性数据
          </div>
        </div>
      </div>
    </div>

    <!-- Buff列表区 -->
    <div v-if="frontCharacterId" class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="flex justify-between items-center cursor-pointer hover:bg-base-300 rounded-lg p-2 -m-2 transition-colors" @click="isBuffListExpanded = !isBuffListExpanded">
          <h3 class="card-title">Buff列表</h3>
          <button class="btn btn-ghost btn-sm">
            <span v-if="isBuffListExpanded">▼ 收起</span>
            <span v-else>▶ 展开</span>
          </button>
        </div>

        <div v-show="isBuffListExpanded" class="mt-4">
          <!-- 前台角色的Buff -->
          <div v-if="frontCharacterBuffs.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-3">
            <h4 class="text-lg font-bold text-primary">{{ frontCharacterName }}</h4>
            <span class="badge badge-primary">前台</span>
          </div>

          <div class="space-y-4">
            <!-- 角色自身Buff -->
            <div v-if="frontCharacterBuffs.find(b => b.source === 'character')">
              <h5 class="font-semibold mb-2">角色Buff</h5>
              <div class="space-y-2">
                <div
                  v-for="buff in frontCharacterBuffs.filter(b => b.source === 'character')"
                  :key="buff.id"
                  class="card bg-base-100 shadow-sm"
                  :class="{ 'opacity-50': !buff.isActive }"
                >
                  <div class="card-body p-3">
                    <div class="flex justify-between items-start gap-2">
                      <div class="flex-1">
                        <div class="font-semibold">{{ buff.name }}</div>
                        <div class="text-sm text-gray-500">{{ buff.description }}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="badge badge-sm">{{ buff.context }}</div>
                        <input
                          type="checkbox"
                          class="toggle toggle-sm toggle-success"
                          :checked="buff.isActive"
                          @change="toggleBuffActive(frontCharacterBuffs, buff.id)"
                        />
                      </div>
                    </div>
                    <div v-if="Object.keys(buff.stats).length > 0" class="mt-2 text-sm">
                      <div v-for="(value, key) in buff.stats" :key="key" class="text-accent">
                        {{ key }}: +{{ value }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 音擎Buff -->
            <div v-if="frontCharacterBuffs.find(b => b.source === 'weapon')">
              <h5 class="font-semibold mb-2">音擎Buff</h5>
              <div class="space-y-2">
                <div
                  v-for="buff in frontCharacterBuffs.filter(b => b.source === 'weapon')"
                  :key="buff.id"
                  class="card bg-base-100 shadow-sm"
                  :class="{ 'opacity-50': !buff.isActive }"
                >
                  <div class="card-body p-3">
                    <div class="flex justify-between items-start gap-2">
                      <div class="flex-1">
                        <div class="font-semibold">{{ buff.name }}</div>
                        <div class="text-sm text-gray-500">{{ buff.description }}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="badge badge-sm">{{ buff.context }}</div>
                        <input
                          type="checkbox"
                          class="toggle toggle-sm toggle-success"
                          :checked="buff.isActive"
                          @change="toggleBuffActive(frontCharacterBuffs, buff.id)"
                        />
                      </div>
                    </div>
                    <div v-if="Object.keys(buff.stats).length > 0" class="mt-2 text-sm">
                      <div v-for="(value, key) in buff.stats" :key="key" class="text-accent">
                        {{ key }}: +{{ value }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 驱动盘Buff -->
            <div v-if="frontCharacterBuffs.find(b => b.source === 'equipment')">
              <h5 class="font-semibold mb-2">驱动盘Buff</h5>
              <div class="space-y-2">
                <div
                  v-for="buff in frontCharacterBuffs.filter(b => b.source === 'equipment')"
                  :key="buff.id"
                  class="card bg-base-100 shadow-sm"
                  :class="{ 'opacity-50': !buff.isActive }"
                >
                  <div class="card-body p-3">
                    <div class="flex justify-between items-start gap-2">
                      <div class="flex-1">
                        <div class="font-semibold">{{ buff.name }}</div>
                        <div class="text-sm text-gray-500">{{ buff.description }}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="badge badge-sm">{{ buff.context }}</div>
                        <input
                          type="checkbox"
                          class="toggle toggle-sm toggle-success"
                          :checked="buff.isActive"
                          @change="toggleBuffActive(frontCharacterBuffs, buff.id)"
                        />
                      </div>
                    </div>
                    <div v-if="Object.keys(buff.stats).length > 0" class="mt-2 text-sm">
                      <div v-for="(value, key) in buff.stats" :key="key" class="text-accent">
                        {{ key }}: +{{ value }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 后台角色1的Buff -->
        <div v-if="backCharacter1Id && backCharacter1Buffs.length > 0" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <h4 class="text-lg font-bold">{{ backCharacter1Name }}</h4>
            <span class="badge">后台</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="buff in backCharacter1Buffs"
              :key="buff.id"
              class="card bg-base-100 shadow-sm"
              :class="{ 'opacity-50': !buff.isActive }"
            >
              <div class="card-body p-3">
                <div class="flex justify-between items-start gap-2">
                  <div class="flex-1">
                    <div class="font-semibold">{{ buff.name }} <span class="text-sm text-gray-500">({{ buff.sourceType }})</span></div>
                    <div class="text-sm text-gray-500">{{ buff.description }}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="badge badge-sm">{{ buff.context }}</div>
                    <input
                      type="checkbox"
                      class="toggle toggle-sm toggle-success"
                      :checked="buff.isActive"
                      @change="toggleBuffActive(backCharacter1Buffs, buff.id)"
                    />
                  </div>
                </div>
                <div v-if="Object.keys(buff.stats).length > 0" class="mt-2 text-sm">
                  <div v-for="(value, key) in buff.stats" :key="key" class="text-accent">
                    {{ key }}: +{{ value }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 后台角色2的Buff -->
        <div v-if="backCharacter2Id && backCharacter2Buffs.length > 0" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <h4 class="text-lg font-bold">{{ backCharacter2Name }}</h4>
            <span class="badge">后台</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="buff in backCharacter2Buffs"
              :key="buff.id"
              class="card bg-base-100 shadow-sm"
              :class="{ 'opacity-50': !buff.isActive }"
            >
              <div class="card-body p-3">
                <div class="flex justify-between items-start gap-2">
                  <div class="flex-1">
                    <div class="font-semibold">{{ buff.name }} <span class="text-sm text-gray-500">({{ buff.sourceType }})</span></div>
                    <div class="text-sm text-gray-500">{{ buff.description }}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="badge badge-sm">{{ buff.context }}</div>
                    <input
                      type="checkbox"
                      class="toggle toggle-sm toggle-success"
                      :checked="buff.isActive"
                      @change="toggleBuffActive(backCharacter2Buffs, buff.id)"
                    />
                  </div>
                </div>
                <div v-if="Object.keys(buff.stats).length > 0" class="mt-2 text-sm">
                  <div v-for="(value, key) in buff.stats" :key="key" class="text-accent">
                    {{ key }}: +{{ value }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!frontCharacterId" class="text-center text-gray-500 py-8">
          请先选择前台角色
        </div>
        </div>
      </div>
    </div>

    <!-- 技能列表区 -->
    <div v-if="frontCharacterId" class="card bg-base-200 shadow-xl mt-6">
      <div class="card-body">
        <div class="flex justify-between items-center cursor-pointer hover:bg-base-300 rounded-lg p-2 -m-2 transition-colors" @click="isSkillListExpanded = !isSkillListExpanded">
          <h3 class="card-title">技能列表</h3>
          <button class="btn btn-ghost btn-sm">
            <span v-if="isSkillListExpanded">▼ 收起</span>
            <span v-else>▶ 展开</span>
          </button>
        </div>

        <div v-show="isSkillListExpanded" class="mt-4">
          <div v-if="frontCharacterSkills && frontCharacterSkills.skills.size > 0" class="space-y-6">
          <!-- 技能类型分组显示 -->
          <div
            v-for="[skillName, skill] in Array.from(frontCharacterSkills.skills.entries())"
            :key="skillName"
            class="mb-4"
          >
            <h4 class="text-lg font-bold mb-3 text-primary">{{ skillName }}</h4>

            <!-- 技能段列表 -->
            <div class="space-y-2">
              <div
                v-for="(segment, index) in skill.segments"
                :key="index"
                class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div class="card-body p-4">
                  <div class="flex justify-between items-start gap-4">
                    <!-- 段名称 -->
                    <div class="flex-shrink-0">
                      <span class="font-semibold text-base">
                        {{ segment.segmentName || '单段' }}
                      </span>
                    </div>

                    <!-- 技能数据 -->
                    <div class="flex flex-wrap gap-2 justify-end">
                      <div class="badge badge-primary badge-lg">
                        伤害倍率: {{ (segment.damageRatio * 100).toFixed(1) }}%
                      </div>
                      <div class="badge badge-secondary badge-lg">
                        失衡倍率: {{ (segment.stunRatio * 100).toFixed(1) }}%
                      </div>
                      <div v-if="segment.energyRecovery > 0" class="badge badge-info badge-lg">
                        能量回复: {{ segment.energyRecovery }}
                      </div>
                      <div v-if="segment.anomalyBuildup > 0" class="badge badge-accent badge-lg">
                        异常积蓄: {{ segment.anomalyBuildup }}
                      </div>
                      <div v-if="segment.decibelRecovery > 0" class="badge badge-success badge-lg">
                        喧响值: {{ segment.decibelRecovery }}
                      </div>
                    </div>
                  </div>

                  <!-- 额外信息（如果有） -->
                  <div
                    v-if="
                      segment.flashEnergyAccumulation > 0 ||
                      segment.corruptionShieldReduction > 0 ||
                      segment.energyExtraCost > 0
                    "
                    class="mt-2 flex flex-wrap gap-2 text-sm"
                  >
                    <div v-if="segment.flashEnergyAccumulation > 0" class="text-gray-500">
                      闪能累积: {{ segment.flashEnergyAccumulation }}
                    </div>
                    <div v-if="segment.corruptionShieldReduction > 0" class="text-gray-500">
                      秽盾削减: {{ segment.corruptionShieldReduction }}
                    </div>
                    <div v-if="segment.energyExtraCost > 0" class="text-gray-500">
                      额外能量消耗: {{ segment.energyExtraCost }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="!frontCharacterSkills || frontCharacterSkills.skills.size === 0"
          class="text-center text-gray-500 py-8"
        >
          {{ frontCharacterId ? '未找到该角色的技能数据' : '请先选择前台角色' }}
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Ref } from 'vue';
import { useSaveStore } from '../../stores/save.store-simple';
import { useGameDataStore } from '../../stores/game-data.store';
import { dataLoaderService } from '../../services/data-loader.service';
import { Agent } from '../../model/agent';

const saveStore = useSaveStore();
const gameDataStore = useGameDataStore();

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

// 可用角色列表
const availableCharacters = computed(() => {
  return saveStore.characters.map(char => {
    const gameChar = gameDataStore.getCharacterByCode(char.key);
    return {
      id: char.id,
      name: gameChar?.CHS || char.key,
      level: char.level,
      zodData: char,
    };
  });
});

// 获取角色名称
const frontCharacterName = computed(() => {
  const char = availableCharacters.value.find(c => c.id === frontCharacterId.value);
  return char?.name || '';
});

const backCharacter1Name = computed(() => {
  const char = availableCharacters.value.find(c => c.id === backCharacter1Id.value);
  return char?.name || '';
});

const backCharacter2Name = computed(() => {
  const char = availableCharacters.value.find(c => c.id === backCharacter2Id.value);
  return char?.name || '';
});

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

// 前台角色的技能数据
const frontCharacterSkills = computed(() => {
  if (!frontCharacterId.value) return null;

  const char = availableCharacters.value.find(c => c.id === frontCharacterId.value);
  if (!char) return null;

  // 从gameDataStore获取角色名称
  const gameChar = gameDataStore.getCharacterByCode(char.zodData.key);
  const agentName = gameChar?.CHS || char.zodData.key;

  // 从dataLoaderService获取技能数据
  return dataLoaderService.getAgentSkills(agentName);
});

// 属性快照计算
const combatStatsSnapshot = computed(() => {
  if (!frontAgent.value) return null;

  // 直接获取战斗属性（包含基础属性+自身Buff）
  return frontAgent.value.getCombatStats();
});

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

// 加载角色的所有Buff
async function loadCharacterBuffs(characterId: string, isOnField: boolean): Promise<BuffInfo[]> {
  const char = availableCharacters.value.find(c => c.id === characterId);
  if (!char) return [];

  const buffs: BuffInfo[] = [];

  try {
    // 1. 加载角色自身的Buff
    const gameCharCode = char.zodData.key; // CodeName like "Anby"

    // 调试日志
    console.log(`查找角色: ${gameCharCode}`, char.zodData);

    // 从dataLoaderService直接查找ID
    // zodData.key对应的是EN字段，而不是code字段
    let gameCharId: string | null = null;
    const charMap = dataLoaderService.characterData;
    if (charMap) {
      for (const [id, data] of charMap.entries()) {
        // 先尝试匹配EN字段（zodData.key通常是EN名称）
        if (data.EN && data.EN.trim().toLowerCase() === gameCharCode.trim().toLowerCase()) {
          gameCharId = id;
          console.log(`通过EN字段匹配到: ${id}`, data);
          break;
        }
        // 如果EN不匹配，再尝试code字段
        if (data.code && data.code.trim().toLowerCase() === gameCharCode.trim().toLowerCase()) {
          gameCharId = id;
          console.log(`通过code字段匹配到: ${id}`, data);
          break;
        }
      }
    }

    if (!gameCharId) {
      console.error(`未找到角色ID: ${gameCharCode}`);
      console.log('可用的角色列表:', Array.from(charMap?.entries() || []).slice(0, 5).map(([id, data]) => ({
        id,
        code: data.code,
        EN: data.EN,
        CHS: data.CHS
      })));
      return [];
    }

    console.log(`加载角色Buff: ${gameCharCode}, ID: ${gameCharId}`);

    const charBuffData = await gameDataStore.getCharacterBuff(gameCharId);

      // 提取角色Buff
      const allCharBuffs = [
        ...(charBuffData.core_passive_buffs || []),
        ...(charBuffData.talent_buffs || []),
        ...(charBuffData.mindscape_buffs || []),
      ];

      for (const buff of allCharBuffs) {
        // 前台：只选择对自己生效的
        // 后台：只选择对队友或全体生效的
        const targetSelf = buff.target?.target_self || false;
        const targetTeammate = buff.target?.target_teammate || false;

        // 调试日志
        if (!isOnField) {
          console.log(`后台角色Buff: ${buff.name}`, {
            targetSelf,
            targetTeammate,
            target: buff.target
          });
        }

        if (isOnField && targetSelf) {
          buffs.push({
            id: buff.id,
            name: buff.name,
            description: buff.description || '',
            source: 'character',
            sourceType: '角色',
            context: buff.context || '',
            stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
            target: buff.target,
            isActive: true,
          });
        } else if (!isOnField && targetTeammate) {
          buffs.push({
            id: buff.id,
            name: buff.name,
            description: buff.description || '',
            source: 'character',
            sourceType: '角色',
            context: buff.context || '',
            stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
            target: buff.target,
            isActive: true,
          });
        }
      }

    // 2. 加载音擎Buff
    if (char.zodData.equippedWengine) {
      const wengine = saveStore.wengines.find(w => w.id === char.zodData.equippedWengine);
      if (wengine) {
        // 从dataLoaderService查找音擎ID
        let gameWengineId: string | null = null;
        const weaponMap = dataLoaderService.weaponData;
        if (weaponMap) {
          for (const [id, data] of weaponMap.entries()) {
            const normalized = wengine.key.replace(/[\s']/g, '').toLowerCase();
            const dataEN = (data.EN || '').replace(/[\s']/g, '').toLowerCase();
            if (data.EN === wengine.key || dataEN === normalized) {
              gameWengineId = id;
              break;
            }
          }
        }

        if (gameWengineId) {
          console.log(`加载音擎Buff: ${wengine.key}, ID: ${gameWengineId}`);
          const wengineBuffData = await gameDataStore.getWeaponBuff(gameWengineId);

          // 提取音擎Buff
          const allWengineBuffs = wengineBuffData.talents?.flatMap((t: any) => t.buffs || []) || [];

          for (const buff of allWengineBuffs) {
            const targetSelf = buff.target?.target_self || false;
            const targetTeammate = buff.target?.target_teammate || false;

            if (isOnField && targetSelf) {
              buffs.push({
                id: buff.id,
                name: buff.name,
                description: buff.description || '',
                source: 'weapon',
                sourceType: '音擎',
                context: buff.context || '',
                stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
                target: buff.target,
                isActive: true,
              });
            } else if (!isOnField && targetTeammate) {
              buffs.push({
                id: buff.id,
                name: buff.name,
                description: buff.description || '',
                source: 'weapon',
                sourceType: '音擎',
                context: buff.context || '',
                stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
                target: buff.target,
                isActive: true,
              });
            }
          }
        }
      }
    }

    // 3. 加载驱动盘Buff
    const equippedDiscs = char.zodData.equippedDiscs || {};
    const discSetKeys = new Set(Object.values(equippedDiscs).filter(Boolean));

    // 统计每个套装的数量
    const setCount: Record<string, number> = {};
    for (const setKey of discSetKeys) {
      setCount[setKey] = Object.values(equippedDiscs).filter(s => s === setKey).length;
    }

    for (const [setKey, count] of Object.entries(setCount)) {
      const gameEquip = gameDataStore.getEquipmentBySetKey(setKey);
      if (gameEquip) {
        const equipBuffData = await gameDataStore.getEquipmentBuff(gameEquip.id);

        // 2件套效果
        if (count >= 2 && equipBuffData.two_piece_buffs) {
          for (const buff of equipBuffData.two_piece_buffs) {
            const targetSelf = buff.target?.target_self || false;
            const targetTeammate = buff.target?.target_teammate || false;

            if (isOnField && targetSelf) {
              buffs.push({
                id: buff.id,
                name: buff.name,
                description: buff.description || '',
                source: 'equipment',
                sourceType: '驱动盘2件套',
                context: buff.context || '',
                stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
                target: buff.target,
                isActive: true,
              });
            } else if (!isOnField && targetTeammate) {
              buffs.push({
                id: buff.id,
                name: buff.name,
                description: buff.description || '',
                source: 'equipment',
                sourceType: '驱动盘2件套',
                context: buff.context || '',
                stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
                target: buff.target,
                isActive: true,
              });
            }
          }
        }

        // 4件套效果
        if (count >= 4 && equipBuffData.four_piece_buffs) {
          for (const buff of equipBuffData.four_piece_buffs) {
            const targetSelf = buff.target?.target_self || false;
            const targetTeammate = buff.target?.target_teammate || false;

            if (isOnField && targetSelf) {
              buffs.push({
                id: buff.id,
                name: buff.name,
                description: buff.description || '',
                source: 'equipment',
                sourceType: '驱动盘4件套',
                context: buff.context || '',
                stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
                target: buff.target,
                isActive: true,
              });
            } else if (!isOnField && targetTeammate) {
              buffs.push({
                id: buff.id,
                name: buff.name,
                description: buff.description || '',
                source: 'equipment',
                sourceType: '驱动盘4件套',
                context: buff.context || '',
                stats: { ...buff.out_of_combat_stats, ...buff.in_combat_stats },
                target: buff.target,
                isActive: true,
              });
            }
          }
        }
      }
    }

  } catch (err) {
    console.error('加载角色Buff失败:', err);
  }

  return buffs;
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
    frontCharacterBuffs.value = await loadCharacterBuffs(newId, true);
    
    // 创建Agent实例并计算基础属性
    const char = availableCharacters.value.find(c => c.id === newId);
    if (char) {
      try {
        frontAgent.value = await Agent.fromZodData(char.zodData, dataLoaderService);
      } catch (e) {
        console.error('Failed to create agent:', e);
        frontAgent.value = null;
      }
    }
  } else {
    frontCharacterBuffs.value = [];
    frontAgent.value = null;
  }
});

// 监听后台角色1变化
watch(backCharacter1Id, async (newId) => {
  if (newId) {
    backCharacter1Buffs.value = await loadCharacterBuffs(newId, false);
  } else {
    backCharacter1Buffs.value = [];
  }
});

// 监听后台角色2变化
watch(backCharacter2Id, async (newId) => {
  if (newId) {
    backCharacter2Buffs.value = await loadCharacterBuffs(newId, false);
  } else {
    backCharacter2Buffs.value = [];
  }
});

// 切换Buff激活状态
const toggleBuffActive = (buffList: Ref<BuffInfo[]>, buffId: string) => {
  const buff = buffList.value.find(b => b.id === buffId);
  if (buff) {
    buff.isActive = !buff.isActive;
  }
};
</script>

<style scoped>
.battle-simulator {
  width: 100%;
}
</style>
