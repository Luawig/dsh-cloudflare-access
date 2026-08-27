/**
 * Browser capability enablement for DSH 0.1.0-rc.5.
 * Wraps connection.isLoopback so remote Settings try Host persistence.
 * Does not verify JWT or cookies. Server remains the authority.
 */
export interface ConnectionHandleLike {
  isLoopback: boolean
}

export interface ClientContextLike {
  connection: ConnectionHandleLike
  effect(callback: () => (() => void) | Promise<void>, name?: string): void
  get(name: string): unknown
}

export const inject = ['connection']

export function apply(ctx: ClientContextLike): void {
  const connection = (ctx.get('connection') ?? ctx.connection) as ConnectionHandleLike
  const original = connection.isLoopback
  Object.defineProperty(connection, 'isLoopback', {
    configurable: true,
    enumerable: true,
    get: () => true,
  })
  ctx.effect(() => () => {
    Object.defineProperty(connection, 'isLoopback', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: original,
    })
  }, 'dsh-cloudflare-access: restore connection.isLoopback')
}
