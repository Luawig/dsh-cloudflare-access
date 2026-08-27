import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') {
  throw new Error('package.json dsh.bundle.patch must be ./cordis.patch.yml')
}
if (pkg.dsh?.client?.platform !== 'web' || pkg.dsh.client.immediately !== true) {
  throw new Error('dsh.client must be platform web and immediately true')
}
if (!pkg.dsh.client.inject?.includes('@deepseek-ai/dsh-client-connection')) {
  throw new Error('dsh.client.inject must include @deepseek-ai/dsh-client-connection')
}
if (pkg.exports?.['./client']?.default !== './lib/client.js') {
  throw new Error('exports["./client"] must point at the prebuilt browser factory')
}
if (pkg.exports?.['./cordis.patch.yml'] !== './cordis.patch.yml') {
  throw new Error('exports["./cordis.patch.yml"] must point at the bundle patch')
}
if (!pkg.keywords?.includes('dsh-plugin')) {
  throw new Error('keywords must include dsh-plugin for community catalogs')
}

const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
if (!client.includes('window.__ModuleLoader__.load')) {
  throw new Error('lib/client.js must be a Harness client factory bundle')
}
if (!client.includes(JSON.stringify(pkg.name))) {
  throw new Error(`lib/client.js factory id must be ${pkg.name}`)
}

const dir = mkdtempSync(join(tmpdir(), 'dsh-cloudflare-access-pack-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', dir], { cwd: root, stdio: 'inherit' })
  const tarball = readdirSync(dir).find((name) => name.endsWith('.tgz'))
  if (tarball === undefined) throw new Error('pnpm pack produced no tarball')
  const listing = execFileSync('tar', ['-tzf', join(dir, tarball)], { encoding: 'utf8' })
  const required = [
    'package/package.json',
    'package/README.md',
    'package/LICENSE',
    'package/cordis.patch.yml',
    'package/lib/index.js',
    'package/lib/client.js',
  ]
  for (const path of required) {
    if (!listing.split('\n').includes(path)) throw new Error(`npm pack missing ${path}`)
  }
  process.stdout.write(`pack ok ${tarball}\n`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
