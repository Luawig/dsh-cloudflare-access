# 第三方项目参考分析

## 状态
accepted

## 参考对象
- 名称：Cloudflare Access JWT 源站验证
- 来源：Cloudflare 文档（`Cf-Access-Jwt-Assertion`、Team Domain certs 端点）
- 参考目的：Origin 再验证模型、JWKS URL 约定、只信任 assertion header

## 可借鉴能力
- 在 Origin 验证 Access 签发的 JWT，而不是在应用里再做登录页。
- JWKS：`https://<team-domain>/cdn-cgi/access/certs`
- `iss` 为 team domain；`aud` 为 Access Application audience。

## 不采用点
- 不采用 Access Application 自动创建流程。原因：规格非职责。
- 不采用 Cookie `CF_Authorization` 作为 Origin 身份。原因：规格只信任 header；Cookie 更易被无关上下文带入。
- 不采用 Cloudflare API token 管理。原因：超出最小职责。

## 需要适配后采用
- Remote JWK Set：适配为 `jose.createRemoteJWKSet`，并遵守本仓库 fail closed 与日志规则。
- 多 audience：Cloudflare 一个 Origin 可能对应多个 Application；配置必须是数组。

## 风险
- Team Domain 配错会导致全部远程 privileged 失败（fail closed，可接受）。
- Origin 未限制为 Cloudflare 网络时，攻击者可直连 Origin 并尝试 JWT 相关路径；插件不能代替网络层。

## 关联决策
- `docs/decisions/ADR-0001-additional-auth-layer.md`
- `docs/decisions/ADR-0003-jose-remote-jwks.md`

---

## 参考对象
- 名称：DeepSeek Harness 插件与 Client Module 机制
- 来源：DeepSeek Harness `0.1.0-rc.5` 源码，以及官方 `docs/user/develop/basic/publish.md`
- 参考目的：out-of-tree bundle 安装、client 构建、可逆 fiber

## 可借鉴能力
- `dsh.bundle.patch` 指向 `cordis.patch.yml`，`dsh plugin add` 自动维护 bundle list。
- `dsh.client` + `exports["./client"]` 由 modules 扫描并注入 Web runtime。
- `ctx.effect` disposer 随 fiber unload。
- 双面包装参考 `@deepseek-ai/dsh-session-log-export`。

## 不采用点
- 不采用 in-tree 的 `packages/client/tsdown.client.ts` 作为运行时依赖。原因：out-of-tree 包必须自包含构建。
- 不采用替换 `id: connection` 的 bundle overlay。原因：等于维护 connection 分叉。

## 需要适配后采用
- Client 构建：需要独立 tsdown/esbuild 配置，把 DSH 平台模块标为 external（`react`、`cordis` 等），产出 `lib/client.js`。
- Server 授权：DSH 无 hook，适配为 `webServer.register` 包装，见 ADR-0002。

## 风险
- DSH Developer Preview 内部 API 变化会使 `compat/` 失效。缓解：peer 锁版本 + 集成测试 + 升级时只改 compat。

## 关联决策
- `docs/decisions/ADR-0002-dsh-hook-strategy.md`
