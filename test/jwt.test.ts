import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK, type JWTPayload } from 'jose'
import { createJwtVerifier, CLOCK_TOLERANCE_SECONDS, type JwtVerifier } from '../src/server/cloudflare-jwt.ts'
import { resolveConfig } from '../src/config.ts'

const TEAM = 'https://example.cloudflareaccess.com'
const AUD_A = 'audience-a'
const AUD_B = 'audience-b'

async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ url: string, server: Server }> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', () => { resolve() }) })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('expected tcp address')
  return { url: `http://127.0.0.1:${String(address.port)}/cdn-cgi/access/certs`, server }
}

function pluginConfig(issuer: string, audiences: string[]) {
  return {
    teamDomain: issuer,
    audiences,
    ordinary: 'off' as const,
    envLocked: { teamDomain: false, audiences: false, ordinary: false },
  }
}

async function withLocalJwks(
  keys: JWK[],
  audiences: string[],
  run: (input: { verifier: JwtVerifier, issuer: string }) => Promise<void>,
): Promise<void> {
  const { url, server } = await listen((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ keys }))
  })
  try {
    const issuer = url.replace('/cdn-cgi/access/certs', '')
    const verifier = createJwtVerifier(pluginConfig(issuer, audiences), { jwks: { cooldownDuration: 0 } })
    await run({ verifier, issuer })
  } finally {
    server.close()
  }
}

async function signAccessToken(
  privateKey: CryptoKey,
  issuer: string,
  audience: string | undefined,
  claims: { exp?: number | string, nbf?: number } = {},
): Promise<string> {
  const payload: JWTPayload = {}
  let token = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
    .setIssuedAt()
    .setIssuer(issuer)
  if (audience !== undefined) token = token.setAudience(audience)
  if (claims.nbf !== undefined) token = token.setNotBefore(claims.nbf)
  return token.setExpirationTime(claims.exp ?? '5m').sign(privateKey)
}

describe('Cloudflare Access JWT', () => {
  let privateKey: CryptoKey
  let publicJwk: JWK

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256', { extractable: true })
    privateKey = pair.privateKey
    publicJwk = await exportJWK(pair.publicKey)
    publicJwk.kid = 'key-1'
    publicJwk.use = 'sig'
    publicJwk.alg = 'RS256'
  })

  it('accepts a valid JWT', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const token = await signAccessToken(privateKey, issuer, AUD_A)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
    })
  })

  it('rejects an expired JWT', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const token = await signAccessToken(privateKey, issuer, AUD_A, {
        exp: Math.floor(Date.now() / 1000) - 60,
      })
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('expired')
    })
  })

  it('accepts a JWT within the clock-skew tolerance', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const token = await signAccessToken(privateKey, issuer, AUD_A, {
        exp: Math.floor(Date.now() / 1000) - Math.min(5, CLOCK_TOLERANCE_SECONDS - 1),
      })
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
    })
  })

  it('rejects an invalid signature', async () => {
    const other = await generateKeyPair('RS256', { extractable: true })
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const token = await signAccessToken(other.privateKey, issuer, AUD_A)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('invalid_signature')
    })
  })

  it('rejects a wrong issuer', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier }) => {
      const token = await signAccessToken(privateKey, 'https://attacker.example', AUD_A)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('issuer_mismatch')
    })
  })

  it('rejects a wrong audience', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const token = await signAccessToken(privateKey, issuer, 'other-aud')
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('audience_mismatch')
    })
  })

  it('rejects a missing audience', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const token = await signAccessToken(privateKey, issuer, undefined)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('audience_mismatch')
    })
  })

  it('accepts a token that matches one of multiple audiences', async () => {
    await withLocalJwks([publicJwk], [AUD_A, AUD_B], async ({ verifier, issuer }) => {
      const token = await signAccessToken(privateKey, issuer, AUD_B)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
    })
  })

  it('refreshes JWKS on unknown kid', async () => {
    let generation = 0
    const { url, server } = await listen((_req, res) => {
      generation += 1
      const keys = generation === 1 ? [{ ...publicJwk, kid: 'old-key' }] : [publicJwk]
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys }))
    })
    try {
      const issuer = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier(pluginConfig(issuer, [AUD_A]), { jwks: { cooldownDuration: 0 } })
      const token = await signAccessToken(privateKey, issuer, AUD_A)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
      expect(generation).toBeGreaterThanOrEqual(2)
    } finally {
      server.close()
    }
  })

  it('fails closed when JWKS is unavailable', async () => {
    const verifier = createJwtVerifier(pluginConfig('http://127.0.0.1:1', [AUD_A]))
    const token = await signAccessToken(privateKey, 'http://127.0.0.1:1', AUD_A)
    const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
    expect(result.outcome).toBe('invalid')
    expect(result.reason).toBe('jwks_unavailable')
  })

  it('ignores CF_Authorization cookies', async () => {
    const verifier = createJwtVerifier(resolveConfig({
      cloudflare: { teamDomain: TEAM, audiences: [AUD_A] },
    }))
    const result = await verifier.verify({
      cookie: 'CF_Authorization=not-a-jwt',
    })
    expect(result.outcome).toBe('missing')
    expect(result.reason).toBe('missing_token')
  })

  it('returns unconfigured without a team domain', async () => {
    const verifier = createJwtVerifier(resolveConfig({}))
    const result = await verifier.verify({ 'cf-access-jwt-assertion': 'a.b.c' })
    expect(result.reason).toBe('unconfigured')
  })

  it('rejects an unsigned JWT', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(JSON.stringify({
        iss: issuer,
        aud: AUD_A,
        exp: Math.floor(Date.now() / 1000) + 300,
      })).toString('base64url')
      const result = await verifier.verify({
        'cf-access-jwt-assertion': `${header}.${payload}.`,
      })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).not.toBeNull()
    })
  })

  it('rejects a JWT whose nbf is still in the future', async () => {
    await withLocalJwks([publicJwk], [AUD_A], async ({ verifier, issuer }) => {
      const token = await signAccessToken(privateKey, issuer, AUD_A, {
        nbf: Math.floor(Date.now() / 1000) + 120,
      })
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('malformed')
    })
  })
})
