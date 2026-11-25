// Writes tokens.css from the TypeScript tokens; run with `npm run build:css` after changing a token.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildTokensCss } from '../src/css-variables.js';

const outputPath = fileURLToPath(new URL('../tokens.css', import.meta.url));
writeFileSync(outputPath, buildTokensCss());
console.log(`Tokens escritos en ${outputPath}`);
