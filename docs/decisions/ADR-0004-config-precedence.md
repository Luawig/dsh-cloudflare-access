# ADR-0004 配置优先级 Env 锁定 Cordis

## 状态
accepted

## 背景
服务器管理员需要用环境变量固定信任根，防止远程 DSH 管理界面把 Team Domain 改到攻击者的 Cloudflare Team。规格把优先级定为 Environment > Cordis/Bundle > Default。

## 决策
1. 解析时若对应环境变量 **存在**（包括空字符串），该字段 env-locked。
2. Locked 字段忽略 Cordis / Web Settings 的后续值。
3. 空字符串锁定仍视为未配置，远程 privileged fail closed。
4. 不提供关闭远程 privileged JWT 的配置。
5. `issuer` / `jwksUrl` 不暴露给用户。

## 备选方案
- 方案 A：Cordis 配置覆盖 Env。拒绝。违反安全要求。
- 方案 B：完全禁止 Cordis 配置，只允许 Env。可行但降低本地试用体验；v0.1 保留 Cordis 作为未锁定时的来源。

## 影响
- 正向影响：systemd 可用环境变量钉死信任根。
- 负向影响：管理员若在 Env 写错 Team Domain，Web UI 无法自救，必须改进程环境。

## 相关文档
- `docs/services/config-resolver.md`
- `docs/data-model.md`
- `docs/rules.md`
