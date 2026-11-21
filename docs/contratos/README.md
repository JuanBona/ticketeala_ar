# Contratos

- `api.openapi.yaml`: API ↔ web y móvil. Lo genera y mantiene el rol API y datos. **No se edita a
  mano**: sale de los controladores y DTO de `apps/api` con `npm run contract:api` (desde
  `apps/api`). Un test de integración falla si el archivo commiteado no coincide con el código.
  - Cada endpoint pide `Authorization: Bearer <accessToken>` salvo los que tienen `security: []`.
  - `x-roles` dice qué roles pueden llamarlo (cualquiera de ellos alcanza, RN29).
  - Las descripciones salen de los comentarios del código.
  - Para generar un cliente en web o móvil se puede usar cualquier generador de OpenAPI 3.0.
- `verifier.schema.json`: API ↔ verificador. Lo define el rol Motor en la iteración 0.

Cambiar un contrato = PR propio + aviso al equipo.
