// End-to-end flows of the Login against a fake API: each path of D12, D35 and D36.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  apiError,
  apiPath,
  currentEmployeeIs,
  fakeApi,
  recordingPost,
  SYNTHETIC_APPROVER,
  SYNTHETIC_TOKENS,
} from '../../test/fake-api.js';
import { renderApp } from '../../test/render-app.js';

const SYNTHETIC_EMPLOYEE = { employeeNumber: 1003, roles: ['empleado' as const], secondFactorVerified: false };
const OTPAUTH_URI = 'otpauth://totp/AMR%20Viajes:sintetico%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=AMR%20Viajes';
const RECOVERY_CODES = ['ABCD-EFGH-JKLM-NPQR', '7KQ2-MX4R-P9TW-ZB3N'];

async function enterCredentials() {
  await userEvent.type(screen.getByLabelText('Correo institucional'), 'sintetico@example.com');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-sintetica');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function typeAppCode(code: string) {
  await userEvent.click(screen.getByLabelText('Dígito 1 de 6'));
  await userEvent.keyboard(code);
}

describe('Login', () => {
  it('signs in an employee without an RN30 role straight away', async () => {
    const login = recordingPost('/auth/login', { step: 'authenticated', ...SYNTHETIC_TOKENS });
    fakeApi.use(login.handler, currentEmployeeIs(SYNTHETIC_EMPLOYEE));
    renderApp('/login');

    await enterCredentials();

    expect(await screen.findByRole('heading', { name: 'Hola, legajo 1003.' })).toBeInTheDocument();
    expect(login.bodies).toEqual([{ email: 'sintetico@example.com', password: 'clave-sintetica' }]);
  });

  it('shows why the password failed and stays on step 1', async () => {
    fakeApi.use(http.post(apiPath('/auth/login'), () => apiError(401, 'Correo o contraseña incorrectos')));
    renderApp('/login');

    await enterCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(screen.getByLabelText('Contraseña')).toBeInvalid();
  });

  it('asks an approver for the app code before signing in (RN30)', async () => {
    const verify = recordingPost('/auth/totp/verify', SYNTHETIC_TOKENS);
    fakeApi.use(
      http.post(apiPath('/auth/login'), () => Response.json({ step: 'totp_required', challengeToken: 'desafio' })),
      verify.handler,
      currentEmployeeIs(SYNTHETIC_APPROVER),
    );
    renderApp('/login');

    await enterCredentials();
    await screen.findByRole('heading', { name: 'Verificá que sos vos' });
    await typeAppCode('481920');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar e ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Hola, legajo 1002.' })).toBeInTheDocument();
    expect(verify.bodies).toEqual([{ challengeToken: 'desafio', code: '481920' }]);
  });

  it('keeps the verify button disabled until the six digits are in', async () => {
    fakeApi.use(http.post(apiPath('/auth/login'), () => Response.json({ step: 'totp_required', challengeToken: 'desafio' })));
    renderApp('/login');

    await enterCredentials();
    await screen.findByRole('heading', { name: 'Verificá que sos vos' });
    await typeAppCode('4819');

    expect(screen.getByRole('button', { name: 'Verificar e ingresar' })).toBeDisabled();
  });

  it('walks a first login through code, QR and recovery codes (D36)', async () => {
    const enroll = recordingPost('/auth/totp/enroll', { challengeToken: 'desafio-alta', otpauthUri: OTPAUTH_URI });
    fakeApi.use(
      http.post(apiPath('/auth/login'), () =>
        Response.json({ step: 'totp_enrollment_required', challengeToken: 'desafio' }),
      ),
      enroll.handler,
      http.post(apiPath('/auth/totp/verify'), () => Response.json({ ...SYNTHETIC_TOKENS, recoveryCodes: RECOVERY_CODES })),
      currentEmployeeIs(SYNTHETIC_APPROVER),
    );
    renderApp('/login');

    await enterCredentials();
    await userEvent.type(await screen.findByLabelText('Código de habilitación'), ' K7QM-2XRP-H5VC-QJ8E ');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('img', { name: 'Código QR para tu app de autenticación' })).toBeInTheDocument();
    await typeAppCode('209571');
    await userEvent.click(screen.getByRole('button', { name: 'Activar e ingresar' }));
    const codes = await screen.findByRole('list', { name: 'Códigos de recuperación' });

    expect(enroll.bodies).toEqual([{ challengeToken: 'desafio', enrollmentCode: 'K7QM-2XRP-H5VC-QJ8E' }]);
    expect(codes).toHaveTextContent('ABCD-EFGH-JKLM-NPQR');
  });

  it('enters after the recovery codes only once the person says they saved them', async () => {
    fakeApi.use(
      http.post(apiPath('/auth/login'), () =>
        Response.json({ step: 'totp_enrollment_required', challengeToken: 'desafio' }),
      ),
      http.post(apiPath('/auth/totp/enroll'), () => Response.json({ challengeToken: 'desafio-alta', otpauthUri: OTPAUTH_URI })),
      http.post(apiPath('/auth/totp/verify'), () => Response.json({ ...SYNTHETIC_TOKENS, recoveryCodes: RECOVERY_CODES })),
      currentEmployeeIs(SYNTHETIC_APPROVER),
    );
    renderApp('/login');
    await enterCredentials();
    await userEvent.type(await screen.findByLabelText('Código de habilitación'), 'K7QM-2XRP-H5VC-QJ8E');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('img', { name: 'Código QR para tu app de autenticación' });
    await typeAppCode('209571');
    await userEvent.click(screen.getByRole('button', { name: 'Activar e ingresar' }));
    const enter = await screen.findByRole('button', { name: 'Ingresar al panel' });

    expect(enter).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Los guardé en un lugar seguro'));
    await userEvent.click(enter);

    expect(await screen.findByRole('heading', { name: 'Hola, legajo 1002.' })).toBeInTheDocument();
  });

  it('lets a person without their phone in with a recovery code (D36)', async () => {
    const recover = recordingPost('/auth/totp/recover', SYNTHETIC_TOKENS);
    fakeApi.use(
      http.post(apiPath('/auth/login'), () => Response.json({ step: 'totp_required', challengeToken: 'desafio' })),
      recover.handler,
      currentEmployeeIs(SYNTHETIC_APPROVER),
    );
    renderApp('/login');

    await enterCredentials();
    await userEvent.click(await screen.findByRole('button', { name: 'Perdí mi celular' }));
    await userEvent.type(screen.getByLabelText('Código de recuperación'), 'ABCD-EFGH-JKLM-NPQR');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Hola, legajo 1002.' })).toBeInTheDocument();
    expect(recover.bodies).toEqual([{ challengeToken: 'desafio', recoveryCode: 'ABCD-EFGH-JKLM-NPQR' }]);
  });

  it('goes back to the password with a notice when the 5-minute challenge expired (D35)', async () => {
    fakeApi.use(
      http.post(apiPath('/auth/login'), () => Response.json({ step: 'totp_required', challengeToken: 'desafio' })),
      http.post(apiPath('/auth/totp/verify'), () => apiError(401, 'Desafío de segundo factor rechazado: jwt expired')),
    );
    renderApp('/login');

    await enterCredentials();
    await screen.findByRole('heading', { name: 'Verificá que sos vos' });
    await typeAppCode('481920');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar e ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Pasaron más de 5 minutos');
  });
});

describe('Session in the app', () => {
  it('sends a visitor without a session to /login', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('restores the session after a page reload with the stored refresh token', async () => {
    window.sessionStorage.setItem('amr-viajes.refresh-token', 'refresh-guardado');
    fakeApi.use(http.post(apiPath('/auth/refresh'), () => Response.json(SYNTHETIC_TOKENS)), currentEmployeeIs(SYNTHETIC_APPROVER));
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Hola, legajo 1002.' })).toBeInTheDocument();
  });

  it('closes the session in the API and returns to the login on sign out (D34)', async () => {
    window.sessionStorage.setItem('amr-viajes.refresh-token', 'refresh-guardado');
    const logout = recordingPost('/auth/logout', () => new Response(null, { status: 204 }));
    fakeApi.use(
      http.post(apiPath('/auth/refresh'), () => Response.json(SYNTHETIC_TOKENS)),
      currentEmployeeIs(SYNTHETIC_APPROVER),
      logout.handler,
    );
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(logout.bodies).toEqual([{ refreshToken: SYNTHETIC_TOKENS.refreshToken }]);
  });
});
