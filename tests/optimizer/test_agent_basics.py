"""测试妮可基础面板 - 验证角色属性加载是否正确"""
import sys
from pathlib import Path

# 添加src到路径
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from optimizer.optimizer_facade import OptimizerFacade
from optimizer.zzz_models.base import PropertyType


def test_nico_base_stats():
    """测试妮可60级满突破基础面板"""
    # 通过正确的入口初始化
    facade = OptimizerFacade(
        game_data_dir=str(Path(__file__).parent.parent / 'assets' / 'inventory_data'),
        save_dir=str(Path(__file__).parent.parent / 'saves')
    )
    
    # 切换到max_all存档
    facade.switch_save('max_all')
    
    # 获取妮可
    save = facade.save_manager.get_current_save()
    nico = None
    for agent in save.agents.values():
        if agent.name_cn == '妮可':
            nico = agent
            break
    
    if not nico:
        print("ERROR: 未找到妮可")
        return False
    
    # 获取基础面板 (裸面板，不含装备)
    bare = nico.get_bare_stats()
    
    print(f"=== 妮可 ({nico.game_id}) 60级满突破 ===")
    print(f"基础生命值: {bare.get_out_of_combat(PropertyType.HP_BASE):.0f}")
    print(f"基础攻击力: {bare.get_out_of_combat(PropertyType.ATK_BASE):.0f}")
    print(f"基础防御力: {bare.get_out_of_combat(PropertyType.DEF_BASE):.0f}")
    print(f"冲击力: {bare.get_out_of_combat(PropertyType.IMPACT):.0f}")
    print(f"暴击率: {bare.get_out_of_combat(PropertyType.CRIT_):.1f}%")
    print(f"暴击伤害: {bare.get_out_of_combat(PropertyType.CRIT_DMG_):.1f}%")
    print(f"异常掌控: {bare.get_out_of_combat(PropertyType.ANOM_MAS):.0f}")
    print(f"异常精通: {bare.get_out_of_combat(PropertyType.ANOM_PROF):.0f}")
    print(f"穿透率: {bare.get_out_of_combat(PropertyType.PEN_RATE):.1f}%")
    print(f"能量自动回复: {bare.get_out_of_combat(PropertyType.ENER_REGEN):.2f}")
    
    print(f"\n=== 对比期望值 ===")
    print(f"基础生命值: {bare.get_out_of_combat(PropertyType.HP_BASE):.0f} (期望: 8145)")
    print(f"基础攻击力: {bare.get_out_of_combat(PropertyType.ATK_BASE):.0f} (期望: 649)")
    print(f"基础防御力: {bare.get_out_of_combat(PropertyType.DEF_BASE):.0f} (期望: 622)")
    print(f"冲击力: {bare.get_out_of_combat(PropertyType.IMPACT):.0f} (期望: 88)")
    print(f"暴击率: {bare.get_out_of_combat(PropertyType.CRIT_):.1f}% (期望: 5%)")
    print(f"暴击伤害: {bare.get_out_of_combat(PropertyType.CRIT_DMG_):.1f}% (期望: 50%)")
    print(f"异常掌控: {bare.get_out_of_combat(PropertyType.ANOM_MAS):.0f} (期望: 90)")
    print(f"异常精通: {bare.get_out_of_combat(PropertyType.ANOM_PROF):.0f} (期望: 93)")
    print(f"穿透率: {bare.get_out_of_combat(PropertyType.PEN_RATE):.1f}% (期望: 0%)")
    print(f"能量自动回复: {bare.get_out_of_combat(PropertyType.ENER_REGEN):.2f} (期望: 1.56)")
    
    # 验证
    checks = [
        ("HP", bare.get_out_of_combat(PropertyType.HP_BASE), 8145),
        ("ATK", bare.get_out_of_combat(PropertyType.ATK_BASE), 649),
        ("DEF", bare.get_out_of_combat(PropertyType.DEF_BASE), 622),
        ("IMPACT", bare.get_out_of_combat(PropertyType.IMPACT), 88),
        ("CRIT_RATE", bare.get_out_of_combat(PropertyType.CRIT_), 5.0),
        ("CRIT_DMG", bare.get_out_of_combat(PropertyType.CRIT_DMG_), 50.0),
        ("ANOMALY_MASTERY", bare.get_out_of_combat(PropertyType.ANOM_MAS), 90),
        ("ANOMALY_PROF", bare.get_out_of_combat(PropertyType.ANOM_PROF), 93),
        ("PEN_RATE", bare.get_out_of_combat(PropertyType.PEN_RATE), 0.0),
        ("ENER_REGEN", bare.get_out_of_combat(PropertyType.ENER_REGEN), 1.56),
    ]
    
    all_passed = True
    print(f"\n=== 验证结果 ===")
    for name, actual, expected in checks:
        passed = abs(actual - expected) < 0.1
        status = "PASS" if passed else "FAIL"
        print(f"{name}: {actual:.2f} vs {expected} => {status}")
        if not passed:
            all_passed = False
    
    return all_passed


if __name__ == '__main__':
    result = test_nico_base_stats()
    sys.exit(0 if result else 1)
