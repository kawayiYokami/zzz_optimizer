/**
 * 存档数据服务
 *
 * 负责存档数据的规范化和验证
 */

import type { SaveDataZod } from '../model/save-data-zod';
import { dataLoaderService } from './data-loader.service';

/**
 * 存档数据服务
 */
class SaveDataService {
  private static instance: SaveDataService;

  private constructor() {}

  static getInstance(): SaveDataService {
    if (!SaveDataService.instance) {
      SaveDataService.instance = new SaveDataService();
    }
    return SaveDataService.instance;
  }

  /**
   * 验证是否为有效的 ZOD 存档数据
   */
  isZodSaveData(data: any): data is SaveDataZod {
    return data && typeof data === 'object' && typeof data.format === 'string' && data.format === 'ZOD';
  }

  /**
   * 规范化 ZOD 数据
   * 将各种语言的键名统一为标准格式
   */
  normalizeZodData(data: SaveDataZod): SaveDataZod {
    const cloned: SaveDataZod = JSON.parse(JSON.stringify(data));
    cloned.characters = (cloned.characters ?? []).map((char) => ({
      ...char,
      key: this.normalizeCharacterKey(char.key),
    }));
    cloned.wengines = (cloned.wengines ?? []).map((wengine) => ({
      ...wengine,
      key: this.normalizeWengineKey(wengine.key),
    }));
    cloned.discs = (cloned.discs ?? []).map((disc) => ({
      ...disc,
      setKey: this.normalizeDiscSetKey(disc.setKey),
    }));
    return cloned;
  }

  /**
   * 规范化角色键名
   * 支持多语言名称匹配，返回标准 code
   */
  normalizeCharacterKey(key: string): string {
    const normalized = this.keyNormalizer(key);
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
        if (this.keyNormalizer(candidate) === normalized) {
          return info.code || candidate;
        }
      }
    }

    return key;
  }

  /**
   * 规范化音擎键名
   * 支持多语言名称匹配，返回英文名
   */
  normalizeWengineKey(key: string): string {
    const normalized = this.keyNormalizer(key);
    const weaponData = dataLoaderService.weaponData;
    if (!weaponData) {
      return key;
    }

    for (const info of weaponData.values()) {
      const candidates = [info.EN, info.CHS, info.JP, info.KR].filter(Boolean) as string[];
      for (const candidate of candidates) {
        if (this.keyNormalizer(candidate) === normalized) {
          return info.EN || candidate;
        }
      }
    }

    return key;
  }

  /**
   * 规范化驱动盘套装键名
   * 支持多语言名称匹配，返回英文名
   */
  normalizeDiscSetKey(key: string): string {
    const normalized = this.keyNormalizer(key);
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
        if (this.keyNormalizer(name) === normalized) {
          return info.EN?.name || name;
        }
      }
    }

    return key;
  }

  /**
   * 键值规范化器
   * 移除空格、引号、连字符，转小写
   */
  private keyNormalizer(value: string): string {
    return value
      ? value.replace(/[\s'\-]/g, '').toLowerCase()
      : '';
  }
}

export const saveDataService = SaveDataService.getInstance();
