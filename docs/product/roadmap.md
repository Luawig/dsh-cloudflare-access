# 产品路线图

## 状态
accepted

## Milestone 1 — v0.1.0 Origin JWT 映射
- 状态：已交付。Live 验证目标为 DSH `0.1.1-rc.2`。
- 目标：在不修改 DSH 本体的前提下，把 Cloudflare Access 身份映射为 DSH 远程配置面授权。
- 交付能力：JWT 验证、privileged 授权、普通 API 三模式、Client capability（含 immediately prefetch）、Bundle/Client 包装、测试与安全文档。
- 不包含：RBAC、Cloudflare API、`host.pickDirectory` / `host.openPath`、插件市场 listing、npm 公共 registry 发布。
- 验收方式：`docs/product/acceptance-criteria.md`；单元/集成测试；本机 DSH `0.1.1-rc.2` 远程 Settings / Credentials / unload。

## Milestone 2 — 分发与 DSH 版本跟随
- 目标：把安装命令落到真实分发渠道，并在 DSH 升级后保持可逆扩展点。
- 交付能力：npm 公共包、可选 dsh.pub listing、针对新 DSH 的兼容性矩阵；必要时只改 `compat/`。
- 不包含：把 compat hack 扩散进 JWT 核心；未测版本的宽 peer range。
- 验收方式：文档中的安装命令与实际分发渠道一致；对新 DSH 版本跑通 privileged / ordinary / Host-Origin / unload 用例。

## Milestone 3 — 插件市场（候选）
- 目标：降低安装摩擦。
- 交付能力：DSH 插件市场 / 目录安装路径。
- 不包含：改变安全模型。
- 验收方式：市场安装与 `dsh plugin --profile web add` 行为一致。
