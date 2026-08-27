# DSH 源码调研（规格第 26 节）

## 状态
accepted

## 调研对象
- 仓库：`DeepSeek Harness upstream source`
- 版本：根与相关包均为 `0.1.0-rc.5`
- 日期：2026-08-27
- 结论：不需要修改 DSH dist/source。v0.1 用 `compat/` 做可逆包装。

## 1. Privileged API 的 loopback 判断

位置：`packages/client/connection/src/index.ts`

- 包：`@deepseek-ai/dsh-client-connection`
- 符号：模块常量 `PRIVILEGED_METHODS`
- 执行点：`connection.createSharedFetchHandler` 的 fallback `fetch`

逻辑：pathname 去掉 `/api/` 后若在集合内，且 `!isTrustedApiRequest(request, [])`，返回 HTTP 403 `forbidden`。空 trustedHosts 表示仅 loopback Host 可通过。

注释明确：`trustedHosts` 是 DNS-rebinding 栅栏，不是认证；配置面在真实 auth 层出现前保持 loopback。

## 2. 是否存在正式 authorization hook

不存在。`/api` 路径上没有可替换的 auth service、waterfall 或 middleware。

相关但不可用的机制：

| 机制 | 原因 |
| --- | --- |
| `isTrustedApiRequest` | 模块函数，不读 Authorization / CF header |
| `PRIVILEGED_METHODS` | 闭包内常量，插件不能改 |
| `connection.rpc.intercept` | 单槽，已被 `@deepseek-ai/dsh-api-gateway` / Typert 占用 |

## 3. 可替换或可包装的 Cordis 面

`ctx.provide` 不能二次注册同名 service。

选定：包装 `webServer.register` / `registerUpgrade`。

- `WebServer.register` 把 route 对象存进 Map，dispatch 调用 `route.handler`。
- 插件 `inject = ['webServer']` 可在 connection 之前运行。connection 还要等 `webRuntime`。
- 仅包装外层 handler 而不直连 `apiProxy` 无法放行 privileged，因为 pin 在 fallback 内部。
- 因此远程 privileged + 有效 JWT 的成功路径：Host/Origin 通过后，使用 HTTP-to-Fetch bridge 调用 `toFetchHandler(apiProxy)`。

不得占用 `rpc.intercept`，不得默认替换 `id: connection` 整行。

## 4. Web Client 何处决定 Settings unavailable

仓库没有文案 `"settings are unavailable in this browser"`。实际机制：

1. `isLoopbackHostname` → `packages/client/connection/src/loopback-hostname.ts`
2. `ConnectionHandle.isLoopback` → `packages/client/connection/src/client/index.ts`
3. `SettingsScopeBinder.bind`：`connection.isLoopback ? 'host' : 'memory'` → `packages/client/ui-settings/src/client/settings-scope.ts`
4. `persistence === 'memory'` 时 snapshot `status: 'unavailable'`，`enqueue` 永不发 settings RPC

同类直接读取 `isLoopback` 的点：

- `ui-settings-models` `WelcomeNoticeStore` persistence
- `ui-settings-general` `SettingsDocumentStore`（非 loopback 不创建）
- `ui-deliverables` `canOpenPath`

## 5. Client Plugin 能否通过公开 service 改变该判断

没有公开 “treat as loopback” 或 persistence override。

不能重 provide `connection`。`trustedHosts` 不能放行 settings。

可行 compat：包装已提供的 `connection.isLoopback` 属性。这是 capability enablement，不是授权。副作用是 native host UI 可能出现；Server 仍不放行 `host.pickDirectory` / `host.openPath`。

## 6. 方法清单

权威注册：`packages/host/apiproxy/src/api/rpc-map.ts`。Pin 集合见 connection `PRIVILEGED_METHODS`。

### settings.*（全部特权）
`describe` `openDocument` `update` `replace` `mutate`

### credentials.*（全部特权）
`describe` `set` `unset`

### agentPreset.*
- 非特权：`list` `select`
- 特权：`read` `copy` `openDocument` `remove`

### llm.*
- 非特权：`providers` `models`
- 特权：`discoverModels`

另有 pin 但不在本插件放行集合：`host.pickDirectory` `host.openPath`。

## 7. Host/Origin 与 privileged 的调用顺序

`packages/client/connection/src/api-request-trust.ts` 的 `isTrustedApiRequest`：

1. Host 必须存在且可解析
2. Host 为 loopback 或匹配 `trustedHosts`
3. `sec-fetch-site === 'cross-site'` 拒绝
4. 若有 Origin：必须与 Host 权威相同；`"null"` 拒绝

HTTP `/api`：

```text
webServer handler
  → isTrustedApiRequest(req, trustedHosts)     // 最先
  → bridge → shared fetch
       → Typert interceptor（若匹配）
       → else fallback：PRIVILEGED_METHODS + isTrustedApiRequest(req, [])
       → apiProxy
```

WebSocket upgrade 同样先做 `isTrustedApiRequest(req, trustedHosts)`。

现有 DSH 代码中 JWT 不存在，因此也不可能绕过 Host/Origin。本插件设计必须保持该顺序。禁止通过改写 Host 为 loopback 让内部 pin 通过。

## 8. 插件 unload 如何恢复

Cordis fiber dispose 按序调用 `ctx.effect` / `ctx.on` / 路由 disposer。

`WebServer.register` 返回删除 Map 项的 disposer。

本插件必须自己恢复被替换的 `register` 函数引用与 `isLoopback` 属性；不能依赖 DSH 来撤销我们的包装。

现有可逆模式：`timeout-policy` 的 `ctx.on`、`client-connection` 的 `webServer.register` effect。

## 9. out-of-tree `dsh.client` 构建

- `package.json`：`dsh.client.platform === 'web'` 且 `exports["./client"]`
- 扫描：`packages/client/modules/src/index.ts`
- 浏览器产物：CJS factory，externals 为平台模块（`react`、`cordis`、`ui-slots` 等）
- 树外参考：DSH 文档指向 turtle-ui；`prepare` 必须自包含
- 仅有 `dsh.client` 而无 `dsh.bundle` 的包不会自动进入 profile bundle stack
- 同时声明 `dsh.bundle` + `dsh.client` 才能 `dsh plugin --profile web add` 后自动加载

## 对实现方案的结论

```text
Hook A → Server authorization：compat 包装 webServer.register
Hook B → Client capability：compat 包装 connection.isLoopback
Bundle C → package.json dsh.bundle + dsh.client
```

确认：不存在必须修改 DSH dist/source 的需求。限制是缺少稳定公开 hook，最小适配集中在 `compat/`。
