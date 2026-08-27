# 系统架构

## 状态
accepted

## 范围
定义插件在 DSH 进程内的模块边界、运行时请求路径、Client 注入方式，以及推荐部署模型。

## 选定架构

插件作为 DSH 进程内的 Cordis 组合层，而不是独立反向代理。

```text
Internet
   ↓
Cloudflare Access
   ↓
Cloudflare Proxy
   ↓
Origin Network Controls
   ↓
Reverse Proxy (nginx 等，本仓库不管理)
   ↓
DeepSeek Harness
   ↓
dsh-cloudflare-access
   ├─ Server: JWT verify + policy
   └─ Client: capability enablement
```

DSH `0.1.0-rc.5` 没有公开 authorization hook。架构选择是：

```text
Hook A → Server authorization
Hook B → Client capability
Bundle C → 自动安装
```

不修改 DSH dist/source。版本相关包装只存在于 `compat/`。决策见 `docs/decisions/ADR-0002-dsh-hook-strategy.md`。

## 系统组件

### ConfigResolver
- 职责：合并 Env、Cordis config 与默认值；标记哪些键被环境变量锁定。
- 非职责：校验 JWT、读写 DSH settings 文档。
- 上游：`process.env`、插件 `Config`。
- 下游：JwtVerifier、AuthorizationPolicy、日志。

### JwtVerifier
- 职责：从 `Cf-Access-Jwt-Assertion` 取值，用 `jose` + Remote JWK Set 验证 signature/alg/iss/aud/exp/nbf。
- 非职责：Host/Origin 判断、RPC 方法分类、Client UI。
- 上游：HTTP 请求头、ConfigResolver。
- 下游：AuthorizationPolicy。

### AuthorizationPolicy
- 职责：按 loopback / privileged / ordinary 模式给出 allow/deny 与错误类别。
- 非职责：实现 JWKS、修改 DSH 路由表。
- 上游：请求元数据、JwtVerifier 结果。
- 下游：compat 层的 `/api` 包装。

### DshCompatServer
- 职责：在 `webServer.register` 上可逆包装 `/api` 与相关 upgrade，把 policy 插入 DSH 现有 handler 之外或之前；对远程 privileged + 有效 JWT 在通过 Host/Origin 后绕过 DSH 内部 loopback pin，转发到 `apiProxy`。
- 非职责：JWT 解析、普通业务 RPC。
- 上游：`webServer`、`apiProxy`、AuthorizationPolicy。
- 下游：DSH 原 `/api` handler 或 `apiProxy`。

### DshCompatClient
- 职责：可逆包装 `connection.isLoopback`，让远程 Web 使用 Host settings persistence 并尝试 privileged RPC。
- 非职责：在浏览器验证 JWT、根据 Cookie 判断登录。
- 上游：`connection` 服务。
- 下游：DSH UI plugins（ui-settings 等）。

### BundleManifest
- 职责：通过 `dsh.bundle` 插入 Server 插件行，通过 `dsh.client` 注册浏览器模块。
- 非职责：用户手工维护 profile patch。

## 架构规则
RULE-ARCH-1: JWT 核心（config / jwt / policy）不得 import DSH 内部未公开模块；所有 DSH 符号依赖必须位于 `src/compat/`。

RULE-ARCH-2: Server 包装必须发生在 `client-connection` 注册 `/api` 之前。实现方式是插件 `inject = ['webServer']`，不注入 `webRuntime`，从而早于 connection 行激活。

RULE-ARCH-3: 远程 privileged 放行路径必须先复用或等价执行 DSH Host/Origin 检查，再验证 JWT，最后才转发 `apiProxy`。禁止把 Host 改写成 loopback 来骗过内部 pin。

RULE-ARCH-4: 插件 unload 必须恢复 `webServer.register` / `registerUpgrade` 与 `connection.isLoopback` 的原行为，并撤销本插件注册的路由包装。

RULE-ARCH-5: 不得占用 `connection.rpc.intercept`。该槽位已被 Typert Gateway 使用。

## 运行时流程

### 远程 privileged HTTP
1. Cloudflare Access 认证浏览器并注入 `Cf-Access-Jwt-Assertion`。
2. 请求到达 DSH `webServer` 的 `/api` 前缀。
3. 本插件包装 handler 先做 Host/Origin（不得跳过）。
4. 识别 RPC 方法；若属于 privileged 且非 loopback，则验证 JWT。
5. JWT 有效则转发 `apiProxy`，不再走 DSH 内部 `PRIVILEGED_METHODS + isTrustedApiRequest(request, [])`。
6. JWT 缺失或无效则拒绝，不调用 privileged 业务实现。

### 远程 ordinary HTTP
1. Host/Origin 仍由 DSH 原 handler 执行（包装层先按 ordinary 策略处理 JWT）。
2. `off`：不看 JWT，交给原 handler。
3. `optional`：无 JWT 交给原 handler；有 JWT 则必须有效。
4. `required`：必须有效 JWT，再交给原 handler。

### Loopback
1. 包装层识别 loopback 后直接交给 DSH 原 handler。
2. 不读取、不要求 JWT。

### Client
1. Client Module 在 `connection` 可用后把 `isLoopback` 包装为 capability 开启。
2. UI 发起 `settings.describe` 等 RPC。
3. Server 按上述流程裁决。
4. unload 时恢复 `isLoopback`。

## 部署模型

推荐：

```text
Internet
   ↓
Cloudflare Access
   ↓
Cloudflare Proxy
   ↓
Origin 仅允许 Cloudflare 网络
   ↓
Reverse Proxy
   ↓
DSH（--trusted-host dsh.example.com）
   ↓
dsh-cloudflare-access
```

插件不替代 Origin 网络控制。安装插件后仍不应把 DSH Origin 直接暴露到公网。

## 非目标
- 独立认证服务或 sidecar。
- 替换 `@deepseek-ai/dsh-client-connection` 整行。
- 在浏览器做 JWT 校验。

## Open Questions
- QUESTION-3：远程 native host UI 可见但 403 是否保持为已知限制。见 `docs/intake.md`。
