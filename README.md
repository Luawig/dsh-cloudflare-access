# dsh-cloudflare-access

Cloudflare Access JWT verification and remote privileged authorization for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This plugin does **not** replace Cloudflare Access. Identity stays in Access. The plugin re-validates `Cf-Access-Jwt-Assertion` at the DSH Origin and maps a successful result onto DSH remote authorization so Settings, Credentials, Agent Preset management, and model discovery can work from `https://dsh.example.com`.

It does not ship a login page, password store, MFA, session table, or Cloudflare API client.

## Security model

Remote privileged requests must pass **both**:

1. DSH Host / Origin / `sec-fetch-site` checks (`--trusted-host` remains mandatory).
2. A valid Cloudflare Access JWT (signature, `iss`, `aud`, expiry).

A valid JWT never authorizes an arbitrary Host or Origin.

Loopback (`localhost` / `127.0.0.1` / `::1`) does not require a JWT, so `SSH Tunnel → localhost → DSH` keeps working.

Remote privileged APIs always require a JWT in v0.1. There is no switch to disable that.

Recommended deployment:

```text
Internet
   ↓
Cloudflare Access
   ↓
Cloudflare Proxy
   ↓
Origin Network Controls
   ↓
Reverse Proxy
   ↓
DeepSeek Harness
   ↓
dsh-cloudflare-access
```

Origin should only accept Cloudflare (or equivalent) ingress. Installing this plugin is not a reason to put DSH on the public internet.

## Install

Requires a DeepSeek Harness Web profile. Source-level hooks were verified against DSH `0.1.0-rc.5`. Published DSH npm packages currently expose `0.1.1-rc.2` (`next`); treat that as the install target until the matrix below is updated from a live DSH run.

```sh
dsh plugin --profile web add dsh-cloudflare-access
```

Until the npm package is published, install from GitHub:

```sh
dsh plugin --profile web add github:Luawig/dsh-cloudflare-access
```

Restart DSH. The package declares `dsh.bundle` and `dsh.client`, so the Web profile bundle stack and browser module graph pick it up. You do not edit `$DSH_HOME/profiles/web/cordis.patch.yml` by hand, and you do not patch DSH itself.

Remove with `dsh plugin --profile web remove dsh-cloudflare-access`. After unload, DSH restores the official remote privileged loopback pin.

## Cloudflare Access configuration

1. Put the DSH Web origin behind a Cloudflare Access application.
2. Copy the application **Audience** (`aud`) and your team domain, for example `https://example.cloudflareaccess.com`.
3. Cloudflare injects `Cf-Access-Jwt-Assertion` on authenticated requests. The plugin verifies that header only. It does not trust the `CF_Authorization` cookie.

Issuer and JWKS URL are derived:

```text
issuer  = teamDomain
JWKS    = <teamDomain>/cdn-cgi/access/certs
```

You do not configure `issuer` or `jwksUrl` separately. Multiple audiences are supported.

## DSH configuration

Cordis / bundle config:

```yaml
cloudflare:
  teamDomain: https://example.cloudflareaccess.com
  audiences:
    - xxxxxxxxxxxxxxxxx
auth:
  ordinary: off
```

DSH must still list the public hostname:

```sh
dsh --profile web --trusted-host dsh.example.com
```

Environment variables override Cordis config and cannot be changed from Web Settings at runtime:

| Variable | Meaning |
| --- | --- |
| `DSH_CF_ACCESS_TEAM_DOMAIN` | Team domain / issuer |
| `DSH_CF_ACCESS_AUDIENCES` | Comma-separated audiences |
| `DSH_CF_ACCESS_ORDINARY_MODE` | `off` \| `optional` \| `required` |

If a variable exists, even as an empty string, that field is locked.

Missing `teamDomain` or `audiences`: the plugin still starts, loopback is unchanged, remote privileged APIs are denied.

## systemd example

```ini
[Service]
Environment=DSH_CF_ACCESS_TEAM_DOMAIN=https://example.cloudflareaccess.com
Environment=DSH_CF_ACCESS_AUDIENCES=xxxxxxxxxxxxxxxxxxxxxxxxx
Environment=DSH_CF_ACCESS_ORDINARY_MODE=off
ExecStart=/usr/bin/dsh --profile web --trusted-host dsh.example.com
```

Pin the team domain in the unit file so a remote Settings session cannot point DSH at another Cloudflare team.

## nginx / Cloudflare deployment

```text
Browser
   ↓
Cloudflare Access + Proxy (TLS, JWT injection)
   ↓
Origin allowlist (Cloudflare IP ranges or authenticated origin pulls)
   ↓
nginx (TLS offload optional; proxy_pass to DSH)
   ↓
DSH 127.0.0.1:3080 or LAN bind with --trusted-host
```

nginx should forward `Host`, `Origin`, and `Cf-Access-Jwt-Assertion`. Do not strip the assertion header. Do not require the plugin to manage nginx.

## Ordinary API modes

`auth.ordinary` applies only to **remote non-privileged** APIs (including `/api/events.mux` and `/api/events.host`). Loopback ignores it. Host/Origin always runs first.

| Mode | No JWT | Valid JWT | Invalid JWT |
| --- | --- | --- | --- |
| `off` (default) | DSH original policy | ignored | ignored |
| `optional` | DSH original policy | allow | deny |
| `required` | deny | allow | deny |

Privileged remote APIs always require a valid JWT, regardless of this setting.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Remote Settings still unavailable | Confirm the client module loaded; confirm Access is in front of the site; confirm the assertion header reaches Origin. |
| 401 on `settings.*` | Header missing. Inspect nginx/`cf-access` forwarding, not cookies. |
| 403 on `settings.*` | Invalid `iss`/`aud`/signature/expiry, unconfigured plugin, or Host/Origin mismatch. |
| Loopback Settings broken | Unload the plugin; loopback must not require JWT. File a bug if it does. |
| JWKS / key rotation failures | Confirm `https://<team>/cdn-cgi/access/certs` is reachable from Origin. No config change should be required after Cloudflare rotates keys. |
| Logs | Reasons are categories only (`expired`, `invalid_signature`, `issuer_mismatch`, `audience_mismatch`, `missing_token`, `jwks_unavailable`, `unconfigured`). Tokens are never logged. |

## Compatibility Matrix

| Plugin | DSH | Status |
| --- | --- | --- |
| 0.1.x | 0.1.0-rc.5 (source) | Hook research + unit/integration tests in this repo |
| 0.1.x | 0.1.1-rc.2 (npm `next`) | peerDependency target; live process test pending |

Do not assume newer DSH releases work until this matrix is updated.

## Security Considerations

- Additional layer, not a replacement. See [SECURITY.md](./SECURITY.md).
- Fail closed: JWKS outages deny remote privileged traffic.
- v0.1 does not authorize `host.pickDirectory` or `host.openPath`. The client capability wrap may still show some native-host UI; those RPCs remain rejected.
- Unloading the plugin must restore DSH's official remote privileged pin.

## License

MIT
