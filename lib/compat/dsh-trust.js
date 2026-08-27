/**
 * DSH 0.1.1-rc.2 compatible Host/Origin fence copy (same shape as 0.1.0-rc.5).
 * Kept in compat so JWT core does not import DSH internals.
 * Source of truth in DSH: packages/client/connection/src/api-request-trust.ts
 */
export function isLoopbackHostname(hostname) {
    if (hostname === 'localhost' || hostname === '[::1]')
        return true;
    const parts = hostname.split('.');
    return parts.length === 4
        && parts[0] === '127'
        && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function header(headers, name) {
    if (typeof headers.get === 'function') {
        return headers.get(name) ?? undefined;
    }
    const value = headers[name]
        ?? headers[name.toLowerCase()];
    return typeof value === 'string' ? value : undefined;
}
function parseAuthority(authority) {
    try {
        return new URL(`http://${authority}`);
    }
    catch {
        return undefined;
    }
}
function canonicalAuthority(entry, entryUrl) {
    const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port;
    return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
function isTrustedAuthority(hostUrl, trustedHosts) {
    return trustedHosts.some((entry) => {
        const entryUrl = parseAuthority(entry);
        if (entryUrl === undefined)
            return false;
        return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
            ? entryUrl.hostname === hostUrl.hostname
            : entryUrl.host === hostUrl.host;
    });
}
export function isTrustedApiRequest(headers, trustedHosts) {
    const host = header(headers, 'host');
    if (host === undefined)
        return false;
    const hostUrl = parseAuthority(host);
    if (hostUrl === undefined)
        return false;
    if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts))
        return false;
    if (header(headers, 'sec-fetch-site') === 'cross-site')
        return false;
    const origin = header(headers, 'origin');
    if (origin === undefined)
        return true;
    try {
        return new URL(origin).host === hostUrl.host;
    }
    catch {
        return false;
    }
}
export function requestIsLoopback(headers) {
    const host = header(headers, 'host');
    if (host === undefined)
        return false;
    const hostUrl = parseAuthority(host);
    return hostUrl !== undefined && isLoopbackHostname(hostUrl.hostname);
}
//# sourceMappingURL=dsh-trust.js.map