"""
测试 format() 方法输出

测试所有模型的格式化输出方法，确保：
1. 中文显示正确
2. 百分比格式正确
3. 数值精度合理
4. 布局清晰易读
"""
import sys
import os
from pathlib import Path
from datetime import datetime

# 添加项目根目录到 Python 路径
root_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root_dir / "src"))

from optimizer.optimizer_facade import OptimizerFacade


def test_agent_format():
    """测试角色的完整格式化输出"""
    # 收集所有输出
    output_lines = []

    def print_to_lines(text):
        """将print输出保存到列表"""
        output_lines.append(text)
        print(text)  # 同时输出到终端

    print_to_lines("="*80)
    print_to_lines("测试 format() 方法")
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

    print_to_lines("")
    print_to_lines("="*80)
    print_to_lines("星见雅 - 完整格式化输出")
    print_to_lines("="*80)
    print_to_lines(agent.format(context=context))

    print_to_lines("")
    print_to_lines("="*80)
    print_to_lines("所有 format() 方法测试完成！")
    print_to_lines("="*80)

    # 保存到markdown文件
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"format_methods_output_{timestamp}.md"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))

    print_to_lines(f"\n输出已保存到: {filename}")


if __name__ == "__main__":
    test_agent_format()
