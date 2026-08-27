/**
 * DSH 0.1.1-rc.2 (live-tested) server hook, researched against 0.1.0-rc.5:
 * wrap webServer.register before connection mounts /api, then apply JWT policy.
 * Isolated from JWT core.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { PluginConfig } from '../config.ts';
import { type PluginLogger } from '../server/authorization.ts';
import type { JwtVerifier } from '../server/cloudflare-jwt.ts';
import { type FetchHandler } from './http-bridge.ts';
export interface WebRoute {
    kind: 'exact' | 'prefix';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}
export interface WebUpgradeRoute {
    path: string;
    handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>;
}
export interface WebServerLike {
    register(route: WebRoute): () => void;
    registerUpgrade(route: WebUpgradeRoute): () => void;
}
export interface CompatContext {
    webServer: WebServerLike;
    logger?: PluginLogger;
    effect(callback: () => (() => void) | Promise<void>, name?: string): void;
    get(name: string): unknown;
}
export interface ServerCompatDeps {
    config: PluginConfig;
    verifier: JwtVerifier;
    getTrustedHosts: () => readonly string[];
    getApiFetchHandler: () => FetchHandler | undefined;
}
/**
 * Wrap webServer.register / registerUpgrade. Must run before connection apply.
 * Restores originals on dispose.
 */
export declare function installServerCompat(ctx: CompatContext, deps: ServerCompatDeps): void;
//# sourceMappingURL=dsh.d.ts.map