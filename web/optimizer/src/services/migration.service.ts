/**
 * 数据迁移服务
 *
 * 负责将 localStorage 中的旧数据迁移到 IndexedDB
 */

import { dbService } from './db.service';
import type { SaveDataZod } from '../model/save-data-zod';

const STORAGE_KEY = 'zzz_optimizer_saves';
const CURRENT_SAVE_KEY = 'zzz_optimizer_current_save';

/**
 * 迁移结果
 */
export interface MigrationResult {
  success: boolean;
  migratedSaves: number;
  errors: string[];
}

/**
 * 迁移服务
 */
class MigrationService {
  private static instance: MigrationService;

  private constructor() {}

  static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * 检查是否需要迁移
   */
  async needsMigration(): Promise<boolean> {
    // 如果 IndexedDB 不可用，不需要迁移
    if (!dbService.isAvailable) {
      return false;
    }

    // 检查 localStorage 是否有数据
    const oldData = localStorage.getItem(STORAGE_KEY);
    if (oldData === null) {
      // 没有旧数据，不需要迁移
      return false;
    }

    // 检查是否已完成迁移
    const completed = await dbService.isMigrationCompleted();
    if (completed) {
      return false;
    }

    return true;
  }

  /**
   * 执行迁移
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedSaves: 0,
      errors: [],
    };

    try {
      // 读取 localStorage 数据
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) {
        // 没有数据需要迁移，标记完成
        await dbService.setMigrationCompleted(true);
        result.success = true;
        return result;
      }

      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(savedData);
      } catch (err) {
        result.errors.push(`解析 localStorage 数据失败: ${err}`);
        return result;
      }

      // 逐个迁移存档
      for (const [name, data] of Object.entries(parsed)) {
        try {
          // 验证数据格式
          if (!this.isValidSaveData(data)) {
            result.errors.push(`存档 "${name}" 格式无效，跳过`);
            continue;
          }

          await dbService.putSave(name, data as SaveDataZod);
          result.migratedSaves++;
        } catch (err) {
          result.errors.push(`存档 "${name}" 迁移失败: ${err}`);
        }
      }

      // 迁移当前存档指针
      const currentSave = localStorage.getItem(CURRENT_SAVE_KEY);
      if (currentSave) {
        await dbService.setCurrentSaveName(currentSave);
      }

      // 标记迁移完成
      await dbService.setMigrationCompleted(true);

      result.success = result.errors.length === 0;

      return result;
    } catch (err) {
      result.errors.push(`迁移过程出错: ${err}`);
      return result;
    }
  }

  /**
   * 清理 localStorage（迁移成功后调用）
   */
  cleanupLocalStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_SAVE_KEY);
  }

  /**
   * 验证存档数据格式
   */
  private isValidSaveData(data: any): data is SaveDataZod {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.format === 'string' &&
      data.format === 'ZOD'
    );
  }
}

export const migrationService = MigrationService.getInstance();
