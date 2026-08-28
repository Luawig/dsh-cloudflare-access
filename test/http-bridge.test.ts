import type { IncomingMessage, ServerResponse } from 'node:http'
import { bridge } from '../src/compat/http-bridge.ts'

function fakeReq(input: {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: Buffer
}): IncomingMessage {
  const body = input.body
  return {
    url: input.url ?? '/api/settings.describe',
    method: input.method ?? 'GET',
    headers: input.headers ?? {},
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield body
    },
    destroy() {},
  } as unknown as IncomingMessage
}

function fakeRes(): {
  res: ServerResponse
  result: () => Promise<{ status: number, body: string, destroyed: boolean }>
} {
  const chunks: Buffer[] = []
  let status = 200
  let ended = false
  let destroyed = false
  let resolveDone: ((value: { status: number, body: string, destroyed: boolean }) => void) | undefined
  const done = new Promise<{ status: number, body: string, destroyed: boolean }>((resolve) => {
    resolveDone = resolve
  })
  const finish = () => {
    if (ended) return
    ended = true
    resolveDone?.({ status, body: Buffer.concat(chunks).toString(), destroyed })
  }
  const state = {
    headersSent: false,
    writableEnded: false,
  }
  const res = {
    get headersSent() { return state.headersSent },
    get writableEnded() { return state.writableEnded },
    writeHead(code: number) {
      status = code
      state.headersSent = true
    },
    write(chunk: unknown) {
      if (Buffer.isBuffer(chunk)) chunks.push(chunk)
      else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk))
      else if (chunk !== undefined) chunks.push(Buffer.from(String(chunk)))
    },
    end(body?: unknown) {
      state.writableEnded = true
      if (body !== undefined) {
        if (Buffer.isBuffer(body)) chunks.push(body)
        else chunks.push(Buffer.from(String(body)))
      }
      finish()
    },
    on() { return undefined },
    destroy() {
      destroyed = true
      state.writableEnded = true
      finish()
    },
  } as unknown as ServerResponse
  return { res, result: () => done }
}

describe('http-to-fetch bridge', () => {
  it('returns 502 when apiProxy fetch throws', async () => {
    const { res, result } = fakeRes()
    await bridge(fakeReq({}), res, {
      fetch: async () => {
        throw new Error('proxy down')
      },
    })
    const outcome = await result()
    expect(outcome.status).toBe(502)
    expect(outcome.destroyed).toBe(false)
  })

  it('forwards a successful apiProxy response', async () => {
    const { res, result } = fakeRes()
    await bridge(fakeReq({}), res, {
      fetch: async () => new Response('ok', { status: 200 }),
    })
    const outcome = await result()
    expect(outcome.status).toBe(200)
    expect(outcome.body).toBe('ok')
  })

  it('rejects an oversized content-length before reading the body', async () => {
    const { res, result } = fakeRes()
    await bridge(fakeReq({
      headers: { 'content-length': String(200 * 1024 * 1024) },
    }), res, {
      fetch: async () => new Response('ok'),
    })
    const outcome = await result()
    expect(outcome.status).toBe(413)
  })
})
