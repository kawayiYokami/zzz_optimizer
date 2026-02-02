/**
 * 导入结果类型定义
 */

import type { ZodDiscData, ZodWengineData, ZodCharacterData } from './save-data-zod';

/**
 * 单项导入结果计数器
 */
export interface ImportResultCounter<T> {
    /** 导入文件中的总数 */
    import: number;
    /** 新增的项 */
    new: T[];
    /** 更新的项（已有项被新数据更新） */
    update: T[];
    /** 未更改的项（检测到完全重复） */
    unchanged: T[];
    /** 升级的项（如驱动盘等级/词条升级） */
    upgraded: T[];
    /** 删除的项（本地有但导入没有） */
    remove: T[];
    /** 无效的项（数据校验失败） */
    invalid: T[];
    /** 本地存在但导入文件中没有的项数量 */
    notInImport: number;
    /** 合并前本地已有的数量 */
    beforeMerge: number;
}

/**
 * 创建空的计数器
 */
export function newCounter<T>(): ImportResultCounter<T> {
    return {
        import: 0,
        new: [],
        update: [],
        unchanged: [],
        upgraded: [],
        remove: [],
        invalid: [],
        notInImport: 0,
        beforeMerge: 0,
    };
}

/**
 * 完整导入结果
 */
export interface ImportResult {
    type: 'ZOD';
    source: string;
    discs: ImportResultCounter<ZodDiscData>;
    wengines: ImportResultCounter<ZodWengineData>;
    characters: ImportResultCounter<ZodCharacterData>;
    /** 是否保留本地已有但导入中没有的项 */
    keepNotInImport: boolean;
    /** 是否忽略去重检测（全部作为新增） */
    ignoreDups: boolean;
}

/**
 * 创建空的导入结果
 */
export function newImportResult(
    source: string,
    keepNotInImport: boolean,
    ignoreDups: boolean
): ImportResult {
    return {
        type: 'ZOD',
        source,
        discs: newCounter(),
        wengines: newCounter(),
        characters: newCounter(),
        keepNotInImport,
        ignoreDups,
    };
}

/**
 * 导入选项
 */
export interface ImportOptions {
    /** 检测更新/重复（勾选=开启检测，不勾选=忽略去重全部新增） */
    detectDups: boolean;
    /** 删除导入中不存在的项（勾选=删除，不勾选=保留） */
    deleteNotInImport: boolean;
}

/**
 * 默认导入选项
 */
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
    detectDups: true,
    deleteNotInImport: false,
};
