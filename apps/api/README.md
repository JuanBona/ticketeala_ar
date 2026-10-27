# apps/api — API de AMR Viajes

Monolito modular con NestJS, Prisma y PostgreSQL 17. Reglas del módulo en `CLAUDE.md`.

## Qué hay por ahora

- `prisma/schema.prisma`: el esquema de la base. Replica `docs/modelo-datos.sql` con **nombres en
  inglés** en el código; cada modelo y campo dice con `@map`/`@@map` cuál es su tabla o columna real
  en español (por ejemplo, `TravelRequest` → `solicitud_viaje`, `employeeNumber` → `legajo`).
- `prisma/migrations/`: la migración inicial. La generó Prisma y al final tiene, escritas a mano, las
  restricciones que Prisma no sabe expresar: 3 índices únicos parciales (D01, cotización
  seleccionada, S07) y 2 `CHECK` (fechas de la solicitud y puntaje 0–100).
- `src/prisma/`: `PrismaService`, la conexión a la base que usan todos los módulos.
- `test/`: tests de integración que corren contra el PostgreSQL de `infra/`.

## Primera vez

1. Levantá los servicios: ver `infra/README.md`.
2. Configurá y prepará la API:

   ```sh
   cd apps/api
   cp .env.example .env      # las contraseñas tienen que coincidir con infra/.env
   npm ci                    # instala exactamente las versiones del package-lock.json
   npx prisma migrate deploy # crea las tablas en la base de desarrollo
   ```

## Comandos

| Quiero… | Comando |
|---|---|
| Correr los tests de integración | `npm run test:integration` |
| Correr los tests unitarios | `npm test` |
| Levantar la API en modo desarrollo | `npm run start:dev` |
| Revisar estilo y errores comunes | `npm run lint` |
| Formatear el código | `npm run format` |
| Ver la base con una interfaz web | `npx prisma studio` |

Los tests de integración usan otra base (`TEST_DATABASE_URL`, por defecto `amr_viajes_test`) que se
crea sola y **se vacía en cada test**. Por eso se niegan a correr si apunta a la misma base que
`DATABASE_URL`.

## Cambiar el esquema

1. Primero se cambia `docs/modelo-datos.sql` (es la referencia) y después `prisma/schema.prisma`.
2. `npx prisma migrate dev --name que-cambia` genera y aplica la migración nueva.
3. Si el cambio incluye un índice parcial o un `CHECK`, usá `--create-only`, agregalo a mano al
   final del `migration.sql` y recién después corré `npx prisma migrate dev`.

## Detalles que conviene saber

- **Prisma 7** configura la conexión en `prisma.config.ts` y usa el adaptador `@prisma/adapter-pg`;
  muchos tutoriales de internet todavía muestran la forma vieja (`url` dentro de `schema.prisma`).
- El cliente de Prisma se genera en `src/generated/` al instalar (`postinstall`) y no se sube al repo.
- Las relaciones usan `onDelete: NoAction` como el SQL de referencia: nunca se borra en cascada ni se
  deja un dato huérfano en nulo (no se borran registros con historial).
- **Para agregar una dependencia usá `npx npm@11 install <paquete>`**: el npm 10 que trae Node 22
  tiene un error interno al resolver este árbol de dependencias. `npm ci` anda con cualquiera.
