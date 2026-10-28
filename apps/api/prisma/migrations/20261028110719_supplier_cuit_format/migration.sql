-- D31: CUIT stored without dashes (11 digits), the same format as docs/contratos/verifier.schema.json.
-- Hand-written: Prisma cannot express CHECK constraints. Gasto and cotizacion reference proveedor.cuit,
-- so this single constraint covers every CUIT in the database.
BEGIN;

ALTER TABLE "proveedor"
  ADD CONSTRAINT "proveedor_cuit_formato_check" CHECK ("cuit" ~ '^[0-9]{11}$');

COMMIT;
