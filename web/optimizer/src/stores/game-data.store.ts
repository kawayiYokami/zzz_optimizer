/**
 * 游戏数据Store
 *
 * 使用Pinia管理游戏数据的状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { dataLoaderService } from '../services/data-loader.service';
import type { CharacterInfo, WeaponInfo, EquipmentInfo, BangbooInfo, EnemyInfo, AnomalyBarInfo } from '../services/data-loader.service';

export const useGameDataStore = defineStore('gameData', () => {
  // 状态
  const isLoading = ref(false);
  const isInitialized = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const allCharacters = computed(() => {
    // 依赖 isInitialized 以确保数据加载完成后重新计算
    if (!isInitialized.value) return [];
    const data = dataLoaderService.characterData;
    return data ? Array.from(data.values()) : [];
  });

  const allWeapons = computed(() => {
    if (!isInitialized.value) return [];
    const data = dataLoaderService.weaponData;
    return data ? Array.from(data.values()) : [];
  });

  const allEquipments = computed(() => {
    if (!isInitialized.value) return [];
    const data = dataLoaderService.equipmentData;
    return data ? Array.from(data.values()) : [];
  });

  const allBangboos = computed(() => {
    if (!isInitialized.value) return [];
    const data = dataLoaderService.bangbooData;
    return data ? Array.from(data.values()) : [];
  });

  const allEnemies = computed(() => {
    if (!isInitialized.value) return [];
    const data = dataLoaderService.enemyData;
    return data ? Array.from(data.values()) : [];
  });

  const allAnomalyBars = computed(() => {
    if (!isInitialized.value) return [];
    const data = dataLoaderService.anomalyBarsData;
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
   * 获取异常条信息
   */
  function getAnomalyBarInfo(anomalyBarId: string): AnomalyBarInfo | undefined {
    const data = dataLoaderService.anomalyBarsData;
    return data?.get(anomalyBarId);
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
   * 驱动盘套装信息接口
   */
  interface DriveDiskSetInfo {
    id: string;              // 套装ID
    name: string;            // 套装中文名称
    icon: string;            // 套装图标URL
    fourPieceDescription: string; // 4件套效果描述
    twoPieceDescription: string;  // 2件套效果描述
  }

  /**
   * 驱动盘套装缓存
   */
  const _driveDiskSetsCache = ref<DriveDiskSetInfo[] | null>(null);

  /**
   * 获取所有驱动盘套装信息
   *
   * @returns 驱动盘套装信息列表
   */
  async function getDriveDiskSets(): Promise<DriveDiskSetInfo[]> {
    // 如果已缓存，直接返回
    if (_driveDiskSetsCache.value !== null) {
      return _driveDiskSetsCache.value;
    }

    // 直接获取 equipmentData Map
    const equipmentData = dataLoaderService.equipmentData;
    if (!equipmentData) {
      return [];
    }

    const setsMap = new Map<string, DriveDiskSetInfo>();

    // 遍历所有套装（equipmentData 的所有条目都是驱动盘套装）
    for (const [setId, equipInfo] of equipmentData.entries()) {
      // 提取套装名称（优先中文）
      const setName = equipInfo.CHS?.name || equipInfo.EN?.name || setId;

      try {
        // 加载Buff数据获取4件套和2件套描述
        const buffs = await dataLoaderService.getEquipmentBuff(setId);

        let fourPieceDescription = '无4件套效果';
        let twoPieceDescription = '无2件套效果';
        if (buffs) {
          if (buffs.four_piece_effect) {
            fourPieceDescription = buffs.four_piece_effect;
          }
          if (buffs.two_piece_effect) {
            twoPieceDescription = buffs.two_piece_effect;
          }
        }

        setsMap.set(setId, {
          id: setId,
          name: setName,
          icon: equipInfo.icon,
          fourPieceDescription: fourPieceDescription,
          twoPieceDescription: twoPieceDescription
        });
      } catch (err) {
        console.warn(`加载驱动盘套装Buff数据失败: ${setId}`, err);
        // 即使加载失败，也创建基本信息
        setsMap.set(setId, {
          id: setId,
          name: setName,
          icon: equipInfo.icon,
          fourPieceDescription: '加载失败',
          twoPieceDescription: '加载失败'
        });
      }
    }

    // 缓存结果
    _driveDiskSetsCache.value = Array.from(setsMap.values());
    return _driveDiskSetsCache.value;
  }

  /**
   * 清除缓存
   */
  function clearCache(): void {
    dataLoaderService.clearCache();
    _driveDiskSetsCache.value = null;
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
    allAnomalyBars,

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
    getAnomalyBarInfo,
    getCharacterDetail,
    getCharacterBuff,
    getWeaponDetail,
    getWeaponBuff,
    getEquipmentDetail,
    getEquipmentBuff,
    getDriveDiskSets,
    clearCache,
    reset,
  };
});