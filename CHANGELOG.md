# Changelog

## 0.1.0

- Initial release: Cloudflare Access JWT verification at the DSH Origin.
- Remote privileged authorization for the settings / credentials / agentPreset management / `llm.discoverModels` plane.
- Ordinary API modes `off | optional | required`.
- Web Client capability enablement for remote Settings, with `dsh.client.immediately: true` so the module is prefetched before `ui-settings` snapshots loopback state.
- Official `dsh.bundle` and `dsh.client` packaging for `dsh plugin --profile web add`.
