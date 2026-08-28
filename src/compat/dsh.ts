/**
 * DSH 0.1.1-rc.2 (live-tested) server hook, researched against 0.1.0-rc.5:
 * wrap webServer.register before connection mounts /api, then apply JWT policy.
 * Isolated from JWT core.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import type { PluginConfig } from '../config.ts'
import { httpStatusFor, logDenied, type PluginLogger } from '../server/authorization.ts'
import type { JwtVerifier } from '../server/cloudflare-jwt.ts'
import { decide, isPrivilegedMethod, jwtParticipates } from '../server/policy.ts'
import { readAccessJwt } from '../server/types.ts'
import {
  API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH, bridge, rpcMethodFromUrl, type FetchHandler,
} from './http-bridge.ts'
import { isTrustedApiRequest, requestIsLoopback } from './dsh-trust.ts'

export interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

export interface WebUpgradeRoute {
  path: string
  handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
}

export interface WebServerLike {
  register(route: WebRoute): () => void
  registerUpgrade(route: WebUpgradeRoute): () => void
}

export interface CompatContext {
  webServer: WebServerLike
  logger?: PluginLogger
  effect(callback: () => (() => void) | Promise<void>, name?: string): void
  get(name: string): unknown
}

export interface ServerCompatDeps {
  config: PluginConfig
  verifier: JwtVerifier
  getTrustedHosts: () => readonly string[]
  getApiFetchHandler: () => FetchHandler | undefined
}

function nodeHeaders(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers
}

async function jwtFor(req: IncomingMessage, verifier: JwtVerifier) {
  return verifier.verify(nodeHeaders(req))
}

function writeAuth(res: ServerResponse, status: 401 | 403, body: string): void {
  res.writeHead(status)
  res.end(body)
}

function rejectUpgrade(socket: Duplex): void {
  socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
  socket.destroy()
}

function isApiPrefix(route: WebRoute): boolean {
  return route.kind === 'prefix' && route.path === API_PATH
}

function isApiUpgrade(route: WebUpgradeRoute): boolean {
  return route.path === MUX_EVENTS_PATH || route.path === HOST_EVENTS_PATH
}

/**
 * Wrap webServer.register / registerUpgrade. Must run before connection apply.
 * Restores originals on dispose.
 */
export function installServerCompat(ctx: CompatContext, deps: ServerCompatDeps): void {
  const originalRegister = ctx.webServer.register
  const originalRegisterUpgrade = ctx.webServer.registerUpgrade
  const logger: PluginLogger = ctx.logger ?? { info() {}, warn() {} }

  ctx.webServer.register = (route: WebRoute): (() => void) => {
    if (!isApiPrefix(route)) return originalRegister.call(ctx.webServer, route)
    const inner = route.handler
    return originalRegister.call(ctx.webServer, {
      ...route,
      handler: async (req, res) => {
        await handleApi(req, res, inner, deps, logger)
      },
    })
  }

  ctx.webServer.registerUpgrade = (route: WebUpgradeRoute): (() => void) => {
    if (!isApiUpgrade(route)) return originalRegisterUpgrade.call(ctx.webServer, route)
    const inner = route.handler
    return originalRegisterUpgrade.call(ctx.webServer, {
      ...route,
      handler: (req, socket, head) => handleUpgrade(req, socket, head, inner, deps, logger),
    })
  }

  ctx.effect(() => () => {
    ctx.webServer.register = originalRegister
    ctx.webServer.registerUpgrade = originalRegisterUpgrade
  }, 'dsh-cloudflare-access: restore webServer.register')
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  inner: WebRoute['handler'],
  deps: ServerCompatDeps,
  logger: PluginLogger,
): Promise<void> {
  const headers = nodeHeaders(req)
  const trustedHosts = deps.getTrustedHosts()
  if (requestIsLoopback(headers)) {
    await inner(req, res)
    return
  }

  const hostOriginTrusted = isTrustedApiRequest(headers, trustedHosts)
  if (!hostOriginTrusted) {
    await inner(req, res)
    return
  }

  const method = rpcMethodFromUrl(req.url)
  const token = readAccessJwt(headers)
  const tokenPresent = token !== undefined && token.trim() !== ''
  if (!jwtParticipates({ method, ordinary: deps.config.ordinary, tokenPresent })) {
    await inner(req, res)
    return
  }

  const jwt = await jwtFor(req, deps.verifier)
  const decision = decide({
    isLoopback: false,
    hostOriginTrusted: true,
    method,
    ordinary: deps.config.ordinary,
    jwt,
  })

  if (decision.effect === 'deny') {
    const http = httpStatusFor(decision)
    logDenied(logger, { method, reason: decision.reason, privileged: decision.class === 'privileged' })
    if (http !== null) writeAuth(res, http.status, http.body)
    else await inner(req, res)
    return
  }

  if (isPrivilegedMethod(method)) {
    const api = deps.getApiFetchHandler()
    if (api === undefined) {
      logDenied(logger, { method, reason: 'unconfigured', privileged: true })
      writeAuth(res, 403, 'forbidden')
      return
    }
    await bridge(req, res, api)
    return
  }

  await inner(req, res)
}

async function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  inner: WebUpgradeRoute['handler'],
  deps: ServerCompatDeps,
  logger: PluginLogger,
): Promise<void> {
  const headers = nodeHeaders(req)
  const trustedHosts = deps.getTrustedHosts()
  if (requestIsLoopback(headers)) {
    await inner(req, socket, head)
    return
  }
  const hostOriginTrusted = isTrustedApiRequest(headers, trustedHosts)
  if (!hostOriginTrusted) {
    await inner(req, socket, head)
    return
  }
  const method = rpcMethodFromUrl(req.url)
  const token = readAccessJwt(headers)
  const tokenPresent = token !== undefined && token.trim() !== ''
  if (!jwtParticipates({ method, ordinary: deps.config.ordinary, tokenPresent })) {
    await inner(req, socket, head)
    return
  }
  const jwt = await jwtFor(req, deps.verifier)
  const decision = decide({
    isLoopback: false,
    hostOriginTrusted: true,
    method,
    ordinary: deps.config.ordinary,
    jwt,
  })
  if (decision.effect === 'deny') {
    logDenied(logger, { method, reason: decision.reason, privileged: false })
    rejectUpgrade(socket)
    return
  }
  await inner(req, socket, head)
}
