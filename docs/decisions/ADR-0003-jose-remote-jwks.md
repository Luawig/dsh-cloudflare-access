# ADR-0003 使用 jose Remote JWK Set 且不缓存 JWT 结果

## 状态
accepted

## 背景
规格要求验证 Cloudflare Access JWT，支持 key rotation，禁止自实现密码学，也禁止每个请求拉取 JWKS 或启动后永不更新。v0.1 明确不缓存单个 JWT 验证结果。

## 决策
- 使用 `jose` 的 `jwtVerify` + `createRemoteJWKSet`。
- JWKS URL 固定为 `<teamDomain>/cdn-cgi/access/certs`。
- 不实现 token LRU、TTL 结果缓存或撤销列表。
- 验证 `iss`、`aud`（多值命中）、`exp`、可选 `nbf`、签名与 alg。

## 备选方案
- 方案 A：自写 RSA/JWK parser。拒绝。
- 方案 B：启动时下载 JWKS 后永不刷新。拒绝。无法支持 Cloudflare 轮换 key。
- 方案 C：缓存验证通过的 JWT 直到 exp。拒绝。规格 v0.1 明确不做；还要处理撤销与内存。

## 影响
- 正向影响：key rotation 无需重启；实现面小；与 Cloudflare 文档一致。
- 负向影响：privileged 请求以及 JWT 会改变裁决的普通 API 仍需 RSA 验签。规格认为该请求量可接受。v0.1 不缓存单个 JWT 结果。

## 相关文档
- `docs/services/jwt-verifier.md`
- `docs/rules.md`
