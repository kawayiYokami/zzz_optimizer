/**
 * 存档管理Store（重构版）
 *
 * 直接存储ZOD格式，不做任何转换
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SaveDataZod, ZodCharacterData, ZodWengineData, ZodDiscData } from '../model/save-data-zod';

const STORAGE_KEY = 'zzz_optimizer_saves';
const CURRENT_SAVE_KEY = 'zzz_optimizer_current_save';

export const useSaveStore = defineStore('save', () => {
  // 状态
  const saves = ref<Map<string, SaveDataZod>>(new Map());
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

  const characters = computed(() => {
    return currentSave.value?.characters ?? [];
  });

  const driveDisks = computed(() => {
    return currentSave.value?.discs ?? [];
  });

  const wengines = computed(() => {
    return currentSave.value?.wengines ?? [];
  });

  const saveNames = computed(() => {
    return Array.from(saves.value.keys());
  });

  /**
   * 从localStorage加载存档
   */
  function loadFromStorage(): void {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        const newSaves = new Map<string, SaveDataZod>();

        for (const [name, data] of Object.entries(parsed)) {
          newSaves.set(name, data as SaveDataZod);
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
      const dataToSave: Record<string, any> = {};

      for (const [name, saveData] of saves.value.entries()) {
        dataToSave[name] = saveData;
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
  function createSave(name: string): SaveDataZod {
    if (saves.value.has(name)) {
      throw new Error(`Save "${name}" already exists`);
    }

    const newSave: SaveDataZod = {
      name,
      format: 'ZOD',
      dbVersion: 1,
      source: 'manual',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      characters: [],
      wengines: [],
      discs: [],
    };

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
   * 从ZOD数据导入（不转换，直接存）
   */
  async function importFromZodData(data: any, saveName?: string): Promise<SaveDataZod> {
    isLoading.value = true;
    error.value = null;

    try {
      const name = saveName ?? `import_${Date.now()}`;

      // 直接保存ZOD格式
      const saveData: SaveDataZod = {
        name,
        format: data.format || 'ZOD',
        dbVersion: data.dbVersion || 1,
        source: data.source || 'import',
        version: data.version || 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        characters: data.characters || [],
        wengines: data.wengines || [],
        discs: data.discs || [],
      };

      saves.value.set(name, saveData);
      currentSaveName.value = name;
      saveToStorage();

      return saveData;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to import ZOD data:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 导出当前存档
   */
  function exportSaveData(): string {
    if (!currentSave.value) {
      throw new Error('No current save to export');
    }

    return JSON.stringify(currentSave.value, null, 2);
  }

  /**
   * 导出所有存档
   */
  function exportAllSaves(): string {
    const dataToSave: Record<string, any> = {};

    for (const [name, saveData] of saves.value.entries()) {
      dataToSave[name] = saveData;
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

  // 初始化时从localStorage加载
  loadFromStorage();

  return {
    // 状态
    saves,
    currentSaveName,
    isLoading,
    error,

    // 计算属性
    currentSave,
    characters,
    driveDisks,
    wengines,
    saveNames,

    // 方法
    loadFromStorage,
    saveToStorage,
    createSave,
    deleteSave,
    switchSave,
    importFromZodData,
    exportSaveData,
    exportAllSaves,
    reset,
  };
});
