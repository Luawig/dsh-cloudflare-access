import { prepareAction } from '../scripts/prepare.mjs'

describe('install-time prepare', () => {
  const packageRoot = '/repo/dsh-cloudflare-access'

  it('skips a git/npm dependency install when lib/ is already present', () => {
    expect(prepareAction({
      initCwd: '/apps/dsh',
      packageRoot,
      hasLib: true,
      hasBuildTools: false,
    })).toBe('skip')
    expect(prepareAction({
      initCwd: '/apps/dsh',
      packageRoot,
      hasLib: true,
      hasBuildTools: true,
    })).toBe('skip')
  })

  it('builds this repository checkout when compilers are available', () => {
    expect(prepareAction({
      initCwd: packageRoot,
      packageRoot,
      hasLib: true,
      hasBuildTools: true,
    })).toBe('build')
  })

  it('fails when both lib/ and compilers are missing', () => {
    expect(prepareAction({
      initCwd: '/apps/dsh',
      packageRoot,
      hasLib: false,
      hasBuildTools: false,
    })).toBe('fail')
  })
})
