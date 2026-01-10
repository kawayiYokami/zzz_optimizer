"""
测试 BattleService 格式化输出

参照 test_format_methods.py 的模式
"""
import sys
import os
from pathlib import Path
from datetime import datetime

# 添加项目根目录到 Python 路径
root_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root_dir / "src"))

from optimizer.optimizer_facade import OptimizerFacade
from optimizer.services.battle_service import BattleService


def test_battle_service_format():
    """测试战场服务的格式化输出"""
    # 收集所有输出
    output_lines = []

    def print_to_lines(text):
        """将print输出保存到列表"""
        output_lines.append(text)
        print(text)  # 同时输出到终端

    print_to_lines("="*80)
    print_to_lines("战场服务测试")
    print_to_lines("="*80)

    # 切换到项目根目录（以便找到存档文件）
    root_dir = Path(__file__).parent.parent.parent
    os.chdir(root_dir)

    # 初始化
    facade = OptimizerFacade()
    facade.switch_save('max_all')
    save = facade.save_manager.get_current_save()

    # 获取上下文
    context = facade.save_manager.get_current_context()

    # 获取星见雅
    agent = None
    for a in save.agents.values():
        if a.game_id == '1091':  # 星见雅的game_id
            agent = a
            break

    if not agent:
        print_to_lines("未找到星见雅")
        return

    # 获取终结技（用于计算伤害）
    ultimate_skill = None
    if agent.skill_set:
        print_to_lines(f"\n星见雅有技能集")
        all_skills = agent.skill_set.get_all_skills()
        print_to_lines(f"技能数量: {len(all_skills)}")
        print_to_lines(f"技能列表：")
        for skill in all_skills:
            print_to_lines(f"  - {skill.skill_name}")

        for skill in all_skills:
            if '终结技' in skill.skill_name or '连携技' in skill.skill_name:
                ultimate_skill = skill
                break

        # 如果没找到终结技，使用第一个技能
        if not ultimate_skill and all_skills:
            ultimate_skill = all_skills[0]
    else:
        print_to_lines("\n星见雅没有技能集，创建测试技能")
        # 手动创建一个测试技能（用于测试战场服务的格式化输出）
        from optimizer.zzz_models.agent_skill import AgentSkill, AgentSkillSegment

        # 创建技能段
        segment = AgentSkillSegment(
            agent_name='星见雅',
            skill_name='终结技：霜华乱舞',
            segment_name='',
            damage_ratio=10.0,  # 1000%
            damage_ratio_growth=0.5,
            stun_ratio=0.0,
            stun_ratio_growth=0.0,
            energy_recovery=0.0,
            anomaly_buildup=50.0,
            decibel_recovery=0.0,
            flash_energy_accumulation=0.0,
            corruption_shield_reduction=0.0,
            skill_type=4,
            attack_type=0,
            energy_extra_cost=0.0,
        )

        # 创建技能
        ultimate_skill = AgentSkill(
            agent_name='星见雅',
            skill_name='终结技：霜华乱舞',
            segments=[segment],
            level=agent.skills.chain,
        )

    if not ultimate_skill:
        print_to_lines("无法创建测试技能")
        return

    # 获取敌人
    enemies = facade.optimizer.data_loader.enemies
    if not enemies:
        print_to_lines("未找到敌人数据")
        return
    enemy = list(enemies.values())[0]

    # 创建战场
    battle = BattleService()
    battle.set_front_agent(agent)
    battle.set_enemy(enemy)
    battle.set_skill(ultimate_skill)
    battle.start_battle()

    # 计算伤害（使用真实的终结技参数）
    level = agent.skills.chain
    damage_ratio = ultimate_skill.get_total_damage_ratio(level)
    anomaly_buildup = ultimate_skill.get_total_anomaly_buildup()
    element = agent.element.name.lower()

    battle.calculate_skill_damage(
        skill_damage_ratio=damage_ratio,
        skill_element=element,
        skill_anomaly_buildup=anomaly_buildup,
        skill_anomaly_ratio=0.0,
        is_penetration=False,
    )

    # ✅ 唯一的输出：调用 battle.format(context=context)
    print_to_lines("")
    print_to_lines("="*80)
    print_to_lines("战场服务 - 完整格式化输出")
    print_to_lines("="*80)
    print_to_lines(battle.format(context=context))

    print_to_lines("")
    print_to_lines("="*80)
    print_to_lines("测试完成！")
    print_to_lines("="*80)

    # 保存到markdown文件
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"battle_service_output_{timestamp}.md"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))

    print_to_lines(f"\n输出已保存到: {filename}")


if __name__ == "__main__":
    test_battle_service_format()
