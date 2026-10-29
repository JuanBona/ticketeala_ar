-- CreateTable
CREATE TABLE "sesion_refresh" (
    "id" BIGSERIAL NOT NULL,
    "legajo" INTEGER NOT NULL,
    "id_familia" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "creado" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vence" TIMESTAMPTZ NOT NULL,
    "usado" TIMESTAMPTZ,
    "revocado" TIMESTAMPTZ,

    CONSTRAINT "sesion_refresh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sesion_refresh_token_hash_key" ON "sesion_refresh"("token_hash");

-- CreateIndex
CREATE INDEX "ix_sesion_refresh_familia" ON "sesion_refresh"("id_familia");

-- AddForeignKey
ALTER TABLE "sesion_refresh" ADD CONSTRAINT "sesion_refresh_legajo_fkey" FOREIGN KEY ("legajo") REFERENCES "empleado"("legajo") ON DELETE NO ACTION ON UPDATE NO ACTION;
