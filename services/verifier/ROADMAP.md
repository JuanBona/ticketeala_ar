# Hoja de ruta del verificador

Orden de los pasos del plan aprobado para `services/verifier`. Cada paso es una sesión, una rama
y un PR. Se habla de "Paso N", no de "PR N", para no confundirlo con los números de GitHub.
La última columna es el paso de la sección "Motor" de `PROMPTS.md` que cubre cada uno.

| Paso | Estado | Rama | Incluye | Paso de PROMPTS.md |
|---|---|---|---|---|
| 1 | Hecho (PR #6) | `feat/verifier-contract` | `docs/contratos/verifier.schema.json`, ejemplos sintéticos, tests del contrato, D27 a D30 | 1 |
| 1 (ajustes) | Hecho (PR #10) | `fix/verifier-contract-review` | Ajustes al contrato: techo de la nitidez, moneda declarada (D31), código de ARCA del tipo de comprobante (D32) | — |
| 2 | Hecho (PR #15) | `feat/verifier-core` | Modelos del contrato, carga de parámetros con RN22, registro de señales (D29), puntaje y decisión (D20, D21, D37), `config/parametros_v1.json`, `GET /health` | 2, y la parte de puntaje y decisión del 8 |
| 3 | Hecho (PR #17) | `feat/verifier-fiscal-checks` | Importes en formato argentino, dígito verificador del CUIT, S04, S05 y S06. Cumple el hito de la iteración 1 (el motor valida aritmética y CAE, 8/11) | 3 |
| 4 | Hecho (PR #18) | `feat/verifier-image` | S01 (nitidez de Crete y brillo medio sobre la región del papel, D39 y D40) y preprocesamiento: papel por color, perspectiva y CLAHE; `tools/inspect_images.py` para calibrar | 4 |
| 4 (ajustes) | Hecho (PR #19) | `fix/verifier-contract-sharpness` | Contrato a la nitidez de Crete (D40): descripción y techo 100 de `nitidez`, ejemplos, comentario de `calidad_imagen` | — |
| 5 | Hecho (PR #20) | `feat/verifier-transport` | Pipeline, `POST /verify`, worker de Redis Streams, almacenamiento S3 y OCR falso. Destraba la integración con la API | La parte de `POST /verify` del 8 |
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

- **S01 sigue sin umbral (calibración del 25/11/2026):** con 57 fotos (43 legibles, 12 ilegibles
  por movimiento), ninguna medida de nitidez separa las dos clases. La actual queda en −13,03 puntos
  de margen, la medida solo cerca del texto en −7,69 y la de trazos finos a 1000 px, la más cercana,
  en −2,05. Tampoco hay fotos ilegibles por falta de luz para fijar el brillo mínimo. `umbral` y
  `umbral_advertencia` siguen nulos (D24), y S01 da `no_aplica` (D29). Detalle, tabla y cómo
  repetirlo en [`data/eval/calibracion-s01.md`](../../data/eval/calibracion-s01.md).
  - Se revisa en el paso 8 con más fotos. Si una medida separa con al menos 2 puntos de margen, va
    en una rama aparte con una decisión que modifique D39 y D40; después Juan Cruz carga los
    umbrales en una versión nueva de parámetros (D24).
  - Para el brillo mínimo hacen falta fotos oscuras que no se lean.
- **Paso 6/8:** recalibrar S01 usando como criterio si Google Vision extrae bien los campos (las
  facturas sintéticas tienen el JSON con los valores correctos), en lugar del juicio a ojo.
  Candidata: la variante de trazos de
  [`data/eval/calibracion-s01.md`](../../data/eval/calibracion-s01.md). Si se cambia la medida,
  revisar D39 y D40.
- **Detección del papel en facturas A4:** el mínimo de 3 % de tinta queda justo con poco texto, y
  una foto movida lo pierde (04900_movida y 08792_movida, 2,9 %); con mesa blanca, el papel y la
  mesa forman una sola región; los pliegues se toman como tinta. Ver
  [`data/eval/calibracion-s01.md`](../../data/eval/calibracion-s01.md).
- **S01 no detecta falta de resolución:** en boleto-lejos el papel ocupa el 17 % de la foto y el
  CUIT casi no se lee, pero la nitidez da como legible (al llevar el papel a 1000 px se pierde esa
  información). Boleto-angulo también es ilegible: el papel ocupa el 41 % de la foto, pero por la
  perspectiva el CUIT queda chico y lejos. Un mínimo de tamaño del papel no alcanza. Primero, en
  el paso 6, ver si S02 (confianza del OCR por campo) atrapa estos casos; si no, evaluar en la
  iteración 3 un control del tamaño del texto en píxeles.
- **Paso 6:** convertir la moneda del QR de ARCA (`PES`, `DOL`, …) a ISO 4217 (`ARS`, `USD`, …),
  como exige `campos.moneda` (D31).
- **Paso 6:** leer la orientación del texto que devuelve Google Vision. El paso 4 no gira las fotos
  sacadas de costado: nitidez y brillo no cambian con la rotación, y saber si girar 90° o 270°
  requiere leer el texto.
- **Paso 6:** OCR caído con QR legible (UC-02 5a, D30): seguir con los datos del QR y dejar S02 en
  falla. En el paso 5 no hay QR, así que un OCR caído siempre se reintenta y tras N entregas da
  `error`.
- **Paso 6:** un tiempo máximo para la llamada al OCR real; si se pasa, `OcrUnavailableError`.
- **Paso 6:** QR que no es de ARCA (las facturas sintéticas apuntan a surus.lat): ignorarlo para los
  campos y decidir si S03 da `no_aplica` o `advertencia`. Hoy D30 solo permite `advertencia` en S06
  y S10, así que elegir `advertencia` requiere cambiar D30.
- **Paso 6:** hoy una foto ilegible puede salir aceptada, porque S01 y S02 están sin umbral (D24)
  y, si el OCR no lee los campos, S04 a S06 dan `no_aplica`, así que nada resta puntos. Cerrarlo de
  dos formas: calibrar S01 y S02 con Vision, y además una regla que no dependa de umbrales: si
  faltan campos clave (total, fecha o CUIT del emisor), la decisión es como mínimo revisión. Esa
  regla necesita una decisión nueva.
- **Paso 7:** calcular el dHash de S08 sobre la imagen ya orientada: una refoto girada cambia el hash
  y no se detectaría como similar.
- **Credenciales de S3 de solo lectura para el motor (D23):** hoy usa las mismas que la API
  (`S3_ACCESS_KEY` de `infra/.env`). El motor solo baja fotos y no debería poder escribirlas ni
  borrarlas.

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
