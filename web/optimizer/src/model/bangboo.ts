/**
 * 邦布模型
 */
import type { BangbooInfo } from '../services/data-loader.service';

export class Bangboo {
  id: string;
  name_cn: string;
  name_en: string;
  rarity: 'S' | 'A' = 'A'; // 默认为A级
  level: number = 1;
  refinement: number = 1; // 1-5
  
  // 基础属性
  base_hp: number = 0;
  base_atk: number = 0;
  base_def: number = 0;
  impact: number = 0;
  anomaly_mastery: number = 0;
  crit_rate: number = 0;
  crit_dmg: number = 0;

  // 技能描述 (暂存)
  active_skill: string = '';
  passive_skill: string = '';

  constructor(id: string, nameCn: string) {
    this.id = id;
    this.name_cn = nameCn;
    this.name_en = '';
  }

  static fromInfo(info: BangbooInfo): Bangboo {
    const bangboo = new Bangboo(info.id, info.CHS);
    bangboo.name_en = info.EN;
    bangboo.base_hp = info.base_hp;
    bangboo.base_atk = info.base_atk;
    bangboo.base_def = info.base_def;
    bangboo.impact = info.impact;
    bangboo.anomaly_mastery = info.anomaly_mastery;
    bangboo.crit_rate = info.crit_rate;
    bangboo.crit_dmg = info.crit_dmg;
    
    // 简单的稀有度判断逻辑 (通常S级基础属性更高，或者有特定的ID范围)
    // 这里暂时默认为A，除非有额外字段
    return bangboo;
  }
}