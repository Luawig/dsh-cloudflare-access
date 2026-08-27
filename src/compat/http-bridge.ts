/**
 * node:http → Fetch bridge for privileged bypass onto apiProxy.
 * Isolated in compat; not DSH-specific authorization.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const DEFAULT_MAX_REQUEST_BODY_BYTES = 160 * 1024 * 1024

export interface FetchHandler {
  fetch(request: Request): Promise<Response>
}

function nodeHeadersToObject(headers: IncomingMessage['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') out[key] = value
    else if (Array.isArray(value) && value[0] !== undefined) out[key] = value.join(', ')
  }
  return out
}

export async function bridge(
  req: IncomingMessage,
  res: ServerResponse,
  apiHandler: FetchHandler,
  maxRequestBodyBytes = DEFAULT_MAX_REQUEST_BODY_BYTES,
): Promise<void> {
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })
  const declaredLength = req.headers['content-length']
  if (declaredLength !== undefined && Number(declaredLength) > maxRequestBodyBytes) {
    res.writeHead(413, { connection: 'close' })
    res.end()
    req.destroy()
    return
  }
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    received += buffer.byteLength
    if (received > maxRequestBodyBytes) {
      res.writeHead(413, { connection: 'close' })
      res.end()
      req.destroy()
      return
    }
    chunks.push(buffer)
  }
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method ?? 'GET',
    headers: nodeHeadersToObject(req.headers),
    signal: abort.signal,
  }
  if (chunks.length > 0) {
    init.body = Buffer.concat(chunks)
    init.duplex = 'half'
  }
  const request = new Request(new URL(req.url ?? '/', 'http://dsh.internal'), init)
  const response = await apiHandler.fetch(request)
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  if (response.body === null) {
    res.end()
    return
  }
  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  } catch {
    res.destroy()
  }
}

export const API_PATH = '/api'
export const MUX_EVENTS_PATH = `${API_PATH}/events.mux`
export const HOST_EVENTS_PATH = `${API_PATH}/events.host`

export function rpcMethodFromUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  let pathname: string
  try {
    pathname = new URL(url, 'http://dsh.internal').pathname
  } catch {
    return undefined
  }
  if (pathname === MUX_EVENTS_PATH) return 'events.mux'
  if (pathname === HOST_EVENTS_PATH) return 'events.host'
  if (!pathname.startsWith(`${API_PATH}/`)) return undefined
  return pathname.slice(API_PATH.length + 1)
}
