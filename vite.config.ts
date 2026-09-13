import { defineConfig } from 'vite';

export default defineConfig({
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
