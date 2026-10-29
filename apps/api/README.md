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
- `src/auth/`: el ingreso (D12, D34). Ver "Autenticación" más abajo.
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

## Autenticación

Cómo entra alguien a la API (D12, D34, D35):

1. `POST /auth/login` con `email` y `password`. La contraseña se compara con el hash argon2 de la
   base. La respuesta trae `step`, que dice qué sigue:
   - `authenticated`: listo. Trae dos **tokens** (cadenas de texto que prueban quién sos):
     - `accessToken`: un **JWT** que dura 15 minutos. Va en cada pedido, en el encabezado
       `Authorization: Bearer <accessToken>`.
     - `refreshToken`: dura 7 días y sirve solo para pedir un par nuevo.
   - `totp_required`: la persona tiene rol aprobador, contaduria o administrador (RN30) y tiene que
     mandar el código de 6 dígitos de su app (Google Authenticator u otra). Trae un
     `challengeToken` (desafío) que vale 5 minutos y no abre ningún endpoint.
   - `totp_enrollment_required`: todavía no configuró el TOTP. Necesita el **código de
     habilitación** que le entrega en persona un Administrador (ver abajo).
2. Solo la primera vez: `POST /auth/totp/enroll` con `challengeToken` y `enrollmentCode` devuelve un
   `challengeToken` nuevo y `otpauthUri`, el link que la web o la app convierten en el QR.
3. `POST /auth/totp/verify` con `challengeToken` y `code` devuelve los tokens. En la primera vez,
   ese código además confirma el alta: se guarda el secreto (cifrado), se gasta el código de
   habilitación y la respuesta trae `recoveryCodes`, 8 **códigos de recuperación** que se muestran
   esa única vez.
4. Si perdió el celular: `POST /auth/totp/recover` con `challengeToken` y uno de sus códigos de
   recuperación. Cada código sirve una sola vez.
5. Cuando el JWT vence, `POST /auth/refresh` con `refreshToken` devuelve un par nuevo. El refresh
   viejo deja de servir (**rotación**). Si alguien usa uno viejo, la API supone que lo robaron y
   cierra toda esa sesión.
6. `POST /auth/logout` con `refreshToken` cierra la sesión.
7. `GET /auth/me` devuelve el legajo, los roles y si la sesión pasó el segundo factor.

Reglas para quien programe endpoints:

- **Todo endpoint pide JWT** salvo los marcados `@Public()`. No hace falta agregar nada para
  protegerlo: el guard es global.
- `@Roles('contaduria', 'aprobador')` limita el endpoint a quien tenga alguno de esos roles (RN29).
  Quien tiene un rol de RN30 siempre llega con el segundo factor verificado: el guard rechaza
  cualquier otro token.
- `@CurrentEmployee()` da el legajo y los roles de quien llama. Nunca tomes el legajo del body.
- El login admite 10 intentos por minuto por correo y 30 por IP, contados por separado; el código
  TOTP, 5 por minuto por empleado. El siguiente responde 429.
- Un mismo código TOTP no sirve dos veces, aunque siga dentro de sus 30 segundos.
- Variables del `.env`: `JWT_SECRET` firma los JWT (al menos 32 caracteres; generalo con
  `openssl rand -base64 48`) y `TOTP_ENCRYPTION_KEY` cifra los secretos TOTP (32 bytes en base64;
  `openssl rand -base64 32`). Sin ellas, la API no arranca. **Si cambiás `TOTP_ENCRYPTION_KEY`,
  los secretos guardados ya no se pueden leer** y cada persona tiene que darse de alta de nuevo.
- En la base solo queda el hash SHA-256 de cada refresh, en `sesion_refresh`.

### Códigos de habilitación (D36)

- Un Administrador emite uno con `POST /auth/totp/enrollment-codes` y `{ "employeeNumber": 1002 }`.
  Sirve para la primera vez y para cuando alguien pierde el celular: **reinicia** el segundo factor
  (borra el secreto, anula los códigos viejos y cierra todas las sesiones de esa persona).
- Vence a las 24 horas y sirve una sola vez. Nadie puede emitirse uno a sí mismo.
- El primer Administrador no tiene a quién pedírselo: se emite por consola.

  ```sh
  npm run auth:enrollment-code -- 1010
  ```

- Los códigos se ven una sola vez: en la base queda solo su hash, en `codigo_segundo_factor`.

## Auditoría

`registro_auditoria` guarda quién cambió qué registro, cuándo, y el valor anterior y el nuevo
(D13, RNF11). La base solo permite agregar filas: nunca se editan ni se borran.

Para auditar un endpoint (aprobaciones, correcciones, cambios de políticas y parámetros):

```ts
@Audited({ entity: 'politica_gasto', action: 'cerrar_version' })
@Post(':id/cerrar')
async close(@Param('id') id: string): Promise<AuditedChange<PolicyResponse>> {
  const before = …; const after = …;
  return auditedChange({ entityId: id, previousValue: before, newValue: after, response: after });
}
```

- El **interceptor** (`AuditInterceptor`, global) espera a que el endpoint termine bien, guarda la
  fila con el legajo del JWT y responde al cliente solo `response`.
- Si el endpoint falla, no se guarda nada. Si un endpoint `@Audited` se olvida de `auditedChange()`,
  responde 500 para que el error se vea en los tests.
- La fila se escribe **después** de la operación, no en la misma transacción. Si justo falla esa
  escritura, el cambio queda hecho sin su registro. Para lo más delicado (como el segundo factor)
  se usa `AuditService.record(entrada, transacción)`, que escribe en la misma transacción.

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
- Para probar la API con `tsx` u otra herramienta basada en esbuild, compilá antes con
  `npm run build`: esbuild no guarda los tipos de los constructores que Nest usa para inyectar
  dependencias. `npm run start:dev` ya compila con `nest`.
- npm 11 no corre los scripts de instalación de las dependencias hasta que alguien los aprueba
  (`npm install-scripts`). La API no los necesita: `argon2` y `esbuild` traen sus binarios armados.
