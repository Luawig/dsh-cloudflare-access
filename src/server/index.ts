import { createRequire } from 'node:module'
import { isCloudflareConfigured, issuerOf, resolveConfig, type CordisConfig } from '../config.ts'
import { installServerCompat } from '../compat/dsh.ts'
import type { FetchHandler } from '../compat/http-bridge.ts'
import { logBoot, type PluginLogger } from './authorization.ts'
import { createJwtVerifier } from './cloudflare-jwt.ts'

export type { CordisConfig, PluginConfig } from '../config.ts'
export { resolveConfig, isCloudflareConfigured, issuerOf, jwksUrlOf } from '../config.ts'
export { createJwtVerifier } from './cloudflare-jwt.ts'
export { decide, PRIVILEGED_METHODS, jwtParticipates } from './policy.ts'

export const name = 'cloudflare-access'
export const inject = ['webServer']

export interface ServerPluginContext {
  webServer: {
    register(route: unknown): () => void
    registerUpgrade(route: unknown): () => void
  }
  logger?: PluginLogger
  effect(callback: () => (() => void) | Promise<void>, name?: string): void
  get(name: string): unknown
}

function trustedHostsFrom(ctx: ServerPluginContext): readonly string[] {
  const runtime = ctx.get('webRuntime') as { trustedHosts?: string[] } | undefined
  return runtime?.trustedHosts ?? []
}

function apiFetchHandlerFrom(ctx: ServerPluginContext): FetchHandler | undefined {
  const apiProxy = ctx.get('apiProxy')
  if (apiProxy === undefined || apiProxy === null) return undefined
  if (typeof (apiProxy as { fetch?: unknown }).fetch === 'function') {
    const fetchFn = (apiProxy as FetchHandler).fetch.bind(apiProxy)
    return { fetch: fetchFn }
  }
  try {
    const required = createRequire(import.meta.url)
    const mod = required('@deepseek-ai/dsh-host-apiproxy') as {
      toFetchHandler?: (proxy: unknown) => FetchHandler
    }
    if (typeof mod.toFetchHandler === 'function') return mod.toFetchHandler(apiProxy)
  } catch {
    return undefined
  }
  return undefined
}

export function apply(ctx: ServerPluginContext, config?: CordisConfig): void {
  const resolved = resolveConfig(config, process.env)
  const logger: PluginLogger = ctx.logger ?? { info() {}, warn() {} }
  logBoot(logger, {
    configured: isCloudflareConfigured(resolved),
    audienceCount: resolved.audiences.length,
    ordinary: resolved.ordinary,
    issuer: issuerOf(resolved),
  })
  const verifier = createJwtVerifier(resolved)
  installServerCompat(ctx as never, {
    config: resolved,
    verifier,
    getTrustedHosts: () => trustedHostsFrom(ctx),
    getApiFetchHandler: () => apiFetchHandlerFrom(ctx),
  })
}
