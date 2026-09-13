import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks(id) {
        if (id.includes('@dimforge/rapier3d')) return 'physics';
        if (id.includes('/three/')) return 'three';
      } },
    },
  },
});
