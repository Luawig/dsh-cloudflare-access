/**
 * DSH 0.1.1-rc.2 compatible Host/Origin fence copy (same shape as 0.1.0-rc.5).
 * Kept in compat so JWT core does not import DSH internals.
 * Source of truth in DSH: packages/client/connection/src/api-request-trust.ts
 */
export declare function isLoopbackHostname(hostname: string): boolean;
export declare function isTrustedApiRequest(headers: {
    get(name: string): string | null;
} | Record<string, string | string[] | undefined>, trustedHosts: readonly string[]): boolean;
export declare function requestIsLoopback(headers: {
    get(name: string): string | null;
} | Record<string, string | string[] | undefined>): boolean;
//# sourceMappingURL=dsh-trust.d.ts.map