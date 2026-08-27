# 需求摄取记录

## 状态
accepted

## 来源
- 来源 1：用户提供的《dsh-cloudflare-access 实现规格说明书》全文（本仓库初始输入）。
- 来源 2：本地 DeepSeek Harness 源码调研，路径 `DeepSeek Harness upstream source`，版本 `0.1.0-rc.5`。调研问题见规格第 26 节；结论见 `docs/references/dsh-source-research.md`。

## Facts
- FACT-1: 项目定位是 DSH Profile Bundle + Client Plugin，为 Cloudflare Access 后方的 DeepSeek Harness Origin 提供 JWT 再验证，并把认证结果映射为远程 privileged API 授权。
- FACT-2: 插件不提供账号、密码、MFA、登录页、Session、用户数据库、Cloudflare API 管理、nginx 管理或 DSH Agent/Sandbox 权限管理。
- FACT-3: 禁止 fork / 修改 `DSH 安装目录` / patch 编译后的 DSH JS / 替换 Web 静态资源 / 修改 DSH 上游源码。
- FACT-4: 远程 privileged 请求必须同时通过 DSH 原有 Host/Origin 检查和有效 Cloudflare Access JWT；有效 JWT 不得绕过 Host/Origin。
- FACT-5: Loopback 访问不要求 Cloudflare JWT，privileged API 保持 DSH 原行为，以支持 `SSH Tunnel → localhost → DSH`。
- FACT-6: 远程 privileged API 固定要求有效 JWT，v0.1 不提供关闭开关。覆盖 `settings.*`、`credentials.*`、特权子集 `agentPreset.*`、`llm.discoverModels`。
- FACT-7: 普通 API 的 JWT 策略可配置为 `off | optional | required`，默认 `off`。Loopback 不受该配置影响。
- FACT-8: Origin 只信任 HTTP Header `Cf-Access-Jwt-Assertion`，不以 `CF_Authorization` Cookie 作为身份依据。
- FACT-9: 用户只配置 `cloudflare.teamDomain` 与 `cloudflare.audiences`（多值）。内部推导 `issuer = teamDomain`，`jwksUrl = <teamDomain>/cdn-cgi/access/certs`。
- FACT-10: 必须支持环境变量 `DSH_CF_ACCESS_TEAM_DOMAIN`、`DSH_CF_ACCESS_AUDIENCES`（逗号分隔）、`DSH_CF_ACCESS_ORDINARY_MODE`。优先级为 Environment > Cordis/Bundle Config > Default。环境变量一旦存在，运行时不得被 Web Settings 覆盖。
- FACT-11: JWT 验证必须使用成熟库（推荐 `jose`），覆盖 signature、alg、iss、aud、exp、nbf（存在时）。拒绝 unsigned、algorithm downgrade、错误 iss/aud、过期 token。
- FACT-12: 使用 Remote JWK Set 缓存与 key rotation；v0.1 不缓存单个 JWT 验证结果。JWKS 不可用时 fail closed，禁止因 Cloudflare 网络异常而放行。
- FACT-13: 缺少 `teamDomain` 或 `audiences` 时插件可以启动，loopback 保持，远程 privileged API 必须 fail closed，并打明确日志。
- FACT-14: 安装形态必须是正式 `dsh.bundle`（`cordis.patch.yml`）+ `dsh.client`（`exports["./client"]`），使用 `dsh plugin --profile web add ...` 后无需手工改 Profile patch。
- FACT-15: 插件 unload 必须可逆，不得留下全局 monkey patch；DSH 恢复官方 remote privileged 限制。
- FACT-16: v0.1 不实现 `host.pickDirectory`、`host.openPath`、用户名密码、MFA、用户数据库、RBAC、Cloudflare API、自动创建 Access Application、nginx 管理。
- FACT-17: License MIT；TypeScript；ESM；GitHub 开源；npm 公共包。
- FACT-18: 本地调研到的 DSH 版本为 `0.1.0-rc.5`。`PRIVILEGED_METHODS` 硬编码在 `@deepseek-ai/dsh-client-connection`；无正式 authorization hook。Client 通过 `connection.isLoopback` 将 Settings persistence 设为 `memory`。完整调用链见 `docs/references/dsh-source-research.md`。
- FACT-19: DSH 当前 `settings.*` 全部为特权方法；`credentials.*` 全部为特权方法；`agentPreset.list` / `agentPreset.select` 非特权，`agentPreset.read` / `copy` / `openDocument` / `remove` 为特权；`llm.discoverModels` 为特权，`llm.providers` / `llm.models` 非特权。

## Assumptions
- ASSUMPTION-1: v0.1 的兼容性矩阵只声明已用本地源码调研并对准的 DSH `0.1.0-rc.5`，不提前声明更宽范围。原因：规格第 21 节禁止猜测未经测试的兼容范围。
- ASSUMPTION-2: npm 包名使用未加 scope 的 `dsh-cloudflare-access`。原因：规格项目名称即此；GitHub org / npm scope 未指定。
- ASSUMPTION-3: Cordis 配置面即规格所说的可被 Web Settings 编辑的配置来源；环境变量覆盖该面。原因：规格要求 Env > Cordis，且禁止 Web Settings 覆盖 env 指定的信任根。
- ASSUMPTION-4: 远程 WebSocket 事件通道（`/api/events.mux`、`/api/events.host`）按普通 API 策略处理，不属于 privileged 集合。原因：DSH 未把它们列入 `PRIVILEGED_METHODS`，规格第 17 节普通策略覆盖非特权远程请求。
- ASSUMPTION-5: 在 DSH `0.1.0-rc.5` 无公开授权钩子的前提下，将 Host 路由包装与 Client `isLoopback` 包装隔离在 `compat/`，JWT/policy 核心不依赖 DSH 内部符号。原因：规格第 3.2 / 26 节允许最小兼容适配集中在 `compat/`。
- ASSUMPTION-6: Client 为解锁 Settings / Models / Credentials / Preset 能力，需要把远程页的 `connection.isLoopback` 视为 capability enablement（仅 UI），安全裁决仍在 Server。副作用是 `host.pickDirectory` / `host.openPath` 的 UI 入口可能出现，但 Server 在 v0.1 即使 JWT 有效也拒绝这两类方法。原因：Client 没有公开 persistence override；这些 UI 读同一 `isLoopback` 字段。

## Open Questions
- QUESTION-1: npm 发布账号是什么？影响：npm 安装命令与 provenance。GitHub 仓库已确认为 `Luawig/dsh-cloudflare-access`。
- QUESTION-2: 是否要在 Web Settings 暴露 `cloudflare.teamDomain` / `audiences` / `auth.ordinary` 表单？影响：配置面与 RULE-CONFIG-ENV-LOCK 的实现范围。当前按“Cordis 配置可用，但不强制做独立 Settings UI”处理。
- QUESTION-3: 远程页出现 `host.pickDirectory` / `host.openPath` UI 但 RPC 403，是否可接受为 v0.1 已知限制？影响：Client hook 选择。当前按 ASSUMPTION-6 接受，并写入验收“不验收事项”。
- QUESTION-4: CI 是对真实安装的 DSH npm 包做集成测试，还是允许用本地 checkout 的 DSH 作为 peer？影响：CI 矩阵与 peerDependencies 写法。

## Pending Decisions
- DECISION-1: npm provenance 是否在首个正式发布启用。候选项：v0.1.0 启用 / 延后到后续版本。规格写“条件允许”。
- DECISION-2: Dependabot 与 Renovate 选哪一个。候选项：Dependabot / Renovate / 两者都不在 v0.1 强制。
- DECISION-3: 插件市场安装形态。候选项：v0.1 只保证 `dsh plugin --profile web add`；市场安装列为后续。规格写“后续应兼容”。

## Reference Signals

### 可借鉴模式
- REF-1: Cloudflare Access Origin 验证 `Cf-Access-Jwt-Assertion`，JWKS 来自 Team Domain `/cdn-cgi/access/certs`。
- REF-2: DSH 正式 out-of-tree bundle：`package.json` 的 `dsh.bundle.patch` + `dsh.client` + `exports["./client"]`。参考 `docs/user/develop/basic/publish.md` 与 `@deepseek-ai/dsh-session-log-export`。
- REF-3: `jose.createRemoteJWKSet()` 负责 JWKS cache、cooldown、kid miss refresh、key rotation。

### 不适用模式
- REF-4: 不要把 Cloudflare Access Application 创建、Zero Trust Dashboard 自动化或 Cloudflare API token 管理做进插件。原因：规格明确非职责。
- REF-5: 不要用 Cookie `CF_Authorization` 做 Origin 身份。原因：规格只信任 assertion header。
- REF-6: 不要 fork DSH 或替换 connection 整包作为正常安装方式。原因：维护分叉成本高，且违反“不修改 DSH 本体”。


### 需要适配后采用
- REF-8: DSH `webServer.register` 包装作为 Server 授权插入点。适配条件：包装必须发生在 `connection` 注册 `/api` 之前；unload 时恢复原方法；JWT 不能跳过 Host/Origin。
- REF-9: DSH Client `connection.isLoopback` 包装作为 capability enablement。适配条件：Client 不做 JWT 判断；Server 仍拒绝 `host.pickDirectory` / `host.openPath`；unload 时恢复原值。
