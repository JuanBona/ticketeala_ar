// Publisher of verification jobs on the Redis stream `verify.requests` (D23, UC-02 step 4).
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { VerifyRequest } from './verify-request-rules.js';

export const VERIFY_REQUESTS_STREAM = 'verify.requests';
/** The contract puts the JSON in this field of each stream entry. */
export const REQUEST_FIELD = 'pedido';
const DEFAULT_REDIS_PORT = '6379';

export interface RedisSettings {
  host: string;
  port: number;
  password: string;
}

/** Reads the Redis settings from the environment; names the missing variable if one is absent. */
export function readRedisSettings(
  environment: NodeJS.ProcessEnv,
): RedisSettings {
  const password = environment.REDIS_PASSWORD;
  if (!password) {
    throw new Error(
      'Falta REDIS_PASSWORD: copiá apps/api/.env.example a apps/api/.env',
    );
  }
  return {
    host: environment.REDIS_HOST ?? 'localhost',
    port: Number(environment.REDIS_PORT ?? DEFAULT_REDIS_PORT),
    password,
  };
}

@Injectable()
export class VerifyQueue {
  private connection: Redis | undefined;

  /** Adds the job to the stream; returns the id Redis gave the entry. Redis errors are the caller's to handle. */
  publish(request: VerifyRequest): Promise<string | null> {
    return this.connect().xadd(
      VERIFY_REQUESTS_STREAM,
      '*',
      REQUEST_FIELD,
      JSON.stringify(request),
    );
  }

  // Connects on first use, so the app (and tests that never upload) start without Redis settings.
  private connect(): Redis {
    this.connection ??= new Redis({
      ...readRedisSettings(process.env),
      maxRetriesPerRequest: 1,
    });
    return this.connection;
  }
}
