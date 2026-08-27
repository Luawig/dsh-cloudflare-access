export const inject = ['connection'];
export function apply(ctx) {
    const connection = (ctx.get('connection') ?? ctx.connection);
    const original = connection.isLoopback;
    Object.defineProperty(connection, 'isLoopback', {
        configurable: true,
        enumerable: true,
        get: () => true,
    });
    ctx.effect(() => () => {
        Object.defineProperty(connection, 'isLoopback', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: original,
        });
    }, 'dsh-cloudflare-access: restore connection.isLoopback');
}
//# sourceMappingURL=index.js.map