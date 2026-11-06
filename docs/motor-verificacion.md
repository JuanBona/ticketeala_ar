# Motor de verificación de comprobantes

Fuente: punto 12.5 de `docs/fuente/etapa3.pdf` y UC-02, UC-05, UC-07 y UC-09.
Este archivo lo resume para programar; ante dudas, manda el PDF (salvo `docs/decisiones.md`).

## Etapas

1. **Preprocesamiento (S01).** Región del papel por color (clara y casi sin saturación). Sobre esa
   región en la foto original (o la foto entera si no hay papel) se miden nitidez = 100 × (1 −
   desenfoque de Crete et al., D40) e iluminación = brillo medio, antes de CLAHE y a 1000 px de
   lado largo (D29, D39). Si no pasan el umbral, se pide otra foto **sin llamar al OCR**; tras N
   rechazos se procesa igual (D21). Luego se corrige la perspectiva, solo si el papel no toca el
   borde y su cuadrilátero deja afuera como mucho el 2,5 % del papel (D39), y se aplica CLAHE a la
   imagen del OCR.
2. **Post-procesamiento fiscal.** Decodificar el QR fiscal y contrastarlo con el OCR. Dígito
   verificador del CUIT (módulo 11, pesos 5-4-3-2-7-6-5-4-3-2). CAE de 14 dígitos y vigente.
   Importes en formato argentino (punto de miles, coma decimal). En facturas A, la suma de los
   conceptos = total con tolerancia de un peso (D18).
3. **Duplicados.** Clave fiscal ya rendida (CUIT + tipo + punto de venta + número). dHash de 64 bits
   contra los comprobantes del mismo empleado de los últimos 12 meses; distancia de Hamming ≤ umbral
   = misma imagen o refotografía.
4. **Coherencia con el viaje.** Fecha dentro del viaje (±1 día). Distancia de la captura al trayecto
   origen–destino con haversine (D19). Monto contra el tope de la política según su unidad (D22) y
   contra lo habitual (Q3 + 1,5 × IQR).
5. **Puntaje y decisión** con explicación por señal.

## Catálogo de señales (versión inicial de parámetros)

| Código | Etapa | Regla | Peso | Bloqueante |
|---|---|---|---|---|
| S01 | 1 | Calidad de imagen sobre el umbral (control previo; sin imagen válida no hay verificación, salvo tras N rechazos, inicial 3: D21) | — | — |
| S02 | 2 | Confianza del OCR por campo sobre el umbral; los campos por debajo se marcan | 10 | No |
| S03 | 2 | QR coincide con OCR (CUIT, fecha, número, importe) | 25 | No |
| S04 | 2 | Dígito verificador del CUIT válido | 30 | Sí |
| S05 | 2 | CAE con formato válido y vigente a la fecha del comprobante | 15 | No |
| S06 | 2 | Factura A: total = neto gravado + no gravado + exento + IVA + otros tributos, ±1 peso; los ausentes cuentan 0. Si el OCR no lee los otros conceptos: total > neto + IVA → advertencia; total < neto + IVA → falla (D18) | 15 | No |
| S07 | 3 | Clave fiscal no rendida previamente | — | Sí* |
| S08 | 3 | Sin imagen similar (Hamming del dHash > 10) | 40 | No |
| S09 | 4 | Fecha dentro del viaje aprobado (±1 día) | 25 | No |
| S10 | 4 | En el trayecto, d(origen, captura) + d(captura, destino) ≤ k × d(origen, destino), k inicial 1,2 → OK. Si no, sobre la menor distancia de la captura al origen o al destino: ≤ 50 km OK; 50–300 km advertencia; > 300 km falla (D19) | 10 | No |
| S11 | 4 | Monto dentro del tope de la política: tope del tipo de gasto × cantidad según su unidad (por comprobante, por noche, por día; D26), convertido con el tipo de cambio si la moneda difiere (D22, D26) | 15 | No |
| S12 | 4 | Monto ≤ Q3 + 1,5 × IQR del historial de destino, categoría y tipo (solo con ≥ 20 gastos previos) | 10 | No |

S07*: es bloqueante y además la base lo impide con `ux_gasto_clave_fiscal` (D25).

Pesos, umbrales, bloqueo y activación **no van en el código**: se leen de la versión vigente de
`PARAMETRO_SENAL` (o de `services/verifier/config/parametros_v1.json` mientras no haya API).
Con la cola, la API los envía en cada trabajo junto con su versión (D23). También son parámetros
el factor k de S10 (D19) y la cantidad máxima de intentos de S01 (D21). Qué columna usa cada
señal: D29.

Señales que no aplican (`no_aplica`, penalización 0): S03 sin QR; S05 y S04 en comprobantes del
exterior; S06 si no es factura A; S10 sin ubicación (sin consentimiento); S11 sin tipo de cambio
cuando la moneda del comprobante difiere de la de la política (D22); S12 con menos de 20 gastos
previos en la moneda del comprobante (D30). También cualquier señal inactiva o sin un valor de
parámetro que usa (D29). Una bloqueante en `no_aplica` no bloquea (D20). Solo S06 y S10 dan
`advertencia` (D30).

## Puntaje y decisión

```
penalización_i = peso_i si falla · peso_i / 2 si advertencia · 0 si ok o no aplica
puntaje = max(0, 100 − Σ penalización_i)
```

Se evalúa en orden y gana la primera condición que se cumple (D20):

| # | Condición | Estado | Decisión |
|---|---|---|---|
| 1 | S01 no pasa y el intento es menor que N | `imagen_rechazada` | sin decisión (D21) |
| 2 | S07 en falla | `duplicado_rechazado` | sin decisión: la API rechaza el gasto con baja lógica (UC-02 7a, RN05, D25) |
| 3 | Otra bloqueante en falla | `verificado` | `alerta` |
| 4 | puntaje ≥ 80 | `verificado` | `aceptado` |
| 5 | 50 ≤ puntaje < 80 | `verificado` | `revision` |
| 6 | puntaje < 50 | `verificado` | `alerta` |

Imagen forzada (S01 no pasa en el intento N, D21): se procesa igual y la decisión es como mínimo
`revision`: si la tabla da `aceptado`, queda `revision`; si da `alerta`, queda `alerta`.

Cada señal devuelve `resultado`, `valor_observado`, `penalizacion` y `detalle` en lenguaje llano
(ej.: "La foto se tomó a 120 km del destino; si la sacaste al volver, podés ignorar este aviso").

## Contrato del servicio

`docs/contratos/verifier.schema.json` (D28), con ejemplos en `docs/contratos/ejemplos/verifier/`.

**Integración (D23).** La API publica en el stream de Redis `verify.requests` y el motor responde
en `verify.results`. Los reintentos se manejan con un consumer group; tras N fallos, el resultado
sale con estado `error`. `POST /verify` usa el mismo schema, con la imagen adjunta en lugar de la
clave del almacenamiento.

**Entrada** (`verify.requests`): `job_id`, `gasto_id`, clave de la imagen en el almacenamiento de
imágenes compatible con S3 (D17), número de intento (D21) y contexto: fechas del viaje, coordenadas del origen (D19) y del destino; tipo
de gasto elegido por el empleado (D27); moneda declarada por el empleado (D31); tope, unidad del
tope, cantidad, moneda de la política y tipo de cambio si la moneda difiere (D22, D26); ubicación
de captura si hay; dHash del empleado (12 meses) y claves fiscales de todos los gastos activos
(D28); historial para S12; valores de los parámetros con su versión (D23).

**Moneda del comprobante (D28, D31).** La del QR, convertida de código de ARCA a ISO 4217; sin QR,
la declarada. Así el resultado siempre trae moneda y `GASTO.moneda` nunca queda sin valor.

**Salida** (`verify.results`): `job_id`, `gasto_id`, `estado` y resultado según el estado (D21):

| Estado | Qué trae |
|---|---|
| `verificado` | Campos extraídos con confianza, QR decodificado, señales, puntaje, decisión, calidad de imagen, respuesta cruda del OCR |
| `imagen_rechazada` | Solo las métricas de calidad y un detalle para el empleado; sin puntaje ni decisión |
| `duplicado_rechazado` | S07 con su detalle y el gasto original; opcionales, los campos leídos y la respuesta cruda del OCR (D28); sin puntaje ni decisión |
| `error` | El trabajo falló N veces; sin resultado del motor |

El verificador **no accede a la base**: la API le pasa el contexto y persiste el resultado.

## Evaluación (UC-09, `EVALUACION_MOTOR` y `RESULTADO_CAMPO`)

Set: `data/eval/images` + `labels.csv` (genuinos) y `data/eval/manipulados` + `manipulados.csv`.

- **Exactitud por campo**: proporción de comprobantes con el campo correcto tras normalizar
  (fecha ISO, importe con dos decimales, CUIT sin guiones). Se calcula para **OCR solo** y para
  **el motor**.
- **Tasa de detección** (definición del documento): manipulados que terminaron en `revision` o
  `alerta` / total de manipulados.
- **Tasa de falsos positivos** (definición del documento): genuinos que terminaron en `alerta` /
  total de genuinos.
- **Genuinos en revisión**: genuinos que terminaron en `revision` / total de genuinos. Mide la
  fricción para el empleado, que la tasa de falsos positivos no cuenta.
- Además, para la consulta: matriz de confusión, **precisión** (de lo marcado, cuánto era
  manipulado) y **exhaustividad** (de lo manipulado, cuánto se marcó), y desglose por tipo de
  manipulación. Precisión y exactitud son métricas distintas: no usarlas como sinónimos.

Los números se reportan como salen, con el tamaño del set. Con ~50 comprobantes son orientativos.

## Limitaciones conocidas

- En comprobantes sin QR, una edición del importe solo la detectan S11 (tope) o S12 (lo habitual).
- El CAE se valida en formato y coherencia, sin consultar a ARCA.
- `claves_fiscales_previas` manda todas las claves fiscales activas en cada trabajo, así que el
  mensaje crece con el historial. Mejora futura: un set de Redis con las claves activas, que la API
  mantiene (alta al verificar, baja con la baja lógica) y el motor consulta con `SISMEMBER`, sin
  acceder a la base. `ux_gasto_clave_fiscal` sigue siendo la red final.

## Recalibración (UC-09)

Propone cambios de umbral a partir de `CORRECCION_COMPROBANTE` (ej.: campos que se corrigen con
confianza alta → subir el umbral de S02). La propuesta se evalúa sobre el set y solo se aplica si
Contaduría la aprueba, creando una nueva `VERSION_PARAMETROS`.
