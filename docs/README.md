# 文档索引

内部文档描述当前有效状态。公开安装说明以仓库根目录 [README.md](../README.md)（英文）和 [README.zh-CN.md](../README.zh-CN.md)（简体中文）为准。

## 阅读顺序

1. [overview.md](./overview.md) — 定位、原则、术语
2. [diagrams.md](./diagrams.md) — 部署、请求路径、Client/Server、配置优先级（Archify HTML + SVG）
3. [product/prd.md](./product/prd.md) — 目标与场景
4. [product/scope.md](./product/scope.md) — 当前版本范围
5. [architecture.md](./architecture.md) — 模块边界与请求路径
6. [rules.md](./rules.md) — 不可违反的规则
7. 需要实现细节时再读 [services/](./services/) 与 [protocols.md](./protocols.md)

## 已实现（v0.1.0）

- Origin 验证 `Cf-Access-Jwt-Assertion`，Remote JWKS，fail closed。
- 远程 privileged 授权（Settings / Credentials / 特权 Agent Preset / `llm.discoverModels`）。
- 普通 API `off | optional | required`。
- Web Client capability enablement，且 `dsh.client.immediately: true`。
- 标准 `dsh.bundle` + `dsh.client` 安装；unload 可逆。
- 在 DSH `0.1.1-rc.2` Web profile 上 live 验证远程 Settings / Credentials。
- npm 公共包 `dsh-cloudflare-access@0.1.0`。

## 尚未交付

- 提交 dsh.pub / 插件市场 listing。
- 跟随尚未实测的更新 DSH 版本。
- 远程授权 `host.pickDirectory` / `host.openPath`，或隐藏因此出现的 native host UI。

## 规范基线

当前需求基线在 `openspec/specs/`。已完成的 change 归档在 `openspec/changes/archive/`。
