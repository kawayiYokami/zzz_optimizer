import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SaveDataZod } from '../model/save-data-zod';
import type { ImportResult } from '../model/import-result';
import { importExportService } from './import-export.service';
import { zodParserService } from './zod-parser.service';
import { mergeZodData } from './merge.service';

vi.mock('./zod-parser.service', () => ({
  zodParserService: {
    parseZodDataWithErrors: vi.fn(),
  },
}));

vi.mock('./merge.service', () => ({
  mergeZodData: vi.fn(),
}));

const buildEmptyResult = (): ImportResult => ({
  type: 'ZOD',
  source: 'test',
  discs: {
    import: 0,
    new: [],
    update: [],
    unchanged: [],
    upgraded: [],
    remove: [],
    invalid: [],
    notInImport: 0,
    beforeMerge: 0,
  },
  wengines: {
    import: 0,
    new: [],
    update: [],
    unchanged: [],
    upgraded: [],
    remove: [],
    invalid: [],
    notInImport: 0,
    beforeMerge: 0,
  },
  characters: {
    import: 0,
    new: [],
    update: [],
    unchanged: [],
    upgraded: [],
    remove: [],
    invalid: [],
    notInImport: 0,
    beforeMerge: 0,
  },
  keepNotInImport: true,
  ignoreDups: false,
  parseErrors: [],
});

describe('ImportExportService.computeMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters invalid IDs from existing data and excludes invalid import items', async () => {
    const importData: SaveDataZod = {
      name: 'import',
      format: 'ZOD',
      dbVersion: 1,
      source: 'test',
      version: 1,
      discs: [
        { id: 'disc_bad', setKey: 'Bad', rarity: 'S', level: 0, slotKey: '1', mainStatKey: 'hp', substats: [], location: '', lock: false, trash: false },
        { id: 'disc_good', setKey: 'Good', rarity: 'S', level: 0, slotKey: '1', mainStatKey: 'hp', substats: [], location: '', lock: false, trash: false },
      ],
      characters: [
        { id: 'char_bad', key: 'BadChar', level: 1, core: 1, mindscape: 0, dodge: 0, basic: 0, chain: 0, special: 0, assist: 0, promotion: 0, potential: 0, equippedDiscs: {}, equippedWengine: '' },
        { id: 'char_good', key: 'GoodChar', level: 1, core: 1, mindscape: 0, dodge: 0, basic: 0, chain: 0, special: 0, assist: 0, promotion: 0, potential: 0, equippedDiscs: {}, equippedWengine: '' },
      ],
      wengines: [
        { id: 'wen_bad', key: 'BadW', level: 1, modification: 1, promotion: 0, location: '' },
        { id: 'wen_good', key: 'GoodW', level: 1, modification: 1, promotion: 0, location: '' },
      ],
      teams: [],
      battles: [],
    };

    const existingData: SaveDataZod = {
      name: 'existing',
      format: 'ZOD',
      dbVersion: 1,
      source: 'test',
      version: 1,
      discs: [
        { id: 'disc_bad', setKey: 'Bad', rarity: 'S', level: 0, slotKey: '1', mainStatKey: 'hp', substats: [], location: '', lock: false, trash: false },
        { id: 'disc_keep', setKey: 'Keep', rarity: 'S', level: 0, slotKey: '1', mainStatKey: 'hp', substats: [], location: '', lock: false, trash: false },
      ],
      characters: [
        { id: 'char_bad', key: 'BadChar', level: 1, core: 1, mindscape: 0, dodge: 0, basic: 0, chain: 0, special: 0, assist: 0, promotion: 0, potential: 0, equippedDiscs: {}, equippedWengine: '' },
        { id: 'char_keep', key: 'KeepChar', level: 1, core: 1, mindscape: 0, dodge: 0, basic: 0, chain: 0, special: 0, assist: 0, promotion: 0, potential: 0, equippedDiscs: {}, equippedWengine: '' },
      ],
      wengines: [
        { id: 'wen_bad', key: 'BadW', level: 1, modification: 1, promotion: 0, location: '' },
        { id: 'wen_keep', key: 'KeepW', level: 1, modification: 1, promotion: 0, location: '' },
      ],
      teams: [],
      battles: [],
    };

    const parseErrors = [
      { type: 'disc', id: 'disc_bad', rawData: importData.discs![0], errorMessage: 'bad disc', displayName: 'bad disc' },
      { type: 'character', id: 'char_bad', rawData: importData.characters![0], errorMessage: 'bad char', displayName: 'bad char' },
      { type: 'wengine', id: 'wen_bad', rawData: importData.wengines![0], errorMessage: 'bad wen', displayName: 'bad wen' },
    ];

    vi.mocked(zodParserService.parseZodDataWithErrors).mockResolvedValue({
      driveDisks: new Map([['disc_good', {} as any]]),
      agents: new Map([['char_good', {} as any]]),
      wengines: new Map([['wen_good', {} as any]]),
      errors: parseErrors,
    });

    const result = buildEmptyResult();
    vi.mocked(mergeZodData).mockReturnValue({
      merged: {
        name: 'merged',
        format: 'ZOD',
        dbVersion: 1,
        source: 'test',
        version: 1,
        discs: [],
        characters: [],
        wengines: [],
        teams: [],
        battles: [],
      },
      result,
    });

    const output = await importExportService.computeMerge(importData, existingData);

    const [sanitizedImport, sanitizedExisting] = vi.mocked(mergeZodData).mock.calls[0];
    expect(sanitizedImport.discs?.map((d) => d.id)).toEqual(['disc_good']);
    expect(sanitizedImport.characters?.map((c) => c.id)).toEqual(['char_good']);
    expect(sanitizedImport.wengines?.map((w) => w.id)).toEqual(['wen_good']);

    expect(sanitizedExisting?.discs?.map((d) => d.id)).toEqual(['disc_keep']);
    expect(sanitizedExisting?.characters?.map((c) => c.id)).toEqual(['char_keep']);
    expect(sanitizedExisting?.wengines?.map((w) => w.id)).toEqual(['wen_keep']);

    expect(output.result.discs.import).toBe(2);
    expect(output.result.characters.import).toBe(2);
    expect(output.result.wengines.import).toBe(2);

    expect(output.result.discs.invalid).toEqual([importData.discs![0]]);
    expect(output.result.characters.invalid).toEqual([importData.characters![0]]);
    expect(output.result.wengines.invalid).toEqual([importData.wengines![0]]);
  });
});
