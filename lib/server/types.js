export const JWT_HEADER = 'cf-access-jwt-assertion';
export function readAccessJwt(headers) {
    if (headers instanceof Headers) {
        return headers.get(JWT_HEADER) ?? headers.get('Cf-Access-Jwt-Assertion') ?? undefined;
    }
    const direct = headers[JWT_HEADER] ?? headers['Cf-Access-Jwt-Assertion'];
    if (typeof direct === 'string')
        return direct;
    if (Array.isArray(direct) && typeof direct[0] === 'string')
        return direct[0];
    return undefined;
}
//# sourceMappingURL=types.js.map