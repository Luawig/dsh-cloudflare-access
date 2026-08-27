import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose'
import {
  isCloudflareConfigured, issuerOf, jwksUrlOf, type PluginConfig,
} from '../config.ts'
import { readAccessJwt, type JwtFailureReason, type JwtVerification } from './types.ts'

export type { JwtFailureReason, JwtVerification } from './types.ts'
export { JWT_HEADER, readAccessJwt } from './types.ts'

export interface JwtVerifier {
  verify(headers: Headers | Record<string, string | string[] | undefined>): Promise<JwtVerification>
}

export interface JwtVerifierOptions {
  /** Test seam: inject a key resolver instead of Remote JWK Set. */
  getKey?: JWTVerifyGetKey
  /** Options forwarded to `createRemoteJWKSet`. */
  jwks?: { cooldownDuration?: number }
}

function invalid(reason: JwtFailureReason): JwtVerification {
  return { outcome: 'invalid', reason, audienceMatched: null }
}

function mapJoseError(error: unknown): JwtFailureReason {
  if (error instanceof errors.JWKSTimeout || error instanceof errors.JWKSNoMatchingKey) {
    return error instanceof errors.JWKSNoMatchingKey ? 'invalid_signature' : 'jwks_unavailable'
  }
  if (error instanceof errors.JWKSInvalid || error instanceof errors.JWKInvalid) {
    return 'jwks_unavailable'
  }
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name === 'JWTExpired') return 'expired'
  if (name === 'JWTClaimValidationFailed') {
    if (/"iss"/i.test(message) || /\biss\b/i.test(message)) return 'issuer_mismatch'
    if (/"aud"/i.test(message) || /\baud\b/i.test(message)) return 'audience_mismatch'
    if (/"exp"/i.test(message) || /\bexp\b/i.test(message)) return 'expired'
    if (/"nbf"/i.test(message) || /\bnbf\b/i.test(message)) return 'malformed'
    return 'malformed'
  }
  if (name === 'JWSSignatureVerificationFailed' || name === 'JWSInvalid') return 'invalid_signature'
  if (name === 'JWTInvalid' || name === 'JWSInvalid') return 'malformed'
  if (/fetch|network|ECONNREFUSED|ENOTFOUND|certificate/i.test(message)) return 'jwks_unavailable'
  return 'invalid_signature'
}

function audienceOptions(audiences: readonly string[]): string | string[] {
  return audiences.length === 1 ? audiences[0]! : [...audiences]
}

/**
 * Create a verifier that uses jose Remote JWK Set (or an injected getKey in tests).
 * Does not cache per-token results.
 */
export function createJwtVerifier(config: PluginConfig, options: JwtVerifierOptions = {}): JwtVerifier {
  const jwksUrl = jwksUrlOf(config)
  const getKey = options.getKey ?? (
    jwksUrl === null
      ? undefined
      : createRemoteJWKSet(new URL(jwksUrl), options.jwks)
  )

  return {
    async verify(headers): Promise<JwtVerification> {
      if (!isCloudflareConfigured(config)) return invalid('unconfigured')
      const token = readAccessJwt(headers)
      if (token === undefined || token.trim() === '') {
        return { outcome: 'missing', reason: 'missing_token', audienceMatched: null }
      }
      if (getKey === undefined) return invalid('unconfigured')
      const issuer = issuerOf(config)
      if (issuer === null) return invalid('unconfigured')
      try {
        const { payload } = await jwtVerify(token, getKey, {
          issuer,
          audience: audienceOptions(config.audiences),
          algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
        })
        const aud = payload.aud
        const matched = typeof aud === 'string'
          ? aud
          : Array.isArray(aud)
            ? aud.find((value): value is string => typeof value === 'string' && config.audiences.includes(value)) ?? null
            : null
        return { outcome: 'valid', reason: null, audienceMatched: matched }
      } catch (error) {
        return invalid(mapJoseError(error))
      }
    },
  }
}
