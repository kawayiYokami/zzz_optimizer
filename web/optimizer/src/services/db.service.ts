/**
 * IndexedDB 数据库服务
 *
 * 使用 Dexie.js 封装 IndexedDB 操作
 * 提供存档数据和游戏数据缓存的持久化存储
 */

import Dexie, { type Table } from 'dexie';
import type { SaveDataZod } from '../model/save-data-zod';

/**
 * 存档记录
 */
export interface SaveRecord {
  name: string;
  data: SaveDataZod;
  updatedAt: number;
}

/**
 * 游戏数据缓存记录
 */
export interface GameDataCacheRecord {
  key: string;
  data: any;
  version: string;
  cachedAt: number;
}

/**
 * 元数据记录
 */
export interface MetaRecord {
  key: string;
  value: any;
}

/**
 * 元数据键名常量
 */
export const META_KEYS = {
  CURRENT_SAVE_NAME: 'currentSaveName',
  GAME_DATA_VERSION: 'gameDataVersion',
  MIGRATION_COMPLETED: 'migrationCompleted',
  LAST_MIGRATION_TIME: 'lastMigrationTime',
} as const;

/**
 * 优化器数据库
 */
class OptimizerDatabase extends Dexie {
  saves!: Table<SaveRecord, string>;
  gameDataCache!: Table<GameDataCacheRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('zzz_optimizer_db');

    this.version(1).stores({
      saves: 'name',
      gameDataCache: 'key, version',
      meta: 'key',
    });
  }
}

/**
 * 数据库服务
 */
class DbService {
  private static instance: DbService;
  private db: OptimizerDatabase | null = null;
  private _isAvailable = false;

  private constructor() {}

  static getInstance(): DbService {
    if (!DbService.instance) {
      DbService.instance = new DbService();
    }
    return DbService.instance;
  }

  /**
   * IndexedDB 是否可用
   */
  get isAvailable(): boolean {
    return this._isAvailable;
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      this.db = new OptimizerDatabase();
      await this.db.open();
      this._isAvailable = true;
    } catch (err) {
      console.warn('[DbService] IndexedDB 不可用，将使用 localStorage 降级:', err);
      this._isAvailable = false;
      this.db = null;
    }
  }

  /**
   * 确保数据库已初始化
   */
  private ensureDb(): OptimizerDatabase {
    if (!this.db) {
      throw new Error('数据库未初始化，请先调用 initialize()');
    }
    return this.db;
  }

  // ==================== 存档操作 ====================

  /**
   * 获取单个存档
   */
  async getSave(name: string): Promise<SaveDataZod | null> {
    const db = this.ensureDb();
    const record = await db.saves.get(name);
    return record?.data ?? null;
  }

  /**
   * 获取所有存档
   */
  async getAllSaves(): Promise<Map<string, SaveDataZod>> {
    const db = this.ensureDb();
    const records = await db.saves.toArray();
    return new Map(records.map((r) => [r.name, r.data]));
  }

  /**
   * 保存存档
   */
  async putSave(name: string, data: SaveDataZod): Promise<void> {
    const db = this.ensureDb();
    // 使用 JSON 序列化确保数据可被 IndexedDB 克隆
    const cloneableData = JSON.parse(JSON.stringify(data));
    await db.saves.put({
      name,
      data: cloneableData,
      updatedAt: Date.now(),
    });
  }

  /**
   * 删除存档
   */
  async deleteSave(name: string): Promise<void> {
    const db = this.ensureDb();
    await db.saves.delete(name);
  }

  /**
   * 批量保存存档
   */
  async putAllSaves(saves: Map<string, SaveDataZod>): Promise<void> {
    const db = this.ensureDb();
    const records: SaveRecord[] = [];
    const now = Date.now();

    for (const [name, data] of saves.entries()) {
      records.push({ name, data, updatedAt: now });
    }

    await db.saves.bulkPut(records);
  }

  // ==================== 当前存档 ====================

  /**
   * 获取当前存档名称
   */
  async getCurrentSaveName(): Promise<string | null> {
    return this.getMeta<string>(META_KEYS.CURRENT_SAVE_NAME);
  }

  /**
   * 设置当前存档名称
   */
  async setCurrentSaveName(name: string | null): Promise<void> {
    if (name === null) {
      await this.deleteMeta(META_KEYS.CURRENT_SAVE_NAME);
    } else {
      await this.setMeta(META_KEYS.CURRENT_SAVE_NAME, name);
    }
  }

  // ==================== 游戏数据缓存 ====================

  /**
   * 获取游戏数据缓存
   */
  async getGameDataCache(key: string): Promise<GameDataCacheRecord | null> {
    const db = this.ensureDb();
    const record = await db.gameDataCache.get(key);
    return record ?? null;
  }

  /**
   * 保存游戏数据缓存
   */
  async putGameDataCache(key: string, data: any, version: string): Promise<void> {
    const db = this.ensureDb();
    // 使用 JSON 序列化确保数据可被 IndexedDB 克隆
    const cloneableData = JSON.parse(JSON.stringify(data));
    await db.gameDataCache.put({
      key,
      data: cloneableData,
      version,
      cachedAt: Date.now(),
    });
  }

  /**
   * 清除所有游戏数据缓存
   */
  async clearGameDataCache(): Promise<void> {
    const db = this.ensureDb();
    await db.gameDataCache.clear();
  }

  /**
   * 获取游戏数据版本
   */
  async getGameDataVersion(): Promise<string | null> {
    return this.getMeta<string>(META_KEYS.GAME_DATA_VERSION);
  }

  /**
   * 设置游戏数据版本
   */
  async setGameDataVersion(version: string): Promise<void> {
    await this.setMeta(META_KEYS.GAME_DATA_VERSION, version);
  }

  // ==================== 迁移状态 ====================

  /**
   * 检查迁移是否完成
   */
  async isMigrationCompleted(): Promise<boolean> {
    const value = await this.getMeta<boolean>(META_KEYS.MIGRATION_COMPLETED);
    return value === true;
  }

  /**
   * 设置迁移完成状态
   */
  async setMigrationCompleted(completed: boolean): Promise<void> {
    await this.setMeta(META_KEYS.MIGRATION_COMPLETED, completed);
    if (completed) {
      await this.setMeta(META_KEYS.LAST_MIGRATION_TIME, Date.now());
    }
  }

  // ==================== 元数据操作 ====================

  /**
   * 获取元数据
   */
  async getMeta<T>(key: string): Promise<T | null> {
    const db = this.ensureDb();
    const record = await db.meta.get(key);
    return (record?.value as T) ?? null;
  }

  /**
   * 设置元数据
   */
  async setMeta(key: string, value: any): Promise<void> {
    const db = this.ensureDb();
    await db.meta.put({ key, value });
  }

  /**
   * 删除元数据
   */
  async deleteMeta(key: string): Promise<void> {
    const db = this.ensureDb();
    await db.meta.delete(key);
  }

  // ==================== 工具方法 ====================

  /**
   * 清除所有数据（用于调试）
   */
  async clearAll(): Promise<void> {
    const db = this.ensureDb();
    await db.saves.clear();
    await db.gameDataCache.clear();
    await db.meta.clear();
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this._isAvailable = false;
    }
  }
}

export const dbService = DbService.getInstance();
