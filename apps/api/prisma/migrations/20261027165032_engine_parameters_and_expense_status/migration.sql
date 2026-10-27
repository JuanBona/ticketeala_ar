-- D19, D24, D25, D26: engine parameters, expense verification status and per-category caps.
-- Wrapped in a transaction so a failure leaves nothing half applied.
BEGIN;

-- CreateEnum
CREATE TYPE "estado_verificacion_gasto" AS ENUM ('pendiente', 'verificado', 'imagen_rechazada', 'duplicado_rechazado', 'error');

-- CreateEnum
CREATE TYPE "unidad_tope" AS ENUM ('por_comprobante', 'por_noche', 'por_dia');

-- AlterTable
ALTER TABLE "gasto" ADD COLUMN     "estado_verificacion" "estado_verificacion_gasto" NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "intentos_imagen" SMALLINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "parametro_senal" ADD COLUMN     "factor" DECIMAL(6,2),
ADD COLUMN     "umbral_advertencia" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "solicitud_viaje" ADD COLUMN     "id_origen" INTEGER;

-- AlterTable (hand-edited): existing versions get the initial D24 values; new ones must state them.
ALTER TABLE "version_parametros" ADD COLUMN     "intentos_maximos_imagen" SMALLINT NOT NULL DEFAULT 3,
ADD COLUMN     "reintentos_maximos_cola" SMALLINT NOT NULL DEFAULT 3,
ADD COLUMN     "umbral_aceptacion" SMALLINT NOT NULL DEFAULT 80,
ADD COLUMN     "umbral_alerta" SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE "version_parametros" ALTER COLUMN "intentos_maximos_imagen" DROP DEFAULT,
ALTER COLUMN "reintentos_maximos_cola" DROP DEFAULT,
ALTER COLUMN "umbral_aceptacion" DROP DEFAULT,
ALTER COLUMN "umbral_alerta" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tope_gasto_politica" (
    "id" SERIAL NOT NULL,
    "id_politica" INTEGER NOT NULL,
    "tipo" "tipo_gasto" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "unidad" "unidad_tope" NOT NULL,

    CONSTRAINT "tope_gasto_politica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tope_gasto_politica_id_politica_tipo_key" ON "tope_gasto_politica"("id_politica", "tipo");

-- AddForeignKey
ALTER TABLE "tope_gasto_politica" ADD CONSTRAINT "tope_gasto_politica_id_politica_fkey" FOREIGN KEY ("id_politica") REFERENCES "politica_gasto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_viaje" ADD CONSTRAINT "solicitud_viaje_id_origen_fkey" FOREIGN KEY ("id_origen") REFERENCES "destino"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ===== Hand-written: constraints Prisma cannot express (docs/modelo-datos.sql) =====

ALTER TABLE "version_parametros"
  ADD CONSTRAINT "version_parametros_umbrales_rango_check"
  CHECK ("umbral_alerta" >= 0 AND "umbral_aceptacion" <= 100);

-- RN22: the acceptance threshold must be above the alert threshold.
ALTER TABLE "version_parametros"
  ADD CONSTRAINT "version_parametros_rn22_check"
  CHECK ("umbral_aceptacion" > "umbral_alerta");

ALTER TABLE "version_parametros"
  ADD CONSTRAINT "version_parametros_intentos_check"
  CHECK ("intentos_maximos_imagen" >= 1 AND "reintentos_maximos_cola" >= 1);

COMMIT;
