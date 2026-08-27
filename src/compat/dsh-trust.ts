/**
 * DSH 0.1.0-rc.5 compatible Host/Origin fence copy.
 * Kept in compat so JWT core does not import DSH internals.
 * Source of truth in DSH: packages/client/connection/src/api-request-trust.ts
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function header(
  headers: { get(name: string): string | null } | Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (headers as { get(name: string): string | null }).get(name) ?? undefined
  }
  const value = (headers as Record<string, string | string[] | undefined>)[name]
    ?? (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function canonicalAuthority(entry: string, entryUrl: URL): string {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

export function isTrustedApiRequest(
  headers: { get(name: string): string | null } | Record<string, string | string[] | undefined>,
  trustedHosts: readonly string[],
): boolean {
  const host = header(headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

export function requestIsLoopback(
  headers: { get(name: string): string | null } | Record<string, string | string[] | undefined>,
): boolean {
  const host = header(headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  return hostUrl !== undefined && isLoopbackHostname(hostUrl.hostname)
}
