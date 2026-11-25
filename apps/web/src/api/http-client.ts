// Minimal JSON client for the API; in development Vite forwards /api to apps/api (vite.config.ts).
import { ApiError } from './api-error.js';

export const API_BASE_PATH = '/api';

const NO_CONTENT = 204;

export interface JsonRequest {
  method: 'GET' | 'POST';
  body?: unknown;
  /** JWT of the session, sent as `Authorization: Bearer …` (D12). */
  accessToken?: string;
}

function buildHeaders(request: JsonRequest): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  if (request.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (request.accessToken !== undefined) {
    headers.set('Authorization', `Bearer ${request.accessToken}`);
  }
  return headers;
}

/** Sends the request and returns the parsed JSON; throws ApiError for any status outside 2xx. */
export async function requestJson<ResponseBody>(path: string, request: JsonRequest): Promise<ResponseBody> {
  // Absolute URL on the page's own origin: Vite forwards it in development, and Node's fetch in tests needs it.
  const response = await fetch(new URL(`${API_BASE_PATH}${path}`, window.location.origin), {
    method: request.method,
    headers: buildHeaders(request),
    body: request.body === undefined ? null : JSON.stringify(request.body),
  });
  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }
  if (response.status === NO_CONTENT) {
    return undefined as ResponseBody;
  }
  return (await response.json()) as ResponseBody;
}
