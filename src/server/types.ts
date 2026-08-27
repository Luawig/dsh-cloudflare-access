/** JWT / authorization failure categories safe to log. */
export type JwtFailureReason =
  | 'missing_token'
  | 'malformed'
  | 'expired'
  | 'invalid_signature'
  | 'issuer_mismatch'
  | 'audience_mismatch'
  | 'jwks_unavailable'
  | 'unconfigured'

export type JwtOutcome = 'valid' | 'missing' | 'invalid'

export interface JwtVerification {
  outcome: JwtOutcome
  reason: JwtFailureReason | null
  audienceMatched: string | null
}

export const JWT_HEADER = 'cf-access-jwt-assertion'

export function readAccessJwt(headers: Headers | Record<string, string | string[] | undefined>): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(JWT_HEADER) ?? headers.get('Cf-Access-Jwt-Assertion') ?? undefined
  }
  const direct = headers[JWT_HEADER] ?? headers['Cf-Access-Jwt-Assertion']
  if (typeof direct === 'string') return direct
  if (Array.isArray(direct) && typeof direct[0] === 'string') return direct[0]
  return undefined
}
