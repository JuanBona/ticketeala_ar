# Ejemplos del contrato API ↔ verificador

Ejemplos de `docs/contratos/verifier.schema.json`. **Todos los datos son sintéticos**: comercios,
CUIT (30-11111111-8 y 30-22222222-9, con dígito verificador válido), CAE, montos, ubicaciones e ids
son inventados. Nada de esto es de la Mutual AMR.

| Archivo | Valida contra | Qué muestra |
|---|---|---|
| `pedido-cola.json` | `Pedido` | Mensaje de `verify.requests`: imagen por clave de almacenamiento, contexto completo, versión 2 de parámetros |
| `pedido-http.json` | `Pedido` | Parte `pedido` de `POST /verify`: imagen adjunta, tercer intento, sin origen ni ubicación, versión 1 de parámetros (S01 y S02 sin calibrar, D24) |
| `resultado-verificado.json` | `Resultado` | El ejemplo del punto 12.5: fecha fuera del viaje (S09, −25) y foto a 190 km (S10, −5) → 70 puntos → `revision` |
| `resultado-imagen-rechazada.json` | `Resultado` | Foto borrosa en un intento menor que N (D21): sin campos, puntaje ni decisión |
| `resultado-duplicado.json` | `Resultado` | Clave fiscal ya rendida en el gasto 87: solo S07, con los campos leídos y la respuesta del OCR (D28) |
| `resultado-error.json` | `Resultado` | El trabajo falló N veces en la cola (D23) |

La versión 2 de parámetros también es inventada: muestra cómo quedaría el pedido con S01 y S02
calibrados. El objeto `qr` sigue los nombres de campo del QR de ARCA; se confirman contra la
especificación oficial al implementar el parser.

Los tests de `services/verifier/tests/test_contract.py` validan estos archivos y sus variantes inválidas.
