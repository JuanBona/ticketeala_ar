// Unit tests: fast, no database. Integration tests use vitest.config.integration.ts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
