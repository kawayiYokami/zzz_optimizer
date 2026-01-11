/**
 * 存档管理Store
 *
 * 使用Pinia管理存档数据的状态
 *
 * ⚠️ 重要架构说明：
 * - 存档（SaveData）：持久化数据，存储在localStorage中，是数据的"真相"
 * - 实例对象（Agent、WEngine、DriveDisk）：从存档中生成的运行时对象，用于计算
 *
 * 实例对象 ≠ 存档
 * - 实例对象包含计算缓存（self_properties、base_stats等）
 * - 实例对象是从存档数据生成的，用于运行时计算
 * - 存档是持久化数据，应该直接从localStorage读取
 *
 * 数据流：
 * 1. 存档（SaveData.toDict） → localStorage（持久化）
 * 2. localStorage → 存档（SaveData.fromDict） → 实例对象（运行时计算）
 * 3. 导出时：直接从localStorage读取存档数据，不使用实例对象
 * 4. 导出ZOD时：从实例对象转换格式（因为实例对象有完整的游戏数据引用）
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SaveData } from '../model/save-data-instance';
import { dataLoaderService } from '../services/data-loader.service';
import type { SaveDataZod } from '../model/save-data-zod';

const STORAGE_KEY = 'zzz_optimizer_saves';
const CURRENT_SAVE_KEY = 'zzz_optimizer_current_save';

export const useSaveStore = defineStore('save', () => {
  // 状态
  const saves = ref<Map<string, SaveData>>(new Map());
  const currentSaveName = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const currentSave = computed(() => {
    if (currentSaveName.value === null) {
      return null;
    }
    return saves.value.get(currentSaveName.value) ?? null;
  });

  const agents = computed(() => {
    return currentSave.value?.getAllAgents() ?? [];
  });

  const driveDisks = computed(() => {
    return currentSave.value?.getAllDriveDisks() ?? [];
  });

  const wengines = computed(() => {
    return currentSave.value?.getAllWEngines() ?? [];
  });

  const saveNames = computed(() => {
    return Array.from(saves.value.keys());
  });

  /**
   * 从localStorage加载存档
   */
  async function loadFromStorage(): Promise<void> {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        const newSaves = new Map<string, SaveData>();

        for (const [name, data] of Object.entries(parsed)) {
          try {
            let saveData: SaveData;
            if (isZodSaveData(data)) {
              const normalized = normalizeZodData(data as SaveDataZod);
              saveData = await SaveData.fromZod(name, normalized, dataLoaderService);
            } else {
              saveData = await SaveData.fromDict(data as any, dataLoaderService);
            }
            newSaves.set(name, saveData);
          } catch (err) {
            console.error(`加载存档失败 [${name}]:`, err);
            // 继续加载其他存档，不中断整个加载过程
          }
        }

        saves.value = newSaves;
      }

      const currentSave = localStorage.getItem(CURRENT_SAVE_KEY);
      if (currentSave) {
        currentSaveName.value = currentSave;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load saves from storage:', err);
    }
  }

  /**
   * 保存存档到localStorage
   */
  function saveToStorage(): void {
    try {
      const dataToSave: Record<string, SaveDataZod> = {};

      for (const [name, saveData] of saves.value.entries()) {
        dataToSave[name] = saveData.toZodData();
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));

      if (currentSaveName.value) {
        localStorage.setItem(CURRENT_SAVE_KEY, currentSaveName.value);
      } else {
        localStorage.removeItem(CURRENT_SAVE_KEY);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save saves to storage:', err);
      throw err;
    }
  }

  /**
   * 创建新存档
   */
  function createSave(name: string): SaveData {
    if (saves.value.has(name)) {
      throw new Error(`Save "${name}" already exists`);
    }

    const newSave = new SaveData(name);
    saves.value.set(name, newSave);
    currentSaveName.value = name;

    saveToStorage();

    return newSave;
  }

  /**
   * 删除存档
   */
  function deleteSave(name: string): boolean {
    if (!saves.value.has(name)) {
      return false;
    }

    saves.value.delete(name);

    // 如果删除的是当前存档，切换到其他存档
    if (currentSaveName.value === name) {
      const remainingNames = Array.from(saves.value.keys());
      if (remainingNames.length > 0) {
        currentSaveName.value = remainingNames[0];
      } else {
        currentSaveName.value = null;
      }
    }

    saveToStorage();

    return true;
  }

  /**
   * 切换存档
   */
  function switchSave(name: string): boolean {
    if (!saves.value.has(name)) {
      return false;
    }

    currentSaveName.value = name;
    saveToStorage();

    return true;
  }

  /**
   * 导入ZOD格式数据
   */
  async function importZodData(data: any, saveName?: string): Promise<SaveData> {
    isLoading.value = true;
    error.value = null;

    try {
      const name = saveName ?? `import_${Date.now()}`;
      if (!isZodSaveData(data)) {
        throw new Error('Invalid ZOD data');
      }
      const normalized = normalizeZodData(data as SaveDataZod);
      const newSave = await SaveData.fromZod(name, normalized, dataLoaderService);

      // 保存
      saves.value.set(name, newSave);
      currentSaveName.value = name;
      saveToStorage();

      return newSave;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to import ZOD data:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 导出当前存档（实例格式）
   *
   * ⚠️ 重要说明：
   * - 实例对象（Agent、WEngine、DriveDisk）是从存档中生成的运行时对象，用于计算
   * - 实例对象包含计算缓存（self_properties、base_stats等），不是存档本身
   * - 存档是持久化数据，存储在localStorage中
   *
   * 此方法直接从localStorage读取存档数据，不使用实例对象
   * 这样确保导出的数据与存储的数据完全一致
   *
   * 数据流：localStorage → 存档JSON → 导出
   */
  function exportSaveData(): string {
    if (!currentSaveName.value) {
      throw new Error('No current save to export');
    }

    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) {
        throw new Error('No save data found in localStorage');
      }

      const parsed = JSON.parse(savedData);
      const saveData = parsed[currentSaveName.value];

      if (!saveData) {
        throw new Error(`Save "${currentSaveName.value}" not found in storage`);
      }

      return JSON.stringify(saveData, null, 2);
    } catch (err) {
      throw new Error(`Failed to export save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * 导出为ZOD格式（从实例对象转换）
   *
   * ⚠️ 重要说明：
   * - 实例对象（Agent、WEngine、DriveDisk）是从存档中生成的运行时对象，用于计算
   * - 实例对象包含计算缓存（self_properties、base_stats等）和游戏数据引用
   * - 存档是持久化数据，存储在localStorage中
   *
   * 此方法从实例对象转换为ZOD格式，用于与其他工具兼容
   * 注意：这是唯一一个从实例对象导出的方法，因为需要访问游戏数据引用
   *
   * 数据流：实例对象 → 转换为ZOD格式 → 导出
   */
  function exportAsZod(): string {
    if (!currentSave.value) {
      throw new Error('No current save to export');
    }

    return JSON.stringify(currentSave.value.toZodData(), null, 2);
  }

  /**
   * 导出当前存档（实例格式，从实例对象生成）
   *
   * ⚠️ 重要说明：
   * - 实例对象（Agent、WEngine、DriveDisk）是从存档中生成的运行时对象，用于计算
   * - 实例对象包含计算缓存（self_properties、base_stats等），不是存档本身
   * - 存档是持久化数据，存储在localStorage中
   *
   * 此方法从实例对象重新生成JSON，可能与localStorage中的数据不同步
   * 仅用于调试目的，不推荐用于生产环境
   *
   * 数据流：实例对象 → 重新生成JSON → 导出（可能不同步）
   */
  function exportSaveDataAsInstance(): string {
    if (!currentSave.value) {
      throw new Error('No current save to export');
    }

    return JSON.stringify(currentSave.value.toDict(), null, 2);
  }

  /**
   * 导出所有存档（内部实例格式，仅用于调试）
   */
  function exportAllSaves(): string {
    const dataToSave: Record<string, SaveDataZod> = {};

    for (const [name, saveData] of saves.value.entries()) {
      dataToSave[name] = saveData.toZodData();
    }

    return JSON.stringify(dataToSave, null, 2);
  }

  /**
   * 重置Store
   */
  function reset(): void {
    saves.value = new Map();
    currentSaveName.value = null;
    isLoading.value = false;
    error.value = null;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_SAVE_KEY);
  }

  function isZodSaveData(data: any): data is SaveDataZod {
    return data && typeof data === 'object' && typeof data.format === 'string' && data.format === 'ZOD';
  }

  function normalizeZodData(data: SaveDataZod): SaveDataZod {
    const cloned: SaveDataZod = JSON.parse(JSON.stringify(data));
    cloned.characters = (cloned.characters ?? []).map((char) => ({
      ...char,
      key: normalizeCharacterKey(char.key),
    }));
    cloned.wengines = (cloned.wengines ?? []).map((wengine) => ({
      ...wengine,
      key: normalizeWengineKey(wengine.key),
    }));
    cloned.discs = (cloned.discs ?? []).map((disc) => ({
      ...disc,
      setKey: normalizeDiscSetKey(disc.setKey),
    }));
    return cloned;
  }

  function normalizeCharacterKey(key: string): string {
    const normalized = keyNormalizer(key);
    const charData = dataLoaderService.characterData;
    if (!charData) {
      return key;
    }

    for (const info of charData.values()) {
      const candidates = [
        info.code,
        info.EN,
        info.CHS,
        info.JP,
        info.KR,
      ].filter(Boolean) as string[];

      for (const candidate of candidates) {
        if (keyNormalizer(candidate) === normalized) {
          return info.code || candidate;
        }
      }
    }

    return key;
  }

  function normalizeWengineKey(key: string): string {
    const normalized = keyNormalizer(key);
    const weaponData = dataLoaderService.weaponData;
    if (!weaponData) {
      return key;
    }

    for (const info of weaponData.values()) {
      const candidates = [info.EN, info.CHS, info.JP, info.KR].filter(Boolean) as string[];
      for (const candidate of candidates) {
        if (keyNormalizer(candidate) === normalized) {
          return info.EN || candidate;
        }
      }
    }

    return key;
  }

  function normalizeDiscSetKey(key: string): string {
    const normalized = keyNormalizer(key);
    const equipmentData = dataLoaderService.equipmentData;
    if (!equipmentData) {
      return key;
    }

    for (const info of equipmentData.values()) {
      const names: string[] = [];
      if (info.EN?.name) names.push(info.EN.name);
      if (info.CHS?.name) names.push(info.CHS.name);
      if (info.JP?.name) names.push(info.JP.name);
      if (info.KR?.name) names.push(info.KR.name);

      for (const name of names) {
        if (keyNormalizer(name) === normalized) {
          return info.EN?.name || name;
        }
      }
    }

    return key;
  }

  function keyNormalizer(value: string): string {
    return value
      ? value.replace(/[\s']/g, '').toLowerCase()
      : '';
  }

  // 不在模块初始化时自动加载，由应用显式控制加载顺序
  // loadFromStorage();

  return {
    // 状态
    saves,
    currentSaveName,
    isLoading,
    error,

    // 计算属性
    currentSave,
    agents,
    driveDisks,
    wengines,
    saveNames,

    // 方法
    loadFromStorage,
    saveToStorage,
    createSave,
    deleteSave,
    switchSave,
    importZodData,           // 导入ZOD格式数据
    exportSaveData,           // 导出实例格式（直接从localStorage读取）
    exportAsZod,              // 导出ZOD格式（转换格式）
    exportSaveDataAsInstance, // 导出实例格式（从实例生成，调试用）
    exportAllSaves,           // 导出所有存档（实例格式）
    reset,
  };
});
