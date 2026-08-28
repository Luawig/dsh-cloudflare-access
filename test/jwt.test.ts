import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose'
import { createJwtVerifier, CLOCK_TOLERANCE_SECONDS } from '../src/server/cloudflare-jwt.ts'
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
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const localVerifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setAudience(AUD_A)
        .setExpirationTime('5m')
        .sign(privateKey)
      const result = await localVerifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
    } finally {
      server.close()
    }
  })

  it('rejects an expired JWT', async () => {
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setAudience(AUD_A)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('expired')
    } finally {
      server.close()
    }
  })

  it('accepts a JWT within the clock-skew tolerance', async () => {
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setAudience(AUD_A)
        .setExpirationTime(Math.floor(Date.now() / 1000) - Math.min(5, CLOCK_TOLERANCE_SECONDS - 1))
        .sign(privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
    } finally {
      server.close()
    }
  })

  it('rejects an invalid signature', async () => {
    const other = await generateKeyPair('RS256', { extractable: true })
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setAudience(AUD_A)
        .setExpirationTime('5m')
        .sign(other.privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('invalid_signature')
    } finally {
      server.close()
    }
  })

  it('rejects a wrong issuer', async () => {
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer('https://attacker.example')
        .setAudience(AUD_A)
        .setExpirationTime('5m')
        .sign(privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('issuer_mismatch')
    } finally {
      server.close()
    }
  })

  it('rejects a wrong audience', async () => {
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setAudience('other-aud')
        .setExpirationTime('5m')
        .sign(privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('audience_mismatch')
    } finally {
      server.close()
    }
  })

  it('rejects a missing audience', async () => {
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setExpirationTime('5m')
        .sign(privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('invalid')
      expect(result.reason).toBe('audience_mismatch')
    } finally {
      server.close()
    }
  })

  it('accepts a token that matches one of multiple audiences', async () => {
    const { url, server } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [publicJwk] }))
    })
    try {
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A, AUD_B],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setAudience(AUD_B)
        .setExpirationTime('5m')
        .sign(privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
    } finally {
      server.close()
    }
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
      const localOrigin = url.replace('/cdn-cgi/access/certs', '')
      const verifier = createJwtVerifier({
        teamDomain: localOrigin,
        audiences: [AUD_A],
        ordinary: 'off',
        envLocked: { teamDomain: false, audiences: false, ordinary: false },
      }, { jwks: { cooldownDuration: 0 } })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuedAt()
        .setIssuer(localOrigin)
        .setAudience(AUD_A)
        .setExpirationTime('5m')
        .sign(privateKey)
      const result = await verifier.verify({ 'cf-access-jwt-assertion': token })
      expect(result.outcome).toBe('valid')
      expect(generation).toBeGreaterThanOrEqual(2)
    } finally {
      server.close()
    }
  })

  it('fails closed when JWKS is unavailable', async () => {
    const verifier = createJwtVerifier({
      teamDomain: 'http://127.0.0.1:1',
      audiences: [AUD_A],
      ordinary: 'off',
      envLocked: { teamDomain: false, audiences: false, ordinary: false },
    })
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuedAt()
      .setIssuer('http://127.0.0.1:1')
      .setAudience(AUD_A)
      .setExpirationTime('5m')
      .sign(privateKey)
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
})
