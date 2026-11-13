import { defineConfig } from 'vitest/config';
import { readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const sourceRoot = resolve(__dirname, 'src');
const sourceFiles = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => resolve(entry.parentPath, entry.name));
const unitTests = sourceFiles.filter(
  (file) => file.includes('/__test__/') && file.endsWith('.spec.ts'),
);

// A test named foo.spec.ts covers foo.ts or foo.<role>.ts within its parent area.
const coveredFiles = sourceFiles.filter((file) => {
  if (
    !file.endsWith('.ts') ||
    file.includes('/__test__/') ||
    file.includes('/generated/')
  )
    return false;
  return unitTests.some((test) => {
    const area = dirname(dirname(test));
    const stem = test.slice(test.lastIndexOf('/') + 1, -'.spec.ts'.length);
    const name = file.slice(file.lastIndexOf('/') + 1);
    return (
      file.startsWith(`${area}/`) &&
      (name === `${stem}.ts` || name.startsWith(`${stem}.`))
    );
  });
});

export default defineConfig({
  test: {
    include: ['src/**/__test__/**/*.spec.ts'],
    exclude: ['src/**/__test__/**/*.e2e-spec.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: coveredFiles.map((file) => relative(__dirname, file)),
      exclude: ['src/**/__test__/**', 'src/infrastructure/database/prisma/generated/**'],
      reportsDirectory: './coverage',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportOnFailure: true,
    },
  },
});
