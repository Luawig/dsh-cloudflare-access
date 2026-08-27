export const ENV_TEAM_DOMAIN = 'DSH_CF_ACCESS_TEAM_DOMAIN';
export const ENV_AUDIENCES = 'DSH_CF_ACCESS_AUDIENCES';
export const ENV_ORDINARY_MODE = 'DSH_CF_ACCESS_ORDINARY_MODE';
const ORDINARY_MODES = new Set(['off', 'optional', 'required']);
function envPresent(env, name) {
    return Object.prototype.hasOwnProperty.call(env, name);
}
function normalizeTeamDomain(raw) {
    if (raw === undefined || raw === null)
        return null;
    const trimmed = raw.trim().replace(/\/+$/, '');
    return trimmed === '' ? null : trimmed;
}
function parseAudiences(raw) {
    if (raw === undefined)
        return [];
    const parts = typeof raw === 'string' ? raw.split(',') : [...raw];
    return parts.map(part => part.trim()).filter(part => part.length > 0);
}
function parseOrdinary(raw, source) {
    if (raw === undefined || raw.trim() === '')
        return 'off';
    const value = raw.trim();
    if (!ORDINARY_MODES.has(value)) {
        throw new Error(`${source} must be one of off | optional | required, got ${JSON.stringify(raw)}`);
    }
    return value;
}
/**
 * Merge environment variables, Cordis config, and defaults.
 * An env var that exists (including empty string) locks that field.
 */
export function resolveConfig(cordis = {}, env = process.env) {
    const teamLocked = envPresent(env, ENV_TEAM_DOMAIN);
    const audiencesLocked = envPresent(env, ENV_AUDIENCES);
    const ordinaryLocked = envPresent(env, ENV_ORDINARY_MODE);
    const teamDomain = teamLocked
        ? normalizeTeamDomain(env[ENV_TEAM_DOMAIN])
        : normalizeTeamDomain(cordis.cloudflare?.teamDomain);
    const audiences = audiencesLocked
        ? parseAudiences(env[ENV_AUDIENCES])
        : parseAudiences(cordis.cloudflare?.audiences);
    const ordinary = ordinaryLocked
        ? parseOrdinary(env[ENV_ORDINARY_MODE], ENV_ORDINARY_MODE)
        : parseOrdinary(cordis.auth?.ordinary, 'auth.ordinary');
    if (teamDomain !== null) {
        try {
            void new URL(teamDomain.includes('://') ? teamDomain : `https://${teamDomain}`);
        }
        catch {
            throw new Error(`cloudflare.teamDomain is not a valid URL: ${teamDomain}`);
        }
    }
    return {
        teamDomain,
        audiences,
        ordinary,
        envLocked: {
            teamDomain: teamLocked,
            audiences: audiencesLocked,
            ordinary: ordinaryLocked,
        },
    };
}
/** Whether remote privileged APIs can be authorized (fail closed when false). */
export function isCloudflareConfigured(config) {
    return config.teamDomain !== null && config.audiences.length > 0;
}
/** JWT issuer equals the configured team domain. */
export function issuerOf(config) {
    return config.teamDomain;
}
/** JWKS URL derived from team domain. */
export function jwksUrlOf(config) {
    if (config.teamDomain === null)
        return null;
    return `${config.teamDomain}/cdn-cgi/access/certs`;
}
//# sourceMappingURL=config.js.map