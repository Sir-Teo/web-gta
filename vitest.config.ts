import { defineConfig } from 'vitest/config';
// The transform cache persists module transforms across runs (they were 55% of a 4 s run, redone every time).
export default defineConfig({ test: { include: ['tests/*.test.ts'], fsModuleCache: true } });
