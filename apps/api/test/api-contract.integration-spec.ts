// The committed API contract (docs/contratos/api.openapi.yaml) must match what the code generates today.
import { execFileSync } from 'node:child_process';

const BUILD_AND_GENERATE_TIMEOUT_MILLISECONDS = 120_000;

describe('API contract', () => {
  it(
    'docs/contratos/api.openapi.yaml is up to date with the controllers and DTOs',
    () => {
      // Exits with an error (and the test fails) when the file differs: run npm run contract:api.
      const run = () =>
        execFileSync('npm', ['run', '-s', 'contract:api:check'], {
          stdio: 'pipe',
        });

      expect(run).not.toThrow();
    },
    BUILD_AND_GENERATE_TIMEOUT_MILLISECONDS,
  );
});
