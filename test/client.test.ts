import { readFileSync } from 'node:fs'
import { apply, inject } from '../src/client/index.ts'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dsh: { client: { immediately?: boolean, inject?: string[] } }
}

describe('client capability wrap', () => {
  it('prefetches with connection so ui-settings cannot snapshot memory mode first', () => {
    expect(pkg.dsh.client.immediately).toBe(true)
    expect(pkg.dsh.client.inject).toEqual(['@deepseek-ai/dsh-client-connection'])
  })

  it('declares a connection inject and does not read cookies', () => {
    expect(inject).toEqual(['connection'])
    const source = apply.toString()
    expect(source).not.toMatch(/CF_Authorization/)
    expect(source).not.toMatch(/Cf-Access-Jwt-Assertion/)
  })

  it('enables isLoopback and restores it on unload', () => {
    const connection = { isLoopback: false }
    const disposers: Array<() => void> = []
    apply({
      connection,
      get: () => connection,
      effect(cb: () => (() => void) | Promise<void>) {
        const dispose = cb()
        if (typeof dispose === 'function') disposers.push(dispose)
      },
    })
    expect(connection.isLoopback).toBe(true)
    for (const dispose of disposers) dispose()
    expect(connection.isLoopback).toBe(false)
  })
})
