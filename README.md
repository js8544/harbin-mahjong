# 哈尔滨麻将

[![CI](https://github.com/js8544/harbin-mahjong/actions/workflows/ci.yml/badge.svg)](https://github.com/js8544/harbin-mahjong/actions/workflows/ci.yml)

一个可直接在浏览器中游玩的单机哈尔滨麻将网页游戏，使用 React + TypeScript + Vite 构建。

## 在线地址

- Railway 生产环境：<https://harbin-mahjong-production.up.railway.app>

## 当前功能

- 1 名玩家对战 3 家 AI
- 完整的摸牌 / 出牌 / 吃 / 碰 / 杠 / 胡流程
- 弃牌响应优先级处理
- 庄家轮转
- 单局结算面板
- 多局累计计分
- 七对结算支持
- 牌局日志与操作提示
- 中文化牌面、方位、玩家名称与局内文案
- GitHub Actions 自动执行 lint / test / build

## 当前规则假设

这是一个可玩的哈尔滨麻将近似实现，但还不是所有地方规则细节的权威完整版。

- 136 张牌
- 不带花牌
- 吃牌仅限上家弃牌
- 响应优先级：胡 > 杠 > 碰 > 吃
- 支持标准和型：4 组面子 + 1 对将
- 支持七对
- 当前简化结算项包括：
  - 基础胡牌
  - 自摸
  - 庄家胡牌
  - 七对
  - 清一色
  - 刻子手

## 本地开发

本仓库使用 pnpm。

```bash
corepack enable
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
```

## CI

GitHub Actions 工作流文件位于：

- `.github/workflows/ci.yml`

当前 CI 会在以下场景运行：

- push 到 `main` / `master`
- pull request 到 `main` / `master`
- 手动触发 workflow_dispatch

执行内容包括：

- 安装依赖
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Railway 自动部署

当前项目已部署在 Railway 的 `harbin-mahjong` 项目中。

推荐自动部署方式：

1. 在 Railway 控制台打开项目 `harbin-mahjong`
2. 确认服务已连接 GitHub 仓库 `js8544/harbin-mahjong`
3. 确认跟踪分支为 `main`
4. 保持 Auto Deploy 开启

这样每次推送到 `main` 时，Railway 就会自动拉取并部署最新版本。

## 本次修复说明

本轮已完成：

- 麻将牌面从英文内部编码改为中文显示（如 `1万 / 2条 / 3筒 / 东 / 南 / 西 / 北 / 中 / 发 / 白`）
- 玩家与方位统一中文化（你 / 左家 / 对家 / 右家）
- 局内提示、日志、结算文案改为中文
- 手牌样式调整为更接近真实麻将牌的视觉形式
- 修复 CI 中的 lint 与测试问题
- 验证 Railway 生产环境可访问

## 路线图

后续可以继续完善：

- 更完整的哈尔滨地方规则
- 更强的 AI 出牌策略
- 更好的牌桌沉浸感和动画
- 更细的结算番型展示
