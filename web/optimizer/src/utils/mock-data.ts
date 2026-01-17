import { DriveDisk, DriveDiskPosition } from '../model/drive-disk';
import { WEngine, WEngineTalent } from '../model/wengine';
import { Agent, AgentSkills } from '../model/agent';
import { Enemy } from '../model/enemy';
import { Bangboo } from '../model/bangboo';
import { Buff, BuffSource, BuffTarget } from '../model/buff';
import { Rarity, PropertyType, StatValue, WeaponType, ElementType } from '../model/base';

export const MockData = {
    driveDisk: () => {
        const subStats = new Map();
        subStats.set(PropertyType.CRIT_, new StatValue(0.048, true));
        subStats.set(PropertyType.CRIT_DMG_, new StatValue(0.096, true));
        subStats.set(PropertyType.ATK_, new StatValue(0.06, true));
        subStats.set(PropertyType.PEN, new StatValue(18, false));

        const disk = new DriveDisk(
            'mock-disk-1',
            '1001',
            DriveDiskPosition.SLOT_4,
            Rarity.S,
            15,
            PropertyType.CRIT_DMG_,
            new StatValue(0.48, true),
            subStats
        );
        disk.set_name = '极地重金属';
        return disk;
    },

    wEngine: () => {
        const we = new WEngine('mock-wengine-1', '12001', '深海访客');
        we.level = 60;
        we.refinement = 5;
        we.base_atk = 713;
        we.rand_stat_type = PropertyType.CRIT_;
        we.rand_stat = 0.24;
        we.talents = [
            new WEngineTalent(1, '深海猎手', '冰属性伤害提升25%。', []),
            new WEngineTalent(5, '深海猎手', '冰属性伤害提升50%。暴击率提升20%。', [])
        ];
        we.equipped_agent = 'agent-1';
        return we;
    },

    agent: () => {
        const agent = new Agent('agent-1', '1011', '艾莲·乔', 60, Rarity.S, ElementType.ICE, WeaponType.ATTACK);
        agent.cinema = 2;
        agent.core_skill = 7; // F
        agent.skills = new AgentSkills(12, 12, 12, 12, 12);
        agent.equipped_wengine = 'mock-wengine-1';
        agent.equipped_drive_disks = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
        return agent;
    },

    bangboo: () => {
        const b = new Bangboo('bangboo-1', '巴特勒');
        b.rarity = 'S';
        b.level = 60;
        b.refinement = 5;
        b.base_hp = 10580;
        b.base_atk = 880;
        b.base_def = 880;
        b.active_skill = '为您效劳：回复能量，并提升全队攻击力。';
        b.passive_skill = '管家之道：队伍中存在维多利亚家政成员时，能量回复效率提升20%。';
        return b;
    },

    enemy: () => {
        const e = new Enemy('enemy-1', '尼尼微', 'Nineveh', 25000000, 15000, 2000, 80000, true);
        // e.is_boss is a getter, implies reliance on tags
        e.tags = '首领, 以太, 侵蚀'; 
        e.ice_dmg_resistance = -0.2; // Weak to Ice
        e.fire_dmg_resistance = 0.2;
        e.stun_vulnerability_multiplier = 1.5; // 150%
        return e;
    },

    buff: () => {
        const stats = new Map();
        stats.set(PropertyType.ATK_, 0.25); // +25% ATK
        return new Buff(
            BuffSource.AGENT_PASSIVE,
            stats,
            undefined,
            undefined,
            new BuffTarget(),
            3,
            'linear',
            true,
            'buff-1',
            '苍角：战旗',
            '攻击力提升25%，持续10秒。'
        );
    }
};