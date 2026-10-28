-- Immutable versions and audit log enforced by triggers, plus D32 and D33 checks. Hand-written:
-- Prisma cannot express triggers or CHECK constraints.
BEGIN;

-- ===== Immutable versions (CLAUDE.md: a change closes the version in force and inserts a new one) =====

-- Shared by every table whose rows can never change once inserted.
CREATE FUNCTION "rechazar_cambio_inmutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es inmutable: no se permite % sobre la fila %',
    TG_TABLE_NAME, TG_OP, to_jsonb(OLD);
END;
$$;

-- D01: the only allowed change to a policy version is closing it (vigente_hasta from null to a date).
CREATE FUNCTION "permitir_solo_cierre_de_politica"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."vigente_hasta" IS NULL
     AND NEW."vigente_hasta" IS NOT NULL
     AND (to_jsonb(NEW) - 'vigente_hasta') = (to_jsonb(OLD) - 'vigente_hasta') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'politica_gasto id=% es inmutable: solo se puede cerrar vigente_hasta una vez', OLD."id";
END;
$$;

CREATE TRIGGER "politica_gasto_solo_cierre"
  BEFORE UPDATE ON "politica_gasto"
  FOR EACH ROW EXECUTE FUNCTION "permitir_solo_cierre_de_politica"();

CREATE TRIGGER "politica_gasto_sin_borrado"
  BEFORE DELETE ON "politica_gasto"
  FOR EACH ROW EXECUTE FUNCTION "rechazar_cambio_inmutable"();

CREATE TRIGGER "tope_gasto_politica_inmutable"
  BEFORE UPDATE OR DELETE ON "tope_gasto_politica"
  FOR EACH ROW EXECUTE FUNCTION "rechazar_cambio_inmutable"();

CREATE TRIGGER "version_parametros_inmutable"
  BEFORE UPDATE OR DELETE ON "version_parametros"
  FOR EACH ROW EXECUTE FUNCTION "rechazar_cambio_inmutable"();

CREATE TRIGGER "parametro_senal_inmutable"
  BEFORE UPDATE OR DELETE ON "parametro_senal"
  FOR EACH ROW EXECUTE FUNCTION "rechazar_cambio_inmutable"();

-- RNF11: the audit log only grows; nobody can rewrite or erase who did what.
CREATE TRIGGER "registro_auditoria_solo_insercion"
  BEFORE UPDATE OR DELETE ON "registro_auditoria"
  FOR EACH ROW EXECUTE FUNCTION "rechazar_cambio_inmutable"();

-- ===== D32: receipt type as the official ARCA code, so the S07 fiscal key has a single spelling =====
ALTER TABLE "gasto"
  ADD CONSTRAINT "gasto_tipo_comprobante_codigo_arca_check"
  CHECK ("tipo_comprobante" ~ '^[1-9][0-9]{0,2}$');

-- ===== D33: nobody approves or substitutes for themselves =====
ALTER TABLE "empleado"
  ADD CONSTRAINT "empleado_jefe_distinto_check" CHECK ("legajo_jefe" <> "legajo"),
  ADD CONSTRAINT "empleado_suplente_distinto_check" CHECK ("legajo_suplente" <> "legajo");

COMMIT;
