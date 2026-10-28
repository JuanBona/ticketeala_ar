// Engine seed: parameter version 1 and the 12 signals with the weights of docs/motor-verificacion.md.
import type { Prisma } from '../../src/generated/prisma/client.js';

type Transaction = Prisma.TransactionClient;

const SEED_PARAMETER_VERSION = 1;

/** Contaduría (1002) approves the initial parameters. */
const PARAMETERS_APPROVER_EMPLOYEE_NUMBER = 1002;

/** D20, D21, D23 initial values (D24). */
const INITIAL_VERSION_VALUES = {
  acceptanceThreshold: 80,
  alertThreshold: 50,
  maximumImageAttempts: 3,
  maximumQueueRetries: 3,
};

interface SignalSeed {
  code: string;
  description: string;
  weight: number;
  threshold: string | null;
  warningThreshold: string | null;
  factor: string | null;
  blocking: boolean;
}

/**
 * Weights from docs/motor-verificacion.md; S01 and S07 have none (quality gate and duplicate rule).
 * Values per column from D24 and D29: S01 and S02 stay null until calibrated with data/eval.
 */
export const SIGNAL_SEEDS: SignalSeed[] = [
  {
    code: 'S01',
    description: 'Calidad de imagen sobre el umbral',
    weight: 0,
    threshold: null,
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S02',
    description: 'Confianza del OCR por campo sobre el umbral',
    weight: 10,
    threshold: null,
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S03',
    description: 'QR coincide con OCR (CUIT, fecha, número, importe)',
    weight: 25,
    threshold: null,
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S04',
    description: 'Dígito verificador del CUIT válido',
    weight: 30,
    threshold: null,
    warningThreshold: null,
    factor: null,
    blocking: true,
  },
  {
    code: 'S05',
    description: 'CAE con formato válido y vigente a la fecha del comprobante',
    weight: 15,
    threshold: null,
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S06',
    description: 'Factura A: total igual a la suma de conceptos, ±1 peso',
    weight: 15,
    threshold: '1',
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S07',
    description: 'Clave fiscal no rendida previamente',
    weight: 0,
    threshold: null,
    warningThreshold: null,
    factor: null,
    blocking: true,
  },
  {
    code: 'S08',
    description: 'Sin imagen similar (Hamming del dHash > umbral)',
    weight: 40,
    threshold: '10',
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S09',
    description: 'Fecha dentro del viaje aprobado (± días de tolerancia)',
    weight: 25,
    threshold: '1',
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S10',
    description: 'Ubicación de la captura en el trayecto o cerca del destino',
    weight: 10,
    threshold: '300',
    warningThreshold: '50',
    factor: '1.2',
    blocking: false,
  },
  {
    code: 'S11',
    description: 'Monto dentro del tope de la política para el tipo de gasto',
    weight: 15,
    threshold: null,
    warningThreshold: null,
    factor: null,
    blocking: false,
  },
  {
    code: 'S12',
    description: 'Monto ≤ Q3 + factor × IQR del historial',
    weight: 10,
    threshold: '20',
    warningThreshold: null,
    factor: '1.5',
    blocking: false,
  },
];

/**
 * Inserts parameter version 1 with its signals. Versions are immutable (triggers), so an existing
 * version 1 is left as it is.
 */
export async function seedEngineParameters(
  transaction: Transaction,
): Promise<void> {
  const existing = await transaction.parameterVersion.findUnique({
    where: { number: SEED_PARAMETER_VERSION },
  });
  if (existing) {
    return;
  }
  await transaction.parameterVersion.create({
    data: {
      number: SEED_PARAMETER_VERSION,
      reason: 'Valores iniciales del documento (semilla sintética)',
      approvedByEmployeeNumber: PARAMETERS_APPROVER_EMPLOYEE_NUMBER,
      ...INITIAL_VERSION_VALUES,
      signals: {
        create: SIGNAL_SEEDS.map((signal) => ({ ...signal, enabled: true })),
      },
    },
  });
}
