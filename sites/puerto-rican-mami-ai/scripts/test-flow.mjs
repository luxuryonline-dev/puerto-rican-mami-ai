import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(site, '.preview/test-flow');
await build({
  configFile: false, root: site, logLevel: 'warn',
  resolve: { alias: {
    '~': path.join(site, 'src'),
    'cloudflare:workers': path.join(site, 'tests/support/local-worker.ts'),
  } },
  ssr: { noExternal: true },
  build: { target: 'node24', ssr: path.join(site, 'tests/flow.test.ts'), outDir, emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'flow.mjs' } } },
});
const result = spawnSync(process.execPath, ['--test', path.join(outDir, 'flow.mjs')], { cwd: site, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
