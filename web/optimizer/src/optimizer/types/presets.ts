/**
 * 优化器预设类型定义
 *
 * 用于保存和加载用户的优化配置
 */

import type { OptimizationConstraints } from './serialized';

/**
 * 优化配置预设
 */
export interface OptimizationPreset {
    /** 预设 ID */
    id: string;
    /** 预设名称 */
    name: string;
    /** 适用角色 ID（可选，空表示通用） */
    agentId?: string;
    /** 约束配置 */
    constraints: Partial<OptimizationConstraints>;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt?: string;
}

/**
 * 预设存储数据结构
 */
export interface PresetStorage {
    /** 版本号 */
    version: number;
    /** 预设列表 */
    presets: OptimizationPreset[];
}

/**
 * 预设存储键名
 */
export const PRESETS_STORAGE_KEY = 'zzz_optimizer_presets';

/**
 * 当前预设存储版本
 */
export const PRESETS_STORAGE_VERSION = 1;
