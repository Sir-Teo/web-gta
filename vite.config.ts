import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { useRapierWasmFile } from './scripts/rapierWasm.mjs';
import { serviceWorkerSource } from './scripts/serviceWorker.mjs';

/** The public files the game page loads itself: its manifest, icons, the menu's font and the touch buttons' widget art. */
const SHELL_PUBLIC = ['manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'fonts/UnifrakturCook-Bold.ttf', 'play/touch/widgets.png'];

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

/** Rapier's compat build carries its WebAssembly as a base64 string inside the JS (2.85 MB, 1.08 MB gzipped), which a
 * phone downloads, parses and decodes before compiling. The package ships the same module as rapier_wasm3d_bg.wasm, and
 * its loader takes a URL as readily as bytes: the build hands it the file's URL instead (0.76 MB gzipped, compiled as
 * it streams in, and kept compiled by the browser between visits), and the game page preloads it beside its scripts. */
const rapierWasmFile = (): Plugin => {
  let wasmFile: string | undefined, base = '/';
  return {
    name: 'rapier-wasm-file',
    apply: 'build',
    configResolved(config) { base = config.base; },
    transform(code, id) {
      const file = id.split('?')[0];
      if (!/[\\/]@dimforge[\\/]rapier3d-compat[\\/]dist[\\/]rapier\.mjs$/.test(file)) return;
      const wasm = join(dirname(file), 'rapier_wasm3d_bg.wasm');
      try { return { code: `import __rapierWasmUrl from ${JSON.stringify(`${wasm}?url`)};\n${useRapierWasmFile(code, readFileSync(wasm), '__rapierWasmUrl')}`, map: null }; }
      catch (error) { this.error(`${(error as Error).message} Revisit rapierWasmFile.`); }
    },
    generateBundle(_options, bundle) { wasmFile = Object.keys(bundle).find(file => /rapier_wasm3d_bg-[\w-]+\.wasm$/.test(file)); },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (!wasmFile || context.path !== '/index.html') return;
        // The loader's fetch() is a same-origin CORS request: the preload matches it, so the one download serves both.
        return [{ tag: 'link', attrs: { rel: 'preload', href: `${base}${wasmFile}`, as: 'fetch', type: 'application/wasm', crossorigin: '' }, injectTo: 'head' }];
      },
    },
  };
};

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [rapierWasmFile(), serviceWorker()],
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
