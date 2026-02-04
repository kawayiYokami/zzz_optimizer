/**
 * 导入导出服务
 *
 * 负责存档数据的导入导出和合并逻辑
 */

import type { SaveDataZod } from '../model/save-data-zod';
import type { ImportOptions, ImportResult } from '../model/import-result';
import { DEFAULT_IMPORT_OPTIONS } from '../model/import-result';
import { mergeZodData } from './merge.service';
import { zodParserService } from './zod-parser.service';
import { saveDataService } from './save-data.service';

/**
 * 导入导出服务
 */
class ImportExportService {
  private static instance: ImportExportService;

  private constructor() {}

  static getInstance(): ImportExportService {
    if (!ImportExportService.instance) {
      ImportExportService.instance = new ImportExportService();
    }
    return ImportExportService.instance;
  }

  /**
   * 导出单个存档为 JSON 字符串
   */
  exportAsZod(rawSave: SaveDataZod): string {
    return JSON.stringify(rawSave, null, 2);
  }

  /**
   * 导出所有存档为 JSON 字符串
   */
  exportAll(rawSaves: Map<string, SaveDataZod>): string {
    const dataToSave = Object.fromEntries(rawSaves.entries());
    return JSON.stringify(dataToSave, null, 2);
  }

  /**
   * 解析并验证导入数据
   * @throws 如果数据格式无效
   */
  parseImportData(data: any): SaveDataZod {
    if (!saveDataService.isZodSaveData(data)) {
      throw new Error('Invalid ZOD data');
    }
    return saveDataService.normalizeZodData(data as SaveDataZod);
  }

  /**
   * 计算导入合并结果
   * 用于预览和实际导入
   */
  async computeMerge(
    importData: SaveDataZod,
    existingData: SaveDataZod | undefined,
    options: ImportOptions = DEFAULT_IMPORT_OPTIONS
  ): Promise<{ merged: SaveDataZod; result: ImportResult }> {
    // 先解析导入数据，收集解析错误
    const parseResult = await zodParserService.parseZodDataWithErrors(importData);
    const parseErrors = parseResult.errors;

    const invalidDiscIds = new Set<string>();
    const invalidCharacterIds = new Set<string>();
    const invalidWengineIds = new Set<string>();

    for (const e of parseErrors) {
      if (!e.id) continue;
      if (e.type === 'disc') invalidDiscIds.add(e.id);
      if (e.type === 'character') invalidCharacterIds.add(e.id);
      if (e.type === 'wengine') invalidWengineIds.add(e.id);
    }

    // 安全保护：如果存在解析失败条目，"删除导入中不存在项" 会导致误删
    if (options.deleteNotInImport && parseErrors.length > 0) {
      throw new Error('导入文件存在解析失败条目：为避免误删，请先关闭"删除导入中不存在的项"，或修复导入文件后再尝试。');
    }

    // 过滤掉无法解析的条目：避免 SaveData.fromZod 在生成实例时崩溃
    const sanitizedImportData: SaveDataZod = {
      ...importData,
      discs: (importData.discs ?? []).filter((d) => parseResult.driveDisks.has(d.id)),
      characters: (importData.characters ?? []).filter((c) => parseResult.agents.has(c.id)),
      wengines: (importData.wengines ?? []).filter((w) => parseResult.wengines.has(w.id)),
    };

    // 同步剔除已有数据中与“导入非法条目”同 ID 的记录，避免被 keepNotInImport 重新保留
    const sanitizedExistingData: SaveDataZod | undefined = existingData
      ? {
          ...existingData,
          discs: (existingData.discs ?? []).filter((d) => !invalidDiscIds.has(d.id)),
          characters: (existingData.characters ?? []).filter((c) => !invalidCharacterIds.has(c.id)),
          wengines: (existingData.wengines ?? []).filter((w) => !invalidWengineIds.has(w.id)),
        }
      : existingData;

    // 合并数据（传入解析错误，用于 UI 展示）
    const { merged, result } = mergeZodData(sanitizedImportData, sanitizedExistingData, options, parseErrors);

    // 修正统计：import 计数应该以文件原始数量为准
    result.discs.import = importData.discs?.length ?? 0;
    result.characters.import = importData.characters?.length ?? 0;
    result.wengines.import = importData.wengines?.length ?? 0;

    // 收集无效条目用于 UI 展示
    const invalidDiscs: any[] = [];
    const invalidCharacters: any[] = [];
    const invalidWengines: any[] = [];

    for (const e of parseErrors) {
      if (e.type === 'disc') invalidDiscs.push(e.rawData);
      if (e.type === 'character') invalidCharacters.push(e.rawData);
      if (e.type === 'wengine') invalidWengines.push(e.rawData);
    }

    result.discs.invalid = invalidDiscs as any;
    result.characters.invalid = invalidCharacters as any;
    result.wengines.invalid = invalidWengines as any;

    return { merged, result };
  }
}

export const importExportService = ImportExportService.getInstance();
