<template>
  <div class="game-wiki">
    <h2 class="text-2xl font-bold mb-4">游戏 WIKI</h2>

    <!-- 全局控制 -->
    <div class="form-control mb-4">
      <label class="label cursor-pointer justify-start gap-2">
        <input type="checkbox" v-model="showAll" class="checkbox checkbox-primary" />
        <span class="label-text">显示全部数据（可能较慢）</span>
      </label>
    </div>

    <!-- 角色列表 -->
    <div class="mb-6">
      <h3 class="text-xl font-semibold mb-2">角色 ({{ characters.length }})</h3>
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>中文名</th>
              <th>英文名</th>
              <th>稀有度</th>
              <th>元素</th>
              <th>武器</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="char in displayedCharacters" :key="char.id">
              <td>{{ char.id }}</td>
              <td>{{ char.CHS }}</td>
              <td>{{ char.EN }}</td>
              <td>{{ char.rank }}</td>
              <td>{{ char.element }}</td>
              <td>{{ char.type }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!showAll && characters.length > 20" class="text-sm text-gray-500 mt-2">
          显示前 20 个，共 {{ characters.length }} 个角色 - <a @click="showAll = true" class="link link-primary">显示全部</a>
        </div>
      </div>
    </div>

    <!-- 音擎列表 -->
    <div class="mb-6">
      <h3 class="text-xl font-semibold mb-2">音擎 ({{ weapons.length }})</h3>
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>中文名</th>
              <th>英文名</th>
              <th>稀有度</th>
              <th>武器类型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="weapon in displayedWeapons" :key="weapon.id">
              <td>{{ weapon.id }}</td>
              <td>{{ weapon.CHS }}</td>
              <td>{{ weapon.EN }}</td>
              <td>{{ weapon.rank }}</td>
              <td>{{ weapon.type }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!showAll && weapons.length > 20" class="text-sm text-gray-500 mt-2">
          显示前 20 个，共 {{ weapons.length }} 个音擎 - <a @click="showAll = true" class="link link-primary">显示全部</a>
        </div>
      </div>
    </div>

    <!-- 驱动盘套装列表 -->
    <div class="mb-6">
      <h3 class="text-xl font-semibold mb-2">驱动盘套装 ({{ equipments.length }})</h3>
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>中文名</th>
              <th>英文名</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="equip in displayedEquipments" :key="equip.id">
              <td>{{ equip.id }}</td>
              <td>{{ equip.CHS?.name || '-' }}</td>
              <td>{{ equip.EN?.name || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!showAll && equipments.length > 20" class="text-sm text-gray-500 mt-2">
          显示前 20 个，共 {{ equipments.length }} 个套装 - <a @click="showAll = true" class="link link-primary">显示全部</a>
        </div>
      </div>
    </div>

    <!-- 邦布列表 -->
    <div class="mb-6">
      <h3 class="text-xl font-semibold mb-2">邦布 ({{ bangboos.length }})</h3>
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>中文名</th>
              <th>60级攻击力</th>
              <th>60级生命值</th>
              <th>冲击力</th>
              <th>异常掌控</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bangboo in bangboos" :key="bangboo.id">
              <td>{{ bangboo.id }}</td>
              <td>{{ bangboo.CHS || '-' }}</td>
              <td>{{ Math.round(bangboo.level_60_atk) }}</td>
              <td>{{ Math.round(bangboo.level_60_hp) }}</td>
              <td>{{ Math.round(bangboo.impact) }}</td>
              <td>{{ Math.round(bangboo.anomaly_mastery) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 敌人列表 -->
    <div class="mb-6">
      <h3 class="text-xl font-semibold mb-2">敌人 ({{ enemies.length }})</h3>
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>完整名称</th>
              <th>代号</th>
              <th>生命值</th>
              <th>攻击力</th>
              <th>防御力</th>
              <th>失衡值上限</th>
              <th>标签</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="enemy in displayedEnemies" :key="enemy.id">
              <td>{{ enemy.id }}</td>
              <td>{{ enemy.full_name || '-' }}</td>
              <td>{{ enemy.code_name || '-' }}</td>
              <td>{{ Math.round(enemy.hp) }}</td>
              <td>{{ Math.round(enemy.atk) }}</td>
              <td>{{ Math.round(enemy.defense) }}</td>
              <td>{{ Math.round(enemy.stun_max) }}</td>
              <td class="text-xs">{{ enemy.tags || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!showAll && enemies.length > 50" class="text-sm text-gray-500 mt-2">
          显示前 50 个，共 {{ enemies.length }} 个敌人 - <a @click="showAll = true" class="link link-primary">显示全部</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameDataStore } from '../../stores/game-data.store';

const gameDataStore = useGameDataStore();
const showAll = ref(false);

const characters = computed(() => {
  return gameDataStore.getAllCharacters();
});

const weapons = computed(() => {
  return gameDataStore.getAllWeapons();
});

const equipments = computed(() => {
  return gameDataStore.getAllEquipments();
});

const bangboos = computed(() => {
  return gameDataStore.getAllBangboos();
});

const enemies = computed(() => {
  return gameDataStore.getAllEnemies();
});

// 显示的数据（根据showAll控制）
const displayedCharacters = computed(() => {
  return showAll.value ? characters.value : characters.value.slice(0, 20);
});

const displayedWeapons = computed(() => {
  return showAll.value ? weapons.value : weapons.value.slice(0, 20);
});

const displayedEquipments = computed(() => {
  return showAll.value ? equipments.value : equipments.value.slice(0, 20);
});

const displayedEnemies = computed(() => {
  return showAll.value ? enemies.value : enemies.value.slice(0, 50);
});

</script>

<style scoped>
.game-wiki {
  width: 100%;
}
</style>