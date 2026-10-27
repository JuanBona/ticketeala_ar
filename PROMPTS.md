# Prompts para arrancar

Abrí Claude Code en la raíz del repo (`claude`) y pegá los prompts de tu rol de a uno. Esperá a que
termine cada uno, revisá el diff, corré los tests y commiteá antes de seguir. Si un paso propone
algo que contradice el documento o `docs/decisiones.md`, frená y consultalo con el equipo.

## Todos — día 1

1. > Leé CLAUDE.md, docs/decisiones.md y docs/plan-trabajo.md. Resumime en 10 líneas qué vamos a
   > construir, qué me toca según mi rol ([Motor | API y datos | Interfaces]) y qué dudas o
   > contradicciones ves entre el PDF y las decisiones.

## Motor — iteración 0 (prueba de concepto para la consulta)

1. > Leé services/verifier/CLAUDE.md y docs/motor-verificacion.md. Proponé la estructura del servicio
   > (módulos, interfaces, tests) y un borrador de docs/contratos/verifier.schema.json. Solo el plan.
2. > Creá el esqueleto: pyproject, FastAPI con GET /health, carga de parámetros desde
   > config/parametros_v1.json con los valores de la tabla de señales, pytest funcionando.
3. > Implementá S04, S05 y S06 y el parsing de importes en formato argentino, con tests de casos
   > válidos, inválidos y ambiguos.
4. > Implementá S01 (Laplaciano e histograma) y el preprocesamiento: perspectiva y CLAHE.
5. > Implementá la lectura del QR fiscal. Antes, buscá la especificación vigente en la documentación
   > oficial de ARCA y citala. Después S03 (QR contra OCR).
6. > Implementá la interfaz de OCR con el adaptador de Google Vision, uno falso que lee respuestas
   > grabadas, y S02.
7. > Implementá S07, S08 (dHash, Hamming), S09, S10 (haversine) y S11.
8. > Implementá el cálculo de puntaje y decisión del punto 12.5 y exponé POST /verify según el contrato.
9. > Escribí eval/run_eval.py según services/verifier/CLAUDE.md y corrélo sobre data/eval.
   > Mostrame la tabla de resultados tal como sale.

## API y datos — iteración 0 y 1

1. > Leé apps/api/CLAUDE.md y docs/modelo-datos.sql. Armá infra/docker-compose.yml con PostgreSQL 17,
   > Redis y SeaweedFS (S3, D17), y un README de cómo levantarlo.
2. > Creá apps/api con NestJS y Prisma. Traducí docs/modelo-datos.sql a schema.prisma y las
   > restricciones que Prisma no soporta a una migración SQL. Verificá que la migración corre.
3. > Escribí prisma/seed.ts con datos sintéticos: áreas, categorías, roles, 10 empleados con jerarquía,
   > 4 destinos con coordenadas, políticas versión 1 y parámetros del motor versión 1.
4. > Implementá auth: login con argon2, JWT corto + refresh, TOTP obligatorio para los roles de RN30,
   > guards por rol y el interceptor de auditoría. Con tests.
5. > Implementá UC-01 completo (leé su sección en docs/fuente/etapa3.pdf): validación de política,
   > viático estimado (RN04, D11), estado en_cotizacion, selección de cotización, regla jerárquica de
   > aprobador y suplente. Con tests por regla de negocio.
6. > Generá docs/contratos/api.openapi.yaml desde los decoradores y commitealo.

## Interfaces — iteración 0 y 1

1. > Leé apps/web/CLAUDE.md, apps/mobile/CLAUDE.md y docs/pantallas.md. Extraé los tokens de diseño
   > de design/html/[estilo]/ a un paquete compartido y mostrámelos.
2. > Creá apps/web con Vite y apps/mobile con Expo, ambos usando ese paquete de tokens. Construí los
   > componentes base y una página que los muestre todos.
3. > Construí Login (web) y Mobile-Login + Mobile-Consentimiento, contra un mock de la API.
4. > Construí el flujo de UC-01 en móvil (Mobile-Solicitud, Mobile-Viajes, Mobile-Aprobar) y la
   > bandeja de aprobación del panel web, contra el mock.
5. > Cuando exista docs/contratos/api.openapi.yaml, generá el cliente y reemplazá el mock por la API real.
