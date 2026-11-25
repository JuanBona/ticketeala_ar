// Turns an error of the /auth endpoints into a message for the person, by the step they are on.
import { ApiError } from '../../api/api-error.js';

export type LoginStage = 'credentials' | 'enrollmentCode' | 'totp' | 'recovery';

export interface LoginErrorMessage {
  message: string;
  /** The 5-minute challenge (D35) expired: the only way on is entering the password again. */
  mustRestart: boolean;
}

const UNAUTHORIZED = 401;
const TOO_MANY_REQUESTS = 429;
/** Prefix of the API message when the challenge token expired or was tampered with. */
const EXPIRED_CHALLENGE_PREFIX = 'Desafío de segundo factor';

const WRONG_VALUE_BY_STAGE: Record<LoginStage, string> = {
  credentials: 'Correo o contraseña incorrectos. Revisalos y probá de nuevo.',
  enrollmentCode: 'El código de habilitación no es válido, venció o ya se usó. Pedile uno nuevo a un Administrador.',
  totp: 'El código no es correcto o ya se usó. Esperá a que la app muestre el siguiente y probá de nuevo.',
  recovery: 'El código de recuperación no es válido o ya se usó.',
};

function message(text: string): LoginErrorMessage {
  return { message: text, mustRestart: false };
}

/** D34, D35, D36: the API messages carry technical details, so the screen shows its own text. */
export function describeLoginError(error: unknown, stage: LoginStage): LoginErrorMessage {
  if (!(error instanceof ApiError)) {
    return message('No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.');
  }
  if (error.status === TOO_MANY_REQUESTS) {
    return message('Demasiados intentos. Esperá un minuto y probá de nuevo.');
  }
  if (error.status === UNAUTHORIZED && error.message.startsWith(EXPIRED_CHALLENGE_PREFIX)) {
    return { message: 'Pasaron más de 5 minutos desde que ingresaste la contraseña. Volvé a ingresar.', mustRestart: true };
  }
  if (error.status === UNAUTHORIZED) {
    return message(WRONG_VALUE_BY_STAGE[stage]);
  }
  return message(`Algo falló en el servidor (error ${error.status}). Probá de nuevo en un momento.`);
}
