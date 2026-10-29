-- AlterTable
ALTER TABLE "empleado" ADD COLUMN     "totp_ultimo_paso" BIGINT;

-- AlterTable
ALTER TABLE "sesion_refresh" ADD COLUMN     "segundo_factor" BOOLEAN NOT NULL DEFAULT false;
