// HTTP settings shared by main.ts and the integration tests, so tests run the same app as production.
import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  // Rejects unknown fields instead of silently passing them on to services (never trust the client).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
