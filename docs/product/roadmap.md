# 产品路线图

## 状态
accepted

## Milestone 1 — v0.1.0 Origin JWT 映射
- 目标：在不修改 DSH 本体的前提下，把 Cloudflare Access 身份映射为 DSH 远程配置面授权。
- 交付能力：JWT 验证、privileged 授权、普通 API 三模式、Client capability、Bundle/Client 包装、测试与安全文档。
- 不包含：RBAC、Cloudflare API、`host.pickDirectory` / `host.openPath`、插件市场。
- 验收方式：`docs/product/acceptance-criteria.md` 全部全局与场景项；单元测试 + 至少一项集成测试通过。

## Milestone 2 — DSH 版本跟随
- 目标：在 DSH 升级后保持可逆扩展点，而不是扩大未测兼容声明。
- 交付能力：针对新 DSH 的集成测试、更新后的兼容性矩阵、必要时仅修改 `compat/`。
- 不包含：把 compat hack 扩散进 JWT 核心。
- 验收方式：对新 DSH 版本跑通 privileged / ordinary / Host-Origin / unload 用例。

## Milestone 3 — 分发与市场（候选）
- 目标：降低安装摩擦。
- 交付能力：npm provenance（若启用）、插件市场安装路径。
- 不包含：改变安全模型。
- 验收方式：文档中的安装命令与实际分发渠道一致。
