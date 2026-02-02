/**
 * 驱动盘合并服务
 *
 * 负责导入时的去重、更新检测和数据合并
 */

import type { ZodDiscData, ZodWengineData, ZodCharacterData, SaveDataZod } from '../model/save-data-zod';
import type { ImportResult, ImportResultCounter, ImportOptions } from '../model/import-result';
import { newCounter, newImportResult } from '../model/import-result';

// ============================================================================
// 驱动盘去重
// ============================================================================

/**
 * 查找重复或升级的驱动盘
 *
 * 规则：
 * - 相同套装 + 相同位置 + 相同主词条 + 相同稀有度 = 候选
 * - 导入等级 >= 已有等级 = 候选
 * - 导入副词条 >= 已有副词条（同key更高upgrades） = 候选
 *
 * 分类：
 * - duplicated: 完全重复（等级相同、副词条完全一致）
 * - upgraded: 升级版本（等级更高或副词条有提升）
 */
export function findDiscDups(
    importDisc: ZodDiscData,
    existingDiscs: ZodDiscData[]
): { duplicated: ZodDiscData[]; upgraded: ZodDiscData[] } {
    const { setKey, rarity, slotKey, mainStatKey, level, substats } = importDisc;

    // 过滤候选：基本属性相同且导入项"不比已有项差"
    const candidates = existingDiscs.filter(
        (candidate) =>
            setKey === candidate.setKey &&
            rarity === candidate.rarity &&
            slotKey === candidate.slotKey &&
            mainStatKey === candidate.mainStatKey &&
            level >= candidate.level &&
            substats.every(
                (sub, i) =>
                    !candidate.substats[i]?.key || // 已有项这个位置没词条
                    (sub.key === candidate.substats[i]?.key && // 或者词条相同
                        sub.upgrades >= candidate.substats[i]?.upgrades) // 且升级次数更多
            )
    );

    // 严格升级：等级更高，且词条有明确提升
    const upgraded = candidates
        .filter(
            (candidate) =>
                level > candidate.level ||
                substats.some(
                    (sub, i) =>
                        candidate.substats[i]?.key &&
                        sub.upgrades > candidate.substats[i]?.upgrades
                )
        )
        .sort((a, b) =>
            // 优先选择相同位置的
            a.location === importDisc.location ? -1 : b.location === importDisc.location ? 1 : 0
        );

    // 严格重复：等级相同，词条完全一致
    const duplicated = candidates
        .filter(
            (candidate) =>
                level === candidate.level &&
                substats.every(
                    (sub, i) =>
                        sub.key === candidate.substats[i]?.key &&
                        sub.upgrades === candidate.substats[i]?.upgrades
                )
        )
        .sort((a, b) =>
            // 优先选择相同位置的
            a.location === importDisc.location ? -1 : b.location === importDisc.location ? 1 : 0
        );

    return { duplicated, upgraded };
}

/**
 * 合并驱动盘数据
 */
export function mergeDiscs(
    importDiscs: ZodDiscData[],
    existingDiscs: ZodDiscData[],
    result: ImportResult
): ZodDiscData[] {
    const counter = result.discs;
    counter.beforeMerge = existingDiscs.length;
    counter.import = importDiscs.length;

    if (!importDiscs.length) {
        counter.notInImport = existingDiscs.length;
        return result.keepNotInImport ? [...existingDiscs] : [];
    }

    // 收集已使用的 ID（防止冲突）
    const takenIds = new Set<string>(existingDiscs.map((d) => d.id));
    importDiscs.forEach((d) => {
        if (d.id) takenIds.add(d.id);
    });

    const idsToRemove = new Set<string>(existingDiscs.map((d) => d.id));
    const hasLocation = importDiscs.some((d) => d.location);
    const mergedDiscs: ZodDiscData[] = [];

    for (const importDisc of importDiscs) {
        let finalDisc = { ...importDisc };
        let foundDupOrUpgrade = false;

        if (!result.ignoreDups) {
            const { duplicated, upgraded } = findDiscDups(importDisc, existingDiscs.filter((d) => idsToRemove.has(d.id)));

            if (duplicated[0] || upgraded[0]) {
                foundDupOrUpgrade = true;

                // 优先选择相同位置的升级项，否则选第一个重复项
                let match: ZodDiscData;
                let isUpgrade: boolean;

                if (hasLocation && importDisc.location && upgraded[0]?.location === importDisc.location) {
                    match = upgraded[0];
                    isUpgrade = true;
                } else if (duplicated[0]) {
                    match = duplicated[0];
                    isUpgrade = false;
                } else {
                    match = upgraded[0];
                    isUpgrade = true;
                }

                // 如果导入项有 ID，优先匹配完全相同的 ID
                if (importDisc.id) {
                    const upById = upgraded.find((d) => d.id === importDisc.id);
                    if (upById) {
                        match = upById;
                        isUpgrade = true;
                    }
                    const dupById = duplicated.find((d) => d.id === importDisc.id);
                    if (dupById) {
                        match = dupById;
                        isUpgrade = false;
                    }
                }

                if (isUpgrade) {
                    counter.upgraded.push(importDisc);
                } else {
                    counter.unchanged.push(importDisc);
                }

                idsToRemove.delete(match.id);

                // 保留已有位置（如果导入文件没有位置信息）
                finalDisc = {
                    ...importDisc,
                    id: match.id, // 复用旧 ID
                    location: hasLocation ? importDisc.location : match.location,
                };
            }
        }

        if (!foundDupOrUpgrade) {
            counter.new.push(importDisc);
            // 确保有唯一 ID
            if (!finalDisc.id || mergedDiscs.some((d) => d.id === finalDisc.id)) {
                finalDisc.id = generateId(takenIds);
                takenIds.add(finalDisc.id);
            }
        }

        mergedDiscs.push(finalDisc);
    }

    // 处理导入中不存在的项
    const notInImportDiscs = existingDiscs.filter((d) => idsToRemove.has(d.id));
    if (result.keepNotInImport || result.ignoreDups) {
        counter.notInImport = notInImportDiscs.length;
        mergedDiscs.push(...notInImportDiscs);
    } else {
        counter.remove = notInImportDiscs;
    }

    return mergedDiscs;
}

// ============================================================================
// 音擎去重
// ============================================================================

/**
 * 查找重复的音擎
 *
 * 规则：相同 key + 相同等级 + 相同精炼 = 重复
 */
export function findWengineDups(
    importWengine: ZodWengineData,
    existingWengines: ZodWengineData[]
): { duplicated: ZodWengineData[]; upgraded: ZodWengineData[] } {
    const { key, level, modification } = importWengine;

    const candidates = existingWengines.filter(
        (candidate) =>
            key === candidate.key &&
            level >= candidate.level &&
            modification >= candidate.modification
    );

    // 严格升级
    const upgraded = candidates.filter(
        (candidate) =>
            level > candidate.level || modification > candidate.modification
    );

    // 严格重复
    const duplicated = candidates.filter(
        (candidate) =>
            level === candidate.level && modification === candidate.modification
    );

    return { duplicated, upgraded };
}

/**
 * 合并音擎数据
 */
export function mergeWengines(
    importWengines: ZodWengineData[],
    existingWengines: ZodWengineData[],
    result: ImportResult
): ZodWengineData[] {
    const counter = result.wengines;
    counter.beforeMerge = existingWengines.length;
    counter.import = importWengines.length;

    if (!importWengines.length) {
        counter.notInImport = existingWengines.length;
        return result.keepNotInImport ? [...existingWengines] : [];
    }

    const takenIds = new Set<string>(existingWengines.map((w) => w.id));
    importWengines.forEach((w) => {
        if (w.id) takenIds.add(w.id);
    });

    const idsToRemove = new Set<string>(existingWengines.map((w) => w.id));
    const hasLocation = importWengines.some((w) => w.location);
    const mergedWengines: ZodWengineData[] = [];

    for (const importWengine of importWengines) {
        let finalWengine = { ...importWengine };
        let foundDupOrUpgrade = false;

        if (!result.ignoreDups) {
            const { duplicated, upgraded } = findWengineDups(
                importWengine,
                existingWengines.filter((w) => idsToRemove.has(w.id))
            );

            if (duplicated[0] || upgraded[0]) {
                foundDupOrUpgrade = true;
                const match = duplicated[0] || upgraded[0];
                const isUpgrade = !duplicated[0];

                if (isUpgrade) {
                    counter.upgraded.push(importWengine);
                } else {
                    counter.unchanged.push(importWengine);
                }

                idsToRemove.delete(match.id);

                finalWengine = {
                    ...importWengine,
                    id: match.id,
                    location: hasLocation ? importWengine.location : match.location,
                };
            }
        }

        if (!foundDupOrUpgrade) {
            counter.new.push(importWengine);
            if (!finalWengine.id || mergedWengines.some((w) => w.id === finalWengine.id)) {
                finalWengine.id = generateId(takenIds);
                takenIds.add(finalWengine.id);
            }
        }

        mergedWengines.push(finalWengine);
    }

    const notInImportWengines = existingWengines.filter((w) => idsToRemove.has(w.id));
    if (result.keepNotInImport || result.ignoreDups) {
        counter.notInImport = notInImportWengines.length;
        mergedWengines.push(...notInImportWengines);
    } else {
        counter.remove = notInImportWengines;
    }

    return mergedWengines;
}

// ============================================================================
// 角色去重
// ============================================================================

/**
 * 合并角色数据
 *
 * 角色的 key 是唯一的，所以直接按 key 匹配
 */
export function mergeCharacters(
    importChars: ZodCharacterData[],
    existingChars: ZodCharacterData[],
    result: ImportResult
): ZodCharacterData[] {
    const counter = result.characters;
    counter.beforeMerge = existingChars.length;
    counter.import = importChars.length;

    if (!importChars.length) {
        counter.notInImport = existingChars.length;
        return result.keepNotInImport ? [...existingChars] : [];
    }

    const existingMap = new Map(existingChars.map((c) => [c.key, c]));
    const mergedChars: ZodCharacterData[] = [];
    const processedKeys = new Set<string>();

    for (const importChar of importChars) {
        const existing = existingMap.get(importChar.key);
        processedKeys.add(importChar.key);

        if (existing && !result.ignoreDups) {
            // 检查是否有更新
            const isUpgrade =
                importChar.level > existing.level ||
                importChar.mindscape > existing.mindscape ||
                importChar.core > existing.core;

            if (isUpgrade) {
                counter.upgraded.push(importChar);
            } else {
                counter.unchanged.push(importChar);
            }

            // 保留已有装备（如果导入没有）
            mergedChars.push({
                ...importChar,
                id: existing.id,
                equippedDiscs: Object.keys(importChar.equippedDiscs).length > 0
                    ? importChar.equippedDiscs
                    : existing.equippedDiscs,
                equippedWengine: importChar.equippedWengine || existing.equippedWengine,
            });
        } else {
            counter.new.push(importChar);
            mergedChars.push(importChar);
        }
    }

    // 处理导入中不存在的角色
    const notInImportChars = existingChars.filter((c) => !processedKeys.has(c.key));
    if (result.keepNotInImport || result.ignoreDups) {
        counter.notInImport = notInImportChars.length;
        mergedChars.push(...notInImportChars);
    } else {
        counter.remove = notInImportChars;
    }

    return mergedChars;
}

// ============================================================================
// 完整合并
// ============================================================================

/**
 * 合并完整的 ZOD 数据
 */
export function mergeZodData(
    importData: SaveDataZod,
    existingData: SaveDataZod | undefined,
    options: ImportOptions
): { merged: SaveDataZod; result: ImportResult } {
    const source = importData.source ?? 'Unknown';
    const keepNotInImport = !options.deleteNotInImport;
    const ignoreDups = !options.detectDups;

    const result = newImportResult(source, keepNotInImport, ignoreDups);

    const existing: SaveDataZod = existingData ?? {
        format: 'ZOD',
        dbVersion: importData.dbVersion,
        source: '',
        version: importData.version,
        characters: [],
        wengines: [],
        discs: [],
        teams: [],
        battles: [],
    };

    // 合并各类数据
    const mergedDiscs = mergeDiscs(importData.discs ?? [], existing.discs ?? [], result);
    const mergedWengines = mergeWengines(importData.wengines ?? [], existing.wengines ?? [], result);
    const mergedCharacters = mergeCharacters(importData.characters ?? [], existing.characters ?? [], result);

    // 队伍和战场数据：暂时直接使用导入数据（不做去重）
    const mergedTeams = keepNotInImport
        ? [...(importData.teams ?? []), ...(existing.teams ?? []).filter(t => !(importData.teams ?? []).some(it => it.id === t.id))]
        : (importData.teams ?? []);

    const mergedBattles = keepNotInImport
        ? [...(importData.battles ?? []), ...(existing.battles ?? []).filter(b => !(importData.battles ?? []).some(ib => ib.id === b.id))]
        : (importData.battles ?? []);

    const merged: SaveDataZod = {
        name: importData.name ?? existing.name,
        format: 'ZOD',
        dbVersion: importData.dbVersion ?? existing.dbVersion ?? 1,
        source: importData.source ?? existing.source ?? '',
        version: importData.version ?? existing.version ?? 1,
        created_at: existing.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        characters: mergedCharacters,
        wengines: mergedWengines,
        discs: mergedDiscs,
        teams: mergedTeams,
        battles: mergedBattles,
    };

    return { merged, result };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成唯一 ID
 */
function generateId(takenIds: Set<string>): string {
    let id: string;
    do {
        id = `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } while (takenIds.has(id));
    return id;
}

/**
 * 格式化导入结果摘要
 */
export function formatImportResultSummary(result: ImportResult): string {
    const lines: string[] = [];
    lines.push(`来源: ${result.source}`);
    lines.push('');

    const formatCounter = (name: string, counter: ImportResultCounter<any>) => {
        const parts: string[] = [];
        if (counter.new.length) parts.push(`新增 ${counter.new.length}`);
        if (counter.upgraded.length) parts.push(`升级 ${counter.upgraded.length}`);
        if (counter.unchanged.length) parts.push(`未更改 ${counter.unchanged.length}`);
        if (counter.remove.length) parts.push(`删除 ${counter.remove.length}`);
        if (counter.invalid.length) parts.push(`无效 ${counter.invalid.length}`);
        if (counter.notInImport) parts.push(`保留 ${counter.notInImport}`);

        if (parts.length) {
            lines.push(`${name}: ${parts.join(', ')}`);
        }
    };

    formatCounter('驱动盘', result.discs);
    formatCounter('音擎', result.wengines);
    formatCounter('角色', result.characters);

    return lines.join('\n');
}
