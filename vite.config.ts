import { defineConfig } from 'vite';

export default defineConfig({
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
