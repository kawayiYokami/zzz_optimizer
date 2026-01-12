<template>
  <div class="buff-list-card card bg-base-200 shadow-xl">
    <div class="card-body">
      <div class="flex justify-between items-center cursor-pointer hover:bg-base-300 rounded-lg p-2 -m-2 transition-colors" @click="emit('toggle-expand')">
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
                          @change="handleToggleBuffActive('front', buff.id)"
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
                          @change="handleToggleBuffActive('front', buff.id)"
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
                          @change="handleToggleBuffActive('front', buff.id)"
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
        <div v-if="backCharacter1Buffs.length > 0" class="mb-6">
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
                      @change="handleToggleBuffActive('back1', buff.id)"
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
        <div v-if="backCharacter2Buffs.length > 0" class="mb-6">
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
                      @change="handleToggleBuffActive('back2', buff.id)"
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

        <div v-if="!frontCharacterBuffs.length && !backCharacter1Buffs.length && !backCharacter2Buffs.length" class="text-center text-gray-500 py-8">
          暂无Buff数据
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

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

// Props
interface Props {
  frontCharacterBuffs: BuffInfo[];
  backCharacter1Buffs: BuffInfo[];
  backCharacter2Buffs: BuffInfo[];
  frontCharacterName: string;
  backCharacter1Name: string;
  backCharacter2Name: string;
  frontCharacterId: string;
  backCharacter1Id: string;
  backCharacter2Id: string;
  isExpanded: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  (e: 'toggle-expand'): void;
  (e: 'toggle-buff-active', buffListType: 'front' | 'back1' | 'back2', buffId: string): void;
}>();

// Local state
const isBuffListExpanded = ref<boolean>(props.isExpanded);

// Methods
function handleToggleBuffActive(buffListType: 'front' | 'back1' | 'back2', buffId: string) {
  emit('toggle-buff-active', buffListType, buffId);
}
</script>

<style scoped>
.buff-list-card {
  width: 100%;
}
</style>