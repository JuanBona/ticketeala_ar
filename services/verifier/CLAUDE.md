# services/verifier — motor de verificación

Dueño: rol Motor. Especificación: `docs/motor-verificacion.md` y punto 12.5 del PDF.

- Python 3.12, FastAPI, OpenCV, pyzbar, imagehash, pandas, pytest. Dependencias en `pyproject.toml`.
- Una señal = un módulo con una función pura y sus tests (`signals/s08_dhash.py`, `tests/test_s08_dhash.py`).
  Cada señal devuelve `resultado`, `valor_observado`, `penalizacion` y `detalle` en español llano.
- Pesos, umbrales y bloqueo se leen de la versión de parámetros recibida; nunca constantes en el código.
- El servicio no accede a PostgreSQL. Recibe imagen + contexto y devuelve el resultado
  (`docs/contratos/verifier.schema.json`). Consume trabajos de Redis Streams y expone `POST /verify`
  para pruebas.
- El proveedor de OCR va detrás de una interfaz (`ocr/base.py`) con adaptadores Google Vision y
  AWS Textract, y un adaptador falso que lee respuestas grabadas, para tests sin red ni costo.
- Guardar la respuesta cruda del OCR en el resultado.
- Antes de codificar el formato del QR fiscal, buscar la especificación vigente en la documentación
  oficial de ARCA y citarla en un comentario.
- `eval/run_eval.py` produce `eval/out/metricas.md` y `metricas.csv`: exactitud por campo (OCR solo y
  motor), tasa de detección y de falsos positivos (definiciones del documento), matriz de confusión,
  precisión y exhaustividad, desglose por tipo de manipulación y tamaño del set.
- El historial para S12 se genera con `eval/generar_historial_sintetico.py`, con una columna
  `origen = 'sintetico'`.
