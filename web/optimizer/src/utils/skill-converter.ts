/**
 * 技能数据转换工具
 *
 * 从原始游戏数据格式（character/{id}.json）转换为新的技能数据结构
 */

import type { Skill, SkillSegment, SkillSet } from '../model/skill';
import { SkillCategory, SkillPropType } from '../model/skill';

/**
 * 从原始游戏数据生成指定等级的技能段
 *
 * @param paramItem 技能参数项（原始游戏数据格式）
 * @param propType 属性类型（伤害或失衡）
 * @param level 技能等级
 * @returns 技能段（已计算）
 */
export function generateSkillSegment(
  paramItem: any,
  propType: SkillPropType,
  level: number
): SkillSegment {
  // 解析 Desc 获取技能ID和属性ID
  const descMatch = paramItem.Desc.match(/\{Skill:(\d+), Prop:(\d+)\}/);
  const skillId = descMatch?.[1] || '';
  const propId = parseInt(descMatch?.[2] || '0');

  // 获取对应的参数数据
  const paramData = paramItem.Param[skillId];
  if (!paramData) {
    throw new Error(`Skill param not found: ${skillId}`);
  }

  // 根据属性类型选择字段
  let baseValue: number;
  let growthValue: number;

  if (propType === SkillPropType.DAMAGE) {
    baseValue = paramData.DamagePercentage;
    growthValue = paramData.DamagePercentageGrowth;
  } else if (propType === SkillPropType.STUN) {
    baseValue = paramData.StunRatio;
    growthValue = paramData.StunRatioGrowth;
  } else {
    throw new Error(`Unknown prop type: ${propType}`);
  }

  // 计算指定等级的值（数值单位是 0.01%，需要除以 10000）
  const finalValue = (baseValue + (level - 1) * growthValue) / 10000;

  // 计算其他属性（如果有成长值）
  const spRecovery = (paramData.SpRecovery + (level - 1) * paramData.SpRecoveryGrowth) / 100;
  const feverRecovery = (paramData.FeverRecovery + (level - 1) * paramData.FeverRecoveryGrowth) / 100;
  const rpRecovery = (paramData.RpRecovery + (level - 1) * paramData.RpRecoveryGrowth) / 100;

  return {
    name: paramItem.Name,
    damageRatio: propType === SkillPropType.DAMAGE ? finalValue : 0,
    stunRatio: propType === SkillPropType.STUN ? finalValue : 0,
    anomalyBuildup: paramData.AttributeInfliction / 100,
    spRecovery: spRecovery,
    feverRecovery: feverRecovery,
    rpRecovery: rpRecovery,
    etherPurify: paramData.EtherPurify / 100,
    skillId: skillId,
  };
}

/**
 * 从原始游戏数据生成指定等级的技能
 *
 * @param descriptionItem 技能描述项（原始游戏数据格式）
 * @param category 技能分类
 * @param level 技能等级
 * @returns 技能（已计算）
 */
export function generateSkill(
  descriptionItem: any,
  category: SkillCategory,
  level: number
): Skill {
  if (!descriptionItem.Param) {
    throw new Error(`Skill param not found: ${descriptionItem.Name}`);
  }

  // 生成所有段
  const segments: SkillSegment[] = [];

  // 遍历 Param 数组，提取伤害倍率和失衡倍率
  for (const paramItem of descriptionItem.Param) {
    const descMatch = paramItem.Desc.match(/\{Skill:(\d+), Prop:(\d+)\}/);
    const propId = parseInt(descMatch?.[2] || '0');

    // 根据属性类型生成对应的段
    if (propId === SkillPropType.DAMAGE) {
      segments.push(generateSkillSegment(paramItem, SkillPropType.DAMAGE, level));
    } else if (propId === SkillPropType.STUN) {
      // 失衡倍率段，更新对应伤害段的 stunRatio
      const stunSegment = generateSkillSegment(paramItem, SkillPropType.STUN, level);
      // 找到对应的伤害段并更新
      const damageSegment = segments.find(s => s.skillId === stunSegment.skillId);
      if (damageSegment) {
        damageSegment.stunRatio = stunSegment.stunRatio;
      }
    }
  }

  // 检查是否有能量消耗（如强化特殊技）
  let spConsume: number | undefined;
  const consumeParam = descriptionItem.Param.find((p: any) => p.Name === '能量消耗');
  if (consumeParam && consumeParam.Desc) {
    const consumeMatch = consumeParam.Desc.match(/(\d+)点/);
    spConsume = consumeMatch ? parseInt(consumeMatch[1]) : undefined;
  }

  return {
    name: descriptionItem.Name,
    category: category,
    segments: segments,
    level: level,
    spConsume: spConsume,
  };
}

/**
 * 从原始游戏数据生成指定等级的技能集合
 *
 * @param skillData 原始游戏数据（Skill 对象）
 * @param skillLevels 各技能类型的等级
 * @returns 技能集合（已计算）
 */
export function generateSkillSet(
  skillData: any,
  skillLevels: Record<string, number>
): SkillSet {
  const skillSet: SkillSet = {
    basic: [],
    dodge: [],
    special: [],
    chain: [],
    assist: [],
  };

  // 处理普通攻击
  if (skillData.Basic?.Description) {
    for (const descItem of skillData.Basic.Description) {
      if (descItem.Param) {
        const skill = generateSkill(descItem, SkillCategory.BASIC, skillLevels.normal || 1);
        skillSet.basic.push(skill);
      }
    }
  }

  // 处理闪避
  if (skillData.Dodge?.Description) {
    for (const descItem of skillData.Dodge.Description) {
      if (descItem.Param) {
        const skill = generateSkill(descItem, SkillCategory.DODGE, skillLevels.dodge || 1);
        skillSet.dodge.push(skill);
      }
    }
  }

  // 处理特殊技
  if (skillData.Special?.Description) {
    for (const descItem of skillData.Special.Description) {
      if (descItem.Param) {
        const skill = generateSkill(descItem, SkillCategory.SPECIAL, skillLevels.special || 1);
        skillSet.special.push(skill);
      }
    }
  }

  // 处理连携技
  if (skillData.Chain?.Description) {
    for (const descItem of skillData.Chain.Description) {
      if (descItem.Param) {
        const skill = generateSkill(descItem, SkillCategory.CHAIN, skillLevels.chain || 1);
        skillSet.chain.push(skill);
      }
    }
  }

  // 处理支援
  if (skillData.Assist?.Description) {
    for (const descItem of skillData.Assist.Description) {
      if (descItem.Param) {
        const skill = generateSkill(descItem, SkillCategory.ASSIST, skillLevels.assist || 1);
        skillSet.assist.push(skill);
      }
    }
  }

  return skillSet;
}