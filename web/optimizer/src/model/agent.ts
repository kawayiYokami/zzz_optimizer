/**
 * 角色模型
 */

import { Rarity, ElementType, WeaponType } from './base';
import { PropertyCollection } from './property-collection';
import { CombatStats } from './combat-stats';
import { Buff, ConversionBuff } from './buff';
import type { ZodCharacterData } from './save-data-simple';
import type { dataLoaderService } from '../services/data-loader.service';

/**
 * 角色技能等级
 */
export class AgentSkills {
  normal: number = 1; // 普通攻击 (1-12)
  dodge: number = 1; // 闪避反击 (1-12)
  assist: number = 1; // 支援技 (1-12)
  special: number = 1; // 特殊技 (1-12)
  chain: number = 1; // 连携技 (1-12)

  constructor(
    normal?: number,
    dodge?: number,
    assist?: number,
    special?: number,
    chain?: number
  ) {
    this.normal = normal ?? 1;
    this.dodge = dodge ?? 1;
    this.assist = assist ?? 1;
    this.special = special ?? 1;
    this.chain = chain ?? 1;
  }

  /**
   * 是否全部满级
   */
  get isMax(): boolean {
    return (
      this.normal >= 12 &&
      this.dodge >= 12 &&
      this.assist >= 12 &&
      this.special >= 12 &&
      this.chain >= 12
    );
  }

  /**
   * 总技能等级
   */
  get totalLevel(): number {
    return this.normal + this.dodge + this.assist + this.special + this.chain;
  }

  /**
   * 转为字典
   */
  toDict(): any {
    return {
      normal: this.normal,
      dodge: this.dodge,
      assist: this.assist,
      special: this.special,
      chain: this.chain,
    };
  }

  /**
   * 从字典创建
   */
  static fromDict(data: any): AgentSkills {
    return new AgentSkills(
      data.normal,
      data.dodge,
      data.assist,
      data.special,
      data.chain
    );
  }
}

/**
 * 角色模型
 */
export class Agent {
  // 实例ID（存档中的唯一标识）
  id: string;

  // 游戏ID（对应character.json中的键）
  game_id: string;

  // 基础信息（从游戏数据加载）
  name_cn: string = '';
  name_en: string = '';
  rarity: Rarity = Rarity.S;
  element: ElementType = ElementType.PHYSICAL;
  weapon_type: WeaponType = WeaponType.ATTACK;
  icon: string = '';

  // 成长属性（玩家数据）
  level: number = 1;
  breakthrough: number = 0;
  cinema: number = 0;
  core_skill: number = 1;
  skills: AgentSkills = new AgentSkills();

  // 装备关联
  equipped_wengine: string | null = null; // 音擎ID
  equipped_drive_disks: (string | null)[] = [null, null, null, null, null, null]; // 驱动盘ID（6个位置）

  // 缓存的基础属性（在fromZodData中计算）
  base_stats: PropertyCollection = new PropertyCollection();

  // Buff系统（从游戏数据加载）
  core_passive_buffs: Buff[] = [];
  talent_buffs: Buff[] = [];
  conversion_buffs: ConversionBuff[] = [];
  potential_buffs: Buff[] = [];

  constructor(
    id: string,
    gameId: string,
    nameCn?: string,
    level?: number,
    rarity?: Rarity,
    element?: ElementType,
    weaponType?: WeaponType
  ) {
    this.id = id;
    this.game_id = gameId;
    this.name_cn = nameCn ?? '';
    this.level = level ?? 1;
    this.rarity = rarity ?? Rarity.S;
    this.element = element ?? ElementType.PHYSICAL;
    this.weapon_type = weaponType ?? WeaponType.ATTACK;
  }

  /**
   * 获取基础属性（不含装备和Buff）
   *
   * @returns 属性集合
   */
  getBareStats(): PropertyCollection {
    return this.base_stats;
  }

  /**
   * 获取自身Buff（不含装备）
   *
   * @returns 属性集合
   */
  getSelfBuff(): PropertyCollection {
    // 合并所有Buff
    const collections: PropertyCollection[] = [];

    // 核心被动Buff
    for (const buff of this.core_passive_buffs) {
      collections.push(buff.toPropertyCollection());
    }

    // 天赋Buff
    for (const buff of this.talent_buffs) {
      collections.push(buff.toPropertyCollection());
    }

    // 潜能Buff
    for (const buff of this.potential_buffs) {
      collections.push(buff.toPropertyCollection());
    }

    return PropertyCollection.mergeAll(collections);
  }

  /**
   * 获取战斗属性（包含基础属性+Buff）
   *
   * @returns 战斗属性
   */
  getCombatStats(): CombatStats {
    // 合并基础属性和Buff
    const collections: PropertyCollection[] = [
      this.getBareStats(),
      this.getSelfBuff(),
    ];

    return CombatStats.fromPropertyCollections(collections, this.level);
  }

  /**
   * 转为字典（只序列化实例特有数据）
   */
  toDict(): any {
    return {
      game_id: this.game_id,
      level: this.level,
      breakthrough: this.breakthrough,
      cinema: this.cinema,
      core_skill: this.core_skill,
      skills: this.skills.toDict(),
      equipped_wengine: this.equipped_wengine,
      equipped_drive_disks: this.equipped_drive_disks,
    };
  }

  /**
   * 从ZOD数据创建Agent实例
   *
   * @param zodData ZOD角色数据
   * @param dataLoader 数据加载服务
   * @returns Agent实例
   */
  static async fromZodData(
    zodData: ZodCharacterData,
    dataLoader: typeof dataLoaderService
  ): Promise<Agent> {
    // 1. 根据key (CodeName) 查找游戏数据中的角色ID
    let gameCharId: string | null = null;
    const charMap = dataLoader.characterData;
    if (charMap) {
      for (const [id, data] of charMap.entries()) {
        if (data.code === zodData.key) {
          gameCharId = id;
          break;
        }
      }
    }

    if (!gameCharId) {
      throw new Error(`未找到角色游戏数据: ${zodData.key}`);
    }

    // 2. 获取角色基础信息
    const charInfo = charMap!.get(gameCharId)!;

    // 获取角色详细数据（用于计算属性）
    const charDetail = await dataLoader.getCharacterDetail(gameCharId);

    // 3. 创建Agent实例
    const agent = new Agent(
      zodData.id,
      gameCharId,
      charInfo.CHS || charInfo.EN,
      zodData.level,
      charInfo.rank as Rarity,
      charInfo.element as ElementType,
      charInfo.type as WeaponType
    );

    // 4. 设置实例数据
    agent.name_en = charInfo.EN || '';
    agent.icon = charInfo.icon || '';
    agent.breakthrough = zodData.promotion;
    agent.cinema = zodData.mindscape;
    agent.core_skill = zodData.core;

    // 4.1 计算基础属性
    if (charDetail && charDetail.Stats) {
      const stats = charDetail.Stats;
      const level = zodData.level;
      const promotion = zodData.promotion; // 0-5 (对应1-6阶突破? 需确认)

      // 基础属性公式：(Base + (Level - 1) * Growth / 10000)
      const calcBase = (base: number, growth: number) => {
        return base + ((level - 1) * growth) / 10000;
      };

      const hp = calcBase(stats.HpMax, stats.HpGrowth);
      const atk = calcBase(stats.Attack, stats.AttackGrowth);
      const def = calcBase(stats.Defence, stats.DefenceGrowth);

      // 突破加成
      // 假设 promotion 0对应Level 1, promotion 1对应Level 2...
      // character.json中Level key是 "1"..."6"
      // 通常 promotion=0 是1-10级，不需要额外突破加成? 或者对应Level "1"?
      // 观察数据：Level "1" 全是0。Level "2" (10-20级) 开始有值。
      // 假设 zodData.promotion 是 0-5。
      let promotionHp = 0;
      let promotionAtk = 0;
      let promotionDef = 0;

      // 简单的映射逻辑：promotion 1 -> Level "2"
      if (promotion > 0 && charDetail.Level) {
        const levelKey = (promotion + 1).toString();
        const levelData = charDetail.Level[levelKey];
        if (levelData) {
          promotionHp = levelData.HpMax || 0;
          promotionAtk = levelData.Attack || 0;
          promotionDef = levelData.Defence || 0;
        }
      }

      // 核心技加成
      // ExtraLevel keys "1"..."6"。对应 core_skill 1-6 (A-F)
      let coreHp = 0;
      let coreAtk = 0;
      let coreDef = 0;
      let coreImpact = 0;
      
      if (charDetail.ExtraLevel) {
          // 累加到当前核心技等级的所有加成？通常ExtraLevel里已经是累计值还是增量值？
          // 看数据： "6": { "Value": 75 }， "5": { "Value": 50 }。看起来是累计值（达到该等级后的总加成）。
          const coreKey = zodData.core.toString(); // 0-6
          const extraData = charDetail.ExtraLevel[coreKey];
          if (extraData && extraData.Extra) {
              for (const bonus of Object.values(extraData.Extra) as any[]) {
                  if (bonus.Name === '基础攻击力') coreAtk += bonus.Value;
                  if (bonus.Name === '基础生命值') coreHp += bonus.Value; // 猜测名字
                  if (bonus.Name === '基础防御力') coreDef += bonus.Value; // 猜测名字
                  if (bonus.Name === '冲击力') coreImpact += bonus.Value;
              }
          }
      }

      // 写入base_stats
      agent.base_stats.add('生命值', hp + promotionHp + coreHp);
      agent.base_stats.add('攻击力', atk + promotionAtk + coreAtk);
      agent.base_stats.add('防御力', def + promotionDef + coreDef);
      agent.base_stats.add('冲击力', stats.BreakStun + coreImpact); // BreakStun 是基础冲击力吗？118? 好像有点低，通常是100左右。Stats里只有BreakStun。
      agent.base_stats.add('暴击率', stats.Crit / 10000); // 500 -> 5%
      agent.base_stats.add('暴击伤害', stats.CritDamage / 10000); // 5000 -> 50%
      agent.base_stats.add('异常掌控', stats.ElementAbnormalPower);
      agent.base_stats.add('异常精通', stats.ElementMystery);
      agent.base_stats.add('能量自动回复', stats.SpRecover / 100); // 120 -> 1.2? 或是120%? 通常是1.2/s
    }

    // 技能等级
    agent.skills = new AgentSkills(
      zodData.basic,
      zodData.dodge,
      zodData.assist,
      zodData.special,
      zodData.chain
    );

    // 装备关联
    agent.equipped_wengine = zodData.equippedWengine || null;

    // 驱动盘装备（ZOD格式是 Record<string, string>，需要转换为数组）
    const discs: (string | null)[] = [null, null, null, null, null, null];
    if (zodData.equippedDiscs) {
      // ZOD的key是"1"到"6"，转换为数组索引0-5
      for (const [slotKey, discId] of Object.entries(zodData.equippedDiscs)) {
        const slotNum = parseInt(slotKey);
        if (slotNum >= 1 && slotNum <= 6) {
          discs[slotNum - 1] = discId;
        }
      }
    }
    agent.equipped_drive_disks = discs;

    // 5. 加载角色Buff数据
    try {
      const buffData = await dataLoader.getCharacterBuff(gameCharId);

      // 核心被动Buff
      if (buffData.core_passive_buffs) {
        agent.core_passive_buffs = buffData.core_passive_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 天赋Buff
      if (buffData.talent_buffs) {
        agent.talent_buffs = buffData.talent_buffs.map((b: any) =>
          Buff.fromBuffData(b)
        );
      }

      // 影画Buff
      if (buffData.mindscape_buffs) {
        agent.potential_buffs = buffData.mindscape_buffs
          .filter((b: any) => b.mindscape_level <= zodData.mindscape)
          .map((b: any) => Buff.fromBuffData(b));
      }

      // 转化Buff
      if (buffData.conversion_buffs) {
        agent.conversion_buffs = buffData.conversion_buffs.map((b: any) =>
          ConversionBuff.fromBuffData(b)
        );
      }
    } catch (err) {
      console.warn(`加载角色Buff数据失败: ${zodData.key}`, err);
    }

    return agent;
  }

  /**
   * 获取所有有效的Buff
   */
  getAllBuffs(): Buff[] {
    return [
      ...this.core_passive_buffs,
      ...this.talent_buffs,
      ...this.potential_buffs,
    ];
  }
}