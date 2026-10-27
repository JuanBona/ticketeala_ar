# Plan de trabajo del prototipo

## Roles

Cada rol es dueño de una carpeta. Los demás pueden proponer cambios ahí, pero por PR y con
revisión del dueño. Así tres personas (y tres sesiones de Claude Code) no editan lo mismo a la vez.

| Rol | Carpetas | Responsable de |
|---|---|---|
| **Motor** | `services/verifier`, `data/eval` | Pipeline S01–S12, contrato `verifier.schema.json`, set de evaluación, métricas, historial sintético, UC-09 (cálculo) |
| **API y datos** | `apps/api`, `infra`, `docs/modelo-datos.sql` | Esquema y migraciones, autenticación y TOTP, roles, auditoría, cola, contrato `api.openapi.yaml`, semillas, lógica de UC-01, 03, 04, 05, 06, 07, 08 y 10 |
| **Interfaces** | `apps/web`, `apps/mobile`, `design` | Pantallas web y móvil a partir de `design/`, tableros de UC-08, cliente generado desde OpenAPI, servidor de prueba (mock) mientras la API no está |

Responsabilidades compartidas: tests de lo propio, revisión de PR ajenos, manual de usuario de las
pantallas que construye cada uno y la parte del documento que le toca.

## Iteraciones

| Iteración | Fechas | Objetivo | Entregable |
|---|---|---|---|
| 0 | 13/10 – 18/10 | Prueba de concepto del motor y repositorio listo | Consulta 19–21/10 con métricas |
| 1 | 22/10 – 04/11 | Base: esquema, login + roles + TOTP, maestros por semilla, UC-01 punta a punta en web y móvil, verificador detrás de la cola | Tercera entrega del documento (26/10) |
| 2 | 05/11 – 18/11 | UC-02 punta a punta (foto en la app → cola → motor → resultado explicado), UC-03, UC-07 políticas | Demo del circuito solicitud → cotización → comprobante |
| 3 | 19/11 – 02/12 | UC-04, UC-05, UC-06 y tableros de UC-08 | Demo del circuito completo hasta la conciliación |
| 4 | 03/12 – 13/12 | UC-09, parámetros de UC-07, auditoría completa, endurecimiento de seguridad, pruebas | Prototipo congelado |
| Cierre | 14/12 – 18/12 | Solo correcciones, manuales, video de demostración | **Entrega 18/12** |

### Iteración 0 en detalle (esta semana)

| Rol | Tareas |
|---|---|
| Todos (día 1) | Crear el repo, subir este kit, completar el estilo en `CLAUDE.md`, reunión de 30 min para aceptar `docs/decisiones.md`. Cada uno junta y fotografía ~17 comprobantes reales. |
| Motor | `PROMPTS.md` → bloque "Motor", pasos 1 a 9. |
| API y datos | `docker-compose` (PostgreSQL, Redis, MinIO), Prisma desde `modelo-datos.sql`, semillas sintéticas, primer borrador de `api.openapi.yaml`. Ayuda a etiquetar. |
| Interfaces | Etiquetar `labels.csv` y armar 15–20 manipulados. Esqueleto de `apps/web` y `apps/mobile`. Slides de la consulta según el guion. |

## Forma de trabajo

- **Repositorio**: GitHub, privado, los tres como colaboradores. `main` protegida: solo entra por PR
  con una aprobación y tests en verde.
- **Tareas**: un issue por tarea, etiquetado con su caso de uso (`UC-02`) y su rol. Tablero en
  GitHub Projects con columnas Pendiente · En curso · En revisión · Hecho.
- **Ramas**: `feat/uc02-s08-dhash`, `fix/uc01-aprobador-suplente`. Una tarea, una rama, un PR chico.
- **Contratos primero**: el lunes de cada iteración se acuerdan los cambios a `api.openapi.yaml` y
  `verifier.schema.json`. Interfaces trabaja contra el mock hasta que la API esté.
- **Ritmo**: planificación de 30 min al inicio de cada iteración; parte diario por WhatsApp (qué hice,
  qué hago, qué me bloquea); demo y retrospectiva al cierre, con una demo al referente si se puede.
- **Definición de terminado**: cumple el camino básico del caso de uso, tiene tests, pasa la revisión,
  respeta los contratos, no rompe la seguridad (roles y auditoría) y está mergeado en `main`.

## Claude Code en equipo

- Todos usan el mismo `CLAUDE.md` (está en el repo). Lo personal va en `CLAUDE.local.md`, que no se
  commitea.
- Cada carpeta tiene su `CLAUDE.md` con reglas propias; Claude lo carga al trabajar ahí.
- Pedí siempre un plan antes del código para tareas de más de un archivo, y revisá el diff antes de
  aceptar.
- Lo que Claude escribe lo firma quien hace el PR: tenés que poder explicarlo en la defensa.
- Si una sesión se desvía o se llena de contexto, empezá otra con `/clear` y una tarea más chica.
