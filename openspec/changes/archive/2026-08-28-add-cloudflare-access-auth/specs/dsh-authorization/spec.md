# Capability: dsh-authorization

## ADDED Requirements

### Requirement: Loopback bypass
The plugin SHALL leave loopback requests on DSH original behavior and MUST NOT require a Cloudflare JWT for loopback privileged or ordinary APIs.

#### Scenario: Loopback privileged without JWT
- **GIVEN** Host is loopback
- **AND** the RPC is `settings.describe`
- **AND** no `Cf-Access-Jwt-Assertion` is present
- **WHEN** authorization runs
- **THEN** the decision is allow

### Requirement: Host and Origin remain mandatory
A valid Cloudflare JWT MUST NOT authorize a request that fails DSH Host/Origin validation. The plugin MUST apply Host/Origin before any privileged bypass of the DSH loopback pin.

#### Scenario: Valid JWT with invalid Host
- **GIVEN** a cryptographically valid Access JWT
- **AND** Host is neither loopback nor a configured trusted host
- **WHEN** a privileged RPC is requested
- **THEN** the decision is deny
- **AND** the reason is host/origin rejection, not JWT success

### Requirement: Remote privileged APIs require JWT
Remote calls to the v0.1 privileged method set MUST require a valid Cloudflare Access JWT. v0.1 MUST NOT provide a configuration switch that disables this requirement. Missing configuration MUST fail closed for remote privileged APIs while still allowing the plugin to start.

Privileged methods that MAY be authorized remotely with a valid JWT are exactly: `settings.describe`, `settings.openDocument`, `settings.update`, `settings.replace`, `settings.mutate`, `credentials.describe`, `credentials.set`, `credentials.unset`, `agentPreset.read`, `agentPreset.copy`, `agentPreset.openDocument`, `agentPreset.remove`, `llm.discoverModels`.

The plugin MUST NOT remotely authorize `host.pickDirectory` or `host.openPath` even when the JWT is valid.

#### Scenario: Remote valid JWT
- **GIVEN** a remote trusted-host request with a valid JWT
- **WHEN** `settings.mutate` is called
- **THEN** the decision is allow

#### Scenario: Remote missing JWT
- **GIVEN** a remote trusted-host request with no JWT
- **WHEN** `credentials.set` is called
- **THEN** the decision is deny / `missing_token`

#### Scenario: Remote invalid JWT
- **GIVEN** a remote trusted-host request with an invalid JWT
- **WHEN** `llm.discoverModels` is called
- **THEN** the decision is deny with a non-missing failure reason

#### Scenario: Unconfigured team
- **GIVEN** `teamDomain` or `audiences` is missing
- **WHEN** a remote privileged RPC arrives
- **THEN** the decision is deny / `unconfigured`
- **AND** the plugin process remains started

#### Scenario: Native host methods stay pinned
- **GIVEN** a remote trusted-host request with a valid JWT
- **WHEN** `host.openPath` or `host.pickDirectory` is called
- **THEN** the plugin MUST NOT bypass DSH loopback pin for that method

### Requirement: Ordinary API modes
Ordinary (non-privileged) remote APIs SHALL follow `auth.ordinary` after Host/Origin succeeds. Loopback MUST ignore this setting.

- `off` (default): JWT is not used.
- `optional`: no JWT continues; a present JWT MUST be valid.
- `required`: a valid JWT is mandatory, including `/api/events.mux` and `/api/events.host` upgrades.

#### Scenario: Ordinary off without JWT
- **GIVEN** `ordinary=off` and a remote trusted-host request with no JWT
- **WHEN** a non-privileged RPC is called
- **THEN** the decision is allow according to DSH original policy

#### Scenario: Ordinary optional with invalid JWT
- **GIVEN** `ordinary=optional` and a remote request with an invalid JWT
- **WHEN** a non-privileged RPC is called
- **THEN** the decision is deny

#### Scenario: Ordinary optional without JWT
- **GIVEN** `ordinary=optional` and no JWT
- **WHEN** a non-privileged RPC is called
- **THEN** the decision is allow

#### Scenario: Ordinary required without JWT
- **GIVEN** `ordinary=required` and no JWT
- **WHEN** a non-privileged RPC is called
- **THEN** the decision is deny / `missing_token`

#### Scenario: Ordinary required with valid JWT
- **GIVEN** `ordinary=required` and a valid JWT
- **WHEN** a non-privileged RPC is called
- **THEN** the decision is allow

### Requirement: Fail closed on verifier outages
Remote privileged authorization MUST deny when JWKS cannot be obtained and the token cannot be verified. Cloudflare network errors MUST NOT temporarily allow all remote privileged traffic.

#### Scenario: JWKS outage
- **GIVEN** a remote privileged request with a JWT
- **AND** JWKS is unavailable
- **WHEN** authorization runs
- **THEN** the decision is deny / `jwks_unavailable`

### Requirement: HTTP error classification
When the plugin can set HTTP status, missing authentication on remote privileged requests SHALL use 401, and present-but-invalid tokens SHALL use 403. Logs MUST record only reason categories defined in `docs/rules.md` and MUST NOT record the token.

#### Scenario: Missing token status
- **GIVEN** remote privileged with no JWT
- **WHEN** the request is rejected
- **THEN** the HTTP status is 401

#### Scenario: Invalid token status
- **GIVEN** remote privileged with an expired JWT
- **WHEN** the request is rejected
- **THEN** the HTTP status is 403
