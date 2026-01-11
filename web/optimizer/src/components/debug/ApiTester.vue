<template>
  <div class="api-tester">
    <h2 class="text-2xl font-bold mb-4">API测试</h2>

    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h3 class="card-title">测试API方法</h3>

        <div class="form-control">
          <label class="label">
            <span class="label-text">选择方法</span>
          </label>
          <select v-model="selectedMethod" class="select select-bordered">
            <option value="getCharacterInfo">getCharacterInfo(gameId)</option>
            <option value="getWeaponInfo">getWeaponInfo(gameId)</option>
            <option value="getEquipmentInfo">getEquipmentInfo(gameId)</option>
            <option value="getCharacterDetail">getCharacterDetail(gameId)</option>
            <option value="getWeaponDetail">getWeaponDetail(gameId)</option>
            <option value="getEquipmentDetail">getEquipmentDetail(gameId)</option>
          </select>
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">参数 (JSON)</span>
          </label>
          <textarea
            v-model="paramsJson"
            class="textarea textarea-bordered h-24 font-mono text-sm"
            placeholder='{"gameId": "1011"}'
          ></textarea>
        </div>

        <div class="card-actions justify-end mt-4">
          <button class="btn btn-primary" @click="testApi" :disabled="isLoading">
            <span v-if="isLoading" class="loading loading-spinner"></span>
            测试
          </button>
        </div>

        <div v-if="error" class="alert alert-error mt-4">
          <span>{{ error }}</span>
        </div>

        <div v-if="result" class="mt-4">
          <label class="label">
            <span class="label-text">结果</span>
          </label>
          <pre class="bg-base-300 p-4 rounded-lg overflow-auto max-h-96 text-sm">{{ JSON.stringify(result, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useGameDataStore } from '../../stores/game-data.store';

const gameDataStore = useGameDataStore();

const selectedMethod = ref('getCharacterInfo');
const paramsJson = ref('{"gameId": "1011"}');
const result = ref<any>(null);
const error = ref<string | null>(null);
const isLoading = ref(false);

async function testApi() {
  isLoading.value = true;
  error.value = null;
  result.value = null;

  try {
    const params = JSON.parse(paramsJson.value);

    switch (selectedMethod.value) {
      case 'getCharacterInfo':
        result.value = gameDataStore.getCharacterInfo(params.gameId);
        break;
      case 'getWeaponInfo':
        result.value = gameDataStore.getWeaponInfo(params.gameId);
        break;
      case 'getEquipmentInfo':
        result.value = gameDataStore.getEquipmentInfo(params.gameId);
        break;
      case 'getCharacterDetail':
        result.value = await gameDataStore.getCharacterDetail(params.gameId);
        break;
      case 'getWeaponDetail':
        result.value = await gameDataStore.getWeaponDetail(params.gameId);
        break;
      case 'getEquipmentDetail':
        result.value = await gameDataStore.getEquipmentDetail(params.gameId);
        break;
      default:
        throw new Error('Unknown method');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.api-tester {
  width: 100%;
}
</style>