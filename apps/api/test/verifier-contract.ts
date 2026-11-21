// Test helper: validates values against docs/contratos/verifier.schema.json (the API <-> verifier contract, D28).
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCHEMA_PATH = resolve(
  process.cwd(),
  '../../docs/contratos/verifier.schema.json',
);

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8')));

const SCHEMA_ID = 'urn:amr-viajes:contratos:verifier';

/** Returns what is wrong with a verification request, or an empty list if it follows the contract. */
export function requestContractErrors(request: unknown): string[] {
  const validate = ajv.getSchema(`${SCHEMA_ID}#/$defs/Pedido`)!;
  if (validate(request)) {
    return [];
  }
  return (validate.errors ?? []).map(
    (error) => `${error.instancePath || '/'} ${error.message}`,
  );
}
