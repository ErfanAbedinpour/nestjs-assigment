import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Shell variables take precedence; test-specific values take precedence over .env.
for (const file of ['.env.test', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e.spec.ts'],
    environment: 'node',
    reporters: ['verbose'],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
