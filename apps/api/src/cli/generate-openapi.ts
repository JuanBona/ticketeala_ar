// Console command (paso 6): writes docs/contratos/api.openapi.yaml from the controllers and DTOs.
// Usage, from apps/api:  npm run contract:api        (writes the file)
//                        npm run contract:api:check  (fails if the committed file is out of date)
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { dump } from 'js-yaml';
import { AppModule } from '../app.module.js';
import { PUBLIC_EXTENSION } from '../auth/decorators.js';

const CONTRACT_PATH = new URL(
  '../../../../docs/contratos/api.openapi.yaml',
  import.meta.url,
);
const CHECK_FLAG = '--check';

/** Builds the OpenAPI document from the decorators, without opening a port or touching the database. */
async function buildContract(): Promise<string> {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    const config = new DocumentBuilder()
      .setTitle('AMR Viajes API')
      .setDescription(
        'Contrato API ↔ web y móvil. Generado desde el código: no editar a mano.',
      )
      .setVersion('0.1.0')
      // Every endpoint asks for `Authorization: Bearer <accessToken>` unless marked @Public.
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    requireBearerExceptOnPublic(document);
    // noRefs: repeated objects are written out, never as YAML anchors the apps would have to resolve.
    return dump(document, { noRefs: true, lineWidth: -1 });
  } finally {
    await app.close();
  }
}

/**
 * D12: the global guard asks for a token everywhere except @Public. The contract says the same:
 * Bearer for the whole API, and an empty requirement on the operations marked public.
 */
function requireBearerExceptOnPublic(document: OpenAPIObject): void {
  document.security = [{ bearer: [] }];
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem) as Record<
      string,
      unknown
    >[]) {
      if (operation[PUBLIC_EXTENSION] === true) {
        operation.security = [];
        delete operation[PUBLIC_EXTENSION];
      }
    }
  }
}

async function main(): Promise<void> {
  const contract = await buildContract();
  if (!process.argv.includes(CHECK_FLAG)) {
    writeFileSync(CONTRACT_PATH, contract);
    console.log(`Contrato escrito en ${CONTRACT_PATH.pathname}`);
    return;
  }
  // Check mode: the committed file must match what the code produces today.
  if (readFileSync(CONTRACT_PATH, 'utf8') !== contract) {
    console.error(
      'docs/contratos/api.openapi.yaml está desactualizado: corré npm run contract:api',
    );
    process.exitCode = 1;
  }
}

await main();
