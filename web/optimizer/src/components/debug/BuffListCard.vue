<template>
  <div class="buff-list-card card bg-base-200 shadow-xl">
    <div class="card-body">
      <!-- 标题和展开/收起按钮 -->
      <div 
        class="flex justify-between items-center cursor-pointer hover:bg-base-300 rounded-lg p-2 -m-2 transition-colors" 
        @click="emit('toggle-expand')"
      >
        <h3 class="card-title">Buff列表</h3>
        <button class="btn btn-ghost btn-sm">
          <span v-if="props.isExpanded">▼ 收起</span>
          <span v-else>▶ 展开</span>
        </button>
      </div>

      <!-- 展开内容 -->
      <div v-show="props.isExpanded" class="mt-4">
        <!-- 刷新按钮 -->
        <div class="flex justify-end mb-4">
          <button class="btn btn-sm btn-primary" @click="$emit('refresh-buffs')">
            刷新Buff列表
          </button>
        </div>
        
        <!-- 直接显示所有Buff -->
        <div v-if="props.allBuffs.length > 0" class="space-y-2">
          <div
            v-for="buff in props.allBuffs"
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
                    :disabled="!buff.isToggleable"
                    @change="handleToggleBuff('all', buff.id)"
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

        <!-- 无Buff提示 -->
        <div v-else class="text-center text-gray-500 py-8">
          暂无Buff数据
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Buff数据结构
interface BuffInfo {
  id: string;
  name: string;
  description: string;
  context: string;
  stats: Record<string, number>;
  target: any;
  isActive: boolean; // 是否激活
  isToggleable: boolean; // 是否可开关
}

// Props
interface Props {
  allBuffs: BuffInfo[];
  isExpanded: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  (e: 'toggle-expand'): void;
  (e: 'toggle-buff-active', buffListType: 'all', buffId: string): void;
  (e: 'refresh-buffs'): void;
}>();

// 处理Buff激活状态切换
function handleToggleBuff(buffListType: 'all', buffId: string) {
  emit('toggle-buff-active', buffListType, buffId);
}
</script>

<style scoped>
.buff-list-card {
  width: 100%;
}
</style>