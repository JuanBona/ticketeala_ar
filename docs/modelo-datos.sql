-- Modelo de datos — PostgreSQL 17
-- Base: diccionario de datos del punto 12.2 de docs/fuente/etapa3.pdf.
-- Los comentarios "-- D0x" marcan cambios propuestos en docs/decisiones.md.
-- Es la referencia para el schema de Prisma (apps/api). Si cambia, se actualiza acá en el mismo PR.

-- ===== Dominios =====
CREATE TYPE estado_solicitud      AS ENUM ('en_cotizacion', 'pendiente', 'aprobada', 'rechazada', 'cancelada'); -- D04
CREATE TYPE estado_rendicion      AS ENUM ('borrador', 'presentada', 'aprobada', 'observada');
CREATE TYPE tipo_gasto            AS ENUM ('alojamiento', 'transporte', 'comida', 'otros');
CREATE TYPE origen_cotizacion     AS ENUM ('agencia', 'externa');                          -- D05
CREATE TYPE decision_verificacion AS ENUM ('aceptado', 'revision', 'alerta');              -- D05
CREATE TYPE resultado_senal       AS ENUM ('ok', 'advertencia', 'falla', 'no_aplica');     -- D05
CREATE TYPE estado_revision       AS ENUM ('sin_revision', 'pendiente', 'resuelta');       -- D05
CREATE TYPE origen_correccion     AS ENUM ('empleado', 'contaduria');                      -- D05
CREATE TYPE estado_verificacion_gasto AS ENUM ('pendiente', 'verificado', 'imagen_rechazada', 'duplicado_rechazado', 'error'); -- D25
CREATE TYPE unidad_tope           AS ENUM ('por_comprobante', 'por_noche', 'por_dia');    -- D26

-- ===== Organización y seguridad =====
CREATE TABLE categoria_empleado (
  id     serial PRIMARY KEY,
  nombre varchar(50) NOT NULL UNIQUE
);

CREATE TABLE area (
  id             serial PRIMARY KEY,
  nombre         varchar(100) NOT NULL,
  legajo_gerente integer                                 -- D15 (FK agregada abajo)
);

CREATE TABLE empleado (
  legajo                    integer PRIMARY KEY,
  nombre                    varchar(150) NOT NULL,
  email                     varchar(150) NOT NULL UNIQUE,
  id_categoria              integer NOT NULL REFERENCES categoria_empleado(id),
  id_area                   integer NOT NULL REFERENCES area(id),
  legajo_jefe               integer REFERENCES empleado(legajo),   -- D15
  legajo_suplente           integer REFERENCES empleado(legajo),   -- D15
  activo                    boolean NOT NULL DEFAULT true,         -- D14 (RN28)
  password_hash             varchar(255) NOT NULL,                 -- D14
  totp_secret               varchar(64),                           -- D14 (RN30)
  consentimiento_ubicacion  boolean NOT NULL DEFAULT false,        -- D14 (Ley 25.326)
  consentimiento_fecha      timestamptz,                           -- D14
  CHECK (legajo_jefe <> legajo),                                   -- D33
  CHECK (legajo_suplente <> legajo)                                -- D33
);
ALTER TABLE area ADD FOREIGN KEY (legajo_gerente) REFERENCES empleado(legajo);

CREATE TABLE rol (
  id     serial PRIMARY KEY,
  nombre varchar(50) NOT NULL UNIQUE  -- D07: empleado, aprobador, agencia, contaduria, gerencia, administrador, auditor (solo lectura)
);

CREATE TABLE empleado_rol (
  legajo_empleado integer NOT NULL REFERENCES empleado(legajo),
  id_rol          integer NOT NULL REFERENCES rol(id),
  PRIMARY KEY (legajo_empleado, id_rol)
);

CREATE TABLE registro_auditoria (                                   -- D13 (RNF11)
  id             bigserial PRIMARY KEY,
  legajo         integer REFERENCES empleado(legajo),
  fecha          timestamptz NOT NULL DEFAULT now(),
  entidad        varchar(50) NOT NULL,
  id_entidad     varchar(50) NOT NULL,
  accion         varchar(30) NOT NULL,
  valor_anterior jsonb,
  valor_nuevo    jsonb
);

-- ===== Viajes y políticas =====
CREATE TABLE destino (
  id     serial PRIMARY KEY,
  ciudad varchar(100) NOT NULL,
  pais   varchar(100) NOT NULL,
  latitud  numeric(10,8),          -- para S10 (distancia captura–destino)
  longitud numeric(11,8)
);

CREATE TABLE politica_gasto (
  id                        serial PRIMARY KEY,
  id_categoria              integer NOT NULL REFERENCES categoria_empleado(id),
  id_destino                integer NOT NULL REFERENCES destino(id),
  moneda                    char(3) NOT NULL DEFAULT 'ARS',            -- D02
  tope_monto                numeric(12,2) NOT NULL,
  anticipacion_minima_dias  integer NOT NULL DEFAULT 0,
  viatico_diario            numeric(12,2) NOT NULL DEFAULT 0,          -- D02
  version                   integer NOT NULL,                          -- D01
  vigente_desde             timestamptz NOT NULL DEFAULT now(),        -- D01
  vigente_hasta             timestamptz,                               -- D01
  legajo_autor              integer NOT NULL REFERENCES empleado(legajo) -- D01
);
CREATE UNIQUE INDEX ux_politica_vigente                               -- D01
  ON politica_gasto (id_categoria, id_destino) WHERE vigente_hasta IS NULL;

CREATE TABLE tope_gasto_politica (                                  -- D26 (S11); inmutable como su política
  id          serial PRIMARY KEY,
  id_politica integer NOT NULL REFERENCES politica_gasto(id),
  tipo        tipo_gasto NOT NULL,
  monto       numeric(12,2) NOT NULL,
  unidad      unidad_tope NOT NULL,
  UNIQUE (id_politica, tipo)
);

CREATE TABLE solicitud_viaje (
  id               serial PRIMARY KEY,
  legajo_empleado  integer NOT NULL REFERENCES empleado(legajo),
  legajo_aprobador integer REFERENCES empleado(legajo),   -- se asigna al pasar a 'pendiente'
  id_destino       integer NOT NULL REFERENCES destino(id),
  id_origen        integer REFERENCES destino(id),           -- D19, D26 (opcional)
  id_politica      integer NOT NULL REFERENCES politica_gasto(id),   -- versión vigente al crear
  estado           estado_solicitud NOT NULL DEFAULT 'en_cotizacion',
  fecha_solicitud  timestamptz NOT NULL DEFAULT now(),
  fecha_inicio     date NOT NULL,
  fecha_fin        date NOT NULL,
  motivo           varchar(255),
  motivo_rechazo   varchar(500),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE proveedor (
  cuit         varchar(13) PRIMARY KEY,
  razon_social varchar(150) NOT NULL,
  CHECK (cuit ~ '^[0-9]{11}$')                 -- D31: sin guiones
);

CREATE TABLE cotizacion (
  id            serial PRIMARY KEY,
  id_solicitud  integer NOT NULL REFERENCES solicitud_viaje(id),
  origen        origen_cotizacion NOT NULL,
  cuit_proveedor varchar(13) REFERENCES proveedor(cuit),
  fuente        varchar(150),                    -- referencia de la cotización externa (UC-03 paso 7)
  descripcion   varchar(255) NOT NULL,
  monto         numeric(12,2) NOT NULL,
  fecha_carga   timestamptz NOT NULL DEFAULT now(),
  vigencia_hasta date,
  seleccionada  boolean NOT NULL DEFAULT false,
  legajo_carga  integer NOT NULL REFERENCES empleado(legajo)
);
CREATE UNIQUE INDEX ux_cotizacion_seleccionada
  ON cotizacion (id_solicitud) WHERE seleccionada;    -- a lo sumo una por solicitud

CREATE TABLE viatico (
  id                  serial PRIMARY KEY,
  id_solicitud        integer NOT NULL UNIQUE REFERENCES solicitud_viaje(id),
  monto_estimado      numeric(12,2) NOT NULL DEFAULT 0,   -- D03 (valor fijo)
  monto_adelantado    numeric(12,2) NOT NULL DEFAULT 0,
  monto_rendido       numeric(12,2) NOT NULL DEFAULT 0,   -- derivado, congelado al conciliar
  saldo               numeric(12,2),                      -- derivado
  estado_conciliacion varchar(30)
);

-- ===== Rendición y gastos =====
CREATE TABLE rendicion (
  id                 serial PRIMARY KEY,
  id_solicitud       integer NOT NULL UNIQUE REFERENCES solicitud_viaje(id),
  fecha_presentacion date,
  estado             estado_rendicion NOT NULL DEFAULT 'borrador',
  total              numeric(12,2) NOT NULL DEFAULT 0,  -- derivado, congelado al aprobar
  observacion        varchar(500)
);

CREATE TABLE gasto (
  id                   serial PRIMARY KEY,
  id_rendicion         integer NOT NULL REFERENCES rendicion(id),
  cuit_proveedor       varchar(13) REFERENCES proveedor(cuit),  -- D06: nulo para el exterior
  id_fiscal_extranjero varchar(40),                             -- D06
  tipo_comprobante     varchar(10) CHECK (tipo_comprobante ~ '^[1-9][0-9]{0,2}$'), -- D32: código ARCA (1 = Factura A, 6 = Factura B, 11 = Factura C)
  punto_venta          integer,                                 -- D06
  numero_comprobante   bigint,                                  -- D06
  fecha                date NOT NULL,
  monto                numeric(12,2) NOT NULL,
  neto                 numeric(12,2),                           -- D06 (S06, factura A)
  iva                  numeric(12,2),                           -- D06 (S06, factura A)
  moneda               char(3) NOT NULL DEFAULT 'ARS',          -- D06; la declara el empleado (D31)
  tipo_cambio          numeric(12,4),                           -- D06 (valor fijo)
  tipo                 tipo_gasto,
  cae                  varchar(20),
  cae_vencimiento      date,                                    -- D06 (S05)
  latitud              numeric(10,8),
  longitud             numeric(11,8),
  fecha_captura        timestamptz,
  comprobante_url      varchar(255),
  dhash                char(16),                                -- D06 (S08, 64 bits en hex)
  estado_verificacion  estado_verificacion_gasto NOT NULL DEFAULT 'pendiente', -- D25
  intentos_imagen      smallint NOT NULL DEFAULT 0,             -- D25 (N de D21)
  activo               boolean NOT NULL DEFAULT true            -- baja lógica (RN28); false en duplicado_rechazado (D25)
);
-- S07: misma clave fiscal no rendida dos veces
CREATE UNIQUE INDEX ux_gasto_clave_fiscal
  ON gasto (cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante)
  WHERE activo AND cuit_proveedor IS NOT NULL AND numero_comprobante IS NOT NULL;

-- ===== Motor de verificación =====
CREATE TABLE version_parametros (
  numero         integer PRIMARY KEY,
  fecha_vigencia timestamptz NOT NULL DEFAULT now(),
  motivo         varchar(255) NOT NULL,
  legajo_aprobo  integer NOT NULL REFERENCES empleado(legajo),
  umbral_aceptacion        smallint NOT NULL,                 -- D24 (D20, inicial 80)
  umbral_alerta            smallint NOT NULL,                 -- D24 (D20, inicial 50)
  intentos_maximos_imagen  smallint NOT NULL,                 -- D24 (N de D21, inicial 3)
  reintentos_maximos_cola  smallint NOT NULL,                 -- D24 (D23, inicial 3)
  CHECK (umbral_alerta >= 0 AND umbral_aceptacion <= 100),    -- D24
  CHECK (umbral_aceptacion > umbral_alerta),                  -- RN22
  CHECK (intentos_maximos_imagen >= 1 AND reintentos_maximos_cola >= 1) -- D24
);

CREATE TABLE parametro_senal (
  id          serial PRIMARY KEY,
  version     integer NOT NULL REFERENCES version_parametros(numero),
  codigo      char(3) NOT NULL,               -- S01..S12
  descripcion varchar(150) NOT NULL,
  peso        smallint NOT NULL,
  umbral      numeric(10,2),
  umbral_advertencia numeric(10,2),           -- D24 (S10: 50 km)
  factor      numeric(6,2),                   -- D24 (S10: k de D19; S12: × IQR)
  bloqueante  boolean NOT NULL,
  activa      boolean NOT NULL,
  UNIQUE (version, codigo)
);

CREATE TABLE verificacion_comprobante (
  id                serial PRIMARY KEY,
  id_gasto          integer NOT NULL UNIQUE REFERENCES gasto(id),
  version_parametros integer NOT NULL REFERENCES version_parametros(numero),
  fecha             timestamptz NOT NULL DEFAULT now(),
  calidad_imagen    numeric(8,2) NOT NULL,     -- varianza del Laplaciano
  puntaje           smallint NOT NULL CHECK (puntaje BETWEEN 0 AND 100),
  decision          decision_verificacion NOT NULL,
  estado_revision   estado_revision NOT NULL DEFAULT 'sin_revision',
  respuesta_ocr     jsonb,                     -- respuesta cruda del proveedor (trazabilidad)
  datos_qr          jsonb
);

CREATE TABLE senal_verificacion (
  id              serial PRIMARY KEY,
  id_verificacion integer NOT NULL REFERENCES verificacion_comprobante(id),
  id_parametro    integer NOT NULL REFERENCES parametro_senal(id),
  resultado       resultado_senal NOT NULL,
  valor_observado varchar(100),
  penalizacion    smallint NOT NULL DEFAULT 0,
  detalle         varchar(255)
);

CREATE TABLE correccion_comprobante (
  id             serial PRIMARY KEY,
  id_gasto       integer NOT NULL REFERENCES gasto(id),
  campo          varchar(30) NOT NULL,
  valor_sugerido varchar(100),
  valor_final    varchar(100) NOT NULL,
  origen         origen_correccion NOT NULL,
  legajo         integer NOT NULL REFERENCES empleado(legajo),
  fecha          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evaluacion_motor (
  id                      serial PRIMARY KEY,
  fecha                   timestamptz NOT NULL DEFAULT now(),
  version_parametros      integer NOT NULL REFERENCES version_parametros(numero),
  cantidad_comprobantes   integer NOT NULL,
  cantidad_manipulados    integer NOT NULL,
  tasa_deteccion          numeric(5,4) NOT NULL,
  tasa_falsos_positivos   numeric(5,4) NOT NULL
);

CREATE TABLE resultado_campo (
  id_evaluacion    integer NOT NULL REFERENCES evaluacion_motor(id),
  campo            varchar(30) NOT NULL,
  exactitud_ocr_solo numeric(5,4) NOT NULL,
  exactitud_motor    numeric(5,4) NOT NULL,
  PRIMARY KEY (id_evaluacion, campo)
);

-- ===== Inmutabilidad (reglas transversales de CLAUDE.md; RNF11) =====
-- Triggers BEFORE UPDATE/DELETE. La implementación está en la migración
-- apps/api/prisma/migrations/*_immutability_and_data_rules.
--   politica_gasto:       solo se permite cerrar vigente_hasta (de nulo a una fecha), una vez; sin DELETE.
--   tope_gasto_politica, version_parametros, parametro_senal: sin UPDATE ni DELETE.
--   registro_auditoria:   solo INSERT.
