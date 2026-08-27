/** Ordinary API JWT participation. */
export type OrdinaryMode = 'off' | 'optional' | 'required';
/** Cordis / bundle config surface. */
export interface CordisConfig {
    cloudflare?: {
        teamDomain?: string | null;
        audiences?: string[];
    };
    auth?: {
        ordinary?: OrdinaryMode | string;
    };
}
/** Keys locked because the corresponding environment variable exists. */
export interface EnvLockedKeys {
    teamDomain: boolean;
    audiences: boolean;
    ordinary: boolean;
}
/** Runtime configuration after Env > Cordis > default merge. */
export interface PluginConfig {
    teamDomain: string | null;
    audiences: string[];
    ordinary: OrdinaryMode;
    envLocked: EnvLockedKeys;
}
export declare const ENV_TEAM_DOMAIN = "DSH_CF_ACCESS_TEAM_DOMAIN";
export declare const ENV_AUDIENCES = "DSH_CF_ACCESS_AUDIENCES";
export declare const ENV_ORDINARY_MODE = "DSH_CF_ACCESS_ORDINARY_MODE";
/**
 * Merge environment variables, Cordis config, and defaults.
 * An env var that exists (including empty string) locks that field.
 */
export declare function resolveConfig(cordis?: CordisConfig | undefined, env?: NodeJS.Dict<string>): PluginConfig;
/** Whether remote privileged APIs can be authorized (fail closed when false). */
export declare function isCloudflareConfigured(config: PluginConfig): boolean;
/** JWT issuer equals the configured team domain. */
export declare function issuerOf(config: PluginConfig): string | null;
/** JWKS URL derived from team domain. */
export declare function jwksUrlOf(config: PluginConfig): string | null;
//# sourceMappingURL=config.d.ts.map