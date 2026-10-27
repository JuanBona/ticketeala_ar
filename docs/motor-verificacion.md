# Motor de verificación de comprobantes

Fuente: punto 12.5 de `docs/fuente/etapa3.pdf` y UC-02, UC-05, UC-07 y UC-09.
Este archivo lo resume para programar; ante dudas, manda el PDF (salvo `docs/decisiones.md`).

## Etapas

1. **Preprocesamiento (S01).** Nitidez = varianza del Laplaciano; iluminación por histograma.
   Si no pasan el umbral, se pide otra foto **sin llamar al OCR**. Luego: contorno del comprobante,
   corrección de perspectiva y CLAHE.
2. **Post-procesamiento fiscal.** Decodificar el QR fiscal y contrastarlo con el OCR. Dígito
   verificador del CUIT (módulo 11, pesos 5-4-3-2-7-6-5-4-3-2). CAE de 14 dígitos y vigente.
   Importes en formato argentino (punto de miles, coma decimal). En facturas A, neto + IVA = total
   con tolerancia de un peso.
3. **Duplicados.** Clave fiscal ya rendida (CUIT + tipo + punto de venta + número). dHash de 64 bits
   contra los comprobantes del mismo empleado de los últimos 12 meses; distancia de Hamming ≤ umbral
   = misma imagen o refotografía.
4. **Coherencia con el viaje.** Fecha dentro del viaje (±1 día). Distancia captura–destino con
   haversine. Monto contra el tope de la política y contra lo habitual (Q3 + 1,5 × IQR).
5. **Puntaje y decisión** con explicación por señal.

## Catálogo de señales (versión inicial de parámetros)

| Código | Etapa | Regla | Peso | Bloqueante |
|---|---|---|---|---|
| S01 | 1 | Calidad de imagen sobre el umbral (control previo; sin imagen válida no hay verificación) | — | — |
| S02 | 2 | Confianza del OCR por campo sobre el umbral; los campos por debajo se marcan | 10 | No |
| S03 | 2 | QR coincide con OCR (CUIT, fecha, número, importe) | 25 | No |
| S04 | 2 | Dígito verificador del CUIT válido | 30 | Sí |
| S05 | 2 | CAE con formato válido y vigente a la fecha del comprobante | 15 | No |
| S06 | 2 | Neto + IVA = total (factura A), ±1 peso | 15 | No |
| S07 | 3 | Clave fiscal no rendida previamente | — | Sí* |
| S08 | 3 | Sin imagen similar (Hamming del dHash > 10) | 40 | No |
| S09 | 4 | Fecha dentro del viaje aprobado (±1 día) | 25 | No |
| S10 | 4 | Distancia captura–destino: ≤ 50 km OK; 50–300 km advertencia; > 300 km falla | 10 | No |
| S11 | 4 | Monto dentro del tope de la política | 15 | No |
| S12 | 4 | Monto ≤ Q3 + 1,5 × IQR del historial de destino, categoría y tipo (solo con ≥ 20 gastos previos) | 10 | No |

Pesos, umbrales, bloqueo y activación **no van en el código**: se leen de la versión vigente de
`PARAMETRO_SENAL` (o de `services/verifier/config/parametros_v1.json` mientras no haya API).

Señales que no aplican (`no_aplica`, penalización 0): S03 sin QR; S05 y S04 en comprobantes del
exterior; S06 si no es factura A; S10 sin ubicación (sin consentimiento); S12 con menos de 20 gastos previos.

## Puntaje y decisión

```
penalización_i = peso_i si falla · peso_i / 2 si advertencia · 0 si ok o no aplica
puntaje = max(0, 100 − Σ penalización_i)
```

| Condición | Decisión |
|---|---|
| puntaje ≥ 80 y ninguna bloqueante en falla | `aceptado` |
| 50 ≤ puntaje < 80 | `revision` |
| puntaje < 50 o alguna bloqueante en falla | `alerta` |

Cada señal devuelve `resultado`, `valor_observado`, `penalizacion` y `detalle` en lenguaje llano
(ej.: "La foto se tomó a 120 km del destino; si la sacaste al volver, podés ignorar este aviso").

## Contrato del servicio

`docs/contratos/verifier.schema.json` (a definir en la primera semana). Entrada: imagen + contexto
(fechas y destino del viaje, tope y moneda de la política, ubicación de captura si hay, dHash y claves
fiscales previas del empleado, historial para S12, versión de parámetros). Salida: campos extraídos con
confianza, QR decodificado, señales, puntaje, decisión, calidad de imagen, respuesta cruda del OCR.

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
- Además, para la consulta: matriz de confusión, **precisión** (de lo marcado, cuánto era
  manipulado) y **exhaustividad** (de lo manipulado, cuánto se marcó), y desglose por tipo de
  manipulación. Precisión y exactitud son métricas distintas: no usarlas como sinónimos.

Los números se reportan como salen, con el tamaño del set. Con ~50 comprobantes son orientativos.

## Recalibración (UC-09)

Propone cambios de umbral a partir de `CORRECCION_COMPROBANTE` (ej.: campos que se corrigen con
confianza alta → subir el umbral de S02). La propuesta se evalúa sobre el set y solo se aplica si
Contaduría la aprueba, creando una nueva `VERSION_PARAMETROS`.
