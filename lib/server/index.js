import { createRequire } from 'node:module';
import { isCloudflareConfigured, issuerOf, resolveConfig } from "../config.js";
import { installServerCompat } from "../compat/dsh.js";
import { logBoot } from "./authorization.js";
import { createJwtVerifier } from "./cloudflare-jwt.js";
export { resolveConfig, isCloudflareConfigured, issuerOf, jwksUrlOf } from "../config.js";
export { createJwtVerifier } from "./cloudflare-jwt.js";
export { decide, PRIVILEGED_METHODS } from "./policy.js";
export const name = 'cloudflare-access';
export const inject = ['webServer'];
function trustedHostsFrom(ctx) {
    const runtime = ctx.get('webRuntime');
    return runtime?.trustedHosts ?? [];
}
function apiFetchHandlerFrom(ctx) {
    const apiProxy = ctx.get('apiProxy');
    if (apiProxy === undefined || apiProxy === null)
        return undefined;
    if (typeof apiProxy.fetch === 'function') {
        const fetchFn = apiProxy.fetch.bind(apiProxy);
        return { fetch: fetchFn };
    }
    try {
        const required = createRequire(import.meta.url);
        const mod = required('@deepseek-ai/dsh-host-apiproxy');
        if (typeof mod.toFetchHandler === 'function')
            return mod.toFetchHandler(apiProxy);
    }
    catch {
        return undefined;
    }
    return undefined;
}
export function apply(ctx, config) {
    const resolved = resolveConfig(config, process.env);
    const logger = ctx.logger ?? { info() { }, warn() { } };
    logBoot(logger, {
        configured: isCloudflareConfigured(resolved),
        audienceCount: resolved.audiences.length,
        ordinary: resolved.ordinary,
        issuer: issuerOf(resolved),
    });
    const verifier = createJwtVerifier(resolved);
    installServerCompat(ctx, {
        config: resolved,
        verifier,
        getTrustedHosts: () => trustedHostsFrom(ctx),
        getApiFetchHandler: () => apiFetchHandlerFrom(ctx),
    });
}
//# sourceMappingURL=index.js.map