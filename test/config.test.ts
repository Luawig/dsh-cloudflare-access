import {
  ENV_AUDIENCES, ENV_ORDINARY_MODE, ENV_TEAM_DOMAIN, isCloudflareConfigured, jwksUrlOf, resolveConfig,
} from '../src/config.ts'

describe('config resolution', () => {
  it('defaults to unconfigured off mode', () => {
    const config = resolveConfig({}, {})
    expect(config.teamDomain).toBeNull()
    expect(config.audiences).toEqual([])
    expect(config.ordinary).toBe('off')
    expect(isCloudflareConfigured(config)).toBe(false)
  })

  it('uses Cordis config when env is absent', () => {
    const config = resolveConfig({
      cloudflare: { teamDomain: 'https://example.cloudflareaccess.com', audiences: ['a'] },
      auth: { ordinary: 'optional' },
    }, {})
    expect(config.teamDomain).toBe('https://example.cloudflareaccess.com')
    expect(config.audiences).toEqual(['a'])
    expect(config.ordinary).toBe('optional')
    expect(jwksUrlOf(config)).toBe('https://example.cloudflareaccess.com/cdn-cgi/access/certs')
  })

  it('lets environment variables override Cordis config', () => {
    const config = resolveConfig({
      cloudflare: { teamDomain: 'https://cordis.cloudflareaccess.com', audiences: ['cordis'] },
      auth: { ordinary: 'off' },
    }, {
      [ENV_TEAM_DOMAIN]: 'https://env.cloudflareaccess.com',
      [ENV_AUDIENCES]: 'one, two ,three',
      [ENV_ORDINARY_MODE]: 'required',
    })
    expect(config.teamDomain).toBe('https://env.cloudflareaccess.com')
    expect(config.audiences).toEqual(['one', 'two', 'three'])
    expect(config.ordinary).toBe('required')
    expect(config.envLocked).toEqual({ teamDomain: true, audiences: true, ordinary: true })
  })

  it('locks an empty env value so Cordis cannot fill it', () => {
    const config = resolveConfig({
      cloudflare: { teamDomain: 'https://cordis.cloudflareaccess.com', audiences: ['a'] },
    }, {
      [ENV_TEAM_DOMAIN]: '',
    })
    expect(config.teamDomain).toBeNull()
    expect(config.envLocked.teamDomain).toBe(true)
  })

  it('rejects an illegal ordinary mode', () => {
    expect(() => resolveConfig({}, { [ENV_ORDINARY_MODE]: 'maybe' })).toThrow(/off \| optional \| required/)
  })
})
