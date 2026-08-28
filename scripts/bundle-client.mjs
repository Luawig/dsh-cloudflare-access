import { rmSync } from 'node:fs'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(root, '..')
const id = 'dsh-cloudflare-access'

await build({
  absWorkingDir: packageRoot,
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  logLevel: 'info',
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
})

// tsc also emits lib/client/index.js; the runtime export is the esbuild factory.
rmSync(join(packageRoot, 'lib/client/index.js'), { force: true })
rmSync(join(packageRoot, 'lib/client/index.js.map'), { force: true })

