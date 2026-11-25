// Checks the messages the Login shows for each API error (D34, D35, D36).
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/api-error.js';
import { describeLoginError } from './login-errors.js';

describe('describeLoginError', () => {
  it('asks to wait a minute after too many attempts (429)', () => {
    const described = describeLoginError(new ApiError(429, 'Demasiados intentos'), 'totp');

    expect(described.message).toBe('Demasiados intentos. Esperá un minuto y probá de nuevo.');
  });

  it('sends back to the password when the 5-minute challenge expired (D35)', () => {
    const expired = new ApiError(401, 'Desafío de segundo factor rechazado: jwt expired');

    expect(describeLoginError(expired, 'totp').mustRestart).toBe(true);
  });

  it('does not reveal whether the email exists on a wrong password', () => {
    const described = describeLoginError(new ApiError(401, 'Correo o contraseña incorrectos'), 'credentials');

    expect(described).toEqual({ message: 'Correo o contraseña incorrectos. Revisalos y probá de nuevo.', mustRestart: false });
  });

  it('hides the employee number the API puts in a wrong enrollment code message', () => {
    const wrongCode = new ApiError(401, 'Código de habilitación inválido, vencido o ya usado para el empleado 1002');

    expect(describeLoginError(wrongCode, 'enrollmentCode').message).not.toContain('1002');
  });

  it('explains a network failure without an API status', () => {
    const described = describeLoginError(new TypeError('Failed to fetch'), 'credentials');

    expect(described.message).toContain('No pudimos conectar con el servidor');
  });
});
