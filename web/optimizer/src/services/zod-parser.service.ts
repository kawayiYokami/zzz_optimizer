/**
 * ZOD 格式解析服务
 *
 * 负责解析 ZOD 格式的导出数据（Zenless Optimizer 格式）
 * 转换为内部的 Agent、DriveDisk、WEngine 对象
 */

import { Agent } from "../model/agent";
import { DriveDisk } from "../model/drive-disk";
import { WEngine } from "../model/wengine";
import { dataLoaderService } from "./data-loader.service";

/**
 * ZOD 格式的驱动盘数据
 */
export interface ZodDiscData {
  setKey: string; // 套装的codename，如 "Flow"、"Miasma"
  rarity: string;
  level: number;
  slotKey: string;
  mainStatKey: string;
  substats: Array<{
    key: string;
    upgrades: number;
  }>;
  location: string;
  lock: boolean;
  trash: boolean;
  id: string;
}

/**
 * ZOD 格式的角色数据
 */
export interface ZodCharacterData {
  key: string;
  level: number;
  core: number;
  mindscape: number;
  dodge: number;
  basic: number;
  chain: number;
  special: number;
  assist: number;
  promotion: number;
  potential: number;
  equippedDiscs: Record<string, string>;
  equippedWengine: string;
  id: string;
}

/**
 * ZOD 格式的音擎数据
 */
export interface ZodWengineData {
  key: string;
  level: number;
  modification: number;
  promotion: number;
  location: string;
  id: string;
}

/**
 * ZOD 格式的完整数据
 */
export interface ZodData {
  format: string;
  dbVersion: number;
  source: string;
  version: number;
  discs?: ZodDiscData[];
  characters?: ZodCharacterData[];
  wengines?: ZodWengineData[];
}

/**
 * ZOD 解析服务
 */
export class ZodParserService {
  private static instance: ZodParserService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ZodParserService {
    if (!ZodParserService.instance) {
      ZodParserService.instance = new ZodParserService();
    }
    return ZodParserService.instance;
  }

  /**
   * 解析 ZOD 格式数据
   */
  async parseZodData(data: ZodData): Promise<{
    agents: Map<string, Agent>;
    driveDisks: Map<string, DriveDisk>;
    wengines: Map<string, WEngine>;
  }> {
    const agents = new Map<string, Agent>();
    const driveDisks = new Map<string, DriveDisk>();
    const wengines = new Map<string, WEngine>();

    // 解析驱动盘
    if (data.discs) {
      for (const discData of data.discs) {
        const disk = await this.parseDisc(discData);
        if (disk) {
          driveDisks.set(disk.id, disk);
        }
      }
    }

    // 解析角色
    if (data.characters) {
      for (const charData of data.characters) {
        const agent = await this.parseCharacter(charData);
        if (agent) {
          agents.set(agent.id, agent);
        }
      }
    }

    // 解析音擎
    if (data.wengines) {
      for (const wengineData of data.wengines) {
        const wengine = await this.parseWengine(wengineData);
        if (wengine) {
          wengines.set(wengine.id, wengine);
        }
      }
    }

    return { agents, driveDisks, wengines };
  }

  /**
   * 解析驱动盘数据
   */
  private async parseDisc(data: ZodDiscData): Promise<DriveDisk | null> {
    try {
      // 直接调用DriveDisk.fromZodData方法，确保使用最新的解析逻辑
      const disk = await DriveDisk.fromZodData(data, dataLoaderService);
      return disk;
    } catch (error) {
      console.error(`Failed to parse disc ${data.id}:`, error);
      return null;
    }
  }

  /**
   * 解析角色数据
   */
  private async parseCharacter(data: ZodCharacterData): Promise<Agent | null> {
    try {
      // 使用 Agent.fromZodData 方法创建 Agent 实例，确保所有私有属性都被正确初始化
      const agent = await Agent.fromZodData(data as any, dataLoaderService);
      return agent;
    } catch (error) {
      console.error(`Failed to parse character ${data.id}:`, error);
      return null;
    }
  }

  /**
   * 解析音擎数据
   */
  private async parseWengine(data: ZodWengineData): Promise<WEngine | null> {
    try {
      // 直接调用WEngine.fromZodData方法，确保使用最新的解析逻辑
      const wengine = await WEngine.fromZodData(data, dataLoaderService);
      return wengine;
    } catch (error) {
      console.error(`Failed to parse wengine ${data.id}:`, error);
      return null;
    }
  }
}

// 导出单例实例
export const zodParserService = ZodParserService.getInstance();
