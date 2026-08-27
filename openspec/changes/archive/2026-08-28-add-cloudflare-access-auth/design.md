# Design

## Context

DSH `0.1.0-rc.5` 把配置面 privileged RPC pin 在 loopback，且无公开 authorization hook。远程部署已有 Cloudflare Access，但 Origin 上的 DSH 仍把浏览器当未认证客户端。本设计在 DSH 进程内增加可卸载插件，而不是独立代理。

源文档：`docs/overview.md`、`docs/architecture.md`、`docs/rules.md`、`docs/references/dsh-source-research.md`。

## Goals / Non-Goals

**Goals:**
- Origin 验证 Access JWT，并把结果叠加到 DSH Host/Origin 防护之上。
- 远程合法用户可使用配置面 privileged API；Client 愿意发起这些 RPC。
- 标准 `dsh plugin --profile web add` 安装；unload 可逆。

**Non-Goals:**
- 替换 Cloudflare Access 或 DSH trusted-host。
- 开放 `host.pickDirectory` / `host.openPath`。
- 自建 IdP、RBAC、Cloudflare API、nginx 管理。
- 修改 DSH dist/source。

## Decisions

### Hook 三件套
见 ADR-0002。

```text
Hook A → webServer.register 包装 → Server authorization
Hook B → connection.isLoopback 包装 → Client capability
Bundle C → dsh.bundle + dsh.client → 自动安装
```

备选（拒绝作为默认）：替换 connection 整行；占用 `rpc.intercept`；伪造 loopback Host。

### 附加安全层
见 ADR-0001。JWT 不能跳过 Host/Origin。

### jose Remote JWK Set
见 ADR-0003。不缓存 JWT 结果。

### Env 锁定
见 ADR-0004。Environment > Cordis > Default。

### 模块边界
JWT/policy/config 不 import DSH 内部模块。`src/compat/` 隔离 DSH 0.1.0-rc.5 适配。

### 错误
包装层能控制 HTTP 时：缺 token → 401；无效/未配置/JWKS 失败 → 403。不记录 token。

### 降级矩阵
| 故障 | 行为 |
| --- | --- |
| Cloudflare Access 未登录 | 远程 privileged deny/`missing_token` |
| JWKS 不可达 | deny/`jwks_unavailable`，不 fail open |
| teamDomain 未配置 | 插件启动，远程 privileged deny/`unconfigured` |
| 插件 unload | DSH 官方 loopback pin 恢复 |
| DSH 内部 API 变化 | 仅修 `compat/`，集成测试失败则不扩大 peer |

## Architecture Impact
- 新增 Server 插件行插入 Web profile。
- 新增 Client module 进入 `__DSH_BOOT__`。
- 不改变 DSH 其他插件的 config schema，除非用户显式配置本插件。

## Protocol Impact
- 无新 REST 资源。消费 `Cf-Access-Jwt-Assertion`。方法清单见 `docs/protocols.md`。

## Data Model Impact
- 仅运行时 `PluginConfig` / `JwtVerification` / `AuthDecision`。无持久化。

## Rules
实现必须遵守 `docs/rules.md` 全部 `RULE-*`。

## Risks / Trade-offs
- [Risk] DSH 升级导致 register 包装失效 → Mitigation：peer 锁 `0.1.0-rc.5`；compat 隔离；升级跑集成测试。
- [Risk] 包装 `isLoopback` 露出 native host UI → Mitigation：Server 不放行对应 RPC；验收列为不验收隐藏 UI。
- [Risk] Origin 直接暴露公网 → Mitigation：README/SECURITY 明确插件不替代网络控制。
- [Risk] 攻击者提交畸形 JWT 造成 DoS → Mitigation：使用 jose；不实现自定义 parser；失败立即 403。
- [Risk] 日志泄露 token → Mitigation：RULE-LOG-NO-SECRETS；测试断言日志不含 token。

## Migration Plan
- 安装 bundle，配置 teamDomain/audiences，保持 `--trusted-host`。
- 回滚：`dsh plugin remove` 或 disable 行；无需数据迁移。

## Open Questions
- GitHub/npm 发布账号、provenance、Dependabot vs Renovate：不阻塞实现。
- CI 使用本地 DSH checkout 还是已发布包：实现阶段用可安装的 peer；文档矩阵以实测为准。
