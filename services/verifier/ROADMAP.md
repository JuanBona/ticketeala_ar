# Hoja de ruta del verificador

Orden de los pasos del plan aprobado para `services/verifier`. Cada paso es una sesión, una rama
y un PR. Se habla de "Paso N", no de "PR N", para no confundirlo con los números de GitHub.
La última columna es el paso de la sección "Motor" de `PROMPTS.md` que cubre cada uno.

| Paso | Estado | Rama | Incluye | Paso de PROMPTS.md |
|---|---|---|---|---|
| 1 | Hecho (PR #6) | `feat/verifier-contract` | `docs/contratos/verifier.schema.json`, ejemplos sintéticos, tests del contrato, D27 a D30 | 1 |
| 1 (ajustes) | Hecho (PR #10) | `fix/verifier-contract-review` | Ajustes al contrato: techo de la nitidez, moneda declarada (D31), código de ARCA del tipo de comprobante (D32) | — |
| 2 | En curso | `feat/verifier-core` | Modelos del contrato, carga de parámetros con RN22, registro de señales (D29), puntaje y decisión (D20, D21, D37), `config/parametros_v1.json`, `GET /health` | 2, y la parte de puntaje y decisión del 8 |
| 3 | Pendiente | `feat/verifier-fiscal-checks` | Importes en formato argentino, dígito verificador del CUIT, S04, S05 y S06. Cumple el hito de la iteración 1 (el motor valida aritmética y CAE, 8/11) | 3 |
| 4 | Pendiente | `feat/verifier-image` | S01 (Laplaciano e histograma) y preprocesamiento: contorno, perspectiva y CLAHE | 4 |
| 5 | Pendiente | `feat/verifier-transport` | Pipeline, `POST /verify`, worker de Redis Streams, almacenamiento S3 y OCR falso. Destraba la integración con la API | La parte de `POST /verify` del 8 |
| 6 | Pendiente | `feat/verifier-ocr` | Adaptador de Google Vision, extracción de campos, QR fiscal (con la especificación de ARCA citada), S02 y S03 | 5 y 6 |
| 7 | Pendiente | `feat/verifier-duplicates-trip` | S07, dHash y S08, haversine, S09, S10, S11 y S12 | 7 (S12 no está en ningún prompt: viene del plan) |
| 8 | Pendiente | `feat/verifier-eval` | `eval/run_eval.py` y las métricas de UC-09 | 9 |

**Consecuencias del orden:**
- En el paso 5 todavía no hay extracción real. Por eso la interfaz de OCR y el adaptador falso
  entran en ese paso, y las respuestas grabadas traen los campos ya extraídos. En el paso 6 la
  extracción pasa a leer el texto real.
- Hasta que llegue su paso, cada señal no implementada da `no_aplica` con el detalle "Señal todavía
  no implementada". Así el resultado trae siempre las 12 señales y cumple el contrato. Esa regla se
  borra en el paso 7.

## Pendientes

- **Paso 4:** redondear la nitidez a dos decimales antes de devolverla. El contrato acepta hasta
  999999,99, pero un valor como 999999,996 pasa el schema y desborda `numeric(8,2)` al guardarlo.
- **Paso 6:** convertir la moneda del QR de ARCA (`PES`, `DOL`, …) a ISO 4217 (`ARS`, `USD`, …),
  como exige `campos.moneda` (D31).

**Propuestas a Juan Cruz, sin respuesta todavía:**
- **Claves fiscales en un hash de Redis.** Hoy `claves_fiscales_previas` manda todas las claves
  activas en cada trabajo, y el mensaje crece con el historial. La API mantendría el hash (alta al
  verificar, baja con la baja lógica): clave fiscal → `gasto_id`. El motor lo consultaría con `HGET`.
  - Hace falta un hash y no un set: el resultado necesita `duplicado_de`, y `SISMEMBER` solo dice
    si la clave existe.
  - `docs/motor-verificacion.md` todavía dice "set".
- **S11 con lo consumido del viaje.** Comparar contra el tope lo ya rendido en el viaje para ese tipo
  de gasto más este comprobante, no cada comprobante por separado. Así, la suma de los comprobantes
  de ese tipo no puede superar el tope del viaje sin que nadie lo vea.
