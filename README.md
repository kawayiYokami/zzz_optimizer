# 绝区零优化器

《绝区零》游戏数据优化器，用于角色配装分析、伤害计算和装备优化。

## 作用

- 📊 数据管理 - 导入导出角色、音擎、驱动盘数据
- ⚔️ 伤害计算 - 基于乘区论的完整伤害计算
- 🛠️ 装备优化 - 角色配装建议和属性分析
- 💾 存档管理 - 本地存储，支持多存档切换
- 👥 队伍配置 - 前台/后台角色管理和 Buff 激活控制

## 数据扫描

本工具需要先扫描游戏内的装备数据，请使用以下扫描器：

**驱动盘扫描器**: https://github.com/kawayiYokami/ZenlessZoneZero-OneDragon/tree/discs_scan

扫描后将数据导入到本工具中即可使用。

## 启动方式

```bash
# 进入 Web 目录
cd web/optimizer

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

然后在浏览器打开 `http://localhost:8522`

## 技术栈

- Vue 3 + TypeScript
- Vite + TailwindCSS + DaisyUI
- Pinia 状态管理

## 许可证

GPL v3