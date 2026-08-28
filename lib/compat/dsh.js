import { httpStatusFor, logDenied } from "../server/authorization.js";
import { decide, isPrivilegedMethod, jwtParticipates } from "../server/policy.js";
import { readAccessJwt } from "../server/types.js";
import { API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH, bridge, rpcMethodFromUrl, } from "./http-bridge.js";
import { isTrustedApiRequest, requestIsLoopback } from "./dsh-trust.js";
function nodeHeaders(req) {
    return req.headers;
}
async function jwtFor(req, verifier) {
    return verifier.verify(nodeHeaders(req));
}
function writeAuth(res, status, body) {
    res.writeHead(status);
    res.end(body);
}
function rejectUpgrade(socket, status) {
    const reason = status === 401 ? 'Unauthorized' : 'Forbidden';
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
}
function isApiPrefix(route) {
    return route.kind === 'prefix' && route.path === API_PATH;
}
function isApiUpgrade(route) {
    return route.path === MUX_EVENTS_PATH || route.path === HOST_EVENTS_PATH;
}
/**
 * Wrap webServer.register / registerUpgrade. Must run before connection apply.
 * Restores originals on dispose.
 */
export function installServerCompat(ctx, deps) {
    const originalRegister = ctx.webServer.register;
    const originalRegisterUpgrade = ctx.webServer.registerUpgrade;
    const logger = ctx.logger ?? { info() { }, warn() { } };
    ctx.webServer.register = (route) => {
        if (!isApiPrefix(route))
            return originalRegister.call(ctx.webServer, route);
        const inner = route.handler;
        return originalRegister.call(ctx.webServer, {
            ...route,
            handler: async (req, res) => {
                await handleApi(req, res, inner, deps, logger);
            },
        });
    };
    ctx.webServer.registerUpgrade = (route) => {
        if (!isApiUpgrade(route))
            return originalRegisterUpgrade.call(ctx.webServer, route);
        const inner = route.handler;
        return originalRegisterUpgrade.call(ctx.webServer, {
            ...route,
            handler: (req, socket, head) => handleUpgrade(req, socket, head, inner, deps, logger),
        });
    };
    ctx.effect(() => () => {
        ctx.webServer.register = originalRegister;
        ctx.webServer.registerUpgrade = originalRegisterUpgrade;
    }, 'dsh-cloudflare-access: restore webServer.register');
}
async function handleApi(req, res, inner, deps, logger) {
    const headers = nodeHeaders(req);
    const trustedHosts = deps.getTrustedHosts();
    if (requestIsLoopback(headers)) {
        await inner(req, res);
        return;
    }
    const hostOriginTrusted = isTrustedApiRequest(headers, trustedHosts);
    if (!hostOriginTrusted) {
        await inner(req, res);
        return;
    }
    const method = rpcMethodFromUrl(req.url);
    const token = readAccessJwt(headers);
    const tokenPresent = token !== undefined && token.trim() !== '';
    if (!jwtParticipates({ method, ordinary: deps.config.ordinary, tokenPresent })) {
        await inner(req, res);
        return;
    }
    const jwt = await jwtFor(req, deps.verifier);
    const decision = decide({
        isLoopback: false,
        hostOriginTrusted: true,
        method,
        ordinary: deps.config.ordinary,
        jwt,
    });
    if (decision.effect === 'deny') {
        const http = httpStatusFor(decision);
        logDenied(logger, { method, reason: decision.reason, privileged: decision.class === 'privileged' });
        if (http !== null)
            writeAuth(res, http.status, http.body);
        else
            await inner(req, res);
        return;
    }
    if (isPrivilegedMethod(method)) {
        const api = deps.getApiFetchHandler();
        if (api === undefined) {
            logDenied(logger, { method, reason: 'unconfigured', privileged: true });
            writeAuth(res, 403, 'forbidden');
            return;
        }
        await bridge(req, res, api);
        return;
    }
    await inner(req, res);
}
async function handleUpgrade(req, socket, head, inner, deps, logger) {
    const headers = nodeHeaders(req);
    const trustedHosts = deps.getTrustedHosts();
    if (requestIsLoopback(headers)) {
        await inner(req, socket, head);
        return;
    }
    const hostOriginTrusted = isTrustedApiRequest(headers, trustedHosts);
    if (!hostOriginTrusted) {
        await inner(req, socket, head);
        return;
    }
    const method = rpcMethodFromUrl(req.url);
    const token = readAccessJwt(headers);
    const tokenPresent = token !== undefined && token.trim() !== '';
    if (!jwtParticipates({ method, ordinary: deps.config.ordinary, tokenPresent })) {
        await inner(req, socket, head);
        return;
    }
    const jwt = await jwtFor(req, deps.verifier);
    const decision = decide({
        isLoopback: false,
        hostOriginTrusted: true,
        method,
        ordinary: deps.config.ordinary,
        jwt,
    });
    if (decision.effect === 'deny') {
        logDenied(logger, { method, reason: decision.reason, privileged: false });
        const http = httpStatusFor(decision);
        rejectUpgrade(socket, http?.status ?? 401);
        return;
    }
    await inner(req, socket, head);
}
//# sourceMappingURL=dsh.js.map