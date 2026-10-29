-- CreateEnum
CREATE TYPE "tipo_codigo_segundo_factor" AS ENUM ('habilitacion', 'recuperacion');

-- CreateTable
CREATE TABLE "codigo_segundo_factor" (
    "id" BIGSERIAL NOT NULL,
    "legajo" INTEGER NOT NULL,
    "tipo" "tipo_codigo_segundo_factor" NOT NULL,
    "codigo_hash" CHAR(64) NOT NULL,
    "creado" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vence" TIMESTAMPTZ,
    "usado" TIMESTAMPTZ,
    "anulado" TIMESTAMPTZ,
    "legajo_emisor" INTEGER,

    CONSTRAINT "codigo_segundo_factor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codigo_segundo_factor_codigo_hash_key" ON "codigo_segundo_factor"("codigo_hash");

-- AddForeignKey
ALTER TABLE "codigo_segundo_factor" ADD CONSTRAINT "codigo_segundo_factor_legajo_fkey" FOREIGN KEY ("legajo") REFERENCES "empleado"("legajo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "codigo_segundo_factor" ADD CONSTRAINT "codigo_segundo_factor_legajo_emisor_fkey" FOREIGN KEY ("legajo_emisor") REFERENCES "empleado"("legajo") ON DELETE NO ACTION ON UPDATE NO ACTION;
