# Decisiones del equipo

Corrigen o completan el documento de Etapa 3 (`docs/fuente/etapa3.pdf`, versión del 13/10/2026).
Si una decisión contradice al PDF, **gana esta lista**. Cada decisión aceptada también hay que
llevarla al documento antes de la entrega.

Estado: **Propuesta** (falta acordar entre los tres) · **Aceptada** · **En el documento**.
D01–D16 aceptadas por el equipo el 27/10/2026. Falta pasarlas al documento antes de la entrega final.

## Afectan al código

| # | Decisión | Por qué | Sección del PDF | Estado |
|---|---|---|---|---|
| D01 | `POLITICA_GASTO` versionada: `version`, `vigente_desde`, `vigente_hasta`, `legajo_autor`. Editar = cerrar la vigente e insertar otra. `UNIQUE(id_categoria, id_destino)` pasa a índice único parcial `WHERE vigente_hasta IS NULL`. | Sin esto, la solicitud apunta a una fila editable y no hay snapshot de la política (R01). Los parámetros del motor ya son versionados; las políticas tienen que serlo igual. | 12.2 | Aceptada |
| D02 | `POLITICA_GASTO.viatico_diario` y `POLITICA_GASTO.moneda`. | UC-01 paso 5 calcula el viático "según la política aplicable", pero la política no tiene dónde guardarlo. | 12.2, UC-01 | Aceptada |
| D03 | `VIATICO.monto_estimado` (viático diario × noches, valor fijo al confirmar la solicitud). | UC-06 paso 2 muestra el "viático estimado" y no está en el modelo. | 12.2, UC-06 | Aceptada |
| D04 | `estado_solicitud` suma `en_cotizacion` (antes de `pendiente`). | UC-01 paso 6 y UC-03 usan "En cotización", que no está en el dominio. | 12.2, UC-01 | Aceptada |
| D05 | Se definen los dominios que el diccionario nombra pero no detalla: `origen_cotizacion` (agencia, externa), `decision_verificacion` (aceptado, revision, alerta), `resultado_senal` (ok, advertencia, falla, no_aplica), `estado_revision` (sin_revision, pendiente, resuelta), `origen_correccion` (empleado, contaduria). | Sin valores definidos no se puede crear el esquema. | 12.2 | Aceptada |
| D06 | `GASTO` suma `tipo_comprobante`, `punto_venta`, `numero_comprobante` (clave fiscal de S07), `neto` e `iva` (S06), `cae_vencimiento` (S05), `dhash` (S08), `moneda`, `tipo_cambio` e `id_fiscal_extranjero`; `cuit_proveedor` pasa a admitir nulo para comprobantes del exterior. | S05 a S08 y el contraste con el QR necesitan esos datos persistidos; los viajes internacionales no tienen CUIT. | 12.2, 12.5 | Aceptada |
| D07 | Roles: empleado, aprobador, agencia (el Asesor de AMR Turismo; UC-03 lo llama "rol Agencia"), contaduria, gerencia, administrador y auditor como rol de **solo lectura** (las pantallas lo usan). | El dominio de `ROL` lista cuatro, pero los casos de uso usan Agencia, Contaduría y Gerencia. | 12.2, 12.3 | Aceptada |
| D08 | La bandeja de UC-05 trabaja sobre `VERIFICACION_COMPROBANTE` (decisión `alerta`) y `SENAL_VERIFICACION`. `ALERTA_ANOMALIA` se elimina (decidido el 27/10; se descartó conservarla como bandeja). | Duplica lo que ya registra la verificación, y su nota ("solo reglas deterministas") describe el modelo viejo. | 12.2, UC-05 | Aceptada |
| D09 | Cola de trabajos: Redis Streams. Almacenamiento de imágenes: MinIO (compatible con S3). | 12.4 pide una cola con reintentos y un storage para las imágenes, sin elegir tecnología. | 12.4 | Aceptada |
| D10 | Tableros propios (React), no Power BI. | Evita la licencia y la integración; el prototipo ya los tiene diseñados. UC-08 lo deja como cuestión abierta. | 5.2, 5.4, UC-08 | Aceptada |
| D11 | Viático por **noche** hasta que la Mutual confirme. | Cuestión abierta: entre 24 y 27 hay 3 noches y 4 días. | UC-01 | Aceptada |
| D12 | Autenticación propia con JWT corto + refresh y TOTP para los roles de RN30 (el "OAuth2" de 12.4 se implementa como flujo de contraseña con tokens; sin proveedor externo). | No hay un proveedor de identidad de la Mutual definido. | 12.4 | Aceptada |
| D13 | Tabla `REGISTRO_AUDITORIA` (usuario, fecha, entidad, id, acción, valor anterior y nuevo en JSON). | RNF11 y 12.4 exigen un registro inmutable de operaciones críticas, pero no está en el modelo. | 12.2, 12.4 | Aceptada |
| D14 | `EMPLEADO` suma `activo` (baja lógica, RN28), `password_hash`, `totp_secret` y `consentimiento_ubicacion` con su fecha. | Necesarios para autenticación, segundo factor y Ley 25.326. | 12.2 | Aceptada |
| D15 | Jerarquía para elegir aprobador: `EMPLEADO.legajo_jefe` y `AREA.legajo_gerente`. Suplente: `EMPLEADO.legajo_suplente` hasta que la Mutual defina si es por persona o por puesto. | UC-01 deriva al aprobador "según la regla jerárquica", pero el modelo no guarda la jerarquía. | 12.2, UC-01 | Aceptada |
| D16 | Campos de soporte: `DESTINO.latitud/longitud` (S10), `COTIZACION.fuente` (UC-03 paso 7), `SOLICITUD_VIAJE.motivo_rechazo`, `RENDICION.observacion`, `GASTO.fecha_captura` (UC-02 paso 2), `VERIFICACION_COMPROBANTE.respuesta_ocr` y `datos_qr` (trazabilidad del motor). `SOLICITUD_VIAJE.legajo_aprobador` admite nulo hasta pasar a `pendiente`. | Los casos de uso usan estos datos y el diccionario no los tiene. | 12.2, 12.3, 12.5 | Aceptada |
| D17 | S06: total = neto gravado + no gravado + exento + IVA + otros tributos, ±1 peso; los conceptos ausentes cuentan 0. Si el OCR no lee los otros conceptos: total mayor que neto + IVA → `advertencia`; total menor → `falla`. | Muchas facturas A legítimas tienen percepciones, impuestos internos o exentos (ej.: combustible); con "neto + IVA = total" darían falla. | 12.5 | Propuesta |
| D18 | S10: la captura está "en el trayecto" si d(origen, captura) + d(captura, destino) ≤ k × d(origen, destino), con k en parámetros (inicial 1,2), y da `ok`. Si no, las bandas de 50 y 300 km se aplican a la menor de las distancias de la captura al origen y al destino. El contexto suma las coordenadas del origen. Sin coordenadas de origen, se usa solo la distancia al destino. | Un gasto en la ruta (combustible en un viaje Rosario–Córdoba en auto) daría falla siendo legítimo. | 12.5, D16 | Propuesta |
| D19 | Decisión: se evalúa en orden y gana la primera condición: (1) S01 no pasa y el intento es menor que N → estado `imagen_rechazada`, sin decisión (D20); (2) S07 en falla → estado `duplicado_rechazado`, sin decisión: la API rechaza el gasto y no lo registra (UC-02 7a, RN05); (3) otra bloqueante en falla → `alerta`; (4) puntaje ≥ 80 → `aceptado`, ≥ 50 → `revision`, < 50 → `alerta`. Una bloqueante en `no_aplica` no bloquea. | La tabla de 12.5 se superpone con puntaje entre 50 y 80 y una bloqueante en falla, y no distingue el duplicado fiscal, que UC-02 7a rechaza sin pasar por Contaduría (RN07). | 12.5, UC-02 | Propuesta |
| D20 | La respuesta del motor suma `estado`: `verificado`, `imagen_rechazada`, `duplicado_rechazado`, `error`. Con `imagen_rechazada` no hay puntaje ni decisión: solo las métricas de calidad y un detalle para el empleado. Con `duplicado_rechazado` no hay puntaje ni decisión: la respuesta trae S07 con su detalle. La API envía el número de intento; tras N rechazos (parámetro, inicial 3) el motor procesa igual y fuerza `revision` como mínimo: si D19 da `aceptado`, queda `revision`; si da `alerta`, queda `alerta`. | `decision_verificacion` (D05) no puede expresar "pedir otra foto" ni "duplicado rechazado". | 12.5, UC-02 (4a, 7a), D05 | Propuesta |
| D21 | S11: `POLITICA_GASTO` suma `tope_unidad` (`por_comprobante`, `por_noche`, `por_dia`). El contexto trae tope, unidad, cantidad y `tipo_cambio` si la moneda del comprobante difiere de la de la política. Sin tipo de cambio, S11 da `no_aplica`. | Una factura de hotel de varias noches contra un tope diario daría siempre falla, y los comprobantes del exterior (D06) no se comparan sin cotización. | 12.2, 12.5, D02, D06 | Propuesta |
| D22 | Integración API ↔ motor: streams de Redis `verify.requests` (`job_id`, `gasto_id`, clave de la imagen en MinIO, contexto y valores de los parámetros con su versión) y `verify.results` (`job_id`, `gasto_id`, estado y resultado). Reintentos con consumer group; tras N fallos, estado `error`. `POST /verify` usa el mismo schema con la imagen adjunta. | No está definido cómo recibe el motor el contexto ni cómo devuelve el resultado. | 12.4, 12.5, D09 | Propuesta |

## Solo del documento (no bloquean el código)

- Precio: los puntos 6.2 y 6.3 dicen USD 157.700 (hitos de 31.540, 23.655…), pero el contrato y el
  Gantt dicen USD 157.000 (hitos de 31.400, 23.550…). Además, la tabla del 6.2 no cierra: la licencia de
  BI subió a USD 1.600, pero la contingencia y el margen siguen calculados con los números anteriores.
  Propuesta: volver la licencia a USD 1.200 (o sacarla, ver D10) y dejar USD 157.000 en todo el documento.
- Punto 4: todavía dice "React Native o Flutter", "Node.js o Spring Boot" y "Power BI, Tableau o
  dashboards personalizados"; el 5.2 ya lo decidió.
- 12.1: falta la imagen del DER.
- La conclusión de la Etapa 3 está vacía.
- Carátula: falta Director y la titulación del tutor; el título no incluye la verificación de comprobantes.
