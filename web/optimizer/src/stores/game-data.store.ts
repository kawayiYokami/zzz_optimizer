/**
 * 游戏数据Store
 *
 * 使用Pinia管理游戏数据的状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { dataLoaderService } from '../services/data-loader.service';
import type { CharacterInfo, WeaponInfo, EquipmentInfo, BangbooInfo, EnemyInfo } from '../services/data-loader.service';

export const useGameDataStore = defineStore('gameData', () => {
  // 状态
  const isLoading = ref(false);
  const isInitialized = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const allCharacters = computed(() => {
    const data = dataLoaderService.characterData;
    return data ? Array.from(data.values()) : [];
  });

  const allWeapons = computed(() => {
    const data = dataLoaderService.weaponData;
    return data ? Array.from(data.values()) : [];
  });

  const allEquipments = computed(() => {
    const data = dataLoaderService.equipmentData;
    return data ? Array.from(data.values()) : [];
  });

  const allBangboos = computed(() => {
    const data = dataLoaderService.bangbooData;
    return data ? Array.from(data.values()) : [];
  });

  const allEnemies = computed(() => {
    const data = dataLoaderService.enemyData;
    return data ? Array.from(data.values()) : [];
  });

  /**
   * 初始化游戏数据
   */
  async function initialize(): Promise<void> {
    if (isLoading.value || isInitialized.value) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      await dataLoaderService.initialize();
      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to initialize game data:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 通过CodeName获取角色信息
   */
  function getCharacterByCode(code: string): CharacterInfo | undefined {
    const data = dataLoaderService.characterData;
    if (!data) return undefined;

    const normalizedCode = code.trim().toLowerCase();

    for (const char of data.values()) {
      // 1. 尝试匹配 Code (忽略大小写)
      if (char.code && char.code.trim().toLowerCase() === normalizedCode) {
        return char;
      }

      // 2. 尝试匹配 EN 名称 (忽略大小写)
      // 很多时候导入的数据 key 是英文名
      if (char.EN && char.EN.trim().toLowerCase() === normalizedCode) {
        return char;
      }
    }

    return undefined;
  }

  /**
   * 通过EN名称获取音擎信息（支持normalize匹配）
   */
  function getWeaponByName(name: string): WeaponInfo | undefined {
    const data = dataLoaderService.weaponData;
    if (!data) return undefined;

    const normalized = name.replace(/[\s']/g, '').toLowerCase();

    for (const weapon of data.values()) {
      const weaponNormalized = weapon.EN.replace(/[\s']/g, '').toLowerCase();
      if (weapon.EN === name || weaponNormalized === normalized) {
        return weapon;
      }
    }

    return undefined;
  }

  /**
   * 通过setKey获取驱动盘套装信息（支持normalize匹配）
   */
  function getEquipmentBySetKey(setKey: string): EquipmentInfo | undefined {
    const data = dataLoaderService.equipmentData;
    if (!data) return undefined;

    const normalized = setKey.replace(/[\s']/g, '').toLowerCase();

    for (const equip of data.values()) {
      if (equip.EN && equip.EN.name) {
        const equipNormalized = equip.EN.name.replace(/[\s']/g, '').toLowerCase();
        if (equip.EN.name === setKey || equipNormalized === normalized) {
          return equip;
        }
      }
    }

    return undefined;
  }

  /**
   * 获取角色信息（兼容旧方法，按ID或CodeName查找）
   */
  function getCharacterInfo(gameIdOrCode: string): CharacterInfo | undefined {
    const data = dataLoaderService.characterData;
    if (!data) return undefined;

    // 先尝试按ID查找
    if (data.has(gameIdOrCode)) {
      return data.get(gameIdOrCode);
    }

    // 再尝试按CodeName查找
    return getCharacterByCode(gameIdOrCode);
  }

  /**
   * 获取音擎信息
   */
  function getWeaponInfo(gameId: string): WeaponInfo | undefined {
    const data = dataLoaderService.weaponData;
    return data?.get(gameId);
  }

  /**
   * 获取驱动盘套装信息
   */
  function getEquipmentInfo(gameId: string): EquipmentInfo | undefined {
    const data = dataLoaderService.equipmentData;
    return data?.get(gameId);
  }

  /**
   * 获取角色详细信息
   */
  async function getCharacterDetail(gameId: string): Promise<any> {
    return await dataLoaderService.getCharacterDetail(gameId);
  }

  /**
   * 获取角色Buff数据
   */
  async function getCharacterBuff(gameId: string): Promise<any> {
    return await dataLoaderService.getCharacterBuff(gameId);
  }

  /**
   * 获取音擎详细信息
   */
  async function getWeaponDetail(gameId: string): Promise<any> {
    return await dataLoaderService.getWeaponDetail(gameId);
  }

  /**
   * 获取音擎Buff数据
   */
  async function getWeaponBuff(gameId: string): Promise<any> {
    return await dataLoaderService.getWeaponBuff(gameId);
  }

  /**
   * 获取驱动盘套装详细信息
   */
  async function getEquipmentDetail(gameId: string): Promise<any> {
    return await dataLoaderService.getEquipmentDetail(gameId);
  }

  /**
   * 获取驱动盘套装Buff数据
   */
  async function getEquipmentBuff(gameId: string): Promise<any> {
    return await dataLoaderService.getEquipmentBuff(gameId);
  }

  /**
   * 获取所有角色（方法形式）
   */
  function getAllCharacters(): CharacterInfo[] {
    return dataLoaderService.getAllCharacters();
  }

  /**
   * 获取所有音擎（方法形式）
   */
  function getAllWeapons(): WeaponInfo[] {
    return dataLoaderService.getAllWeapons();
  }

  /**
   * 获取所有驱动盘套装（方法形式）
   */
  function getAllEquipments(): EquipmentInfo[] {
    return dataLoaderService.getAllEquipments();
  }

  /**
   * 获取所有邦布（方法形式）
   */
  function getAllBangboos(): BangbooInfo[] {
    return dataLoaderService.getAllBangboos();
  }

  /**
   * 获取所有敌人（方法形式）
   */
  function getAllEnemies(): EnemyInfo[] {
    return dataLoaderService.getAllEnemies();
  }

  /**
   * 清除缓存
   */
  function clearCache(): void {
    dataLoaderService.clearCache();
  }

  /**
   * 重置Store
   */
  function reset(): void {
    isLoading.value = false;
    isInitialized.value = false;
    error.value = null;
    dataLoaderService.reset();
  }

  return {
    // 状态
    isLoading,
    isInitialized,
    error,

    // 计算属性
    allCharacters,
    allWeapons,
    allEquipments,
    allBangboos,
    allEnemies,

    // 方法
    initialize,
    getAllCharacters,
    getAllWeapons,
    getAllEquipments,
    getAllBangboos,
    getAllEnemies,
    getCharacterByCode,
    getWeaponByName,
    getEquipmentBySetKey,
    getCharacterInfo,
    getWeaponInfo,
    getEquipmentInfo,
    getCharacterDetail,
    getCharacterBuff,
    getWeaponDetail,
    getWeaponBuff,
    getEquipmentDetail,
    getEquipmentBuff,
    clearCache,
    reset,
  };
});