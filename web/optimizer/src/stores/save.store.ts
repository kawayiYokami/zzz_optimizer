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
 * 1. 存档（原始ZOD格式） → localStorage（持久化）
 * 2. localStorage → 原始ZOD数据 → 实例对象（运行时计算）
 * 3. 导出时：直接从localStorage读取存档数据，不使用实例对象
 * 4. 导出ZOD时：直接从localStorage读取存档数据，不使用实例对象
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
  const rawSaves = ref<Map<string, SaveDataZod>>(new Map());
  const currentSaveName = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const currentSave = computed(() => {
    if (currentSaveName.value === null) {
      return null;
    }
    let save = saves.value.get(currentSaveName.value);
    if (!save) {
      // 如果实例不存在，从rawSaves生成
      const rawSave = rawSaves.value.get(currentSaveName.value);
      if (rawSave) {
        // 异步生成实例，这里我们直接返回null，让调用者处理
        // 实际使用中应该有专门的机制来处理这种情况
        console.warn(`Instance for save ${currentSaveName.value} not found, need to generate from raw data`);
      }
    }
    return save ?? null;
  });

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
   * 从localStorage加载存档
   */
  async function loadFromStorage(): Promise<void> {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        const newSaves = new Map<string, SaveData>();
        const newRawSaves = new Map<string, SaveDataZod>();

        for (const [name, data] of Object.entries(parsed)) {
          try {
            if (isZodSaveData(data)) {
              const normalized = normalizeZodData(data as SaveDataZod);
              // 直接保存原始ZOD数据到rawSaves
              newRawSaves.set(name, normalized);
              // 从原始ZOD数据生成实例
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

              newSaves.set(name, saveData);
            }
          } catch (err) {
            console.error(`加载存档失败 [${name}]:`, err);
            // 继续加载其他存档，不中断整个加载过程
            // 如果是ZOD数据，仍然保存原始数据，便于调试
            if (isZodSaveData(data)) {
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
      // 直接保存rawSaves到localStorage，不从实例转换
      const dataToSave = Object.fromEntries(rawSaves.value.entries());

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
    if (saves.value.has(name) || rawSaves.value.has(name)) {
      throw new Error(`Save "${name}" already exists`);
    }

    const newSave = new SaveData(name);
    saves.value.set(name, newSave);
    
    // 初始化rawSaves
    const zodData = newSave.toZodData();
    rawSaves.value.set(name, zodData);
    
    currentSaveName.value = name;
    saveToStorage();

    return newSave;
  }

  /**
   * 删除存档
   */
  function deleteSave(name: string): boolean {
    if (!saves.value.has(name) && !rawSaves.value.has(name)) {
      return false;
    }

    saves.value.delete(name);
    rawSaves.value.delete(name);

    // 如果删除的是当前存档，切换到其他存档
    if (currentSaveName.value === name) {
      const remainingNames = Array.from(rawSaves.value.keys());
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
  async function switchSave(name: string): Promise<boolean> {
    if (!rawSaves.value.has(name)) {
      return false;
    }

    try {
      // 从rawSaves重新生成当前存档实例
      const rawSave = rawSaves.value.get(name);
      if (rawSave) {
        const saveData = await SaveData.fromZod(name, rawSave, dataLoaderService);
        saves.value.set(name, saveData);
      }

      currentSaveName.value = name;
      saveToStorage();

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
      if (!isZodSaveData(data)) {
        throw new Error('Invalid ZOD data');
      }
      const normalized = normalizeZodData(data as SaveDataZod);
      
      // 直接保存原始ZOD数据到rawSaves
      rawSaves.value.set(name, normalized);
      
      // 从原始ZOD数据生成实例
      const newSave = await SaveData.fromZod(name, normalized, dataLoaderService);
      saves.value.set(name, newSave);
      
      // 设置当前存档
      currentSaveName.value = name;
      
      // 保存到localStorage（直接保存rawSaves，不修改原始数据）
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
   * 导出为ZOD格式（直接从原始数据读取）
   *
   * ⚠️ 重要说明：
   * - 直接从rawSaves或localStorage读取原始ZOD数据
   * - 不使用实例对象转换，确保导出的数据与导入的数据格式一致
   * - 存档是持久化数据，存储在localStorage中，是数据的"真相"
   *
   * 数据流：rawSaves → 导出
   */
  function exportAsZod(): string {
    if (!currentSaveName.value) {
      throw new Error('No current save to export');
    }

    // 优先从rawSaves读取
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (rawSave) {
      return JSON.stringify(rawSave, null, 2);
    }

    // 如果rawSaves中没有，从localStorage读取
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      const saveData = parsed[currentSaveName.value];
      if (saveData) {
        return JSON.stringify(saveData, null, 2);
      }
    }

    throw new Error(`Save "${currentSaveName.value}" not found in storage`);
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
   * 导出所有存档（直接从原始数据读取）
   */
  function exportAllSaves(): string {
    // 直接从rawSaves读取所有原始数据
    const dataToSave = Object.fromEntries(rawSaves.value.entries());
    return JSON.stringify(dataToSave, null, 2);
  }

  /**
   * 导出单个存档（直接从原始数据读取）
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

      // 保存到localStorage
      saveToStorage();
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
      ? value.replace(/[\s'\-]/g, '').toLowerCase()
      : '';
  }

  // 不在模块初始化时自动加载，由应用显式控制加载顺序
  // loadFromStorage();

  /**
   * 装备音擎
   */
  function equipWengine(agentId: string, wengineId: string | null): boolean {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    const agent = save.getAgent(agentId);
    if (!agent) {
      return false;
    }

    // 修改实例对象
    agent.equipped_wengine = wengineId;

    // 更新rawSaves中的数据
    const character = rawSave.characters?.find(c => c.id === agentId);
    if (character) {
      character.equippedWengine = wengineId || '';
      
      // 更新音擎的装备状态
      if (agent.equipped_wengine) {
        // 查找并更新之前装备的音擎
        const oldWengine = rawSave.wengines?.find(w => w.location === agentId);
        if (oldWengine) {
          oldWengine.location = '';
        }
        
        // 更新新装备的音擎
        const newWengine = rawSave.wengines?.find(w => w.id === wengineId);
        if (newWengine) {
          newWengine.location = agentId;
        }
      }
    }

    // 保存到localStorage
    saveToStorage();
    return true;
  }

  /**
   * 装备驱动盘
   */
  function equipDriveDisk(agentId: string, diskId: string | null, slot: number): boolean {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return false;
    }

    const agent = save.getAgent(agentId);
    if (!agent) {
      return false;
    }

    // 检查slot是否有效
    if (slot < 0 || slot >= 6) {
      return false;
    }

    // 修改实例对象
    agent.equipped_drive_disks[slot] = diskId;

    // 更新rawSaves中的数据
    const character = rawSave.characters?.find(c => c.id === agentId);
    if (character) {
      // ZOD格式使用字符串键："1"到"6"
      const slotKey = (slot + 1).toString();
      character.equippedDiscs[slotKey] = diskId || '';
      
      // 更新驱动盘的装备状态
      if (agent.equipped_drive_disks[slot]) {
        // 查找并更新之前装备的驱动盘
        const oldDisk = rawSave.discs?.find(d => d.location === agentId && d.slotKey === slotKey);
        if (oldDisk) {
          oldDisk.location = '';
        }
        
        // 更新新装备的驱动盘
        const newDisk = rawSave.discs?.find(d => d.id === diskId);
        if (newDisk) {
          newDisk.location = agentId;
        }
      }
    }

    // 保存到localStorage
    saveToStorage();
    return true;
  }

  /**
   * 同步实例数据到rawSaves
   * 确保rawSaves始终与实例数据保持一致
   */
  function syncInstanceToRawSave(): void {
    if (!currentSaveName.value) {
      return;
    }

    const save = saves.value.get(currentSaveName.value);
    const rawSave = rawSaves.value.get(currentSaveName.value);
    if (!save || !rawSave) {
      return;
    }

    // 同步角色数据
    save.getAllAgents().forEach(agent => {
      const character = rawSave.characters?.find(c => c.id === agent.id);
      if (character) {
        // 更新角色基本信息
        character.level = agent.level;
        character.promotion = agent.breakthrough;
        character.mindscape = agent.cinema;
        character.core = agent.core_skill;
        character.basic = agent.skills.normal;
        character.dodge = agent.skills.dodge;
        character.assist = agent.skills.assist;
        character.special = agent.skills.special;
        character.chain = agent.skills.chain;
        
        // 更新装备信息
        character.equippedWengine = agent.equipped_wengine || '';
        
        // 更新驱动盘装备
        const discs: Record<string, string> = {
          '1': agent.equipped_drive_disks[0] || '',
          '2': agent.equipped_drive_disks[1] || '',
          '3': agent.equipped_drive_disks[2] || '',
          '4': agent.equipped_drive_disks[3] || '',
          '5': agent.equipped_drive_disks[4] || '',
          '6': agent.equipped_drive_disks[5] || '',
        };
        character.equippedDiscs = discs;
      }
    });

    // 同步音擎数据
    save.getAllWEngines().forEach(wengine => {
      const rawWengine = rawSave.wengines?.find(w => w.id === wengine.id);
      if (rawWengine) {
        rawWengine.level = wengine.level;
        rawWengine.modification = wengine.refinement;
        rawWengine.promotion = wengine.breakthrough;
        rawWengine.location = wengine.equipped_agent || '';
      }
    });

    // 同步驱动盘数据
    save.getAllDriveDisks().forEach(disk => {
      const rawDisk = rawSave.discs?.find(d => d.id === disk.id);
      if (rawDisk) {
        rawDisk.level = disk.level;
        rawDisk.location = disk.equipped_agent || '';
      }
    });

    // 同步队伍数据
    rawSave.teams = save.getAllTeams();
    
    // 同步战场数据
    rawSave.battles = save.getAllBattles();

    // 保存到localStorage
    saveToStorage();
  }

  /**
   * 创建队伍
   */
  function createTeam(name: string, frontAgentId: string, backAgent1Id?: string, backAgent2Id?: string): string | null {
    if (!currentSaveName.value) {
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
      frontCharacterId: frontAgentId,
      backCharacter1Id: backAgent1Id || '',
      backCharacter2Id: backAgent2Id || '',
    };

    // 添加到SaveData
    save.addTeam(newTeam);

    // 同步到rawSaves
    syncInstanceToRawSave();

    return teamId;
  }

  /**
   * 更新队伍
   */
  function updateTeam(teamId: string, updates: Partial<import('../model/save-data-zod').ZodTeamData>): boolean {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    if (!save) {
      return false;
    }

    try {
      save.updateTeam(teamId, updates);
      syncInstanceToRawSave();
      return true;
    } catch (error) {
      console.error('更新队伍失败:', error);
      return false;
    }
  }

  /**
   * 删除队伍
   */
  function deleteTeam(teamId: string): boolean {
    if (!currentSaveName.value) {
      return false;
    }

    const save = saves.value.get(currentSaveName.value);
    if (!save) {
      return false;
    }

    save.deleteTeam(teamId);
    syncInstanceToRawSave();
    return true;
  }

  /**
   * 更新队伍的优化配置
   */
  function updateTeamOptimizationConfig(
    teamId: string,
    config: import('../model/team').TeamOptimizationConfig
  ): boolean {
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
      syncInstanceToRawSave();
      return true;
    } catch (error) {
      console.error('更新队伍优化配置失败:', error);
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
    exportSaveData,           // 导出实例格式（直接从localStorage读取）
    exportAsZod,              // 导出ZOD格式（直接从原始数据读取）
    exportSaveDataAsInstance, // 导出实例格式（从实例生成，调试用）
    exportAllSaves,           // 导出所有存档（直接从原始数据读取）
    exportSingleSave,         // 导出单个存档
    importSaveData,           // 导入存档数据（覆盖或新建）
    reset,
    equipWengine,             // 装备音擎
    equipDriveDisk,           // 装备驱动盘
    syncInstanceToRawSave,    // 同步实例数据到rawSaves
    createTeam,               // 创建队伍
    updateTeam,               // 更新队伍
    deleteTeam,               // 删除队伍
    updateTeamOptimizationConfig, // 更新队伍优化配置
    getTeamOptimizationConfig,    // 获取队伍优化配置
  };
});
