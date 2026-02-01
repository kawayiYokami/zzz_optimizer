/**
 * 角色分析器服务
 *
 * 根据角色类型（武器类型、元素类型）推荐有效词条
 */

import type { Agent } from '../model/agent';
import { PropertyType, WeaponType, ElementType } from '../model/base';

/**
 * 角色分析器
 */
export class CharacterAnalyzer {
  /**
   * 根据角色推荐有效词条
   * @param agent 角色实例
   * @returns 推荐的有效词条列表
   */
  static recommendEffectiveStats(agent: Agent): PropertyType[] {
    const stats: PropertyType[] = [];

    // 根据武器类型推荐核心词条
    switch (agent.weapon_type) {
      case WeaponType.ATTACK: // 强攻型
        stats.push(
          PropertyType.CRIT_,       // 暴击率
          PropertyType.CRIT_DMG_,   // 暴击伤害
          PropertyType.ATK_         // 攻击力%
        );
        break;

      case WeaponType.ANOMALY: // 异常型
        stats.push(
          PropertyType.ANOM_MAS_,   // 异常掌控%
          PropertyType.ANOM_PROF    // 异常精通
        );
        break;

      case WeaponType.STUN: // 击破型
        stats.push(
          PropertyType.IMPACT_,     // 冲击力
          PropertyType.ATK_         // 攻击力%（提升击破伤害）
        );
        break;

      case WeaponType.SUPPORT: // 支援型
        stats.push(
          PropertyType.ENER_REGEN_, // 能量回复
          PropertyType.HP_          // 生命值%
        );
        break;

      case WeaponType.DEFENSE: // 防护型
        stats.push(
          PropertyType.HP_,         // 生命值%
          PropertyType.DEF_,        // 防御力%
          PropertyType.IMPACT_      // 冲击力
        );
        break;

      default:
        // 未知类型，推荐通用词条
        stats.push(
          PropertyType.ATK_,
          PropertyType.CRIT_,
          PropertyType.CRIT_DMG_
        );
        break;
    }

    // 根据元素类型添加对应的元素伤害加成
    const elementDamageType = this.getElementDamageType(agent.element);
    if (elementDamageType) {
      stats.push(elementDamageType);
    }

    // 去重
    return Array.from(new Set(stats));
  }

  /**
   * 获取元素对应的伤害加成属性类型
   * @param element 元素类型
   * @returns 元素伤害加成属性类型
   */
  static getElementDamageType(element: ElementType): PropertyType | null {
    switch (element) {
      case ElementType.PHYSICAL:
        return PropertyType.PHYSICAL_DMG_;
      case ElementType.FIRE:
        return PropertyType.FIRE_DMG_;
      case ElementType.ICE:
        return PropertyType.ICE_DMG_;
      case ElementType.ELECTRIC:
        return PropertyType.ELECTRIC_DMG_;
      case ElementType.ETHER:
        return PropertyType.ETHER_DMG_;
      default:
        return null;
    }
  }

  /**
   * 获取角色类型描述（用于UI显示）
   * @param agent 角色实例
   * @returns 角色类型描述
   */
  static getCharacterTypeDescription(agent: Agent): string {
    const weaponTypeNames: Record<WeaponType, string> = {
      [WeaponType.ATTACK]: '强攻型',
      [WeaponType.ANOMALY]: '异常型',
      [WeaponType.STUN]: '击破型',
      [WeaponType.SUPPORT]: '支援型',
      [WeaponType.DEFENSE]: '防护型',
      [WeaponType.RUPTURE]: '命破',
    };

    const elementNames: Record<ElementType, string> = {
      [ElementType.PHYSICAL]: '物理',
      [ElementType.FIRE]: '火',
      [ElementType.ICE]: '冰',
      [ElementType.ELECTRIC]: '雷',
      [ElementType.ETHER]: '以太',
    };

    return `${elementNames[agent.element] || '未知'}${weaponTypeNames[agent.weapon_type] || '未知'}`;
  }

  /**
   * 获取推荐理由（用于UI显示）
   * @param agent 角色实例
   * @returns 推荐理由
   */
  static getRecommendationReason(agent: Agent): string {
    switch (agent.weapon_type) {
      case WeaponType.ATTACK:
        return '强攻型角色依赖暴击输出，推荐堆叠暴击率、暴击伤害和攻击力';
      case WeaponType.ANOMALY:
        return '异常型角色通过异常伤害输出，推荐堆叠异常掌控和异常精通';
      case WeaponType.STUN:
        return '击破型角色负责打击破盾，推荐堆叠冲击力和攻击力';
      case WeaponType.SUPPORT:
        return '支援型角色提供辅助效果，推荐堆叠能量回复和生命值';
      case WeaponType.DEFENSE:
        return '防护型角色承担坦克职责，推荐堆叠生命值、防御力和冲击力';
      default:
        return '推荐通用输出词条';
    }
  }
}
