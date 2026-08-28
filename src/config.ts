/** Ordinary API JWT participation. */
export type OrdinaryMode = 'off' | 'optional' | 'required'

/** Cordis / bundle config surface. */
export interface CordisConfig {
  cloudflare?: {
    teamDomain?: string | null
    audiences?: string[]
  }
  auth?: {
    ordinary?: OrdinaryMode | string
  }
}

/** Keys locked because the corresponding environment variable exists. */
export interface EnvLockedKeys {
  teamDomain: boolean
  audiences: boolean
  ordinary: boolean
}

/** Runtime configuration after Env > Cordis > default merge. */
export interface PluginConfig {
  teamDomain: string | null
  audiences: string[]
  ordinary: OrdinaryMode
  envLocked: EnvLockedKeys
}

export const ENV_TEAM_DOMAIN = 'DSH_CF_ACCESS_TEAM_DOMAIN'
export const ENV_AUDIENCES = 'DSH_CF_ACCESS_AUDIENCES'
export const ENV_ORDINARY_MODE = 'DSH_CF_ACCESS_ORDINARY_MODE'

const ORDINARY_MODES = new Set<OrdinaryMode>(['off', 'optional', 'required'])

function envPresent(env: NodeJS.Dict<string>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(env, name)
}

function normalizeTeamDomain(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new Error(`cloudflare.teamDomain is not a valid URL: ${trimmed}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`cloudflare.teamDomain is not a valid URL: ${trimmed}`)
  }
  return parsed.origin
}

function parseAudiences(raw: string | readonly string[] | undefined): string[] {
  if (raw === undefined) return []
  const parts = typeof raw === 'string' ? raw.split(',') : [...raw]
  return parts.map(part => part.trim()).filter(part => part.length > 0)
}

function parseOrdinary(raw: string | undefined, source: string): OrdinaryMode {
  if (raw === undefined || raw.trim() === '') return 'off'
  const value = raw.trim() as OrdinaryMode
  if (!ORDINARY_MODES.has(value)) {
    throw new Error(`${source} must be one of off | optional | required, got ${JSON.stringify(raw)}`)
  }
  return value
}

/**
 * Merge environment variables, Cordis config, and defaults.
 * An env var that exists (including empty string) locks that field.
 */
export function resolveConfig(
  cordis: CordisConfig | undefined = {},
  env: NodeJS.Dict<string> = process.env,
): PluginConfig {
  const teamLocked = envPresent(env, ENV_TEAM_DOMAIN)
  const audiencesLocked = envPresent(env, ENV_AUDIENCES)
  const ordinaryLocked = envPresent(env, ENV_ORDINARY_MODE)

  const teamDomain = teamLocked
    ? normalizeTeamDomain(env[ENV_TEAM_DOMAIN])
    : normalizeTeamDomain(cordis.cloudflare?.teamDomain)

  const audiences = audiencesLocked
    ? parseAudiences(env[ENV_AUDIENCES])
    : parseAudiences(cordis.cloudflare?.audiences)

  const ordinary = ordinaryLocked
    ? parseOrdinary(env[ENV_ORDINARY_MODE], ENV_ORDINARY_MODE)
    : parseOrdinary(cordis.auth?.ordinary, 'auth.ordinary')

  return {
    teamDomain,
    audiences,
    ordinary,
    envLocked: {
      teamDomain: teamLocked,
      audiences: audiencesLocked,
      ordinary: ordinaryLocked,
    },
  }
}

/** Whether remote privileged APIs can be authorized (fail closed when false). */
export function isCloudflareConfigured(config: PluginConfig): boolean {
  return config.teamDomain !== null && config.audiences.length > 0
}

/** JWT issuer equals the configured team domain. */
export function issuerOf(config: PluginConfig): string | null {
  return config.teamDomain
}

/** JWKS URL derived from team domain. */
export function jwksUrlOf(config: PluginConfig): string | null {
  if (config.teamDomain === null) return null
  return `${config.teamDomain}/cdn-cgi/access/certs`
}
