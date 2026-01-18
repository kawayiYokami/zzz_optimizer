<template>
  <div class="max-w-4xl mx-auto">
    <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      <!-- Enemy Avatar Buttons -->
      <button
        v-for="enemy in enemies"
        :key="enemy.id"
        class="relative aspect-square rounded-lg overflow-hidden bg-base-200 hover:ring-2 hover:ring-primary hover:scale-105 transition-all"
        @click="$emit('select', enemy.id)"
        :title="enemy.full_name"
      >
        <img
          :src="iconService.getEnemyIconById(enemy.id)"
          :alt="enemy.full_name"
          class="w-full h-full object-cover"
        />
        <div v-if="enemy.isBoss" class="absolute top-0 right-0 badge badge-xs badge-error">首领</div>
        <div v-if="enemy.isElite" class="absolute top-0 right-0 badge badge-xs badge-warning">精英</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameDataStore } from '../../stores/game-data.store';
import { Enemy } from '../../model/enemy';
import { iconService } from '../../services/icon.service';

const emit = defineEmits<{
  select: [enemyId: string];
}>();

const gameDataStore = useGameDataStore();

const enemies = computed(() => {
  const enemyInfos = gameDataStore.allEnemies || [];
  console.log('[EnemyList] 原始敌人数量:', enemyInfos.length);
  
  const mappedEnemies = enemyInfos.map(info => Enemy.fromGameData(info));
  console.log('[EnemyList] 映射后敌人数量:', mappedEnemies.length);
  
  // 过滤：只保留失衡异常倍率不为0且有图标的敌人
  const filteredEnemies = mappedEnemies.filter(enemy => {
    if (enemy.stun_vulnerability_multiplier === 0) return false;
    // 过滤掉没有图标的敌人
    if (!iconService.hasEnemyIcon(enemy.id)) return false;
    return true;
  });
  
  // 去重：同名只保留最后一个
  const nameMap = new Map<string, Enemy>();
  for (const enemy of filteredEnemies) {
    nameMap.set(enemy.full_name, enemy);
  }
  
  return Array.from(nameMap.values());
});
</script>