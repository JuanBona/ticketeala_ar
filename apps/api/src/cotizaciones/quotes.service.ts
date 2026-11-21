// UC-01 steps 7 to 9 and a minimal UC-03: the agency loads quotes, the employee compares and selects one.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SupplierCatalog } from '../administracion/supplier-catalog.service.js';
import { Prisma, type Quote } from '../generated/prisma/client.js';
import { QuoteOrigin, TravelRequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { todayInArgentina } from '../solicitudes/travel-request-rules.js';
import { STATUS_NAMES } from '../solicitudes/travel-request-summary.js';
import {
  TravelRequestsService,
  type QuotingContext,
} from '../solicitudes/travel-requests.service.js';
import type { AddQuoteRequest } from './dto/add-quote.request.js';
import type { SelectQuoteRequest } from './dto/select-quote.request.js';
import {
  toQuoteComparison,
  toQuoteView,
  type QuoteComparison,
  type QuoteView,
} from './quote-comparison.js';
import { exceedsCap, isExpired } from './quote-rules.js';

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly travelRequests: TravelRequestsService,
    private readonly suppliers: SupplierCatalog,
  ) {}

  /**
   * UC-03 steps 5 to 8: validates and stores one quote. Over the cap it is still stored, flagged
   * `exceedsCap`, so the advisor can add a cheaper alternative (5a).
   */
  async add(
    advisorEmployeeNumber: number,
    travelRequestId: number,
    request: AddQuoteRequest,
  ): Promise<QuoteView> {
    const context = await this.quotingRequest(travelRequestId);
    const today = todayInArgentina(new Date());
    assertRequiredByOrigin(request, today);
    if (
      request.supplierCuit &&
      !(await this.suppliers.exists(request.supplierCuit))
    ) {
      throw new BadRequestException(
        `Proveedor con CUIT ${request.supplierCuit} no registrado`,
      );
    }
    const quote = await this.prisma.quote.create({
      data: {
        travelRequestId,
        origin:
          request.origin === 'agencia'
            ? QuoteOrigin.AGENCY
            : QuoteOrigin.EXTERNAL,
        description: request.description,
        // Through a string, so 125000.1 becomes exactly 125000.10 and never 125000.0999…
        amount: new Prisma.Decimal(String(request.amount)),
        supplierCuit: request.supplierCuit ?? null,
        source: request.source ?? null,
        validUntil: request.validUntil ? new Date(request.validUntil) : null,
        loadedByEmployeeNumber: advisorEmployeeNumber,
      },
    });
    return toQuoteView(quote, { context, lowestExternal: null, today });
  }

  /** UC-01 step 8: the requester compares the quotes against the policy cap. */
  async compare(
    employeeNumber: number,
    travelRequestId: number,
  ): Promise<QuoteComparison> {
    const context = await this.ownRequest(employeeNumber, travelRequestId);
    const quotes = await this.quotesOf(travelRequestId);
    return toQuoteComparison(context, quotes, todayInArgentina(new Date()));
  }

  /**
   * UC-01 step 9: the requester picks one agency quote (RN08, RN10) that has not expired (RN11).
   * Over the cap, a justification is mandatory (9a). Choosing again replaces the previous choice.
   */
  async select(
    employeeNumber: number,
    travelRequestId: number,
    request: SelectQuoteRequest,
  ): Promise<QuoteComparison> {
    const context = await this.ownRequest(employeeNumber, travelRequestId);
    assertStillQuoting(context);
    const today = todayInArgentina(new Date());
    const quote = await this.selectableQuote(
      travelRequestId,
      request.quoteId,
      today,
    );
    const justification = requireOverCapJustification(quote, context, request);
    // One transaction: save the 9a justification, unmark the old choice, mark the new one.
    await this.prisma.$transaction(async (transaction) => {
      // First, and only if still en_cotizacion: this locks the request, so a confirmation running
      // now waits for this choice, and a choice arriving after a confirmation fails here.
      const stillQuoting = await this.travelRequests.recordOverCapJustification(
        transaction,
        travelRequestId,
        justification,
      );
      if (!stillQuoting) {
        throw new ConflictException(
          `La solicitud ${travelRequestId} ya no está en cotización: no se puede cambiar la elección`,
        );
      }
      // Clear first: the partial unique index allows only one selected quote per request.
      await transaction.quote.updateMany({
        where: { travelRequestId, selected: true },
        data: { selected: false },
      });
      await transaction.quote.update({
        where: { id: quote.id },
        data: { selected: true },
      });
    });
    return toQuoteComparison(
      context,
      await this.quotesOf(travelRequestId),
      today,
    );
  }

  /** UC-01 steps 10 and 12: the quote the requester chose, or null if none yet (RN09). */
  findSelected(
    travelRequestId: number,
    reader: Pick<PrismaService, 'quote'> = this.prisma,
  ): Promise<Quote | null> {
    // `reader` lets the confirmation read inside its own transaction, after locking the request.
    return reader.quote.findFirst({
      where: { travelRequestId, selected: true },
    });
  }

  /** UC-01 step 12: the selected quote as the approver sees it, against the request's cap. */
  async selectedView(context: QuotingContext): Promise<QuoteView | null> {
    const quote = await this.findSelected(context.id);
    if (!quote) {
      return null;
    }
    return toQuoteView(quote, {
      context,
      lowestExternal: null,
      today: todayInArgentina(new Date()),
    });
  }

  private quotesOf(travelRequestId: number): Promise<Quote[]> {
    return this.prisma.quote.findMany({
      where: { travelRequestId },
      orderBy: { amount: 'asc' },
    });
  }

  /** The agency may quote any request, but only while it is "en_cotizacion". */
  private async quotingRequest(
    travelRequestId: number,
  ): Promise<QuotingContext> {
    const context =
      await this.travelRequests.findQuotingContext(travelRequestId);
    assertStillQuoting(context);
    return context;
  }

  /** Only the requester sees and picks the quotes of their own request. */
  private async ownRequest(
    employeeNumber: number,
    travelRequestId: number,
  ): Promise<QuotingContext> {
    const context =
      await this.travelRequests.findQuotingContext(travelRequestId);
    if (context.employeeNumber !== employeeNumber) {
      throw new ForbiddenException(
        `La solicitud ${travelRequestId} es del empleado ${context.employeeNumber}, no del ${employeeNumber}`,
      );
    }
    return context;
  }

  private async selectableQuote(
    travelRequestId: number,
    quoteId: number,
    today: string,
  ): Promise<Quote> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, travelRequestId },
    });
    if (!quote) {
      throw new NotFoundException(
        `Cotización ${quoteId} inexistente en la solicitud ${travelRequestId}`,
      );
    }
    // RN08, RN10: the external quote is only a reference; AMR Turismo books what the agency quoted.
    if (quote.origin !== QuoteOrigin.AGENCY) {
      throw new BadRequestException(
        `La cotización ${quoteId} es una referencia externa: solo se eligen cotizaciones de la agencia (RN10)`,
      );
    }
    const validUntil = quote.validUntil?.toISOString().slice(0, 10) ?? null;
    if (isExpired(validUntil, today)) {
      throw new UnprocessableEntityException(
        `La cotización ${quoteId} venció el ${validUntil} (RN11)`,
      );
    }
    return quote;
  }
}

/** After step 9 the request moves on (approval, cancellation); then quotes are frozen. */
function assertStillQuoting(context: QuotingContext): void {
  if (context.status !== TravelRequestStatus.QUOTING) {
    throw new ConflictException(
      `La solicitud ${context.id} está ${STATUS_NAMES[context.status]}: ya no admite cotizaciones`,
    );
  }
}

/** UC-03 steps 5 to 7 and 6a: what each origin must bring. */
function assertRequiredByOrigin(request: AddQuoteRequest, today: string): void {
  if (request.origin === 'externa' && !request.source) {
    throw new BadRequestException(
      'Una cotización externa necesita su fuente (UC-03 paso 7)',
    );
  }
  if (request.origin === 'agencia' && !request.validUntil) {
    throw new BadRequestException(
      'Una cotización de la agencia necesita la vigencia de la tarifa (UC-03 paso 5)',
    );
  }
  if (isExpired(request.validUntil ?? null, today)) {
    throw new BadRequestException(
      `La vigencia ${request.validUntil} ya pasó (UC-03 6a)`,
    );
  }
}

/** UC-01 9a: over the cap a justification is mandatory; within the cap any old one is cleared. */
function requireOverCapJustification(
  quote: Quote,
  context: QuotingContext,
  request: SelectQuoteRequest,
): string | null {
  if (!exceedsCap(quote.amount, context.amountCap)) {
    return null;
  }
  if (!request.overCapJustification) {
    // The code lets the app recognize this case and show the justification field (9a).
    throw new UnprocessableEntityException({
      code: 'OVER_CAP_JUSTIFICATION_REQUIRED',
      message: `La cotización ${quote.id} ($${quote.amount.toFixed(2)}) supera el tope de $${context.amountCap.toFixed(2)}: agregá una justificación (UC-01 9a)`,
    });
  }
  return request.overCapJustification;
}
