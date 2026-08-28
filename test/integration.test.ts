import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { generateKeyPair, SignJWT, exportJWK } from 'jose'
import { apply as applyServer } from '../src/server/index.ts'
import { httpStatusFor } from '../src/server/authorization.ts'
import { decide } from '../src/server/policy.ts'
import { installServerCompat, type WebRoute, type WebUpgradeRoute } from '../src/compat/dsh.ts'
import type { JwtVerification } from '../src/server/types.ts'

interface FakeWebServer {
  register(route: WebRoute): () => void
  registerUpgrade(route: WebUpgradeRoute): () => void
  routes: Map<string, WebRoute>
}

function collectEffects(disposers: Array<() => void>) {
  return (cb: () => (() => void) | Promise<void>): void => {
    const dispose = cb()
    if (typeof dispose === 'function') disposers.push(dispose)
  }
}

function createFakeWebServer(): FakeWebServer {
  const routes = new Map<string, WebRoute>()
  return {
    routes,
    register(route) {
      routes.set(`${route.kind}:${route.path}`, route)
      return () => { routes.delete(`${route.kind}:${route.path}`) }
    },
    registerUpgrade() {
      return () => {}
    },
  }
}

describe('server compat integration', () => {
  it('restores register after unload', () => {
    const webServer = createFakeWebServer()
    const original = webServer.register
    const disposers: Array<() => void> = []
    const ctx = {
      webServer,
      logger: { info() {}, warn() {} },
      effect: collectEffects(disposers),
      get(name: string) {
        if (name === 'webRuntime') return { trustedHosts: ['dsh.example.com'] }
        if (name === 'apiProxy') return { fetch: async () => new Response('ok') }
        return undefined
      },
    }
    applyServer(ctx, {
      cloudflare: { teamDomain: 'https://example.cloudflareaccess.com', audiences: ['aud'] },
    })
    expect(webServer.register).not.toBe(original)
    for (const dispose of disposers) dispose()
    expect(webServer.register).toBe(original)
  })

  it('maps missing privileged JWT to 401', () => {
    const http = httpStatusFor(decide({
      isLoopback: false,
      hostOriginTrusted: true,
      method: 'settings.describe',
      ordinary: 'off',
      jwt: { outcome: 'missing', reason: 'missing_token', audienceMatched: null },
    }))
    expect(http).toEqual({ status: 401, body: 'unauthorized' })
  })

  it('does not log token material in deny messages', () => {
    const lines: string[] = []
    const webServer = createFakeWebServer()
    const disposers: Array<() => void> = []
    applyServer({
      webServer,
      logger: {
        info(message) { lines.push(message) },
        warn(message) { lines.push(message) },
      },
      effect: collectEffects(disposers),
      get() { return undefined },
    }, {
      cloudflare: { teamDomain: 'https://example.cloudflareaccess.com', audiences: ['aud'] },
    })
    const joined = lines.join('\n')
    expect(joined).not.toMatch(/eyJ/)
    expect(joined).toContain('plugin initialized')
    for (const dispose of disposers) dispose()
  })
})

describe('end-to-end privileged wrap', () => {
  it('allows remote privileged after Host/Origin and a valid JWT, and 401 without a token', async () => {
    const pair = await generateKeyPair('RS256', { extractable: true })
    const publicJwk = await exportJWK(pair.publicKey)
    publicJwk.kid = 'k1'
    publicJwk.alg = 'RS256'
    publicJwk.use = 'sig'
    const jwks = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    await new Promise<void>((resolve) => { jwks.listen(0, '127.0.0.1', () => { resolve() }) })
    const addr = jwks.address()
    if (addr === null || typeof addr === 'string') throw new Error('port')
    const origin = `http://127.0.0.1:${String(addr.port)}`

    const webServer = createFakeWebServer()
    const disposers: Array<() => void> = []
    let proxied = 0
    applyServer({
      webServer,
      logger: { info() {}, warn() {} },
      effect: collectEffects(disposers),
      get(name: string) {
        if (name === 'webRuntime') return { trustedHosts: ['dsh.example.com'] }
        if (name === 'apiProxy') {
          return {
            fetch: async () => {
              proxied += 1
              return new Response('proxied', { status: 200 })
            },
          }
        }
        return undefined
      },
    }, {
      cloudflare: { teamDomain: origin, audiences: ['aud'] },
    })

    const innerCalls: string[] = []
    webServer.register({
      kind: 'prefix',
      path: '/api',
      handler: async (_req, res) => {
        innerCalls.push('inner')
        res.writeHead(403)
        res.end('forbidden')
      },
    })

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuedAt()
      .setIssuer(origin)
      .setAudience('aud')
      .setExpirationTime('5m')
      .sign(pair.privateKey)

    const route = webServer.routes.get('prefix:/api')
    if (route === undefined) throw new Error('route missing')

    const missing = await invoke(route.handler, {
      url: '/api/settings.describe',
      headers: { host: 'dsh.example.com', origin: 'https://dsh.example.com' },
    })
    expect(missing.status).toBe(401)
    expect(innerCalls).toEqual([])
    expect(proxied).toBe(0)

    const allowed = await invoke(route.handler, {
      url: '/api/settings.describe',
      headers: {
        host: 'dsh.example.com',
        origin: 'https://dsh.example.com',
        'cf-access-jwt-assertion': token,
      },
    })
    expect(allowed.status).toBe(200)
    expect(allowed.body).toBe('proxied')
    expect(proxied).toBe(1)

    const badHost = await invoke(route.handler, {
      url: '/api/settings.describe',
      headers: {
        host: 'evil.example',
        origin: 'https://evil.example',
        'cf-access-jwt-assertion': token,
      },
    })
    expect(badHost.status).toBe(403)
    expect(innerCalls).toEqual(['inner'])

    for (const dispose of disposers) dispose()
    jwks.close()
  })
})

describe('JWT verification is skipped when it cannot change the decision', () => {
  function pluginConfig(ordinary: 'off' | 'optional' | 'required' = 'off') {
    return {
      teamDomain: 'https://example.cloudflareaccess.com',
      audiences: ['aud'],
      ordinary,
      envLocked: { teamDomain: false, audiences: false, ordinary: false },
    }
  }

  function countingVerifier(verify: () => Promise<JwtVerification>) {
    let calls = 0
    return {
      calls: () => calls,
      verifier: {
        async verify() {
          calls += 1
          return verify()
        },
      },
    }
  }

  async function mountApi(input: {
    ordinary?: 'off' | 'optional' | 'required'
    verify?: () => Promise<JwtVerification>
  }) {
    const webServer = createFakeWebServer()
    const disposers: Array<() => void> = []
    const counted = countingVerifier(input.verify ?? (async () => ({
      outcome: 'invalid',
      reason: 'invalid_signature',
      audienceMatched: null,
    })))
    installServerCompat({
      webServer,
      logger: { info() {}, warn() {} },
      effect: collectEffects(disposers),
      get() { return undefined },
    }, {
      config: pluginConfig(input.ordinary),
      verifier: counted.verifier,
      getTrustedHosts: () => ['dsh.example.com'],
      getApiFetchHandler: () => ({ fetch: async () => new Response('proxied') }),
    })
    const innerCalls: string[] = []
    webServer.register({
      kind: 'prefix',
      path: '/api',
      handler: async (_req, res) => {
        innerCalls.push('inner')
        res.writeHead(200)
        res.end('inner')
      },
    })
    const route = webServer.routes.get('prefix:/api')
    if (route === undefined) throw new Error('route missing')
    return { route, innerCalls, calls: counted.calls, disposers }
  }

  it('does not verify ordinary APIs when ordinary=off', async () => {
    const { route, innerCalls, calls, disposers } = await mountApi({ ordinary: 'off' })
    const result = await invoke(route.handler, {
      url: '/api/llm.models',
      headers: {
        host: 'dsh.example.com',
        origin: 'https://dsh.example.com',
        'cf-access-jwt-assertion': 'not-a-jwt',
      },
    })
    expect(result.status).toBe(200)
    expect(result.body).toBe('inner')
    expect(innerCalls).toEqual(['inner'])
    expect(calls()).toBe(0)
    for (const dispose of disposers) dispose()
  })

  it('does not verify when Host/Origin already failed', async () => {
    const { route, innerCalls, calls, disposers } = await mountApi({ ordinary: 'required' })
    const result = await invoke(route.handler, {
      url: '/api/settings.describe',
      headers: {
        host: 'evil.example',
        origin: 'https://evil.example',
        'cf-access-jwt-assertion': 'not-a-jwt',
      },
    })
    expect(result.status).toBe(200)
    expect(innerCalls).toEqual(['inner'])
    expect(calls()).toBe(0)
    for (const dispose of disposers) dispose()
  })

  it('still verifies remote privileged APIs when ordinary=off', async () => {
    const { route, innerCalls, calls, disposers } = await mountApi({ ordinary: 'off' })
    const result = await invoke(route.handler, {
      url: '/api/settings.describe',
      headers: {
        host: 'dsh.example.com',
        origin: 'https://dsh.example.com',
        'cf-access-jwt-assertion': 'not-a-jwt',
      },
    })
    expect(result.status).toBe(403)
    expect(innerCalls).toEqual([])
    expect(calls()).toBe(1)
    for (const dispose of disposers) dispose()
  })
})

async function invoke(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
  input: { url: string, headers: Record<string, string> },
): Promise<{ status: number, body: string }> {
  const chunks: Buffer[] = []
  let status = 200
  let ended = false
  const req = {
    url: input.url,
    method: 'GET',
    headers: input.headers,
    async *[Symbol.asyncIterator]() {},
    destroy() {},
  } as unknown as IncomingMessage
  return await new Promise((resolve, reject) => {
    const res = {
      headersSent: false,
      writableEnded: false,
      writeHead(code: number) {
        status = code
      },
      write(chunk: unknown) {
        if (Buffer.isBuffer(chunk)) chunks.push(chunk)
        else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk))
        else if (chunk !== undefined) chunks.push(Buffer.from(String(chunk)))
      },
      end(body?: unknown) {
        if (ended) return
        ended = true
        if (body !== undefined) {
          if (Buffer.isBuffer(body)) chunks.push(body)
          else if (body instanceof Uint8Array) chunks.push(Buffer.from(body))
          else chunks.push(Buffer.from(String(body)))
        }
        resolve({ status, body: Buffer.concat(chunks).toString() })
      },
      on() { return undefined },
      destroy() {
        if (!ended) {
          ended = true
          resolve({ status, body: Buffer.concat(chunks).toString() })
        }
      },
    } as unknown as ServerResponse
    Promise.resolve(handler(req, res)).catch(reject)
  })
}
