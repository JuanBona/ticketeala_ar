// What the tray says when a decision fails: someone else changed the request, or the API failed.
import { ApiError } from '../../api/api-error.js';

const FORBIDDEN = 403;
const CONFLICT = 409;

/** UC-01 9b and the single-UPDATE rule of the API: a cancelled or already decided request answers 409. */
export function describeDecisionError(error: unknown, requesterName: string): string {
  if (!(error instanceof ApiError)) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.';
  }
  if (error.status === CONFLICT) {
    return `La solicitud de ${requesterName} ya no está pendiente: la canceló o ya se decidió. Actualizamos la bandeja.`;
  }
  if (error.status === FORBIDDEN) {
    return `La solicitud de ${requesterName} ya no está asignada a vos. Actualizamos la bandeja.`;
  }
  return `Algo falló en el servidor (error ${error.status}). Probá de nuevo en un momento.`;
}
