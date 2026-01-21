/**
 * 优化器序列化类型定义
 *
 * 这些接口用于 Worker 通信，只包含纯数据（可 JSON 序列化），不包含方法。
 * 主线程负责将类实例转换为这些纯数据接口，Worker 接收后重建计算逻辑。
 */

import { PropertyType, ElementType, WeaponType } from '../../model/base';

// ============================================================================
// 基础序列化接口
// ============================================================================

/**
 * Buff 纯数据接口
 *
 * 将 Buff 类实例的属性效果预先解析为纯数据
 */
export interface BuffData {
    /** Buff 唯一标识 */
    id: string;
    /** Buff 名称（用于调试） */
    name: string;
    /** 局外属性效果（已解析） */
    outOfCombatStats: Partial<Record<PropertyType, number>>;
    /** 局内属性效果（已解析） */
    inCombatStats: Partial<Record<PropertyType, number>>;
    /** 转换类属性（如果有） */
    conversion?: {
        fromProperty: PropertyType;
        toProperty: PropertyType;
        conversionRatio: number;
        maxValue?: number;
        fromPropertyThreshold?: number;
    };
    /** 是否激活 */
    isActive: boolean;
    /** 触发条件标识（用于 UI 显示） */
    triggerConditions?: string;
}

/**
 * 序列化的角色数据
 *
 * 包含角色的基础属性和被动 Buff，不依赖 dataLoaderService
 */
export interface SerializedAgent {
    /** 角色 ID */
    id: string;
    /** 角色名称 */
    name: string;
    /** 角色等级 */
    level: number;
    /** 元素类型 */
    element: ElementType;
    /** 武器类型 */
    weaponType: WeaponType;
    /**
     * 角色基础属性（局外）
     * - HP_BASE, ATK_BASE, DEF_BASE
     * - CRIT_, CRIT_DMG_, PEN_, ANOM_MAS 等
     */
    baseStats: Partial<Record<PropertyType, number>>;
    /**
     * 角色核心技加成
     */
    coreSkillStats: Partial<Record<PropertyType, number>>;
    /**
     * 角色被动 Buff（已解析）
     * 包括天赋、核心被动等
     */
    passiveBuffs: BuffData[];
}

/**
 * 序列化的音擎数据
 */
export interface SerializedWEngine {
    /** 音擎 ID */
    id: string;
    /** 音擎名称 */
    name: string;
    /** 音擎等级 */
    level: number;
    /** 精炼等级 (1-5) */
    refinement: number;
    /**
     * 音擎基础属性
     * - ATK_BASE（主属性）
     * - 副属性（ATK_, CRIT_, 等）
     */
    stats: Partial<Record<PropertyType, number>>;
    /**
     * 音擎 Buff（已解析）
     */
    buffs: BuffData[];
}

/**
 * 序列化的驱动盘数据
 */
export interface SerializedDriveDisk {
    /** 驱动盘 ID */
    id: string;
    /** 套装 ID */
    setId: string;
    /** 套装名称 */
    setName: string;
    /** 位置 (1-6) */
    position: number;
    /** 稀有度 */
    rarity: 'S' | 'A' | 'B';
    /** 等级 */
    level: number;
    /** 主词条 */
    mainStat: {
        type: PropertyType;
        value: number;
    };
    /** 副词条 */
    subStats: Partial<Record<PropertyType, number>>;
    /** 副词条强化次数（用于有效词条剪枝） */
    subStatRolls?: Partial<Record<PropertyType, number>>;
    /** 有效词条得分（预计算，用于剪枝） */
    effectiveScore?: number;
}

/**
 * 序列化的套装加成数据
 */
export interface SerializedSetBonus {
    /** 套装 ID */
    setId: string;
    /** 套装名称 */
    setName: string;
    /** 2 件套属性加成 */
    twoPieceStats: Partial<Record<PropertyType, number>>;
    /** 4 件套属性加成 */
    fourPieceStats: Partial<Record<PropertyType, number>>;
    /** 4 件套 Buff（某些套装有条件触发的效果） */
    fourPieceBuffs: BuffData[];
}

// ============================================================================
// Worker 通信接口
// ============================================================================

/**
 * 有效词条剪枝配置
 */
export interface EffectiveStatPruningConfig {
    /** 启用有效词条剪枝 */
    enabled: boolean;
    /** 用户选择的有效词条类型 */
    effectiveStats: PropertyType[];
    /** 主词条得分（默认 10） */
    mainStatScore: number;
    /** 剪枝阈值（与 TopN 最后一名的差距，默认 10） */
    pruneThreshold: number;
}

/**
 * 优化约束条件
 */
export interface OptimizationConstraints {
    /**
     * 各位置主词条筛选
     * key: 位置 (4, 5, 6)，value: 允许的主词条类型列表
     * 1-3 号位主词条固定，无需筛选
     */
    mainStatFilters: Partial<Record<number, PropertyType[]>>;
    /**
     * 必须包含的套装 ID 列表
     * 空数组表示不限制
     */
    requiredSets: string[];
    /**
     * 锁定位置
     * key: 位置 (1-6)，value: 锁定的驱动盘 ID
     * 锁定的位置不参与优化，使用指定的驱动盘
     */
    pinnedSlots: Partial<Record<number, string>>;
    /**
     * 套装模式
     * - 'any': 不限制套装组合
     * - 'complete': 只考虑完整套装组合 (2+4 或 2+2+2)
     */
    setMode: 'any' | 'complete';
    /**
     * 选中参与优化的武器 ID 列表（手动选择）
     * 空数组或 undefined 表示使用所有可用武器
     */
    selectedWeaponIds?: string[];
    /**
     * 有效词条剪枝配置
     */
    effectiveStatPruning?: EffectiveStatPruningConfig;
    /**
     * 激活的驱动盘套装 ID 列表
     * 只有在此列表中的套装才会提供 4 件套效果
     * 空数组表示不激活任何 4 件套效果
     */
    activeDiskSets: string[];
    /**
     * 排除的队伍 ID 列表（优先级比当前队伍高的队伍）
     * 这些队伍身上的驱动盘将被排除
     */
    excludedTeamIds?: string[];
}

/**
 * 敌人数据（序列化）
 */
export interface SerializedEnemy {
    /** 敌人等级 */
    level: number;
    /** 敌人防御值 */
    def: number;
    /** 各元素抗性 */
    resistance: Partial<Record<string, number>>;
    /** 是否处于失衡状态 */
    isStunned: boolean;
    /** 失衡易伤倍率 */
    stunVulnerability: number;
}

/**
 * 技能数据（序列化）
 */
export interface SerializedSkill {
    /** 技能 ID */
    id: string;
    /** 技能名称 */
    name: string;
    /** 技能倍率 */
    ratio: number;
    /** 技能元素类型 */
    element: ElementType;
    /** 技能标签（用于匹配增伤） */
    tags: string[];
    /** 是否是贯穿技能 */
    isPenetration: boolean;
    /** 异常积蓄值 (单次技能) */
    anomalyBuildup: number;
}

/**
 * 优化构建结果
 */
export interface OptimizationBuild {
    /** 音擎 ID */
    weaponId: string;
    /** 驱动盘 ID 列表 (6 个) */
    discIds: [string, string, string, string, string, string];
    /** 最终伤害（期望值） */
    damage: number;
    /** 最终属性快照（用于 UI 展示） */
    finalStats: Partial<Record<PropertyType, number>>;
    /** 套装信息 */
    setBonusInfo: {
        /** 激活的 2 件套 */
        twoPieceSets: string[];
        /** 激活的 4 件套 */
        fourPieceSet: string | null;
    };
    /** 伤害构成详情 */
    damageBreakdown?: {
        direct: number;
        anomaly: number;
        disorder: number;
    };
}
