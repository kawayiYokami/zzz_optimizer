import { describe, expect, it } from 'vitest';

import { BattleService } from './battle.service';
import { Buff, BuffSource, BuffTarget, Conversion } from '../model/buff';
import { PropertyType } from '../model/base';
import { Team } from '../model/team';
import { Agent } from '../model/agent';

function makeAgent(name_cn: string): Agent {
  const a = new Agent(`id_${name_cn}`, `game_${name_cn}`, name_cn, 60);
  // Override getSelfProperties().toCombatStats() to return a deterministic snapshot1
  (a as any).getSelfProperties = () => ({
    toCombatStats: () => ({
      getInCombat: (prop: PropertyType, defaultValue = 0) => {
        if (prop === PropertyType.ATK) return 2000;
        return defaultValue;
      },
    }),
  });
  (a as any).getAllBuffsSync = () => [];
  return a;
}

describe('BattleService teammate conversion buff settlement', () => {
  it('filters by is_active before converting teammate conversion buffs', async () => {
    const bs = new BattleService();

    const front = makeAgent('前台');
    const mate = makeAgent('队友');

    // active conversion buff: ATK -> DMG_ with ratio 0.0001 => 2000 * 0.0001 = 0.2
    const conv = new Conversion(PropertyType.ATK, PropertyType.DMG_, 0.0001);
    const target = Object.assign(new BuffTarget(), { target_teammate: true, target_self: false });
    const activeConvBuff = new Buff(
      BuffSource.TEAM_MATE,
      new Map(),
      new Map(),
      conv,
      target,
      1,
      'linear',
      true,
      'conv_active',
      '队友转换',
      '',
      ''
    );

    const inactiveConvBuff = new Buff(
      BuffSource.TEAM_MATE,
      new Map(),
      new Map(),
      conv,
      target,
      1,
      'linear',
      false,
      'conv_inactive',
      '队友转换(关)',
      '',
      ''
    );

    (mate as any).getAllBuffsSync = () => [activeConvBuff, inactiveConvBuff];

    const team = new Team([front, mate], 't1', 't1');

    await bs.setTeam(team);

    const { teammate } = bs.getOptimizerConfigBuffs({ includeFourPiece: true });

    // inactive one should be filtered out entirely
    expect(teammate.find(b => b.id === 'conv_inactive')).toBeFalsy();

    // active one should be converted into a normal buff (conversion removed)
    const converted = teammate.find(b => b.id === 'conv_active');
    expect(converted).toBeTruthy();
    expect(converted!.conversion).toBeUndefined();
    expect(converted!.in_combat_stats.get(PropertyType.DMG_)).toBeCloseTo(0.2);
  });
});
