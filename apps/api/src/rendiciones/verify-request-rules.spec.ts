// Unit tests of the pure pieces of the verification request: cap quantity (D26), amounts and parameters (D23, D24).
import { Prisma } from '../generated/prisma/client.js';
import { CapUnit } from '../generated/prisma/enums.js';
import {
  buildCap,
  buildParameters,
  capQuantity,
  formatAmount,
  toCoordinates,
} from './verify-request-rules.js';

describe('D26 cap quantity', () => {
  it('por_comprobante is always 1', () => {
    expect(capQuantity(CapUnit.PER_RECEIPT, 5)).toBe(1);
  });

  it('por_noche is the nights of the trip', () => {
    expect(capQuantity(CapUnit.PER_NIGHT, 3)).toBe(3);
  });

  it('por_dia is nights plus one', () => {
    expect(capQuantity(CapUnit.PER_DAY, 3)).toBe(4);
  });

  it('a same-day trip still counts one night, because the contract needs at least 1', () => {
    expect(capQuantity(CapUnit.PER_NIGHT, 0)).toBe(1);
  });
});

describe('S11 cap of the request', () => {
  it('is null when the policy has no cap for the expense type', () => {
    expect(buildCap(null, 'ARS', 2)).toBeNull();
  });

  it('carries the amount as text with two decimals and the currency of the policy', () => {
    const cap = buildCap(
      { amount: new Prisma.Decimal('15000.5'), unit: CapUnit.PER_DAY },
      'USD',
      2,
    );

    expect(cap).toEqual({
      monto: '15000.50',
      unidad: 'por_dia',
      cantidad: 3,
      moneda: 'USD',
    });
  });
});

describe('amounts', () => {
  it('keeps the cents without float errors', () => {
    expect(formatAmount(new Prisma.Decimal('0.1').plus('0.2'))).toBe('0.30');
  });
});

describe('D23, D24 engine parameters', () => {
  const version = {
    number: 4,
    acceptanceThreshold: 80,
    alertThreshold: 50,
    maximumImageAttempts: 3,
    maximumQueueRetries: 3,
    signals: [
      {
        code: 'S10',
        weight: 10,
        threshold: new Prisma.Decimal('25.00'),
        warningThreshold: new Prisma.Decimal('50.50'),
        factor: new Prisma.Decimal('1.50'),
        blocking: false,
        enabled: true,
      },
      {
        code: 'S01',
        weight: 20,
        threshold: null,
        warningThreshold: null,
        factor: null,
        blocking: true,
        enabled: false,
      },
    ],
  };

  it('turns Decimal columns into numbers and keeps nulls as null', () => {
    const parameters = buildParameters(version);

    expect(parameters.senales.S10).toEqual({
      peso: 10,
      umbral: 25,
      umbral_advertencia: 50.5,
      factor: 1.5,
      bloqueante: false,
      activa: true,
    });
    expect(parameters.senales.S01.umbral).toBeNull();
  });

  it('keeps the version number and the thresholds of the version', () => {
    const parameters = buildParameters(version);

    expect(parameters).toMatchObject({
      version: 4,
      umbral_aceptacion: 80,
      umbral_alerta: 50,
      intentos_maximos_imagen: 3,
      reintentos_maximos_cola: 3,
    });
  });
});

describe('S10 coordinates', () => {
  it('are null when the place has no latitude or longitude', () => {
    expect(
      toCoordinates({ latitude: null, longitude: new Prisma.Decimal('1') }),
    ).toBeNull();
  });

  it('become plain numbers when both exist', () => {
    expect(
      toCoordinates({
        latitude: new Prisma.Decimal('-31.4201'),
        longitude: new Prisma.Decimal('-64.1888'),
      }),
    ).toEqual({ latitud: -31.4201, longitud: -64.1888 });
  });
});
