/** JWT / authorization failure categories safe to log. */
export type JwtFailureReason = 'missing_token' | 'malformed' | 'expired' | 'invalid_signature' | 'issuer_mismatch' | 'audience_mismatch' | 'jwks_unavailable' | 'unconfigured';
export type JwtOutcome = 'valid' | 'missing' | 'invalid';
export interface JwtVerification {
    outcome: JwtOutcome;
    reason: JwtFailureReason | null;
    audienceMatched: string | null;
}
export declare const JWT_HEADER = "cf-access-jwt-assertion";
export declare function readAccessJwt(headers: Headers | Record<string, string | string[] | undefined>): string | undefined;
//# sourceMappingURL=types.d.ts.map