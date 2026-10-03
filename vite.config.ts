import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { serviceWorkerSource } from './scripts/serviceWorker.mjs';

/** The public files the game page loads itself: its manifest, icons and the menu's font. */
const SHELL_PUBLIC = ['manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'fonts/UnifrakturCook-Bold.ttf'];

/** sw.js with the game page's app shell: its HTML, the JS and CSS the game entry loads (statically or later, by import()),
 * the workers and SHELL_PUBLIC. The asset and model viewer pages' own chunks stay out. */
const serviceWorker = (): Plugin => {
  let publicDir = '', assetsDir = 'assets';
  return {
  name: 'game-service-worker',
  apply: 'build',
  configResolved(config) { publicDir = config.publicDir; assetsDir = config.build.assetsDir; },
  generateBundle(_options, bundle) {
    // One missing file fails the worker's whole install, so a renamed one fails the build instead.
    for (const file of SHELL_PUBLIC) if (!existsSync(join(publicDir, file))) this.error(`The service worker's shell names ${file}, which public/ does not have.`);
    const shell = new Set<string>(), visit = (file: string) => {
      const item = bundle[file];
      if (!item || shell.has(file)) return;
      shell.add(file);
      if (item.type !== 'chunk') return;
      for (const next of [...item.imports, ...item.dynamicImports, ...item.viteMetadata?.importedCss ?? [], ...item.viteMetadata?.importedAssets ?? []]) visit(next);
    };
    for (const item of Object.values(bundle)) if (item.type === 'chunk' && item.isEntry && item.name === 'game') visit(item.fileName);
    // Workers are emitted as assets the chunks reach by new URL(), not by import.
    for (const item of Object.values(bundle)) if (item.type === 'asset' && /\.worker-[\w-]+\.js$/.test(item.fileName)) shell.add(item.fileName);
    const urls = ['index.html', ...[...shell].filter(file => /\.(js|css|wasm)$/.test(file)).sort(), ...SHELL_PUBLIC];
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(urls, undefined, `${assetsDir}/`) });
  },
  };
};

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [serviceWorker()],
  // Playwright sets this only in its server process; avoid sharing optimizer state with the editor.
  cacheDir: process.env.PLAYWRIGHT_TEST ? 'node_modules/.vite-browser-tests' : 'node_modules/.vite',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { game: 'index.html', assets: 'assets.html', models: 'models.html' },
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'physics', test: /@dimforge\/rapier3d/ },
            { name: 'model-controls', test: /\/three\/examples\/jsm\/controls\/OrbitControls/, priority: 10 },
            { name: 'three', test: /\/three\// },
          ],
        },
      },
    },
  },
});
