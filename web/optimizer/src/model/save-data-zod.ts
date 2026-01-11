/**
 * 简化的存档数据模型
 *
 * 直接存储ZOD格式，不做任何转换
 */

export interface ZodCharacterData {
  key: string;          // CodeName: "Anby"
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

export interface ZodWengineData {
  key: string;          // EN name
  level: number;
  modification: number; // 精炼
  promotion: number;    // 突破
  location: string;     // 装备角色ID
  id: string;
}

export interface ZodDiscData {
  setKey: string;       // 套装CodeName: "WhiteWaterBallad"
  rarity: string;
  level: number;
  slotKey: string;      // 位置
  mainStatKey: string;
  substats: Array<{
    key: string;
    upgrades: number;
  }>;
  location: string;     // 装备角色ID
  lock: boolean;
  trash: boolean;
  id: string;
}

/**
 * 存档数据（完全ZOD格式）
 */
export interface SaveDataZod {
  name: string;
  format: string;
  dbVersion: number;
  source: string;
  version: number;
  created_at?: string;
  updated_at?: string;

  characters: ZodCharacterData[];
  wengines: ZodWengineData[];
  discs: ZodDiscData[];
}
