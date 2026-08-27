# Proposal

## Why

DeepSeek Harness 允许远程 trusted-host 访问普通 Web/API，但配置面 privileged RPC 仍限制为 loopback。Cloudflare Access 已经完成身份认证，DSH 无法识别该结果，远程 Settings / Credentials / Agent Preset / Model discovery 不可用。本 change 用 Origin JWT 再验证补齐这层映射，且不引入第二套登录系统、不修改 DSH 本体。

来源：`docs/product/prd.md`。

## What Changes

- 新增 DSH Profile Bundle `dsh-cloudflare-access`：Server Plugin 验证 `Cf-Access-Jwt-Assertion`，并在 Host/Origin 通过后授权远程配置面 privileged API。
- 新增 ordinary API 的 JWT 策略 `off | optional | required`（默认 `off`）。
- 新增 Web Client Module：仅做 capability enablement，让远程 UI 尝试 Host Settings 等 RPC。
- 新增 Env / Cordis 配置，Env 锁定信任根。
- 新增测试、README、SECURITY.md、CHANGELOG.md。
- 不修改 DSH dist/source。不开放 `host.pickDirectory` / `host.openPath`。

## Capabilities

### New Capabilities
- `cloudflare-jwt`: Cloudflare Access JWT 提取与验证（header、iss、多 aud、exp/nbf、Remote JWKS、fail closed）。
- `dsh-authorization`: loopback bypass、远程 privileged 固定 JWT、ordinary 三模式、不得绕过 Host/Origin。
- `client-capability`: 远程 Web Client 解锁 Settings 等尝试路径，不做安全裁决。
- `plugin-packaging`: `dsh.bundle` + `dsh.client` 安装、可逆 unload、Env 配置优先级。

### Modified Capabilities
- 无。本仓库无既有 `openspec/specs/`。

## Impact

- 新 npm 包与 DSH Web Profile 运行时。
- peer：已调研的 DSH `0.1.0-rc.5` 公开插件面；compat 包装 `webServer.register` 与 `connection.isLoopback`。
- 依赖：`jose`、Cordis、DSH host webserver / apiproxy（作为 peer 或运行时存在）。
- 部署：不替代 Cloudflare Access 或 Origin 网络控制。

## Affected Docs
- `docs/product/prd.md`
- `docs/architecture.md`
- `docs/rules.md`
- `docs/references/dsh-source-research.md`

## Open Questions
- 见 `docs/intake.md` QUESTION-1 至 QUESTION-4。不阻塞 v0.1 实现。
