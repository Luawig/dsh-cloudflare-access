/**
 * node:http → Fetch bridge for privileged bypass onto apiProxy.
 * Isolated in compat; not DSH-specific authorization.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const DEFAULT_MAX_REQUEST_BODY_BYTES: number;
export interface FetchHandler {
    fetch(request: Request): Promise<Response>;
}
export declare function bridge(req: IncomingMessage, res: ServerResponse, apiHandler: FetchHandler, maxRequestBodyBytes?: number): Promise<void>;
export declare const API_PATH = "/api";
export declare const MUX_EVENTS_PATH = "/api/events.mux";
export declare const HOST_EVENTS_PATH = "/api/events.host";
export declare function rpcMethodFromUrl(url: string | undefined): string | undefined;
//# sourceMappingURL=http-bridge.d.ts.map