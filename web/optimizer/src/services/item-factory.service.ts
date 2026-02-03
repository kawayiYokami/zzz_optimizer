/**
 * 物品工厂服务
 *
 * 负责创建音擎和驱动盘的 ZOD 数据结构
 */

import type { ZodWengineData, ZodDiscData } from '../model/save-data-zod';
import { saveDataService } from './save-data.service';

/**
 * 物品工厂服务
 */
class ItemFactoryService {
  private static instance: ItemFactoryService;

  private constructor() {}

  static getInstance(): ItemFactoryService {
    if (!ItemFactoryService.instance) {
      ItemFactoryService.instance = new ItemFactoryService();
    }
    return ItemFactoryService.instance;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  /**
   * 创建音擎 ZOD 数据
   */
  buildZodWengineData(
    key: string,
    level: number = 60,
    refinement: number = 1,
    promotion: number = 5
  ): ZodWengineData {
    const normalizedKey = saveDataService.normalizeWengineKey(key);
    const id = this.generateId('wengine');

    return {
      id,
      key: normalizedKey,
      level,
      modification: refinement,
      promotion,
      location: '',
      lock: false,
    };
  }

  /**
   * 创建驱动盘 ZOD 数据
   */
  buildZodDiscData(
    setKey: string,
    rarity: string,
    level: number = 60,
    slotKey: string,
    mainStatKey: string,
    substats: ZodDiscData['substats'] = []
  ): ZodDiscData {
    // 规范化 setKey
    const normalizedSetKey = saveDataService.normalizeDiscSetKey(setKey);

    // slotKey 兼容：
    // - ZOD 导出规范： "1".."6"
    // - UI 可能传: "slot1".."slot6"
    const slotStr = slotKey.startsWith('slot') ? slotKey.replace('slot', '') : slotKey;

    const id = this.generateId('disk');

    return {
      id,
      setKey: normalizedSetKey,
      rarity,
      level,
      slotKey: slotStr,
      mainStatKey,
      substats,
      location: '',
      lock: false,
      trash: false,
    };
  }
}

export const itemFactoryService = ItemFactoryService.getInstance();
