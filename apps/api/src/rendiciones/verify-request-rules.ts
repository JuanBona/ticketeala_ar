// Pure pieces of the verification request (D23, D26, D28): contract types, cap quantity and parameter conversion.
import type { Prisma } from '../generated/prisma/client.js';
import { CapUnit, ExpenseCategory } from '../generated/prisma/enums.js';

/** Contract docs/contratos/verifier.schema.json, #/$defs/Pedido. Field names are the contract's (Spanish). */
export interface Coordinates {
  latitud: number;
  longitud: number;
}

export interface VerifyTrip {
  fecha_inicio: string;
  fecha_fin: string;
  destino: Coordinates | null;
  origen: Coordinates | null;
}

export interface VerifyCap {
  monto: string;
  unidad: 'por_comprobante' | 'por_noche' | 'por_dia';
  cantidad: number;
  moneda: string;
}

export interface SignalParameters {
  peso: number;
  umbral: number | null;
  umbral_advertencia: number | null;
  factor: number | null;
  bloqueante: boolean;
  activa: boolean;
}

export interface EngineParameters {
  version: number;
  umbral_aceptacion: number;
  umbral_alerta: number;
  intentos_maximos_imagen: number;
  reintentos_maximos_cola: number;
  senales: Record<string, SignalParameters>;
}

export interface VerifyContext {
  viaje: VerifyTrip;
  tipo_gasto: string;
  moneda_declarada: string;
  tope: VerifyCap | null;
  tipo_cambio: null;
  ubicacion_captura: Coordinates | null;
  dhash_previos: { gasto_id: number; dhash: string }[];
  claves_fiscales_previas: {
    gasto_id: number;
    cuit: string;
    tipo_comprobante: string;
    punto_venta: number;
    numero_comprobante: number;
  }[];
  historial_montos: { monto: string; moneda: string }[];
}

export interface VerifyRequest {
  job_id: string;
  gasto_id: number;
  intento: number;
  imagen: { origen: 'almacenamiento'; clave: string };
  contexto: VerifyContext;
  parametros: EngineParameters;
}

const CAP_UNIT_NAMES: Record<CapUnit, VerifyCap['unidad']> = {
  [CapUnit.PER_RECEIPT]: 'por_comprobante',
  [CapUnit.PER_NIGHT]: 'por_noche',
  [CapUnit.PER_DAY]: 'por_dia',
};

/** D27: expense type names of the contract (TipoGasto). */
export const EXPENSE_TYPE_BY_CATEGORY: Record<ExpenseCategory, string> = {
  [ExpenseCategory.LODGING]: 'alojamiento',
  [ExpenseCategory.TRANSPORT]: 'transporte',
  [ExpenseCategory.MEALS]: 'comida',
  [ExpenseCategory.OTHER]: 'otros',
};

const MINIMUM_CAP_QUANTITY = 1;

/** The contract wants numeric(12,2) as text with a point and two decimals, never a float. */
export function formatAmount(amount: Prisma.Decimal): string {
  return amount.toFixed(2);
}

/**
 * D26: how many times the cap applies. por_noche = nights (D11), por_dia = nights + 1,
 * por_comprobante = 1. A same-day trip has 0 nights but the contract needs at least 1.
 */
export function capQuantity(unit: CapUnit, nights: number): number {
  if (unit === CapUnit.PER_RECEIPT) {
    return MINIMUM_CAP_QUANTITY;
  }
  if (unit === CapUnit.PER_DAY) {
    return nights + 1;
  }
  return Math.max(nights, MINIMUM_CAP_QUANTITY);
}

/** D26: the cap row of the expense type in the request's policy; null when the policy has none (S11 gives no_aplica). */
export function buildCap(
  cap: { amount: Prisma.Decimal; unit: CapUnit } | null,
  policyCurrency: string,
  nights: number,
): VerifyCap | null {
  if (!cap) {
    return null;
  }
  return {
    monto: formatAmount(cap.amount),
    unidad: CAP_UNIT_NAMES[cap.unit],
    cantidad: capQuantity(cap.unit, nights),
    moneda: policyCurrency,
  };
}

interface SignalRow {
  code: string;
  weight: number;
  threshold: Prisma.Decimal | null;
  warningThreshold: Prisma.Decimal | null;
  factor: Prisma.Decimal | null;
  blocking: boolean;
  enabled: boolean;
}

interface ParameterVersionRow {
  number: number;
  acceptanceThreshold: number;
  alertThreshold: number;
  maximumImageAttempts: number;
  maximumQueueRetries: number;
  signals: SignalRow[];
}

/** D23, D24: the version in force with its signal rows; Decimal columns become numbers, as the contract defines. */
export function buildParameters(
  version: ParameterVersionRow,
): EngineParameters {
  const signals: Record<string, SignalParameters> = {};
  for (const signal of version.signals) {
    signals[signal.code] = {
      peso: signal.weight,
      umbral: signal.threshold?.toNumber() ?? null,
      umbral_advertencia: signal.warningThreshold?.toNumber() ?? null,
      factor: signal.factor?.toNumber() ?? null,
      bloqueante: signal.blocking,
      activa: signal.enabled,
    };
  }
  return {
    version: version.number,
    umbral_aceptacion: version.acceptanceThreshold,
    umbral_alerta: version.alertThreshold,
    intentos_maximos_imagen: version.maximumImageAttempts,
    reintentos_maximos_cola: version.maximumQueueRetries,
    senales: signals,
  };
}

/** Coordinates as numbers, or null if the place has none (S10 then gives no_aplica). */
export function toCoordinates(place: {
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
}): Coordinates | null {
  if (place.latitude === null || place.longitude === null) {
    return null;
  }
  return {
    latitud: place.latitude.toNumber(),
    longitud: place.longitude.toNumber(),
  };
}
