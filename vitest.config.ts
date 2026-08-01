import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'services/**/*.test.ts', 'app/**/*.test.ts'],
    // payrollService.test.ts to stary, ręcznie pisany skrypt asercji (bez describe/it,
    // martwy kod — patrz CLAUDE.md Faza 3). Nie jest suite'em Vitest → wyklucz.
    exclude: ['**/node_modules/**', 'services/payrollService.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
