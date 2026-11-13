import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__test__/**/*.spec.ts'],
    exclude: ['src/**/__test__/**/*.e2e-spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/infrastructure/database/prisma/generated/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
