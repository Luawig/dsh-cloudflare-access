# Capability: plugin-packaging

## ADDED Requirements

### Requirement: Formal DSH bundle install
The package MUST declare `dsh.bundle` with `patch` pointing at `./cordis.patch.yml` so `dsh plugin --profile web add dsh-cloudflare-access` adds the bundle to the Web profile stack without requiring the user to edit `$DSH_HOME/profiles/web/cordis.patch.yml`. The package MUST NOT require modifying DSH itself.

#### Scenario: Plugin add
- **GIVEN** a Web profile
- **WHEN** the operator runs the standard DSH plugin add for this package
- **THEN** the profile bundle list includes `dsh-cloudflare-access`
- **AND** no manual profile patch edit is required

### Requirement: Formal client module
The package MUST ship a built `exports["./client"]` and declare `dsh.client` with `platform` `web`. Installing the plugin MUST NOT require the user to rebuild DSH Web.

#### Scenario: Client export present
- **GIVEN** the published npm package
- **WHEN** DSH scans `dsh.client` packages
- **THEN** `./client` resolves to a prebuilt browser module

### Requirement: Configuration precedence and env lock
Runtime configuration MUST resolve Environment Variables over Cordis/Bundle config over defaults. If `DSH_CF_ACCESS_TEAM_DOMAIN`, `DSH_CF_ACCESS_AUDIENCES`, or `DSH_CF_ACCESS_ORDINARY_MODE` exists, that field MUST NOT be overridden by Web Settings or Cordis config at runtime. Audiences env MUST accept comma-separated values. Users MUST NOT be required to configure issuer or jwksUrl separately.

#### Scenario: Env wins
- **GIVEN** `DSH_CF_ACCESS_TEAM_DOMAIN` is set to team A
- **AND** Cordis config names team B
- **WHEN** the plugin resolves config
- **THEN** issuer is team A

#### Scenario: Derived JWKS
- **GIVEN** teamDomain `https://example.cloudflareaccess.com`
- **WHEN** config is resolved
- **THEN** JWKS URL is `https://example.cloudflareaccess.com/cdn-cgi/access/certs`

### Requirement: Reversible server effects
Unloading the server plugin MUST restore official DSH remote privileged restrictions. The plugin MUST NOT leave a global monkey patch after unload.

#### Scenario: Unload restores privileged pin
- **GIVEN** the server plugin was authorizing remote `settings.*` with a valid JWT
- **WHEN** the plugin unloads
- **THEN** the same remote `settings.*` request is rejected by official DSH behavior
