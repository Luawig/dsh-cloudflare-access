import { apply, inject } from '../src/client/index.ts'

describe('client capability wrap', () => {
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
