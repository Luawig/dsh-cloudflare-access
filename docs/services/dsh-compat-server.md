# 服务规格

## 状态
accepted

## 服务名称
DshCompatServer

## 职责
- 可逆包装 `webServer.register` / `registerUpgrade`。
- 对 `/api` 前缀应用 policy。
- 在远程 privileged + 有效 JWT 且 Host/Origin 已通过时，把请求转发到 `apiProxy`，从而绕过 DSH 内部 loopback pin。
- 在 unload 时恢复原 register 方法。

## 非职责
- 实现 JWT 解析。
- 替换 `connection` 插件行。
- 占用 `connection.rpc.intercept`。

## 服务规则
RULE-SERVICE-COMPAT-1: 包装必须通过 `ctx.effect` 注册 disposer。

RULE-SERVICE-COMPAT-2: 非 `/api` 路由原样交给 `originalRegister`。

RULE-SERVICE-COMPAT-3: 远程 privileged 成功路径禁止修改 Host/Origin 头。

RULE-SERVICE-COMPAT-4: `host.pickDirectory` / `host.openPath` 即使 JWT 有效也走 DSH 原 handler，从而继续 403。

## 接口
- `install(ctx, policy, verifier, config): Disposable`

## 依赖
- 上游：`webServer`、AuthorizationPolicy、JwtVerifier
- 下游：原 `/api` handler、`apiProxy` + HTTP-to-Fetch bridge

## 故障处理
- `apiProxy` 尚未就绪时，远程 privileged 即使 JWT 有效也 fail closed（拒绝），不得把请求交给会 403 的内部 pin 后当作成功。
- 包装期间抛错记入 DSH/Cordis logger。

## 示例
见 `docs/architecture.md` 运行时流程。
