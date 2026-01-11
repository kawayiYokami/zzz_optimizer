/**
 * 存档管理Store
 *
 * 使用Pinia管理存档数据的状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SaveData } from '../model/save-data-instance';
import { dataLoaderService } from '../services/data-loader.service';

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
          const saveData = await SaveData.fromDict(data as any, dataLoaderService);
          newSaves.set(name, saveData);
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
        dataToSave[name] = saveData.toDict();
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
   * 从扫描数据导入
   */
  async function importFromScanData(data: any, saveName?: string): Promise<SaveData> {
    isLoading.value = true;
    error.value = null;

    try {
      // 动态导入 ZOD 解析服务
      const { zodParserService } = await import('../services/zod-parser.service');

      // 创建新存档
      const name = saveName ?? `import_${Date.now()}`;
      const newSave = new SaveData(name);

      // 使用 ZOD 解析服务解析数据
      const parsedData = await zodParserService.parseZodData(data);

      // 合并角色数据
      for (const [agentId, agent] of parsedData.agents.entries()) {
        newSave.addAgent(agent);
      }

      // 合并驱动盘数据
      for (const [diskId, disk] of parsedData.driveDisks.entries()) {
        newSave.addDriveDisk(disk);
      }

      // 合并音擎数据
      for (const [wengineId, wengine] of parsedData.wengines.entries()) {
        newSave.addWEngine(wengine);
      }

      // 保存
      saves.value.set(name, newSave);
      currentSaveName.value = name;
      saveToStorage();

      return newSave;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to import scan data:', err);
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

    return JSON.stringify(currentSave.value.toDict(), null, 2);
  }

  /**
   * 导出所有存档
   */
  function exportAllSaves(): string {
    const dataToSave: Record<string, any> = {};

    for (const [name, saveData] of saves.value.entries()) {
      dataToSave[name] = saveData.toDict();
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
    importFromScanData,
    exportSaveData,
    exportAllSaves,
    reset,
  };
});