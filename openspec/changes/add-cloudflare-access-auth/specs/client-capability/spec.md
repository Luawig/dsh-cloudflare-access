# Capability: client-capability

## ADDED Requirements

### Requirement: Remote Web Client may attempt Host settings
The Client Module SHALL enable remote Web Client capability so Settings persistence is not stuck in memory-only mode solely because the page hostname is not loopback. After enablement, the client MAY issue `settings.describe` and related privileged RPCs.

#### Scenario: Settings become attemptable
- **GIVEN** the client plugin is loaded on `https://dsh.example.com`
- **WHEN** a settings-scoped feature binds persistence
- **THEN** the client uses Host persistence rather than marking the scope unavailable without issuing RPC

### Requirement: Client is not the security authority
The Client Module MUST NOT verify Cloudflare JWTs in the browser, MUST NOT infer login from Cookies, and MUST NOT decide privileged authorization in JavaScript. The Server Plugin remains the only authorization decision maker.

#### Scenario: No browser JWT check
- **GIVEN** the client plugin is loaded
- **WHEN** it enables capability
- **THEN** enablement does not depend on reading `Cf-Access-Jwt-Assertion` or `CF_Authorization` in JavaScript

#### Scenario: Server still denies
- **GIVEN** capability is enabled
- **AND** the browser request has no valid Access JWT
- **WHEN** the client calls a privileged RPC
- **THEN** the Server denies the call

### Requirement: Reversible client wrap
Unloading the client plugin MUST restore DSH default remote capability behavior for `connection.isLoopback`.

#### Scenario: Unload restores official client gating
- **GIVEN** the client plugin wrapped `connection.isLoopback`
- **WHEN** the plugin fiber unloads
- **THEN** subsequent settings binds follow official loopback gating again
