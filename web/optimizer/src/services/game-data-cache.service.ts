/**
 * 游戏数据缓存服务
 *
 * 管理游戏数据的 IndexedDB 缓存
 * 支持版本控制和缓存失效
 */

import { dbService } from './db.service';

/**
 * 索引文件列表（启动时预加载）
 */
const INDEX_FILES = [
  '/game-data/character.json',
  '/game-data/weapon.json',
  '/game-data/equipment.json',
  '/game-data/bangboo.json',
  '/game-data/bangboo_index.json',
  '/game-data/enemy.json',
  '/game-data/enemy_index.json',
  '/game-data/anomaly_bars.json',
];

/**
 * 游戏数据缓存服务
 */
class GameDataCacheService {
  private static instance: GameDataCacheService;

  private constructor() {}

  static getInstance(): GameDataCacheService {
    if (!GameDataCacheService.instance) {
      GameDataCacheService.instance = new GameDataCacheService();
    }
    return GameDataCacheService.instance;
  }

  /**
   * 带缓存的 JSON 加载
   *
   * 优先从 IndexedDB 缓存加载，缓存未命中时从网络加载并写入缓存
   */
  async loadJsonWithCache<T>(path: string): Promise<T> {
    // 如果 IndexedDB 不可用，直接从网络加载
    if (!dbService.isAvailable) {
      return this.fetchJson<T>(path);
    }

    try {
      // 尝试从缓存读取
      const cached = await dbService.getGameDataCache(path);
      if (cached) {
        return cached.data as T;
      }

      // 缓存未命中，从网络加载
      const data = await this.fetchJson<T>(path);

      // 写入缓存
      const version = (await dbService.getGameDataVersion()) || 'unknown';
      await dbService.putGameDataCache(path, data, version);

      return data;
    } catch (err) {
      console.warn(`[GameDataCache] 缓存加载失败，直接从网络加载: ${path}`, err);
      return this.fetchJson<T>(path);
    }
  }

  /**
   * 从网络加载 JSON
   */
  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }

    const text = await response.text();
    // 检查是否是 HTML 页面（404 错误页面等）
    if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
      throw new Error(`Failed to load ${path}: Server returned HTML instead of JSON`);
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse JSON from ${path}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 检查版本并决定是否刷新缓存
   *
   * @returns 是否刷新了缓存
   */
  async checkAndRefreshCache(newVersion: string): Promise<boolean> {
    if (!dbService.isAvailable) {
      return false;
    }

    const cachedVersion = await dbService.getGameDataVersion();

    if (cachedVersion !== newVersion) {
      await dbService.clearGameDataCache();
      await dbService.setGameDataVersion(newVersion);
      return true;
    }

    return false;
  }

  /**
   * 获取缓存的版本号
   */
  async getCachedVersion(): Promise<string | null> {
    if (!dbService.isAvailable) {
      return null;
    }
    return dbService.getGameDataVersion();
  }

  /**
   * 预加载所有索引文件到缓存
   */
  async preloadIndexFiles(): Promise<void> {
    if (!dbService.isAvailable) {
      return;
    }

    await Promise.all(INDEX_FILES.map((path) => this.loadJsonWithCache(path)));
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    if (!dbService.isAvailable) {
      return;
    }
    await dbService.clearGameDataCache();
  }

  /**
   * 获取索引文件列表
   */
  getIndexFiles(): string[] {
    return [...INDEX_FILES];
  }
}

export const gameDataCacheService = GameDataCacheService.getInstance();
