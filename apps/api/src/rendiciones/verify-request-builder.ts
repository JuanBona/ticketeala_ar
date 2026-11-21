// Builds the verification request of an expense: trip, cap, history and engine parameters (UC-02 step 4, D23, D28).
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DestinationCatalog } from '../administracion/destination-catalog.service.js';
import type { Expense } from '../generated/prisma/client.js';
import { EngineParametersService } from '../politicas/engine-parameters.service.js';
import { ExpensePolicyService } from '../politicas/expense-policy.service.js';
import { daysBetween } from '../solicitudes/travel-request-rules.js';
import {
  TravelRequestsService,
  type VerificationTrip,
} from '../solicitudes/travel-requests.service.js';
import { ExpenseService } from './expense.service.js';
import {
  buildCap,
  buildParameters,
  EXPENSE_TYPE_BY_CATEGORY,
  formatAmount,
  toCoordinates,
  type VerifyContext,
  type VerifyRequest,
  type VerifyTrip,
} from './verify-request-rules.js';

/** Who the expense belongs to and which trip it is for. */
export interface ExpenseOwner {
  employeeNumber: number;
  travelRequestId: number;
}

@Injectable()
export class VerifyRequestBuilder {
  constructor(
    private readonly travelRequests: TravelRequestsService,
    private readonly destinations: DestinationCatalog,
    private readonly policies: ExpensePolicyService,
    private readonly engineParameters: EngineParametersService,
    private readonly expenses: ExpenseService,
  ) {}

  /** UC-02 step 4: the job the engine consumes. `intento` is the next image attempt (D21). */
  async build(expense: Expense, owner: ExpenseOwner): Promise<VerifyRequest> {
    const trip = await this.travelRequests.findVerificationTrip(
      owner.travelRequestId,
    );
    const version = await this.engineParameters.findInForce();
    return {
      job_id: randomUUID(),
      gasto_id: expense.id,
      intento: expense.imageAttempts + 1,
      imagen: { origen: 'almacenamiento', clave: expense.receiptUrl! },
      contexto: await this.buildContext(expense, owner, trip),
      parametros: buildParameters(version),
    };
  }

  private async buildContext(
    expense: Expense,
    owner: ExpenseOwner,
    trip: VerificationTrip,
  ): Promise<VerifyContext> {
    // RN02: the cap comes from the policy version the request was born with, not the one in force today.
    const policy = (await this.policies.findByIds([trip.policyId])).get(
      trip.policyId,
    )!;
    const cap = await this.policies.findCap(policy.id, expense.category!);
    const nights = daysBetween(trip.startDate, trip.endDate);
    return {
      viaje: await this.buildTrip(trip),
      tipo_gasto: EXPENSE_TYPE_BY_CATEGORY[expense.category!],
      moneda_declarada: expense.currency,
      tope: buildCap(cap, policy.currency, nights),
      // D22: no exchange rate source in the prototype; the engine gives S11 no_aplica for other currencies.
      tipo_cambio: null,
      // Ley 25.326: the location exists only if the employee agreed when uploading (UC-02 2a).
      ubicacion_captura: toCoordinates({
        latitude: expense.latitude,
        longitude: expense.longitude,
      }),
      dhash_previos: await this.buildHashes(expense, owner),
      claves_fiscales_previas: await this.buildFiscalKeys(expense),
      historial_montos: await this.buildHistory(
        expense,
        trip,
        policy.categoryId,
      ),
    };
  }

  private async buildTrip(trip: VerificationTrip): Promise<VerifyTrip> {
    const destination = await this.destinations.findCoordinates(
      trip.destinationId,
    );
    // D19, D26: the origin is optional; without it S10 measures only against the destination.
    const origin = trip.originId
      ? await this.destinations.findCoordinates(trip.originId)
      : { latitude: null, longitude: null };
    return {
      fecha_inicio: trip.startDate,
      fecha_fin: trip.endDate,
      destino: toCoordinates(destination),
      origen: toCoordinates(origin),
    };
  }

  // S08: the contract wants gasto_id + hash; rows still without a hash were filtered by the query.
  private async buildHashes(expense: Expense, owner: ExpenseOwner) {
    const rows = await this.expenses.findPreviousHashes(
      owner.employeeNumber,
      expense.id,
    );
    return rows.map((row) => ({ gasto_id: row.id, dhash: row.dhash! }));
  }

  // S07: same shape the contract defines; the query already dropped incomplete keys (D32).
  private async buildFiscalKeys(expense: Expense) {
    const rows = await this.expenses.findPreviousFiscalKeys(expense.id);
    return rows.map((row) => ({
      gasto_id: row.id,
      cuit: row.supplierCuit!,
      tipo_comprobante: row.receiptType!,
      punto_venta: row.pointOfSale!,
      numero_comprobante: Number(row.receiptNumber!),
    }));
  }

  // S12: amounts as "0.00" text, in whatever currency they were accepted (the engine filters by it, D30).
  private async buildHistory(
    expense: Expense,
    trip: VerificationTrip,
    employeeCategoryId: number,
  ) {
    const rows = await this.expenses.findAcceptedAmounts({
      destinationId: trip.destinationId,
      employeeCategoryId,
      category: expense.category!,
    });
    return rows.map((row) => ({
      monto: formatAmount(row.amount),
      moneda: row.currency,
    }));
  }
}
