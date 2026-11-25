// Error thrown when the API answers with a status outside 2xx, with the status and the API's message.

/** Body NestJS sends with an error: message is a list when several validations fail. */
interface NestErrorBody {
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => ({}))) as NestErrorBody;
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
    return new ApiError(response.status, message ?? `Error ${response.status} en ${response.url}`);
  }
}
