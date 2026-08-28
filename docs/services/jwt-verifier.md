# 服务规格

## 状态
accepted

## 服务名称
JwtVerifier

## 职责
- 从请求提取 `Cf-Access-Jwt-Assertion`。
- 使用 `jose.createRemoteJWKSet` 验证签名与标准声明。
- 返回 `JwtVerification`，不抛出带 token 的错误信息到日志。

## 非职责
- Host/Origin 检查。
- RPC 方法分类。
- 缓存单个 token 的验证结果。

## 服务规则
RULE-SERVICE-JWT-1: 未配置 teamDomain/audiences 时，任何远程验证请求返回 `invalid/unconfigured`，不得去网络。

RULE-SERVICE-JWT-2: JWKS 获取失败且无法完成验签时返回 `jwks_unavailable`，不得返回 valid。

RULE-SERVICE-JWT-3: 多 audience 命中其一即为 valid。

RULE-SERVICE-JWT-4: 忽略 Cookie。即使存在 `CF_Authorization` 也不得读取。

RULE-SERVICE-JWT-5: `exp` 与 `nbf` 使用 30 秒 `clockTolerance`。超出容差仍按过期或 malformed 拒绝。

## 接口
- `verify(headers, config): Promise<JwtVerification>`

## 依赖
- 上游：ConfigResolver、HTTP headers
- 下游：AuthorizationPolicy
- 外部：Cloudflare JWKS `GET <teamDomain>/cdn-cgi/access/certs`

## 故障处理
- 网络超时 / 非 2xx JWKS：`jwks_unavailable`
- kid 未知：交由 Remote JWK Set 刷新；刷新后仍失败则 `invalid_signature`
- 库抛出的异常映射到 `JwtFailureReason`，日志只记类别

## 示例
`aud` 配置 `["a","b"]`，token `aud=b` → valid，`audienceMatched=b`。
