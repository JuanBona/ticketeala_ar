// Checks where the tokens live and how the JWT is renewed (D34).
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiError, apiPath, fakeApi, recordingPost, SYNTHETIC_TOKENS } from '../test/fake-api.js';
import { Session, SessionExpiredError } from './session.js';

const RENEWED_TOKENS = { accessToken: 'access-renovado', refreshToken: 'refresh-renovado', expiresInSeconds: 900 };

function sessionWithStoredRefresh(): Session {
  const session = new Session(window.sessionStorage);
  session.start(SYNTHETIC_TOKENS);
  return session;
}

describe('Session', () => {
  it('keeps the refresh token in sessionStorage and the JWT only in memory', () => {
    sessionWithStoredRefresh();

    const stored = Object.values({ ...window.sessionStorage });
    expect(stored).toContain(SYNTHETIC_TOKENS.refreshToken);
    expect(stored).not.toContain(SYNTHETIC_TOKENS.accessToken);
  });

  it('renews the JWT once and repeats the call when it expired', async () => {
    const refresh = recordingPost('/auth/refresh', RENEWED_TOKENS);
    fakeApi.use(
      refresh.handler,
      http.get(apiPath('/auth/me'), ({ request }) =>
        request.headers.get('Authorization') === 'Bearer access-renovado'
          ? HttpResponse.json({ ok: true })
          : apiError(401, 'JWT rechazado: jwt expired'),
      ),
    );
    const session = sessionWithStoredRefresh();

    const answer = await session.request('/auth/me', { method: 'GET' });

    expect(answer).toEqual({ ok: true });
    expect(refresh.bodies).toEqual([{ refreshToken: SYNTHETIC_TOKENS.refreshToken }]);
  });

  it('sends a single refresh when several calls need it at once', async () => {
    const refresh = recordingPost('/auth/refresh', RENEWED_TOKENS);
    fakeApi.use(refresh.handler);
    const session = new Session(window.sessionStorage);
    window.sessionStorage.setItem('amr-viajes.refresh-token', SYNTHETIC_TOKENS.refreshToken);

    await Promise.all([session.refresh(), session.refresh(), session.currentAccessToken()]);

    expect(refresh.bodies).toHaveLength(1);
  });

  it('forgets the session when the API rejects the refresh token', async () => {
    fakeApi.use(http.post(apiPath('/auth/refresh'), () => apiError(401, 'Refresh token desconocido')));
    const session = sessionWithStoredRefresh();

    await expect(session.refresh()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(session.hasStoredSession()).toBe(false);
  });
});
