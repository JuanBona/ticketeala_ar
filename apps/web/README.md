# apps/web — panel web de AMR Viajes

React + TypeScript + Vite. Estilo alto-contraste con los tokens de `design/tokens`. Reglas en `CLAUDE.md`.

## Qué hay por ahora

- **Login** (`/login`): contraseña y, para los roles de RN30 (aprobador, contaduría, administrador),
  el segundo paso con el código de la app de autenticación (D35). Incluye el **primer ingreso**
  (código de habilitación → QR → códigos de recuperación, D36) y **"Perdí mi celular"** (código de
  recuperación).
- **Bandeja de aprobación** (`/aprobaciones`, rol aprobador, UC-01 pasos 12, 13 y 12a): quién pide,
  el viaje, la cotización elegida contra el tope, las justificaciones de 4a y 9a, y aprobar o
  rechazar con motivo.
- **Marco del panel**: barra lateral con las pantallas que el rol puede abrir (las demás no se
  muestran), la persona que entró y "Cerrar sesión". En `/` cada rol va a su primera pantalla; el
  Panel de UC-08 llega en la iteración 3.

## Primera vez

1. Levantá la API (ver `apps/api/README.md`).
2. En esta carpeta:

   ```sh
   npm install
   npm run dev        # http://localhost:5173
   ```

Vite reenvía todo lo que empieza con `/api` a la API en `http://localhost:3000` (cambiala con la
variable `API_URL`). Para el navegador es el mismo servidor, así que la API no necesita CORS.

Para probar el segundo factor con la semilla: el Administrador emite un código de habilitación
(`npm run auth:enrollment-code -- 1008` en `apps/api`), y el QR se escanea con cualquier app de
autenticación (Google Authenticator, Microsoft Authenticator, Authy…). No hay conexión con Google:
la app y la API calculan el mismo código a partir de la clave del QR y la hora.

## Comandos

| Quiero… | Comando |
|---|---|
| Levantar la web en desarrollo | `npm run dev` |
| Correr los tests | `npm test` |
| Revisar los tipos | `npm run typecheck` |
| Compilar para producción | `npm run build` |
| Regenerar los tipos de la API desde `docs/contratos/api.openapi.yaml` | `npm run api:types` |

## Datos del servidor

Las pantallas leen y cambian datos con **TanStack Query**: guarda las respuestas en memoria, muestra
carga y error, y vuelve a pedir la lista después de cada decisión. El contador del menú y la
bandeja usan la misma clave, así que comparten un solo pedido.

## Sesión (D34)

- El **JWT** (15 minutos) vive solo en memoria: ningún script puede leerlo de un almacenamiento.
- El **refresh token** (7 días) va en `sessionStorage`: aguanta recargar la página y se borra al
  cerrar la pestaña.
- Cuando el JWT vence, `Session` lo renueva **una sola vez** aunque varios pedidos lo necesiten a
  la vez: la API rota el refresh en cada uso y, si recibe uno ya usado, cierra la sesión entera.

## Estructura

```
src/api/          cliente HTTP y tipos generados del contrato (schema.d.ts, no se edita a mano)
src/auth/         llamadas a /auth, la sesión, el contexto y la guarda de rutas
src/components/   componentes base: Button, TextField, CodeInput, Alert, QrCode, PageSkeleton
src/features/     una carpeta por pantalla (login, approvals, home) y el marco (shell)
src/test/         API simulada con MSW (datos sintéticos) y ayudas para los tests
```
