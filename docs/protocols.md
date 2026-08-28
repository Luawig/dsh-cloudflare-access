# 系统协议

## 状态
accepted

## 范围
定义本插件关心的 HTTP 入口、JWT 声明、配置协议、错误分类与 RPC 方法清单。本插件不引入新的对外 REST API。

## 接口

### API-JWT-HEADER
- 方法：任意到达 DSH Origin 的 HTTP/WebSocket 升级请求
- 路径或事件名：DSH `/api` 前缀，包括 `/api/<rpc-method>`、`/api/events.mux`、`/api/events.host`
- 输入：Header `Cf-Access-Jwt-Assertion`
- 输出：无新响应体协议；沿用 DSH HTTP 或 RPC 错误

### API-PRIVILEGED-RPC
- 方法：DSH unary HTTP RPC
- 路径：`/api/<method>`
- 输入：DSH 原 payload
- 输出：DSH 原结果；本插件只在授权失败时拦截

## 请求结构

### Cloudflare Access JWT Header
- `Cf-Access-Jwt-Assertion`: 紧凑 JWS。缺省表示未认证。

### 插件配置（Cordis）

```yaml
cloudflare:
  teamDomain: null
  audiences: []
auth:
  ordinary: off
```

字段：

- `cloudflare.teamDomain`: `string | null`。Cloudflare Access team domain。可写 `https://example.cloudflareaccess.com` 或 `example.cloudflareaccess.com`；运行时规范化为 http(s) origin。
- `cloudflare.audiences`: `string[]`。Access Application AUD，至少一个非空值才算已配置。
- `auth.ordinary`: `off | optional | required`。默认 `off`。

### 环境变量
- `DSH_CF_ACCESS_TEAM_DOMAIN`: 覆盖 `cloudflare.teamDomain`
- `DSH_CF_ACCESS_AUDIENCES`: 逗号分隔，覆盖 `cloudflare.audiences`
- `DSH_CF_ACCESS_ORDINARY_MODE`: 覆盖 `auth.ordinary`

## JWT 声明约束
- `alg`: 由 JWKS 与 `jose` 允许的算法决定，拒绝 `none` 与降级。
- `iss`: 必须等于规范化后的 `teamDomain` origin。
- `aud`: string 或 string[]；必须与配置 audiences 有交集。
- `exp`: 必须未过期。
- `nbf`: 若存在则必须已生效。

不把 `email` / `identity_nonce` 映射为 DSH 用户。v0.1 无用户模型。

## 特权方法清单

权威来源：DSH `@deepseek-ai/dsh-client-connection` 的 `PRIVILEGED_METHODS`。本插件 v0.1 **放行**其中配置面子集，**不放行** native host 方法。

| method | DSH pin | 本插件远程 + JWT |
| --- | --- | --- |
| `settings.describe` | 是 | 放行 |
| `settings.openDocument` | 是 | 放行 |
| `settings.update` | 是 | 放行 |
| `settings.replace` | 是 | 放行 |
| `settings.mutate` | 是 | 放行 |
| `credentials.describe` | 是 | 放行 |
| `credentials.set` | 是 | 放行 |
| `credentials.unset` | 是 | 放行 |
| `agentPreset.read` | 是 | 放行 |
| `agentPreset.copy` | 是 | 放行 |
| `agentPreset.openDocument` | 是 | 放行 |
| `agentPreset.remove` | 是 | 放行 |
| `llm.discoverModels` | 是 | 放行 |
| `host.pickDirectory` | 是 | 不放行 |
| `host.openPath` | 是 | 不放行 |
| `agentPreset.list` | 否 | 按 ordinary |
| `agentPreset.select` | 否 | 按 ordinary |
| `llm.providers` | 否 | 按 ordinary |
| `llm.models` | 否 | 按 ordinary |

## 错误处理

若包装层能写 HTTP status，则：

- `missing_token` → `401 Unauthorized`
- `unconfigured` → `403 Forbidden`
- `invalid_signature` / `issuer_mismatch` / `audience_mismatch` / `expired` / `malformed` / `jwks_unavailable` → `403 Forbidden`

响应体保持简单文本或 DSH 现有协议，不返回 token。若未来 DSH RPC error model 不允许改 HTTP status，则保持 DSH 协议形式，但错误分类字段必须可区分上述类别。

DSH 官方 privileged 拒绝当前是 `403` + body `forbidden`。unload 后应回到该行为。

## 示例

有效配置：

```json
{
  "cloudflare": {
    "teamDomain": "https://example.cloudflareaccess.com",
    "audiences": ["11111111111111111111111111111111111"]
  },
  "auth": {
    "ordinary": "off"
  }
}
```

拒绝响应（HTTP 层）：

```http
HTTP/1.1 401 Unauthorized
Content-Type: text/plain

unauthorized
```

```http
HTTP/1.1 403 Forbidden
Content-Type: text/plain

forbidden
```
