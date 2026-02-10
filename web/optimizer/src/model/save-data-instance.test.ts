import { describe, it, expect } from 'vitest';

import { SaveData } from './save-data-instance';
import { Agent } from './agent';
import type { ZodTeamData } from './save-data-zod';

describe('SaveData teams', () => {
  it('addTeam throws and does not persist invalid team', () => {
    const save = new SaveData('test');
    save.addAgent(new Agent('a1', 'g1'));

    const validTeam: ZodTeamData = {
      id: 't1',
      name: 'Team 1',
      priority: 0,
      frontCharacterId: 'a1',
      backCharacter1Id: '',
      backCharacter2Id: '',
    };
    save.addTeam(validTeam);
    expect(save.getAllTeams().map(t => t.id)).toContain('t1');
    expect(save.getAllTeamInstances().map(t => t.id)).toContain('t1');

    const invalidTeam: ZodTeamData = {
      id: 'bad',
      name: 'Bad',
      priority: 0,
      frontCharacterId: 'missing',
      backCharacter1Id: '',
      backCharacter2Id: '',
    };

    expect(() => save.addTeam(invalidTeam)).toThrow();
    expect(save.getTeam('bad')).toBeUndefined();
    expect(save.getTeamInstance('bad')).toBeUndefined();
  });

  it('updateTeam is atomic when update would invalidate team', () => {
    const save = new SaveData('test');
    save.addAgent(new Agent('a1', 'g1'));

    const team: ZodTeamData = {
      id: 't1',
      name: 'Team 1',
      priority: 0,
      frontCharacterId: 'a1',
      backCharacter1Id: '',
      backCharacter2Id: '',
    };
    save.addTeam(team);

    expect(() => save.updateTeam('t1', { frontCharacterId: '' })).toThrow();

    const persisted = save.getTeam('t1');
    expect(persisted?.frontCharacterId).toBe('a1');
    expect(save.getTeamInstance('t1')?.frontAgent.id).toBe('a1');
  });

  it('advances next team id when adding a team with explicit numeric id', () => {
    const save = new SaveData('test');
    save.addAgent(new Agent('a1', 'g1'));

    const importedTeam: ZodTeamData = {
      id: '40001',
      name: 'Imported',
      priority: 0,
      frontCharacterId: 'a1',
      backCharacter1Id: '',
      backCharacter2Id: '',
    };
    save.addTeam(importedTeam);

    expect(save.getNextTeamId()).toBe('40002');
  });
});

