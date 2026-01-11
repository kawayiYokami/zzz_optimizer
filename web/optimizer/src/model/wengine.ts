/**
 * 音擎模型
 */

import { PropertyType } from './base';
import { Buff } from './buff';
import { PropertyCollection } from './property-collection';
import type { ZodWengineData } from './save-data-zod';
import type { dataLoaderService } from '../services/data-loader.service';

/**
 * 音擎等级成长数据
 *
 * 记录音擎在不同等级的成长率
 */
export class WEngineLevelData {
  level: number; // 等级 (1-60)
  exp: number; // 升级所需经验
  rate: number; // 成长率（基础属性成长）

  constructor(level: number, exp: number, rate: number) {
    this.level = level;
    this.exp = exp;
    this.rate = rate;
  }

  toDict(): any {
    return {
      level: this.level,
      exp: this.exp,
      rate: this.rate,
    };
  }

  static fromDict(data: any): WEngineLevelData {
    return new WEngineLevelData(data.level, data.exp, data.rate);
  }
}

/**
 * 音擎天赋效果
 *
 * 记录音擎的天赋效果（被动技能）
 */
export class WEngineTalent {
  level: number; // 精炼等级 (1-5)
  name: string; // 天赋名称
  description: string; // 天赋描述
  buffs: Buff[]; // 天赋提供的buff列表

  constructor(level: number, name: string, description: string, buffs?: Buff[]) {
    this.level = level;
    this.name = name;
    this.description = description;
    this.buffs = buffs ?? [];
  }

  toDict(): any {
    return {
      level: this.level,
      name: this.name,
      description: this.description,
      buffs: this.buffs.map((buff) => buff.toDict()),
    };
  }

  static fromDict(data: any): WEngineTalent {
    const buffs = data.buffs ? data.buffs.map((buffData: any) => Buff.fromDict(buffData)) : [];
    return new WEngineTalent(data.level, data.name, data.description, buffs);
  }

  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    // 天赋基本信息
    lines.push(`${prefix}【天赋】`);
    lines.push(`  ${prefix}精炼等级: R${this.level}`);
    lines.push(`  ${prefix}名称: ${this.name}`);
    if (this.description) {
      lines.push(`  ${prefix}描述: ${this.description}`);
    }

    // Buff列表
    if (this.buffs.length > 0) {
      lines.push(`${prefix}【Buff】(${this.buffs.length}个)`);
      for (const buff of this.buffs) {
        lines.push(buff.format(indent + 2));
      }
    }

    return lines.join('\n');
  }
}

/**
 * 音擎数据模型
 *
 * 属性说明：
 * - base_stats: 基础属性集（局外），加载时计算好缓存
 * - talents: 天赋buff列表（局内）
 * - getStatsAtLevel(): 计算某等级的属性的方法（有隐藏系数）
 */
export class WEngine {
  id: string; // 实例ID（唯一，用于仓库管理）
  wengine_id: string; // 游戏ID (如 "12001"，用于关联游戏数据)
  name: string; // 名称（中文，如 "「月相」-望"）

  // 玩家实例数据（存储在存档中）
  level: number = 1; // 等级 (1-60)
  refinement: number = 1; // 精炼等级 (1-5)
  breakthrough: number = 0; // 突破等级 (0-6)
  equipped_agent: string | null = null; // 装备角色ID

  // 游戏数据（从游戏数据文件读取，不存储在存档中）
  base_atk: number = 0.0; // 基础攻击力
  rand_stat_type: PropertyType | null = null; // 副属性类型
  rand_stat: number = 0.0; // 副属性基础值
  level_data: Map<number, WEngineLevelData> = new Map(); // 等级成长数据
  base_stats: PropertyCollection = new PropertyCollection(); // 基础属性集（局外）
  talents: WEngineTalent[] = []; // 天赋buff列表（局内）
  buffs: Buff[] = []; // 当前精炼等级的buff列表（缓存）

  constructor(id: string, wengineId: string, name: string) {
    this.id = id;
    this.wengine_id = wengineId;
    this.name = name;
  }

  /**
   * 计算指定等级的属性值
   *
   * @param level 等级 (1-60)
   * @param ascension 突破等级 (0-5)，如果为None则自动计算
   * @returns PropertyCollection：武器提供的属性
   *
   * 计算公式（参考原项目）：
   * - 攻击力 = base_atk × (1 + rate / 10000 + 0.8922 × ascension)
   * - 副词条 = rand_stat × (1 + 0.3 × ascension)
   */
  getStatsAtLevel(level: number, ascension?: number): PropertyCollection {
    if (ascension === undefined) {
      ascension = Math.min(Math.floor(level / 10), 5);
    }

    const result = new PropertyCollection();

    if (this.base_atk > 0) {
      const levelInfo = this.level_data.get(level);
      const rate = levelInfo ? levelInfo.rate : 0;
      const atk = this.base_atk * (1 + rate / 10000 + 0.8922 * ascension);
      result.out_of_combat.set(PropertyType.ATK_BASE, atk);
    }

    if (this.rand_stat > 0 && this.rand_stat_type) {
      const stat = this.rand_stat * (1 + 0.3 * ascension);
      result.out_of_combat.set(this.rand_stat_type, stat);
    }

    return result;
  }

  /**
   * 获取当前等级的基础属性集（局外）
   */
  getBaseStats(): PropertyCollection {
    return this.base_stats;
  }

  /**
   * 获取当前精炼等级的所有有效 Buff（局内）
   */
  getActiveBuffs(): Buff[] {
    // 从talents中获取当前精炼等级的buff
    let activeBuffs: Buff[] = [];
    for (const talent of this.talents) {
      if (talent.level === this.refinement) {
        activeBuffs = talent.buffs.filter((buff) => buff.is_active);
        break;
      }
    }

    // 更新缓存
    this.buffs = activeBuffs;
    return activeBuffs;
  }

  /**
   * 转为字典
   */
  toDict(): any {
    return {
      id: this.id,
      wengine_id: this.wengine_id,
      name: this.name,
      level: this.level,
      refinement: this.refinement,
      breakthrough: this.breakthrough,
      equipped_agent: this.equipped_agent,
    };
  }

  /**
   * 从字典创建WEngine实例（用于反序列化）
   *
   * @param data 字典数据
   * @param dataLoader 数据加载服务
   * @returns WEngine实例
   */
  static async fromDict(
    data: any,
    dataLoader: typeof dataLoaderService
  ): Promise<WEngine> {
    // 通过wengine_id从游戏数据获取名称
    const weaponInfo = dataLoader.weaponData?.get(data.wengine_id);
    const name = weaponInfo?.CHS || weaponInfo?.EN || data.name;

    // 创建实例
    const wengine = new WEngine(data.id, data.wengine_id, name);

    // 恢复玩家数据
    wengine.level = data.level;
    wengine.refinement = data.refinement;
    wengine.breakthrough = data.breakthrough;
    wengine.equipped_agent = data.equipped_agent;

    // 加载音擎详细数据和Buff数据
    try {
      const wengineDetail = await dataLoader.getWeaponDetail(data.wengine_id);
      const wengineBuffData = await dataLoader.getWeaponBuff(data.wengine_id);

      // 设置基础属性（从 BaseProperty.Value 获取）
      if (wengineDetail.BaseProperty && wengineDetail.BaseProperty.Value !== undefined) {
        wengine.base_atk = wengineDetail.BaseProperty.Value;
      }

      // 设置副属性类型（从 RandProperty.Name 推断）
      if (wengineDetail.RandProperty) {
        const randPropName = wengineDetail.RandProperty.Name || wengineDetail.RandProperty.Name2;
        // 根据名称推断属性类型
        if (randPropName.includes('攻击力') && randPropName.includes('%')) {
          wengine.rand_stat_type = PropertyType.ATK_;
        } else if (randPropName.includes('攻击力')) {
          wengine.rand_stat_type = PropertyType.ATK;
        } else if (randPropName.includes('生命值') && randPropName.includes('%')) {
          wengine.rand_stat_type = PropertyType.HP_;
        } else if (randPropName.includes('生命值')) {
          wengine.rand_stat_type = PropertyType.HP;
        } else if (randPropName.includes('防御力') && randPropName.includes('%')) {
          wengine.rand_stat_type = PropertyType.DEF_;
        } else if (randPropName.includes('防御力')) {
          wengine.rand_stat_type = PropertyType.DEF;
        } else if (randPropName.includes('暴击率')) {
          wengine.rand_stat_type = PropertyType.CRIT_;
        } else if (randPropName.includes('暴击伤害')) {
          wengine.rand_stat_type = PropertyType.CRIT_DMG_;
        } else if (randPropName.includes('穿透')) {
          wengine.rand_stat_type = PropertyType.PEN_;
        } else if (randPropName.includes('异常精通')) {
          wengine.rand_stat_type = PropertyType.ANOM_PROF;
        }
      }

      // 设置副属性基础值
      if (wengineDetail.RandProperty && wengineDetail.RandProperty.Value !== undefined) {
        // 如果 Format 包含%，则是百分比属性，需要除以100
        const isPercent = wengineDetail.RandProperty.Format && wengineDetail.RandProperty.Format.includes('%');
        wengine.rand_stat = isPercent ? wengineDetail.RandProperty.Value / 100 : wengineDetail.RandProperty.Value;
      }

      // 设置等级成长数据（从 Level 获取）
      if (wengineDetail.Level) {
        for (const [level, data] of Object.entries(wengineDetail.Level)) {
          wengine.level_data.set(
            parseInt(level),
            new WEngineLevelData(
              parseInt(level),
              (data as any).Exp || 0,
              (data as any).Rate || 0
            )
          );
        }
      }

      // 计算当前等级的基础属性
      wengine.base_stats = wengine.getStatsAtLevel(data.level, data.breakthrough);

      // 加载天赋数据（从 wengineBuffData.talents 获取）
      if (wengineBuffData.talents) {
        for (const talentData of wengineBuffData.talents) {
          const buffs = (talentData.buffs || []).map((b: any) => Buff.fromBuffData(b));
          wengine.talents.push(
            new WEngineTalent(
              talentData.level,
              talentData.name,
              talentData.description || '',
              buffs
            )
          );
        }
      }

      // 更新当前精炼等级的buff缓存
      wengine.getActiveBuffs();

    } catch (err) {
      console.warn(`加载音擎数据失败: ${data.wengine_id}`, err);
    }

    return wengine;
  }

  /**
   * 从ZOD数据创建WEngine实例
   *
   * @param zodData ZOD音擎数据
   * @param dataLoader 数据加载服务
   * @returns WEngine实例
   */
  static async fromZodData(
    zodData: ZodWengineData,
    dataLoader: typeof dataLoaderService
  ): Promise<WEngine> {
    // 1. 根据key (EN name) 查找游戏数据中的音擎ID
    let gameWengineId: string | null = null;
    const weaponMap = dataLoader.weaponData;
    if (weaponMap) {
      const normalized = zodData.key.replace(/[\s']/g, '').toLowerCase();
      for (const [id, data] of weaponMap.entries()) {
        const dataEN = (data.EN || '').replace(/[\s']/g, '').toLowerCase();
        if (data.EN === zodData.key || dataEN === normalized) {
          gameWengineId = id;
          break;
        }
      }
    }

    if (!gameWengineId) {
      throw new Error(`未找到音擎游戏数据: ${zodData.key}`);
    }

    // 2. 获取音擎基础信息
    const weaponInfo = weaponMap!.get(gameWengineId)!;

    // 3. 创建WEngine实例
    const wengine = new WEngine(
      zodData.id,
      gameWengineId,
      weaponInfo.CHS || weaponInfo.EN
    );

    // 4. 设置实例数据
    wengine.level = zodData.level;
    wengine.refinement = zodData.modification; // ZOD的modification对应refinement
    wengine.breakthrough = zodData.promotion;
    wengine.equipped_agent = zodData.location || null;

    // 5. 加载音擎详细数据和Buff数据
    try {
      const wengineDetail = await dataLoader.getWeaponDetail(gameWengineId);
      const wengineBuffData = await dataLoader.getWeaponBuff(gameWengineId);

      // 设置基础属性（从 BaseProperty.Value 获取）
      if (wengineDetail.BaseProperty && wengineDetail.BaseProperty.Value !== undefined) {
        wengine.base_atk = wengineDetail.BaseProperty.Value;
      }

      // 设置副属性类型（从 RandProperty.Name 推断）
      if (wengineDetail.RandProperty) {
        const randPropName = wengineDetail.RandProperty.Name || wengineDetail.RandProperty.Name2;
        // 根据名称推断属性类型
        if (randPropName.includes('攻击力') && randPropName.includes('%')) {
          wengine.rand_stat_type = PropertyType.ATK_;
        } else if (randPropName.includes('攻击力')) {
          wengine.rand_stat_type = PropertyType.ATK;
        } else if (randPropName.includes('生命值') && randPropName.includes('%')) {
          wengine.rand_stat_type = PropertyType.HP_;
        } else if (randPropName.includes('生命值')) {
          wengine.rand_stat_type = PropertyType.HP;
        } else if (randPropName.includes('防御力') && randPropName.includes('%')) {
          wengine.rand_stat_type = PropertyType.DEF_;
        } else if (randPropName.includes('防御力')) {
          wengine.rand_stat_type = PropertyType.DEF;
        } else if (randPropName.includes('暴击率')) {
          wengine.rand_stat_type = PropertyType.CRIT_;
        } else if (randPropName.includes('暴击伤害')) {
          wengine.rand_stat_type = PropertyType.CRIT_DMG_;
        } else if (randPropName.includes('穿透')) {
          wengine.rand_stat_type = PropertyType.PEN_;
        } else if (randPropName.includes('异常精通')) {
          wengine.rand_stat_type = PropertyType.ANOM_PROF;
        }
      }

      // 设置副属性基础值
      if (wengineDetail.RandProperty && wengineDetail.RandProperty.Value !== undefined) {
        // 如果 Format 包含%，则是百分比属性，需要除以100
        const isPercent = wengineDetail.RandProperty.Format && wengineDetail.RandProperty.Format.includes('%');
        wengine.rand_stat = isPercent ? wengineDetail.RandProperty.Value / 100 : wengineDetail.RandProperty.Value;
      }

      // 设置等级成长数据（从 Level 获取）
      if (wengineDetail.Level) {
        for (const [level, data] of Object.entries(wengineDetail.Level)) {
          wengine.level_data.set(
            parseInt(level),
            new WEngineLevelData(
              parseInt(level),
              (data as any).Exp || 0,
              (data as any).Rate || 0
            )
          );
        }
      }

      // 计算当前等级的基础属性
      wengine.base_stats = wengine.getStatsAtLevel(zodData.level, zodData.promotion);

      // 加载天赋数据（从 wengineBuffData.talents 获取）
      if (wengineBuffData.talents) {
        for (const talentData of wengineBuffData.talents) {
          const buffs = (talentData.buffs || []).map((b: any) => Buff.fromBuffData(b));
          wengine.talents.push(
            new WEngineTalent(
              talentData.level,
              talentData.name,
              talentData.description || '',
              buffs
            )
          );
        }
      }

      // 更新当前精炼等级的buff缓存
      wengine.getActiveBuffs();

    } catch (err) {
      console.warn(`加载音擎数据失败: ${zodData.key}`, err);
    }

    return wengine;
  }

  /**
   * 字符串表示
   */
  toString(): string {
    const equipped = this.isEquipped ? ' [已装备]' : '';
    return `${this.name} Lv.${this.level}/${this.breakthrough}突 精${this.refinement}${equipped}`;
  }

  /**
   * 格式化输出音擎信息（只输出有意义的值）
   *
   * @param indent 缩进空格数
   * @returns 格式化字符串
   */
  format(indent: number = 0): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    // 基础信息
    lines.push(`${prefix}【音擎】`);
    lines.push(`  ${prefix}名称: ${this.name}`);
    lines.push(`  ${prefix}等级: ${this.level}`);
    lines.push(`  ${prefix}精炼: R${this.refinement}`);

    // 当前等级属性（从 base_stats 读取计算后的值）
    if (
      this.base_stats &&
      (this.base_stats.out_of_combat.size > 0 || this.base_stats.in_combat.size > 0)
    ) {
      lines.push(`${prefix}【当前属性】`);
      lines.push(this.base_stats.format(indent + 2));
    }

    // 天赋效果（只显示当前精炼等级）
    if (this.talents.length > 0) {
      let currentTalent: WEngineTalent | null = null;
      for (const talent of this.talents) {
        if (talent.level === this.refinement) {
          currentTalent = talent;
          break;
        }
      }
      if (currentTalent) {
        lines.push(`${prefix}【天赋效果】`);
        lines.push(currentTalent.format(indent + 2));
      }
    }

    // 装备状态
    if (this.isEquipped) {
      lines.push(`${prefix}【状态】: 已装备`);
    }

    return lines.join('\n');
  }

  /**
   * 是否已装备
   */
  get isEquipped(): boolean {
    return this.equipped_agent !== null;
  }
}
