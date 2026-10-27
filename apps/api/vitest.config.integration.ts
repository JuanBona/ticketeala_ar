// Integration tests: run against the real PostgreSQL from infra/, on the database in TEST_DATABASE_URL.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.integration-spec.ts'],
    globalSetup: ['./test/prepare-test-database.ts'],
    fileParallelism: false,
  },
});
