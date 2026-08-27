# Tasks

## 1. Package skeleton

- [x] 1.1 Create `package.json` with ESM, MIT, `dsh.bundle`, `dsh.client`, `exports["."]` and `exports["./client"]`, peerDependencies limited to DSH `0.1.0-rc.5` range actually targeted.
- [x] 1.2 Add `tsconfig.json`, `cordis.patch.yml` inserting the server plugin id, `.gitignore`, and pnpm workspace files needed to build.
- [x] 1.3 Add `jose` dependency and test runner (vitest) without importing DSH internals into JWT core.

## 2. Config and JWT core

- [x] 2.1 Implement `src/config.ts` Env > Cordis > default, env lock, comma-separated audiences, derived issuer/JWKS URL (`specs/plugin-packaging`, `docs/services/config-resolver.md`).
- [x] 2.2 Implement `src/server/cloudflare-jwt.ts` with `jose` Remote JWK Set and failure reason mapping (`specs/cloudflare-jwt`).
- [x] 2.3 Implement `src/server/policy.ts` for loopback / privileged / ordinary (`specs/dsh-authorization`).
- [x] 2.4 Add `src/server/authorization.ts` HTTP 401/403 mapping and no-secret logging (`docs/rules.md`).

## 3. DSH compat hooks

- [x] 3.1 Implement `src/compat/dsh.ts` server wrap of `webServer.register` / `registerUpgrade` with reversible `ctx.effect` (`ADR-0002`).
- [x] 3.2 Implement privileged success path: Host/Origin pass → JWT valid → `apiProxy` fetch, without forging loopback Host.
- [x] 3.3 Ensure `host.pickDirectory` / `host.openPath` never take the privileged bypass path.
- [x] 3.4 Implement `src/client/index.ts` reversible `connection.isLoopback` capability wrap (`specs/client-capability`).
- [x] 3.5 Wire `src/index.ts` and `src/server/index.ts` plugin `apply` / `inject` / `Config` / unload.

## 4. Tests

- [x] 4.1 Unit tests in `test/jwt.test.ts` covering valid, expired, bad signature, wrong iss, wrong aud, missing aud, multi-aud hit, unknown kid refresh, JWKS unavailable (`specs/cloudflare-jwt`). Mock network; do not hit real Cloudflare.
- [x] 4.2 Unit tests in `test/policy.test.ts` covering privileged/ordinary/loopback matrices and valid JWT + invalid Host (`specs/dsh-authorization`).
- [x] 4.3 Unit tests in `test/config.test.ts` covering precedence, env lock, comma audiences, illegal ordinary mode.
- [x] 4.4 Integration test in `test/integration.test.ts` covering register wrap allow/deny, unload restore, and log redaction of tokens.
- [x] 4.5 Client-side test that capability wrap is restored on unload and does not read Cookies.

## 5. Docs and release metadata

- [x] 5.1 Write README covering purpose, security model, install, Cloudflare Access, DSH config, systemd, nginx/Cloudflare diagram, ordinary modes, troubleshooting, compatibility matrix (`0.1.x` ↔ DSH `0.1.0-rc.5` after tests pass), security considerations.
- [x] 5.2 Write `SECURITY.md`, `CHANGELOG.md`, `LICENSE` (MIT).
- [x] 5.3 Add GitHub Actions running unit/integration tests on the verified DSH range.

## 6. Acceptance validation

- [x] 6.1 Validate `docs/product/acceptance-criteria.md` AC-INSTALL / AC-LOCAL / AC-REMOTE / AC-ORDINARY / AC-ROTATE / AC-UNLOAD against implemented tests or documented manual gaps. Live ACs were exercised on DSH `0.1.1-rc.2` (install, remote Settings/Credentials, unload). AC-ROTATE is covered by jose unit tests (`unknown kid` refresh), not a live Cloudflare key rotation.
- [x] 6.2 Confirm no DSH dist/source modification and no leftover global patch after simulated unload.
