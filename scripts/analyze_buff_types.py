#!/usr/bin/env python3
"""
分析所有角色的BUFF类型，找出文档中未涵盖的BUFF类型
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# 文档中已记录的BUFF类型关键词
DOCUMENTED_BUFF_TYPES = {
    # 基础属性
    "ATK_", "HP_", "DEF_", "CRIT_", "CRIT_DMG_", "PEN_",
    "ANOM_MAS", "ANOM_PROF", "ENER_REGEN_",
    # 伤害加成
    "DMG_", "NORMAL_ATK_DMG_", "ENHANCED_SPECIAL_DMG_", 
    "CHAIN_ATK_DMG_", "ULTIMATE_ATK_DMG_",
    # 元素伤害
    "PHYSICAL_DMG_", "FIRE_DMG_", "ICE_DMG_", "ELECTRIC_DMG_", "ETHER_DMG_",
    # Debuff
    "DEF_RED_", "RES_RED_", "DAMAGE_TAKEN_",
}

# 文档中已记录的BUFF机制关键词
DOCUMENTED_MECHANISMS = {
    # 条件触发类
    "攻击命中", "生命值", "暴击", "闪避", "冲刺", "普通攻击", "特殊技", 
    "连携技", "终结技", "强化特殊技", "失衡", "后台", "队伍", "全队",
    # 效果类型
    "伤害提升", "攻击力提升", "暴击率提升", "暴击伤害提升", 
    "防御降低", "抗性降低", "易伤", "能量回复", "回能",
    "持续时间", "叠加", "层数", "上限",
}

# 文档中的BUFF类型分类
DOCUMENTED_CATEGORIES = {
    "Buff": ["攻击力提升", "暴击率提升", "暴击伤害提升", "防御降低", "伤害提升"],
    "ConversionBuff": ["基于X提升Y"],
    "BuffTarget": ["自身", "队友", "敌人", "邦布"],
}


def extract_buff_mentions(text: str) -> list:
    """从文本中提取所有类似BUFF的效果描述"""
    mentions = []
    
    # 提取所有 "X提升/降低Y%" 或 "X提升/降低Y点" 的模式
    pattern = r'([^\s，、，。！？]+(?:率|值|伤害|加成|效率|精通|掌控|回复|持续|层数|时间){1,3}(?:提升|降低|增加|减少)[^\s，、，。！？]{0,15}(?:%|点|秒)?)'
    matches = re.findall(pattern, text)
    mentions.extend(matches)
    
    # 提取条件触发类效果
    condition_pattern = r'(?:当|发动|攻击|使用|命中|处于)[^\s，、，。！？]{0,20}(?:时|后){1}'
    cond_matches = re.findall(condition_pattern, text)
    mentions.extend(cond_matches)
    
    # 提取目标相关效果
    target_pattern = r'(?:全队|队友|后台|自身|敌人|自身|自身){1}'
    target_matches = re.findall(target_pattern, text)
    mentions.extend(target_matches)
    
    return list(set(mentions))


def analyze_character(char_id: str, char_data: dict) -> dict:
    """分析单个角色的BUFF类型"""
    result = {
        "id": char_id,
        "name": char_data.get("Name", ""),
        "undocumented_effects": [],
        "unique_keywords": [],
        "mechanism_types": [],
    }
    
    # 分析核心被动和天赋
    passive_data = char_data.get("Passive", {}).get("Level", {})
    talent_data = char_data.get("Talent", {})
    potential_data = char_data.get("Potential", [])
    
    all_text = []
    
    # 收集所有描述文本
    for level_data in passive_data.values():
        names = level_data.get("Name", [])
        descs = level_data.get("Desc", [])
        if isinstance(names, list) and isinstance(descs, list):
            for name, desc in zip(names, descs):
                all_text.append(f"[核心被动]{name}: {desc}")
                all_text.append(desc)
    
    for level, talent in talent_data.items():
        desc = talent.get("Desc", "")
        desc2 = talent.get("Desc2", "")
        all_text.append(f"[天赋{level}]{talent.get('Name', '')}: {desc}")
        all_text.append(desc)
        all_text.append(desc2)
    
    for pot in potential_data:
        all_text.append(f"[潜能]{pot.get('Name', '')}: {pot.get('Desc', '')}")
        all_text.append(pot.get("Desc", ""))
    
    # 分析特殊效果类型
    special_effects = defaultdict(list)
    
    for text in all_text:
        if not text or not isinstance(text, str):
            continue
            
        # 检测特殊BUFF机制
        # 1. 能量相关
        if re.search(r'能量|回能|充能', text):
            special_effects["ENERGY_RELATED"].append(text[:50])
        
        # 2. 失衡相关
        if re.search(r'失衡值?|失衡状态', text):
            special_effects["STUN_RELATED"].append(text[:50])
        
        # 3. 属性异常
        if re.search(r'属性异常|异常积蓄|异常掌控|异常精通', text):
            special_effects["ANOMALY_RELATED"].append(text[:50])
        
        # 4. 抗打断
        if re.search(r'抗打断|无敌|霸体', text):
            special_effects["INTERRUPT_IMMUNE"].append(text[:50])
        
        # 5. 暴击相关（超出文档）
        if re.search(r'暴击暴击|暴击加成', text):
            special_effects["CRIT_SPECIAL"].append(text[:50])
        
        # 6. 连击/连段
        if re.search(r'连击|连段|连续', text):
            special_effects["COMBO_RELATED"].append(text[:50])
        
        # 7. 特殊触发条件
        if re.search(r'极限闪避|快速支援|招架支援', text):
            special_effects["SPECIAL_TRIGGER"].append(text[:50])
        
        # 8. 多层/叠层
        if re.search(r'叠加|层数|上限', text):
            special_effects["STACK_MECHANIC"].append(text[:50])
        
        # 9. 场上/后台
        if re.search(r'场上|后台|当前角色', text):
            special_effects["POSITION_BASED"].append(text[:50])
        
        # 10. 特定属性/阵营
        if re.search(r'电属性|火属性|冰属性|物理|以太|狡兔屋|维多利亚|', text):
            special_effects["ATTRIBUTE_BASED"].append(text[:50])
        
        # 11. 增益/减益持续时间
        if re.search(r'持续.*秒|.*秒内', text):
            special_effects["DURATION_BASED"].append(text[:50])
        
        # 12. 暴击回能/暴击回血
        if re.search(r'暴击时.*回复|暴击.*回', text):
            special_effects["CRIT_TRIGGER"].append(text[:50])
    
    result["special_effects"] = dict(special_effects)
    return result


def main():
    char_dir = Path.cwd() / r"assets\inventory_data\character"
    
    # 收集所有特殊效果类型
    all_special_effects = defaultdict(set)
    all_keywords = defaultdict(set)
    
    print("正在分析角色数据...\n")
    
    # 分析前20个角色
    char_files = sorted(char_dir.glob("*.json"))[:20]
    
    for char_file in char_files:
        char_id = char_file.stem
        try:
            with open(char_file, 'r', encoding='utf-8') as f:
                char_data = json.load(f)
            
            result = analyze_character(char_id, char_data)
            
            # 收集特殊效果
            for effect_type, examples in result["special_effects"].items():
                all_special_effects[effect_type].update([char_data.get("Name", "")])
                for ex in examples[:1]:  # 只保留示例
                    all_special_effects[f"{effect_type}_examples"] = ex
                    
        except Exception as e:
            print(f"Error analyzing {char_id}: {e}")
    
    # 打印分析结果
    print("=" * 70)
    print("文档中可能未涵盖的BUFF类型分析")
    print("=" * 70)
    
    effect_categories = {
        "ENERGY_RELATED": "⚡ 能量相关（充能、回能、能量效率）",
        "STUN_RELATED": "💫 失衡相关（失衡值、失衡状态）",
        "ANOMALY_RELATED": "🔮 异常相关（属性异常、异常积蓄/掌控/精通）",
        "INTERRUPT_IMMUNE": "🛡️ 抗打断/无敌/霸体",
        "COMBO_RELATED": "🔥 连击/连段相关",
        "SPECIAL_TRIGGER": "🎯 特殊触发条件（极限闪避、快速支援、招架支援）",
        "STACK_MECHANIC": "📊 叠层机制（叠加、层数上限）",
        "POSITION_BASED": "👥 位置相关（场上/后台角色）",
        "ATTRIBUTE_BASED": "🎨 属性/阵营限定（特定属性或阵营的角色）",
        "DURATION_BASED": "⏱️ 持续时间相关（持续X秒、X秒内）",
        "CRIT_TRIGGER": "💥 暴击触发效果（暴击时回复/增益）",
    }
    
    for effect_type, desc in effect_categories.items():
        chars = all_special_effects.get(effect_type, set())
        example = all_special_effects.get(f"{effect_type}_examples", "")
        
        print(f"\n{desc}")
        if chars:
            print(f"  涉及角色: {', '.join(sorted(chars))}")
        if example:
            print(f"  示例: {example}")
        else:
            print(f"  ⚠️ 未找到此类型效果")
    
    # 建议补充的BUFF类型
    print("\n" + "=" * 70)
    print("📋 建议补充到文档的BUFF类型")
    print("=" * 70)
    
    recommendations = [
        ("能量机制", "ENERGY_", "能量自动回复、能量获得效率、充能层数、能量回复"),
        ("失衡机制", "STUN_", "失衡值提升、失衡状态伤害加成、失衡抵抗"),
        ("异常机制", "ANOMALY_", "异常积蓄值、异常掌控、异常精通、属性异常伤害"),
        ("抗打断", "INTERRUPT_", "抗打断等级、无敌时间、霸体"),
        ("连击加成", "COMBO_", "连击伤害加成、连击属性加成"),
        ("特殊触发", "TRIGGER_", "极限闪避触发、快速支援触发、招架支援触发"),
        ("叠层机制", "STACK_", "最大层数、叠层触发条件、叠层效果"),
        ("位置相关", "POSITION_", "场上角色增益、后台角色增益"),
        ("暴击触发", "CRIT_TRIGGER_", "暴击时回复/增益/效果"),
        ("持续时间", "DURATION_", "增益持续时间、效果持续时间"),
    ]
    
    for name, prefix, desc in recommendations:
        print(f"\n{name} ({prefix})")
        print(f"  描述: {desc}")


if __name__ == "__main__":
    main()
