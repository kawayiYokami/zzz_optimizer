/**
 * 存档管理Store
 *
 * 使用Pinia管理存档数据的状态
 *
 * ⚠️ 重要架构说明：
 * - 存档（SaveData）：持久化数据，存储在 IndexedDB 中（降级时使用 localStorage），是数据的"真相"
 * - 实例对象（Agent、WEngine、DriveDisk）：从存档中生成的运行时对象，用于计算
 *
 * 实例对象 ≠ 存档
 * - 实例对象包含计算缓存（self_properties、base_stats等）
 * - 实例对象是从存档数据生成的，用于运行时计算
 * - 存档是持久化数据，应该直接从 IndexedDB 读取
 *
 * 数据流：
 * 1. 存档（原始ZOD格式） → IndexedDB（持久化）
 * 2. IndexedDB → 原始ZOD数据 → 实例对象（运行时计算）
 * 3. 导出时：直接从 rawSaves 读取存档数据，不使用实例对象
 * 4. 导出ZOD时：直接从 rawSaves 读取存档数据，不使用实例对象
 *
 * 存储策略：
 * - 优先使用 IndexedDB（容量大，支持离线）
 * - IndexedDB 不可用时降级到 localStorage
 * - 首次启动时自动迁移 localStorage 数据到 IndexedDB
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SaveData } from '../model/save-data-instance';
import { dataLoaderService } from '../services/data-loader.service';
import type { SaveDataZod, ZodDiscData } from '../model/save-data-zod';
import type { ImportOptions, ImportResult } from '../model/import-result';
import { DEFAULT_IMPORT_OPTIONS } from '../model/import-result';
import { dbService } from '../services/db.service';
import { migrationService } from '../services/migration.service';
import { saveDataService } from '../services/save-data.service';
import { itemFactoryService } from '../services/item-factory.service';
import { equipmentService } from '../services/equipment.service';
import { importExportService } from '../services/import-export.service';
import { PropertyType } from '../model/base';

const STORAGE_KEY = 'zzz_optimizer_saves';
const CURRENT_SAVE_KEY = 'zzz_optimizer_current_save';

export const useSaveStore = defineStore('save', () => {
  // 状态
  const saves = ref<Map<string, SaveData>>(new Map());
  const rawSaves = ref<Map<string, SaveDataZod>>(new Map());
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

  /**
   * 确保当前存档的实例已生成
   * 如果实例不存在但rawSaves中有数据，则生成实例
   */
  async function ensureCurrentSaveInstance(): Promise<SaveData | null> {
    if (currentSaveName.value === null) {
      return null;
    }

    const save = saves.value.get(currentSaveName.value);
    if (save) {
      return save as SaveData;
    }

    // 如果实例不存在，从rawSaves生成
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (rawSave) {
      console.warn(`Instance for save ${currentSaveName.value} not found, generating from raw data...`);
      isLoading.value = true;
      try {
        const inst = await instantiateSaveWithEquipment(currentSaveName.value, rawSave);
        // 使用新的 Map 替换旧的 Map，以触发 Vue 响应式更新
        const newSaves = new Map(saves.value);
        newSaves.set(currentSaveName.value!, inst);
        saves.value = newSaves;
        return inst;
      } catch (err) {
        console.error(`Failed to generate instance for save ${currentSaveName.value}:`, err);
        error.value = err instanceof Error ? err.message : String(err);
        return null;
      } finally {
        isLoading.value = false;
      }
    }

    return null;
  }

  const currentRawSave = computed(() => {
    if (currentSaveName.value === null) {
      return null;
    }
    return rawSaves.value.get(currentSaveName.value) ?? null;
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

  const teams = computed(() => {
    return currentSave.value?.getAllTeams() ?? [];
  });

  const teamInstances = computed(() => {
    return currentSave.value?.getAllTeamInstances() ?? [];
  });

  const saveNames = computed(() => {
    return Array.from(rawSaves.value.keys());
  });

  const rawSaveData = computed(() => {
    return Object.fromEntries(rawSaves.value.entries());
  });

  /**
   * 为SaveData实例设置装备引用
   * 提取为共享辅助函数，确保所有SaveData实例初始化一致
   */
  async function instantiateSaveWithEquipment(
    name: string,
    rawData: SaveDataZod
  ): Promise<SaveData> {
    const normalized = saveDataService.normalizeZodData(rawData);
    const saveData = await SaveData.fromZod(name, normalized, dataLoaderService);

    // 为所有Agent设置装备引用
    const agents = saveData.getAllAgents();
    const wengines = saveData.getAllWEngines();
    const driveDisks = saveData.getAllDriveDisks();

    const wenginesMap = new Map(wengines.map(w => [w.id, w]));
    const driveDisksMap = new Map(driveDisks.map(d => [d.id, d]));

    agents.forEach(agent => {
      agent.setEquipmentReferences(wenginesMap, driveDisksMap);
    });

    return saveData;
  }

  /**
   * 从存储加载存档（优先 IndexedDB，降级 localStorage）
   */
  async function loadFromStorage(): Promise<void> {
    try {
      // 检查并执行迁移（localStorage -> IndexedDB）
      if (await migrationService.needsMigration()) {
        const result = await migrationService.migrate();
        if (result.success) {
          // 迁移成功后清理 localStorage
          migrationService.cleanupLocalStorage();
        } else {
          console.error('[SaveStore] 迁移失败:', result.errors);
          // 迁移失败时降级到 localStorage
        }
      }

      // 优先从 IndexedDB 加载
      if (dbService.isAvailable) {
        await loadFromIndexedDB();
      } else {
        // 降级到 localStorage
        console.warn('[SaveStore] IndexedDB 不可用，降级到 localStorage');
        await loadFromLocalStorage();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load saves from storage:', err);
      // 尝试降级到 localStorage
      try {
        await loadFromLocalStorage();
      } catch (fallbackErr) {
        console.error('Fallback to localStorage also failed:', fallbackErr);
      }
    }
  }

  /**
   * 从 IndexedDB 加载存档
   */
  async function loadFromIndexedDB(): Promise<void> {
    const allSaves = await dbService.getAllSaves();
    const newSaves = new Map<string, SaveData>();
    const newRawSaves = new Map<string, SaveDataZod>();

    for (const [name, data] of allSaves.entries()) {
      try {
        if (saveDataService.isZodSaveData(data)) {
          const normalized = saveDataService.normalizeZodData(data);
          newRawSaves.set(name, normalized);
        }
      } catch (err) {
        console.error(`加载存档失败 [${name}]:`, err);
        if (saveDataService.isZodSaveData(data)) {
          newRawSaves.set(name, data);
        }
      }
    }

    saves.value = newSaves;
    rawSaves.value = newRawSaves;

    const currentSave = await dbService.getCurrentSaveName();
    if (currentSave) {
      currentSaveName.value = currentSave;
    }

    // 没有任何存档时，自动创建一个默认空存档
    if (rawSaves.value.size === 0) {
      const defaultName = '默认存档';
      const newSave = new SaveData(defaultName);
      saves.value.set(defaultName, newSave);
      rawSaves.value.set(defaultName, newSave.toZodData());
      currentSaveName.value = defaultName;
      await saveToStorage();
      return;
    }

    // 有存档但没有当前存档指针时，默认选择第一个
    if (!currentSaveName.value) {
      currentSaveName.value = Array.from(rawSaves.value.keys())[0] ?? null;
    }

    // 只实例化当前存档（惰性加载其他存档）
    if (currentSaveName.value) {
      const raw = rawSaves.value.get(currentSaveName.value);
      if (raw) {
        try {
          const saveData = await instantiateSaveWithEquipment(currentSaveName.value, raw);
          saves.value.set(currentSaveName.value, saveData);
        } catch (err) {
          error.value = err instanceof Error ? err.message : 'Unknown error';
          console.error(`加载当前存档失败 [${currentSaveName.value}]:`, err);
        }
      }
    }
  }

  /**
   * 从 localStorage 加载存档（降级方案）
   */
  async function loadFromLocalStorage(): Promise<void> {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      const newSaves = new Map<string, SaveData>();
      const newRawSaves = new Map<string, SaveDataZod>();

      for (const [name, data] of Object.entries(parsed)) {
        try {
          if (saveDataService.isZodSaveData(data)) {
            const normalized = saveDataService.normalizeZodData(data as SaveDataZod);
            newRawSaves.set(name, normalized);
          }
        } catch (err) {
          console.error(`加载存档失败 [${name}]:`, err);
          if (saveDataService.isZodSaveData(data)) {
            newRawSaves.set(name, data as SaveDataZod);
          }
        }
      }

      saves.value = newSaves;
      rawSaves.value = newRawSaves;
    }

    const currentSave = localStorage.getItem(CURRENT_SAVE_KEY);
    if (currentSave) {
      currentSaveName.value = currentSave;
    }

    // 没有任何存档时，自动创建一个默认空存档
    if (rawSaves.value.size === 0) {
      const defaultName = '默认存档';
      const newSave = new SaveData(defaultName);
      saves.value.set(defaultName, newSave);
      rawSaves.value.set(defaultName, newSave.toZodData());
      currentSaveName.value = defaultName;
      saveToLocalStorage();
      return;
    }

    // 有存档但没有当前存档指针时，默认选择第一个
    if (!currentSaveName.value) {
      currentSaveName.value = Array.from(rawSaves.value.keys())[0] ?? null;
    }

    // 只实例化当前存档
    if (currentSaveName.value) {
      const raw = rawSaves.value.get(currentSaveName.value);
      if (raw) {
        try {
          const saveData = await instantiateSaveWithEquipment(currentSaveName.value, raw);
          saves.value.set(currentSaveName.value, saveData);
        } catch (err) {
          error.value = err instanceof Error ? err.message : 'Unknown error';
          console.error(`加载当前存档失败 [${currentSaveName.value}]:`, err);
        }
      }
    }
  }

  /**
   * 保存存档到存储（优先 IndexedDB，降级 localStorage）
   */
  async function saveToStorage(): Promise<void> {
    try {
      if (dbService.isAvailable) {
        await saveToIndexedDB();
      } else {
        saveToLocalStorage();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save to IndexedDB, falling back to localStorage:', err);
      // 降级到 localStorage
      saveToLocalStorage();
    }
  }

  /**
   * 保存存档到 IndexedDB
   */
  async function saveToIndexedDB(): Promise<void> {
    // 逐个保存存档
    for (const [name, data] of rawSaves.value.entries()) {
      await dbService.putSave(name, data);
    }

    // 保存当前存档指针
    if (currentSaveName.value) {
      await dbService.setCurrentSaveName(currentSaveName.value);
    } else {
      await dbService.setCurrentSaveName(null);
    }
  }

  /**
   * 保存存档到 localStorage（降级方案）
   */
  function saveToLocalStorage(): void {
    const dataToSave = Object.fromEntries(rawSaves.value.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));

    if (currentSaveName.value) {
      localStorage.setItem(CURRENT_SAVE_KEY, currentSaveName.value);
    } else {
      localStorage.removeItem(CURRENT_SAVE_KEY);
    }
  }

  /**
   * 创建新存档
   */
  async function createSave(name: string): Promise<SaveData> {
    if (saves.value.has(name) || rawSaves.value.has(name)) {
      throw new Error(`Save "${name}" already exists`);
    }

    const newSave = new SaveData(name);
    saves.value.set(name, newSave);

    // 初始化rawSaves
    const zodData = newSave.toZodData();
    rawSaves.value.set(name, zodData);

    currentSaveName.value = name;
    await saveToStorage();

    return newSave;
  }

  /**
   * 删除存档
   */
  async function deleteSave(name: string): Promise<boolean> {
    if (!saves.value.has(name) && !rawSaves.value.has(name)) {
      return false;
    }

    // 永远保留最后一个存档
    if (rawSaves.value.size <= 1) {
      console.warn('Cannot delete the last remaining save');
      return false;
    }

    saves.value.delete(name);
    rawSaves.value.delete(name);

    // 从 IndexedDB 删除
    if (dbService.isAvailable) {
      await dbService.deleteSave(name);
    }

    // 如果删除的是当前存档，切换到其他存档
    if (currentSaveName.value === name) {
      const remainingNames = Array.from(rawSaves.value.keys());
      if (remainingNames.length > 0) {
        currentSaveName.value = remainingNames[0];
      } else {
        currentSaveName.value = null;
      }
    }

    await saveToStorage();

    return true;
  }

  /**
   * 切换存档
   */
  async function switchSave(name: string): Promise<boolean> {
    if (!rawSaves.value.has(name)) {
      return false;
    }

    try {
      // 从rawSaves重新生成当前存档实例
      const rawSave = rawSaves.value.get(name);
      if (rawSave) {
        const saveData = await instantiateSaveWithEquipment(name, rawSave);
        saves.value.set(name, saveData);

        // 同步规范化后的数据回 rawSaves
        rawSaves.value.set(name, saveDataService.normalizeZodData(rawSave));
      }

      currentSaveName.value = name;
      await saveToStorage();

      return true;
    } catch (err) {
      console.error(`Failed to switch to save ${name}:`, err);
      error.value = err instanceof Error ? err.message : 'Unknown error';
      return false;
    }
  }

  /**
   * 导入ZOD格式数据
   */
  async function importZodData(data: any, saveName?: string): Promise<SaveData> {
    isLoading.value = true;
    error.value = null;

    try {
      const name = saveName ?? `import_${Date.now()}`;
      if (!saveDataService.isZodSaveData(data)) {
        throw new Error('Invalid ZOD data');
      }
      const normalized = saveDataService.normalizeZodData(data as SaveDataZod);

      // 直接保存原始ZOD数据到rawSaves
      rawSaves.value.set(name, normalized);

      // 从原始ZOD数据生成实例
      const newSave = await SaveData.fromZod(name, normalized, dataLoaderService);
      saves.value.set(name, newSave);

      // 设置当前存档
      currentSaveName.value = name;

      // 保存到存储
      await saveToStorage();

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
   * 带去重选项的 ZOD 数据导入
   *
   * @param data ZOD 格式数据
   * @param options 导入选项（检测重复、删除不存在项）
   * @param targetSaveName 目标存档名（默认当前存档或新建）
   * @returns 导入结果和保存的数据
   */
  async function importZodDataWithOptions(
    data: any,
    options: ImportOptions = DEFAULT_IMPORT_OPTIONS,
    targetSaveName?: string
  ): Promise<{ saveData: SaveData; result: ImportResult }> {
    isLoading.value = true;
    error.value = null;

    try {
      if (!saveDataService.isZodSaveData(data)) {
        throw new Error('Invalid ZOD data');
      }

      const importData = saveDataService.normalizeZodData(data as SaveDataZod);
      const name = targetSaveName ?? currentSaveName.value ?? `import_${Date.now()}`;

      // 获取现有数据
      const existingData = rawSaves.value.get(name);

      const { merged, result } = await importExportService.computeMerge(importData, existingData, options);

      // 保存原始 ZOD 数据
      rawSaves.value.set(name, merged);

      // 生成实例
      const saveData = await SaveData.fromZod(name, merged, dataLoaderService);

      // 为所有 Agent 设置装备引用
      const agents = saveData.getAllAgents();
      const wengines = saveData.getAllWEngines();
      const driveDisks = saveData.getAllDriveDisks();

      const wenginesMap = new Map(wengines.map((w) => [w.id, w]));
      const driveDisksMap = new Map(driveDisks.map((d) => [d.id, d]));

      agents.forEach((agent) => {
        agent.setEquipmentReferences(wenginesMap, driveDisksMap);
      });

      saves.value.set(name, saveData);

      // 设置当前存档
      currentSaveName.value = name;

      // 保存到存储
      await saveToStorage();

      return { saveData, result };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to import ZOD data with options:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 预览导入（不写入 localStorage / 不更新当前存档）
   *
   * 用于 UI 在选择文件/切换选项时即时计算「会发生什么」以及解析失败列表。
   */
  async function previewZodImportWithOptions(
    data: any,
    options: ImportOptions = DEFAULT_IMPORT_OPTIONS,
    targetSaveName?: string
  ): Promise<{ result: ImportResult }> {
    if (!saveDataService.isZodSaveData(data)) {
      throw new Error('Invalid ZOD data');
    }

    const importData = saveDataService.normalizeZodData(data as SaveDataZod);
    const name = targetSaveName ?? currentSaveName.value ?? `import_${Date.now()}`;
    const existingData = rawSaves.value.get(name);

    const { result } = await importExportService.computeMerge(importData, existingData, options);
    return { result };
  }

  /**
   * 导出当前存档为 ZOD 格式
   */
  function exportSingleSave(name: string): string {
    const rawSave = rawSaves.value.get(name);
    if (!rawSave) {
      throw new Error(`Save "${name}" not found in storage`);
    }
    return JSON.stringify(rawSave, null, 2);
  }

  /**
   * 导入存档数据（覆盖或新建）
   */
  async function importSaveData(data: any): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      if (!data || !data.name) {
        throw new Error('Invalid save data: missing name');
      }

      const name = data.name;

      // 直接保存原始数据到rawSaves
      rawSaves.value.set(name, data);

      // 从原始数据生成实例
      const newSave = await SaveData.fromZod(name, data, dataLoaderService);
      saves.value.set(name, newSave);

      // 如果是当前存档，更新当前存档
      if (currentSaveName.value === name) {
        // 不需要特别处理，因为saves已经更新了
      }

      // 保存到存储
      await saveToStorage();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to import save data:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 重置Store
   */
  function reset(): void {
    saves.value = new Map();
    rawSaves.value = new Map();
    currentSaveName.value = null;
    isLoading.value = false;
    error.value = null;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_SAVE_KEY);
  }

  // 不在模块初始化时自动加载，由应用显式控制加载顺序
  // loadFromStorage();

  /**
   * 装备音擎
   */
  async function equipWengine(agentId: string, wengineId: string | null): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    const success = equipmentService.equipWengine(save as SaveData, rawSave, agentId, wengineId);
    if (success) {
      await saveToStorage();
    }
    return success;
  }

  /**
   * 装备驱动盘
   */
  async function equipDriveDisk(agentId: string, diskId: string | null): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    const success = equipmentService.equipDriveDisk(save as SaveData, rawSave, agentId, diskId);
    if (success) {
      await saveToStorage();
      await syncInstanceToRawSave();
    }
    return success;
  }

  /**
   * 同步实例数据到rawSaves
   * 确保rawSaves始终与实例数据保持一致
   */
  async function syncInstanceToRawSave(): Promise<void> {
    if (!currentSaveName.value) {
      return;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return;
    }

    equipmentService.syncInstanceToRaw(save as SaveData, rawSave);
    await saveToStorage();
  }

  /**
   * 创建队伍
   */
  async function createTeam(name: string, frontAgentId: string, backAgent1Id?: string, backAgent2Id?: string): Promise<string | null> {
    if (!currentSaveName.value) {
      return null;
    }

    if (!name?.trim() || !frontAgentId) {
      return null;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return null;
    }

    // 创建ZodTeamData
    const teamId = save.getNextTeamId();
    const newTeam: import('../model/save-data-zod').ZodTeamData = {
      id: teamId,
      name,
      priority: 0,
      frontCharacterId: frontAgentId,
      backCharacter1Id: backAgent1Id || '',
      backCharacter2Id: backAgent2Id || '',
    };

    // 添加到SaveData
    try {
      save.addTeam(newTeam);
    } catch (error) {
      console.error('创建队伍失败:', error);
      return null;
    }

    // 同步到rawSaves
    await syncInstanceToRawSave();

    return teamId;
  }

  /**
   * 更新队伍
   */
  async function updateTeam(teamId: string, updates: Partial<import('../model/save-data-zod').ZodTeamData>): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    if (!save) {
      return false;
    }

    try {
      save.updateTeam(teamId, updates);
      await syncInstanceToRawSave();
      return true;
    } catch (error) {
      console.error('更新队伍失败:', error);
      return false;
    }
  }

  /**
   * 删除队伍
   */
  async function deleteTeam(teamId: string): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    if (!save) {
      return false;
    }

    save.deleteTeam(teamId);
    await syncInstanceToRawSave();
    return true;
  }

  /**
   * 更新队伍的优化配置
   */
  async function updateTeamOptimizationConfig(
    teamId: string,
    config: import('../model/team').TeamOptimizationConfig
  ): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    if (!save) {
      return false;
    }

    try {
      // 获取队伍实例
      const team = save.getAllTeamInstances().find(t => t.id === teamId);
      if (!team) {
        console.error(`队伍 ${teamId} 不存在`);
        return false;
      }

      // 更新优化配置
      team.optimizationConfig = config;

      // 同步到rawSaves
      await syncInstanceToRawSave();
      return true;
    } catch (error) {
      console.error('更新队伍优化配置失败:', error);
      return false;
    }
  }

  /**
   * 更新队伍的优化结果缓存
   */
  async function updateTeamOptimizationResults(
    teamId: string,
    results: import('../optimizer/types').OptimizationBuild[]
  ): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    if (!save) {
      return false;
    }

    try {
      const team = save.getAllTeamInstances().find(t => t.id === teamId);
      if (!team) {
        console.error(`队伍 ${teamId} 不存在`);
        return false;
      }

      // 只保留前10组结果
      team.optimizationResults = results.slice(0, 10);

      // 同步到rawSaves
      await syncInstanceToRawSave();
      return true;
    } catch (error) {
      console.error('更新队伍优化结果失败:', error);
      return false;
    }
  }

  /**
   * 获取队伍的优化配置
   */
  function getTeamOptimizationConfig(
    teamId: string
  ): import('../model/team').TeamOptimizationConfig | undefined {
    if (!currentSaveName.value) {
      return undefined;
    }

    const save = saves.value.get(currentSaveName.value);
    if (!save) {
      return undefined;
    }

    const team = save.getAllTeamInstances().find(t => t.id === teamId);
    return team?.optimizationConfig;
  }

  /**
   * 创建音擎
   */
  async function createWEngine(
    key: string,
    level: number = 60,
    refinement: number = 1,
    promotion: number = 5
  ): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave) {
      return false;
    }

    const newWengine = itemFactoryService.buildZodWengineData(key, level, refinement, promotion);

    if (!rawSave.wengines) {
      rawSave.wengines = [];
    }

    rawSave.wengines.push(newWengine);
    await saveToStorage();

    // 重新生成实例对象
    return await switchSave(currentSaveName.value);
  }

  /**
   * 更新音擎精炼等级（编辑用）
   */
  async function updateWEngineRefinement(wengineId: string, refinement: number): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave?.wengines) {
      return false;
    }

    const rawWengine = rawSave.wengines.find((w) => w.id === wengineId);
    if (!rawWengine) {
      return false;
    }

    rawWengine.modification = refinement;
    await saveToStorage();

    return await switchSave(currentSaveName.value);
  }

  /**
   * 创建驱动盘
   */
  async function createDriveDisk(
    setKey: string,
    rarity: string,
    level: number = 60,
    slotKey: string,
    mainStatKey: string,
    substats: ZodDiscData['substats'] = []
  ): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave) {
      return false;
    }

    const newDisk = itemFactoryService.buildZodDiscData(setKey, rarity, level, slotKey, mainStatKey, substats);

    if (!rawSave.discs) {
      rawSave.discs = [];
    }

    rawSave.discs.push(newDisk);
    await saveToStorage();

    // 重新生成实例对象
    return await switchSave(currentSaveName.value);
  }

  /**
   * 更新驱动盘副词条（仅更新 substats/upgrades，不允许改套装/部位/稀有度/主词条）
   */
  async function updateDriveDiskSubstats(
    diskId: string,
    substats: ZodDiscData['substats']
  ): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave?.discs) {
      return false;
    }

    const rawDisk = rawSave.discs.find((d) => d.id === diskId);
    if (!rawDisk) {
      return false;
    }

    rawDisk.substats = substats;
    await saveToStorage();

    return await switchSave(currentSaveName.value);
  }

  /**
   * 删除驱动盘
   */
  async function deleteDriveDisk(diskId: string): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave?.discs) {
      return false;
    }

    // 解除所有角色装备引用
    rawSave.characters?.forEach((c) => {
      if (!c.equippedDiscs) return;
      for (const [slotKey, equippedId] of Object.entries(c.equippedDiscs)) {
        if (equippedId === diskId) {
          c.equippedDiscs[slotKey] = '';
        }
      }
    });

    rawSave.discs = rawSave.discs.filter((d) => d.id !== diskId);
    await saveToStorage();

    return await switchSave(currentSaveName.value);
  }

  /**
   * 更新角色的有效词条
   */
  async function updateAgentEffectiveStats(agentId: string, stats: PropertyType[]): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    // 更新实例对象
    const agent = save.getAgent(agentId);
    if (!agent) {
      return false;
    }
    agent.effective_stats = stats;

    // 同步到存档
    await syncInstanceToRawSave();
    return true;
  }

  /**
   * 更新角色目标套装配置
   */
  async function updateAgentTargetSets(agentId: string, config: {
    fourPieceSetId?: string;
    twoPieceSetIds?: string[];
  }): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    // 更新实例对象
    const agent = save.getAgent(agentId);
    if (!agent) {
      return false;
    }

    if (config.fourPieceSetId !== undefined) {
      agent.target_four_piece_set_id = config.fourPieceSetId;
    }
    if (config.twoPieceSetIds !== undefined) {
      agent.target_two_piece_set_ids = config.twoPieceSetIds;
    }

    // 同步到存档
    await syncInstanceToRawSave();
    return true;
  }

  /**
   * 更新驱动盘锁定状态
   */
  async function updateDriveDiskLocked(diskId: string, locked: boolean): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    // 更新实例对象
    const disk = save.getAllDriveDisks().find(d => d.id === diskId);
    if (!disk) {
      return false;
    }
    disk.locked = locked;

    // 更新原始数据
    const rawDisk = rawSave.discs?.find(d => d.id === diskId);
    if (!rawDisk) {
      return false;
    }
    rawDisk.lock = locked;

    await saveToStorage();
    return true;
  }

  /**
   * 更新驱动盘弃置状态
   */
  async function updateDriveDiskTrash(diskId: string, trash: boolean): Promise<boolean> {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    // 更新实例对象
    const disk = save.getAllDriveDisks().find(d => d.id === diskId);
    if (!disk) {
      return false;
    }
    disk.trash = trash;

    // 更新原始数据
    const rawDisk = rawSave.discs?.find(d => d.id === diskId);
    if (!rawDisk) {
      return false;
    }
    rawDisk.trash = trash;

    await saveToStorage();
    return true;
  }

  // ==================== 自选BUFF管理 ====================

  /**
   * 添加自选BUFF到指定队伍
   */
  async function addCustomBuff(
    teamId: string,
    buff: Omit<import('../model/save-data-zod').ZodCustomBuff, 'id'>
  ): Promise<string | null> {
    if (!currentSaveName.value) return null;

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave) return null;

    const team = rawSave.teams?.find(t => t.id === teamId);
    if (!team) return null;

    // 生成唯一ID
    const buffId = `custom_buff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newBuff: import('../model/save-data-zod').ZodCustomBuff = {
      id: buffId,
      ...buff,
    };

    if (!team.customBuffs) {
      team.customBuffs = [];
    }
    team.customBuffs.push(newBuff);

    await saveToStorage();
    return buffId;
  }

  /**
   * 更新自选BUFF
   */
  async function updateCustomBuff(
    teamId: string,
    buffId: string,
    updates: Partial<Omit<import('../model/save-data-zod').ZodCustomBuff, 'id'>>
  ): Promise<boolean> {
    if (!currentSaveName.value) return false;

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave) return false;

    const team = rawSave.teams?.find(t => t.id === teamId);
    if (!team?.customBuffs) return false;

    const buffIndex = team.customBuffs.findIndex(b => b.id === buffId);
    if (buffIndex === -1) return false;

    team.customBuffs[buffIndex] = {
      ...team.customBuffs[buffIndex],
      ...updates,
    };

    await saveToStorage();
    return true;
  }

  /**
   * 删除自选BUFF
   */
  async function deleteCustomBuff(teamId: string, buffId: string): Promise<boolean> {
    if (!currentSaveName.value) return false;

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave) return false;

    const team = rawSave.teams?.find(t => t.id === teamId);
    if (!team?.customBuffs) return false;

    team.customBuffs = team.customBuffs.filter(b => b.id !== buffId);

    await saveToStorage();
    return true;
  }

  /**
   * 切换自选BUFF激活状态
   */
  async function toggleCustomBuffActive(
    teamId: string,
    buffId: string,
    isActive: boolean
  ): Promise<boolean> {
    return updateCustomBuff(teamId, buffId, { isActive });
  }

  /**
   * 获取队伍的自选BUFF列表
   */
  function getTeamCustomBuffs(teamId: string): import('../model/save-data-zod').ZodCustomBuff[] {
    if (!currentSaveName.value) return [];

    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!rawSave) return [];

    const team = rawSave.teams?.find(t => t.id === teamId);
    return team?.customBuffs ?? [];
  }

  return {
    // 状态
    saves,
    rawSaves,
    currentSaveName,
    isLoading,
    error,

    // 计算属性
    currentSave,
    currentRawSave,
    agents,
    driveDisks,
    wengines,
    teams,
    teamInstances,
    saveNames,
    rawSaveData,

    // 方法
    loadFromStorage,
    saveToStorage,
    createSave,
    deleteSave,
    switchSave,
    importZodData,           // 导入ZOD格式数据
    importZodDataWithOptions, // 带去重选项的导入
    exportSingleSave,         // 导出单个存档
    importSaveData,           // 导入存档数据（覆盖或新建）
    reset,
    ensureCurrentSaveInstance, // 确保当前存档实例已生成
    equipWengine,             // 装备音擎
    equipDriveDisk,           // 装备驱动盘
    syncInstanceToRawSave,    // 同步实例数据到rawSaves
    createTeam,               // 创建队伍
    updateTeam,               // 更新队伍
    deleteTeam,               // 删除队伍
    updateTeamOptimizationConfig, // 更新队伍优化配置
    updateTeamOptimizationResults, // 更新队伍优化结果
    getTeamOptimizationConfig,    // 获取队伍优化配置
    createWEngine,                // 创建音擎
    createDriveDisk,              // 创建驱动盘
    updateDriveDiskSubstats,      // 更新驱动盘副词条（编辑用）
    deleteDriveDisk,              // 删除驱动盘（编辑用）
    updateWEngineRefinement,      // 更新音擎精炼（编辑用）
    previewZodImportWithOptions,  // 预览导入结果（不落盘）
    updateAgentEffectiveStats,    // 更新角色有效词条
    updateAgentTargetSets,        // 更新角色目标套装配置
    updateDriveDiskLocked,        // 更新驱动盘锁定状态
    updateDriveDiskTrash,         // 更新驱动盘弃置状态
    addCustomBuff,                // 添加自选BUFF
    updateCustomBuff,             // 更新自选BUFF
    deleteCustomBuff,             // 删除自选BUFF
    toggleCustomBuffActive,       // 切换自选BUFF激活状态
    getTeamCustomBuffs,           // 获取队伍的自选BUFF列表

    // 委托到服务的方法（保持向后兼容）
    normalizeZodData: saveDataService.normalizeZodData.bind(saveDataService),
    isZodSaveData: saveDataService.isZodSaveData.bind(saveDataService),
    exportAsZod: () => {
      if (!currentSaveName.value) throw new Error('No current save to export');
      const rawSave = rawSaves.value.get(currentSaveName.value);
      if (!rawSave) throw new Error(`Save "${currentSaveName.value}" not found`);
      return importExportService.exportAsZod(rawSave);
    },
    exportAllSaves: () => importExportService.exportAll(rawSaves.value),
  };
});
