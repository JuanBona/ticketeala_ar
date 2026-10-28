# apps/api — API de AMR Viajes

Monolito modular con NestJS, Prisma y PostgreSQL 17. Reglas del módulo en `CLAUDE.md`.

## Qué hay por ahora

- `prisma/schema.prisma`: el esquema de la base. Replica `docs/modelo-datos.sql` con **nombres en
  inglés** en el código; cada modelo y campo dice con `@map`/`@@map` cuál es su tabla o columna real
  en español (por ejemplo, `TravelRequest` → `solicitud_viaje`, `employeeNumber` → `legajo`).
- `prisma/migrations/`: la migración inicial. La generó Prisma y al final tiene, escritas a mano, las
  restricciones que Prisma no sabe expresar: 3 índices únicos parciales (D01, cotización
  seleccionada, S07) y 2 `CHECK` (fechas de la solicitud y puntaje 0–100).
- Migraciones posteriores con reglas escritas a mano: *triggers* que hacen inmutables las versiones
  de políticas y parámetros (de una política solo se puede cerrar `vigente_hasta`) y que dejan
  `registro_auditoria` en solo inserción; códigos ARCA en `tipo_comprobante` (D32) y nadie como su
  propio jefe o suplente (D33).
- `prisma/seed.ts` y `prisma/seed/`: la **semilla**, datos sintéticos para desarrollar (ver abajo).
- `src/prisma/`: `PrismaService`, la conexión a la base que usan todos los módulos.
- `test/`: tests de integración que corren contra el PostgreSQL de `infra/`.

## Primera vez

1. Levantá los servicios: ver `infra/README.md`.
2. Configurá y prepará la API:

   ```sh
   cd apps/api
   cp .env.example .env      # las contraseñas tienen que coincidir con infra/.env
   npx npm@11 ci             # instala exactamente las versiones del package-lock.json
   npx prisma migrate deploy # crea las tablas en la base de desarrollo
   npx prisma db seed        # carga los datos sintéticos
   ```

   Hace falta **npm 11** y **Node 22.22.3 o más nuevo** (ver "Detalles que conviene saber").

## Comandos

| Quiero… | Comando |
|---|---|
| Cargar los datos sintéticos | `npx prisma db seed` |
| Correr los tests de integración | `npm run test:integration` |
| Correr los tests unitarios | `npm test` |
| Levantar la API en modo desarrollo | `npm run start:dev` |
| Revisar estilo y errores comunes | `npm run lint` |
| Formatear el código | `npm run format` |
| Ver la base con una interfaz web | `npx prisma studio` |

Los tests de integración usan otra base (`TEST_DATABASE_URL`, por defecto `amr_viajes_test`) que se
crea sola y **se vacía en cada test**. Por eso se niegan a correr si apunta a la misma base que
`DATABASE_URL`.

## Semilla (datos sintéticos)

`npx prisma db seed` corre `prisma/seed.ts` sobre la base de `DATABASE_URL`. Todo es inventado y está
marcado: nombres con "(sintético)" y mails `@example.com`.

- **Organización**: los 7 roles de D07, las categorías Junior, Senior y Gerencial, 3 áreas con su
  gerente y 10 empleados con jefe y suplente (D15, D33). Laura Gómez (1001) es la cabeza de la
  jerarquía: es la única sin jefe. Todos entran con la contraseña de `SEED_PASSWORD` del `.env`
  (guardada con argon2) y sin segundo factor todavía (`totp_secret` vacío).
- **Viajes**: Rosario, Córdoba, Buenos Aires y Mendoza con coordenadas reales (S10), y la versión 1
  de la política para cada categoría y destino, con un tope por tipo de gasto (D26).
- **Motor**: la versión 1 de parámetros (80/50, 3 intentos de imagen, 3 reintentos de cola) y las
  12 señales con los pesos de `docs/motor-verificacion.md` y los umbrales de D24 y D29.

Se puede correr las veces que quieras: lo que ya existe no se duplica ni se pisa. Las políticas y
los parámetros son versiones inmutables, así que si la versión 1 ya está, la semilla no la toca.
Para cambiarlas se cierra la vigente y se crea otra versión, nunca editando la semilla.

## Cambiar el esquema

1. Primero se cambia `docs/modelo-datos.sql` (es la referencia) y después `prisma/schema.prisma`.
2. `npx prisma migrate dev --name que-cambia` genera y aplica la migración nueva.
3. Si el cambio incluye un índice parcial o un `CHECK`, usá `--create-only`, agregalo a mano al
   final del `migration.sql` y recién después corré `npx prisma migrate dev`.
4. Si agregás una columna obligatoria a una tabla que puede tener datos, dale un `DEFAULT` en la
   migración y quitáselo después (ver la migración de D24): sin eso, falla en la base de cualquiera
   que ya tenga filas.
5. Envolvé las migraciones editadas a mano en `BEGIN;` … `COMMIT;`: Prisma no usa transacción por
   defecto y, si algo falla a mitad de camino, la migración queda aplicada a medias.

## Detalles que conviene saber

- **Prisma 7** configura la conexión en `prisma.config.ts` y usa el adaptador `@prisma/adapter-pg`;
  muchos tutoriales de internet todavía muestran la forma vieja (`url` dentro de `schema.prisma`).
- El cliente de Prisma se genera en `src/generated/` al instalar (`postinstall`) y no se sube al repo.
- Las relaciones usan `onDelete: NoAction` como el SQL de referencia: nunca se borra en cascada ni se
  deja un dato huérfano en nulo (no se borran registros con historial).
- **npm 11 es obligatorio**: el npm 10 que trae Node 22 tiene un error interno al resolver este árbol
  de dependencias. `package.json` lo pide en `engines` y `.npmrc` tiene `engine-strict=true`, así que
  npm 10 se niega a instalar. Usá `npx npm@11 ci` para instalar y `npx npm@11 install <paquete>` para
  agregar una dependencia.
- **Node 22.22.3 o más nuevo**: con `engine-strict`, npm también hace cumplir lo que piden las
  dependencias, y `@nestjs/cli` pide esa versión. Si `npx npm@11 ci` dice `EBADENGINE` con
  `node`, actualizá Node 22.
- npm 11 no corre los scripts de instalación de las dependencias hasta que alguien los aprueba
  (`npm install-scripts`). La API no los necesita: `argon2` y `esbuild` traen sus binarios armados.
