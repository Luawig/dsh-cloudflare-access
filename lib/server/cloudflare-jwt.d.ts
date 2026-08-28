import { type JWTVerifyGetKey } from 'jose';
import { type PluginConfig } from '../config.ts';
import { type JwtVerification } from './types.ts';
export type { JwtFailureReason, JwtVerification } from './types.ts';
export { JWT_HEADER, readAccessJwt } from './types.ts';
export interface JwtVerifier {
    verify(headers: Headers | Record<string, string | string[] | undefined>): Promise<JwtVerification>;
}
export interface JwtVerifierOptions {
    /** Test seam: inject a key resolver instead of Remote JWK Set. */
    getKey?: JWTVerifyGetKey;
    /** Options forwarded to `createRemoteJWKSet`. */
    jwks?: {
        cooldownDuration?: number;
    };
}
/** Seconds of clock skew accepted for exp/nbf. Origin clocks can lag Cloudflare. */
export declare const CLOCK_TOLERANCE_SECONDS = 30;
/**
 * Create a verifier that uses jose Remote JWK Set (or an injected getKey in tests).
 * Does not cache per-token results.
 */
export declare function createJwtVerifier(config: PluginConfig, options?: JwtVerifierOptions): JwtVerifier;
//# sourceMappingURL=cloudflare-jwt.d.ts.map