# apps/api — API (monolito modular)

Dueño: rol API y datos. Arquitectura: punto 12.4 del PDF. Esquema: `docs/modelo-datos.sql`.

- NestJS + TypeScript estricto + Prisma + PostgreSQL 17. Un módulo de Nest por módulo del documento:
  `solicitudes`, `cotizaciones`, `rendiciones` (incluye gastos y viáticos), `politicas`
  (políticas y parámetros del motor), `auditoria`, `reportes`, `administracion`, `auth`.
- Un módulo no lee ni escribe tablas de otro: pide por su servicio.
- El schema de Prisma replica `docs/modelo-datos.sql`. Los índices únicos parciales y los CHECK que
  Prisma no expresa van en migraciones SQL a mano.
- Versionado (D01 y parámetros): cerrar vigente + insertar nueva **en una transacción**. Test que
  verifique que una solicitud vieja conserva su política después de un cambio.
- Reglas de negocio con su número en el nombre del test (`rn04_viatico_por_noches.spec.ts`).
- Guards de rol en todos los endpoints; TOTP obligatorio para aprobador, contaduria y administrador.
- Auditoría: interceptor que registra en `registro_auditoria` aprobaciones, correcciones y cambios
  de políticas y parámetros, con valor anterior y nuevo.
- Carga de comprobante: guardar la imagen en el almacenamiento S3 (SeaweedFS, D17), crear el gasto en estado pendiente de
  verificación, publicar el trabajo en Redis Streams con el contexto que pide `verifier.schema.json`,
  persistir señales, puntaje y decisión al recibir el resultado.
- `docs/contratos/api.openapi.yaml` se genera desde los decoradores y se commitea en cada PR que
  cambie endpoints.
- Semillas en `prisma/seed.ts`, todas marcadas como sintéticas.
- Comentarios explicativos (pedido de Juan Cruz, 29/10): además del encabezado y los docstrings, cada
  paso de lógica lleva una línea corta antes que diga qué hace y por qué, para entender el código
  leyéndolo en VS Code sin conocer NestJS ni Prisma. Cortos: una línea por paso, sin repetir el
  código literal.
