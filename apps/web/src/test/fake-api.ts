// Fake API for tests (MSW): answers like apps/api would, with synthetic data.
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import type { EmployeeIdentity, TokenPair } from '../auth/auth-api.js';

export const fakeApi = setupServer();

/** Synthetic tokens: plain strings, the web never decodes the JWT. */
export const SYNTHETIC_TOKENS: TokenPair = {
  accessToken: 'access-token-sintetico',
  refreshToken: 'refresh-token-sintetico',
  expiresInSeconds: 900,
};

export const SYNTHETIC_APPROVER: EmployeeIdentity = {
  employeeNumber: 1002,
  roles: ['empleado', 'aprobador'],
  secondFactorVerified: true,
};

export const apiPath = (path: string) => `*/api${path}`;

/** NestJS error body, as the real API sends it. */
export function apiError(status: number, message: string) {
  return HttpResponse.json({ statusCode: status, message }, { status });
}

/** POST handler that records every body it receives, to assert what the screen sent. */
export function recordingPost(path: string, answer: JsonBodyType | (() => Response)) {
  const bodies: unknown[] = [];
  const handler = http.post(apiPath(path), async ({ request }) => {
    bodies.push(await request.json());
    return typeof answer === 'function' ? answer() : HttpResponse.json(answer);
  });
  return { handler, bodies };
}

export function currentEmployeeIs(employee: EmployeeIdentity) {
  return http.get(apiPath('/auth/me'), () => HttpResponse.json(employee));
}
