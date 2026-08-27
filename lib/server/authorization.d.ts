import type { AuthDecision } from './policy.ts';
import type { JwtFailureReason } from './types.ts';
export interface AuthHttpResult {
    status: 401 | 403;
    body: 'unauthorized' | 'forbidden';
}
export declare function httpStatusFor(decision: AuthDecision): AuthHttpResult | null;
export declare function logReason(reason: JwtFailureReason | 'host_origin_rejected' | null): string;
export interface PluginLogger {
    info(message: string): void;
    warn(message: string): void;
}
export declare function logBoot(logger: PluginLogger, input: {
    configured: boolean;
    audienceCount: number;
    ordinary: string;
    issuer: string | null;
}): void;
export declare function logDenied(logger: PluginLogger, input: {
    method: string | undefined;
    reason: JwtFailureReason | 'host_origin_rejected' | null;
    privileged: boolean;
}): void;
//# sourceMappingURL=authorization.d.ts.map