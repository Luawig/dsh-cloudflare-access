/** Remote methods this plugin may authorize with a valid JWT. Native host methods stay DSH-pinned. */
export const PRIVILEGED_METHODS = new Set([
    'settings.describe',
    'settings.openDocument',
    'settings.update',
    'settings.replace',
    'settings.mutate',
    'credentials.describe',
    'credentials.set',
    'credentials.unset',
    'agentPreset.read',
    'agentPreset.copy',
    'agentPreset.openDocument',
    'agentPreset.remove',
    'llm.discoverModels',
]);
function deny(authClass, reason) {
    return { effect: 'deny', class: authClass, reason };
}
function allow(authClass) {
    return { effect: 'allow', class: authClass, reason: null };
}
export function isPrivilegedMethod(method) {
    return method !== undefined && PRIVILEGED_METHODS.has(method);
}
function jwtOk(jwt) {
    return jwt.outcome === 'valid';
}
/**
 * Pure authorization decision. Host/Origin is consumed as a boolean; this
 * function never inspects headers and never treats JWT as a Host substitute.
 */
export function decide(input) {
    if (input.isLoopback)
        return allow('loopback');
    if (!input.hostOriginTrusted)
        return deny(isPrivilegedMethod(input.method) ? 'privileged' : 'ordinary', 'host_origin_rejected');
    if (isPrivilegedMethod(input.method)) {
        if (jwtOk(input.jwt))
            return allow('privileged');
        return deny('privileged', input.jwt.reason ?? 'missing_token');
    }
    switch (input.ordinary) {
        case 'off':
            return allow('ordinary');
        case 'optional':
            if (input.jwt.outcome === 'missing')
                return allow('ordinary');
            if (jwtOk(input.jwt))
                return allow('ordinary');
            return deny('ordinary', input.jwt.reason ?? 'malformed');
        case 'required':
            if (jwtOk(input.jwt))
                return allow('ordinary');
            return deny('ordinary', input.jwt.reason ?? 'missing_token');
    }
}
//# sourceMappingURL=policy.js.map