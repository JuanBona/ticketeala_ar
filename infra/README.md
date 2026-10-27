# infra — servicios para desarrollar

Este archivo explica cómo levantar en tu máquina los tres servicios que necesita AMR Viajes. Con un
solo comando quedan corriendo la base de datos, la cola de trabajos y el almacenamiento de imágenes,
iguales para los tres integrantes.

## Qué es cada cosa

**Docker** corre programas dentro de *contenedores*: cajas aisladas que traen todo lo que el programa
necesita. No hace falta instalar PostgreSQL ni Redis en tu compu. **Docker Compose** lee
`docker-compose.yml`, que describe varios contenedores juntos, y los levanta todos de una vez.

| Servicio | Programa | Para qué lo usamos | Puerto |
|---|---|---|---|
| `postgres` | PostgreSQL 17 | La base de datos de la API: solicitudes, rendiciones, políticas, auditoría. | 5432 |
| `redis` | Redis 7 | La **cola** (D09): la API deja un trabajo por cada comprobante cargado y el verificador lo toma. Usa *Redis Streams*. | 6379 |
| `storage` | SeaweedFS | El **almacenamiento de imágenes** de comprobantes (D17). Habla el protocolo S3, el mismo de Amazon. | 8333 |

Los puertos se abren solo en `127.0.0.1`: los ve tu máquina, nadie más de la red. Los datos se guardan
en *volúmenes* de Docker, así que siguen ahí aunque apagues los contenedores.

## Primera vez

1. Instalá [Docker Desktop](https://docs.docker.com/get-docker/) (en Linux alcanza con Docker Engine y
   el plugin `docker compose`).
2. Copiá el archivo de ejemplo de configuración y cambiá las contraseñas:

   ```sh
   cd infra
   cp .env.example .env
   ```

   `.env` tiene contraseñas: **nunca se sube al repo** (el `.gitignore` ya lo excluye).
3. Levantá todo y esperá a que los tres servicios estén listos:

   ```sh
   docker compose up -d --wait
   ```

4. Comprobá que todo funciona:

   ```sh
   ./check.sh
   ```

   Tiene que terminar con `OK: los tres servicios están listos.` Si algo falla, dice qué y por qué.

## Uso diario

| Quiero… | Comando (desde `infra/`) |
|---|---|
| Prender los servicios | `docker compose up -d --wait` |
| Ver si están sanos | `docker compose ps` (columna STATUS: `healthy`) |
| Ver qué pasa en uno | `docker compose logs -f postgres` (o `redis`, `storage`) |
| Apagarlos sin perder datos | `docker compose down` |
| **Borrar todo** y empezar de cero | `docker compose down -v` (la `-v` borra los volúmenes: base, cola e imágenes) |

## Cómo se conecta la API

Con los valores de `.env.example` (cambiá las contraseñas por las de tu `.env`):

```sh
DATABASE_URL=postgresql://amr:cambiar-esta-clave@localhost:5432/amr_viajes
REDIS_URL=redis://:cambiar-esta-clave@localhost:6379
S3_ENDPOINT=http://localhost:8333
S3_ACCESS_KEY=amr-dev
S3_SECRET_KEY=cambiar-esta-clave-larga
S3_BUCKET=comprobantes
S3_FORCE_PATH_STYLE=true
```

`S3_FORCE_PATH_STYLE=true` le dice al cliente S3 que arme las direcciones como
`localhost:8333/comprobantes/foto.jpg` y no como `comprobantes.localhost:8333/foto.jpg`, que en
desarrollo no resuelve.

## Decisiones que conviene saber

- **Bucket privado.** El bucket (la "carpeta" de S3) `comprobantes` se crea solo al arrancar. Un pedido
  sin credenciales recibe `403`. Para mostrar una imagen, la API genera una *URL firmada* de corta
  duración (requisito de seguridad de CLAUDE.md).
- **Redis guarda en disco** (`appendonly yes`). Sin eso, reiniciar Redis borraría los comprobantes que
  esperaban verificación.
- **Versiones fijas** (`postgres:17.11`, `redis:7.4`, `seaweedfs:4.51`): nadie recibe una versión
  distinta de un día para el otro. Subir una versión es un cambio con su propio PR.
- **SeaweedFS en lugar de MinIO** (D17): MinIO dejó de publicar su imagen de Docker.
- **Telemetría apagada** en SeaweedFS (`-master.telemetry=false`): no manda estadísticas afuera.

## Pendiente para un servidor real (no es del prototipo)

Este compose es para desarrollar. Para usarlo en un VPS faltaría: contraseñas reales y largas, HTTPS
con un proxy delante de la API (por ejemplo Caddy), copias de seguridad programadas de la base y de
las imágenes, y no publicar los puertos de PostgreSQL, Redis y SeaweedFS (solo la API habla con ellos).
