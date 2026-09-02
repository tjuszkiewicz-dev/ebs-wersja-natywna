import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'services/**/*.test.ts', 'app/**/*.test.ts', 'utils/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
