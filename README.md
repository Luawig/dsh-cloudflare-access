# dsh-cloudflare-access

Cloudflare Access JWT verification and remote privileged authorization for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This is a dual-face **Profile Bundle + Web Client** plugin. It does **not** replace Cloudflare Access. Identity stays in Access. The plugin re-validates `Cf-Access-Jwt-Assertion` at the DSH Origin and maps a successful result onto DSH remote authorization so Settings, Credentials, Agent Preset management, and model discovery can work from `https://dsh.example.com`.

It does not ship a login page, password store, MFA, session table, or Cloudflare API client.

Live-tested against DeepSeek Harness **`0.1.1-rc.2`**. Do not assume newer DSH releases work until the [compatibility matrix](#compatibility-matrix) is updated.

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

Requires a DeepSeek Harness **Web** profile.

```sh
dsh plugin --profile web add dsh-cloudflare-access
```

The package is on [npm](https://www.npmjs.com/package/dsh-cloudflare-access). To install an unreleased Git commit instead:

```sh
dsh plugin --profile web add github:Luawig/dsh-cloudflare-access
```

The Git tree ships prebuilt `lib/index.js` and `lib/client.js`. A `github:` install uses those artifacts and does not need TypeScript or esbuild; `prepare` skips the build when this package is installed as a dependency.

Restart DSH. The package declares `dsh.bundle` and `dsh.client`, so the Web profile bundle stack and browser module graph pick it up. You do not edit `$DSH_HOME/profiles/web/cordis.patch.yml` by hand, and you do not patch DSH itself.

### Activate / verify

```sh
dsh --profile web --dump-config
```

Confirm a bundle layer named `dsh-cloudflare-access` and a plugin row `id: cloudflare-access`. After restart, open the remote Web UI through Cloudflare Access and load Settings.

### Disable / uninstall

```sh
dsh plugin --profile web remove dsh-cloudflare-access
```

After unload, DSH restores the official remote privileged loopback pin. Restart if the running process still has the old fiber.

## Cloudflare Access configuration

1. Put the DSH Web origin behind a Cloudflare Access application.
2. Copy the application **Audience** (`aud`) and your team domain, for example `https://example.cloudflareaccess.com`.
3. Cloudflare injects `Cf-Access-Jwt-Assertion` on authenticated requests. The plugin verifies that header only. It does not trust the `CF_Authorization` cookie.

Issuer and JWKS URL are derived from the team domain after it is normalized to an http(s) origin (`https://` is assumed when the scheme is omitted; any path is dropped):

```text
issuer  = <origin>
JWKS    = <origin>/cdn-cgi/access/certs
```

You do not configure `issuer` or `jwksUrl` separately. Multiple audiences are supported.

## DSH configuration

Pin team domain and audiences with environment variables in production. Env locks the trust root so a remote Settings session cannot retarget another Cloudflare team.

```sh
dsh --profile web --trusted-host dsh.example.com
```

| Variable | Meaning |
| --- | --- |
| `DSH_CF_ACCESS_TEAM_DOMAIN` | Team domain / issuer |
| `DSH_CF_ACCESS_AUDIENCES` | Comma-separated audiences |
| `DSH_CF_ACCESS_ORDINARY_MODE` | `off` \| `optional` \| `required` |

If a variable exists, even as an empty string, that field is locked. Environment variables override Cordis / bundle config.

Cordis overlay (only used when the matching env var is unset):

```yaml
cloudflare:
  teamDomain: https://example.cloudflareaccess.com
  audiences:
    - xxxxxxxxxxxxxxxxx
auth:
  ordinary: off
```

Missing `teamDomain` or `audiences`: the plugin still starts, loopback is unchanged, remote privileged APIs are denied.

## systemd example

```ini
[Service]
Environment=DSH_CF_ACCESS_TEAM_DOMAIN=https://example.cloudflareaccess.com
Environment=DSH_CF_ACCESS_AUDIENCES=xxxxxxxxxxxxxxxxxxxxxxxxx
Environment=DSH_CF_ACCESS_ORDINARY_MODE=off
ExecStart=/usr/bin/dsh --profile web --trusted-host dsh.example.com
```

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
| Remote Settings still unavailable | Confirm Access is in front of the site; hard-refresh the browser so `__DSH_BOOT__` picks up `immediately: true`; confirm the assertion header reaches Origin. |
| Settings UI never calls `settings.describe` | The client module must load before `ui-settings`. This package sets `dsh.client.immediately: true` and injects `@deepseek-ai/dsh-client-connection`. Reinstall the plugin if an older tarball omitted that. |
| 401 on `settings.*` | Header missing. Inspect nginx/`cf-access` forwarding, not cookies. |
| 403 on `settings.*` | Invalid `iss`/`aud`/signature/expiry, unconfigured plugin, or Host/Origin mismatch. |
| Loopback Settings broken | Unload the plugin; loopback must not require JWT. File a bug if it does. |
| JWKS / key rotation failures | Confirm `https://<team>/cdn-cgi/access/certs` is reachable from Origin. No config change should be required after Cloudflare rotates keys. |
| Logs | Reasons are categories only (`expired`, `invalid_signature`, `issuer_mismatch`, `audience_mismatch`, `missing_token`, `jwks_unavailable`, `unconfigured`). Tokens are never logged. |

## Compatibility Matrix

| Plugin | DSH | Status |
| --- | --- | --- |
| 0.1.x | 0.1.1-rc.2 | Live-tested (Web profile, remote Settings / Credentials) |
| 0.1.x | 0.1.0-rc.5 | Source research for hooks; not the live install target |

Do not assume newer DSH releases work until this matrix is updated.

## Security Considerations

- Additional layer, not a replacement. See [SECURITY.md](./SECURITY.md).
- Fail closed: JWKS outages deny remote privileged traffic.
- v0.1 does not authorize `host.pickDirectory` or `host.openPath`. The client capability wrap may still show some native-host UI; those RPCs remain rejected.
- Unloading the plugin must restore DSH's official remote privileged pin.

## Develop

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm pack:check
```

After source changes, run `pnpm build` so committed `lib/` matches `src/`. CI rebuilds `lib/` and fails if the tree drifts. Local development install:

```sh
dsh plugin --profile web add ./
```

Plugin packaging follows [dsh.pub/develop-plugin.md](https://dsh.pub/develop-plugin.md). This repository is not claiming a dsh.pub listing or a security audit. Maintainers can later add the GitHub topic `dsh-plugin` and submit the public commit to the community catalog.

npm dependencies and GitHub Actions are updated through Dependabot. When publishing a new version from GitHub Actions, use `npm publish --access public --provenance` with `id-token: write` so the tarball carries npm provenance. v0.1.0 was published without provenance.

## License

MIT
