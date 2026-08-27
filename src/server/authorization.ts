import type { AuthDecision } from './policy.ts'
import type { JwtFailureReason } from './types.ts'

export interface AuthHttpResult {
  status: 401 | 403
  body: 'unauthorized' | 'forbidden'
}

export function httpStatusFor(decision: AuthDecision): AuthHttpResult | null {
  if (decision.effect === 'allow') return null
  if (decision.reason === 'missing_token') {
    return { status: 401, body: 'unauthorized' }
  }
  return { status: 403, body: 'forbidden' }
}

const LOGGABLE = new Set<string>([
  'expired',
  'invalid_signature',
  'issuer_mismatch',
  'audience_mismatch',
  'missing_token',
  'jwks_unavailable',
  'unconfigured',
  'malformed',
  'host_origin_rejected',
])

export function logReason(reason: JwtFailureReason | 'host_origin_rejected' | null): string {
  if (reason !== null && LOGGABLE.has(reason)) return reason
  return 'malformed'
}

export interface PluginLogger {
  info(message: string): void
  warn(message: string): void
}

export function logBoot(logger: PluginLogger, input: {
  configured: boolean
  audienceCount: number
  ordinary: string
  issuer: string | null
}): void {
  logger.info('plugin initialized')
  if (input.configured && input.issuer !== null) {
    logger.info(`Cloudflare issuer configured (${input.issuer})`)
  } else {
    logger.warn('Cloudflare Access is not configured; remote privileged APIs will be denied')
  }
  logger.info(`audience count ${String(input.audienceCount)}`)
  logger.info(`ordinary auth mode ${input.ordinary}`)
}

export function logDenied(logger: PluginLogger, input: {
  method: string | undefined
  reason: JwtFailureReason | 'host_origin_rejected' | null
  privileged: boolean
}): void {
  const method = input.method ?? '(unknown)'
  const reason = logReason(input.reason)
  if (input.privileged) {
    logger.warn(`privileged request denied method=${method} reason=${reason}`)
    return
  }
  logger.warn(`request denied method=${method} reason=${reason}`)
}
