import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Git / npm dependency installs should use committed lib/.
 * A checkout of this repository still builds when TypeScript and esbuild exist.
 *
 * @param {{
 *   initCwd: string | undefined,
 *   packageRoot: string,
 *   hasLib: boolean,
 *   hasBuildTools: boolean,
 * }} input
 * @returns {'build' | 'skip' | 'fail'}
 */
export function prepareAction(input) {
  if (!input.hasLib && !input.hasBuildTools) return 'fail'
  if (!input.hasBuildTools) return 'skip'
  const initCwd = input.initCwd === undefined || input.initCwd === ''
    ? input.packageRoot
    : resolve(input.initCwd)
  const ownInstall = initCwd === resolve(input.packageRoot)
  if (!ownInstall && input.hasLib) return 'skip'
  return 'build'
}

function hasBuildTools() {
  const required = createRequire(import.meta.url)
  try {
    required.resolve('typescript/package.json')
    required.resolve('esbuild/package.json')
    return true
  } catch {
    return false
  }
}

function hasRuntimeArtifacts() {
  return existsSync(join(packageRoot, 'lib/index.js'))
    && existsSync(join(packageRoot, 'lib/client.js'))
}

function isDirectRun() {
  const entry = process.argv[1]
  if (entry === undefined) return false
  return resolve(entry) === fileURLToPath(import.meta.url)
}

if (isDirectRun()) {
  const action = prepareAction({
    initCwd: process.env.INIT_CWD,
    packageRoot,
    hasLib: hasRuntimeArtifacts(),
    hasBuildTools: hasBuildTools(),
  })
  if (action === 'skip') process.exit(0)
  if (action === 'fail') {
    process.stderr.write('dsh-cloudflare-access: lib/ is missing and TypeScript/esbuild are not installed\n')
    process.exit(1)
  }
  const npmExec = process.env.npm_execpath
  const result = npmExec === undefined
    ? spawnSync('pnpm', ['run', 'build'], { cwd: packageRoot, stdio: 'inherit' })
    : spawnSync(process.execPath, [npmExec, 'run', 'build'], { cwd: packageRoot, stdio: 'inherit' })
  process.exit(result.status === null ? 1 : result.status)
}
