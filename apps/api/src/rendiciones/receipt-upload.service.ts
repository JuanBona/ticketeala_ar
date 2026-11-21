// UC-02 steps 1 to 4 (API side): checks the request, stores the photo, creates the pending expense and queues it.
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { TravelRequestStatus } from '../generated/prisma/enums.js';
import { todayInArgentina } from '../solicitudes/travel-request-rules.js';
import { TravelRequestsService } from '../solicitudes/travel-requests.service.js';
import {
  CATEGORY_BY_EXPENSE_TYPE,
  type UploadReceiptRequest,
} from './dto/upload-receipt.request.js';
import type { ReceiptUploadResponse } from './dto/receipt-upload.responses.js';
import { ExpenseReportService } from './expense-report.service.js';
import { ExpenseService, type NewPendingExpense } from './expense.service.js';
import {
  buildImageKey,
  contentTypeOf,
  detectImageFormat,
  type ImageFormat,
} from './receipt-image-rules.js';
import { ReceiptImageStore } from './receipt-image-store.js';
import { VerifyQueue } from './verify-queue.js';
import { VerifyRequestBuilder } from './verify-request-builder.js';
import type { VerifyRequest } from './verify-request-rules.js';

const DEFAULT_CURRENCY = 'ARS';

@Injectable()
export class ReceiptUploadService {
  constructor(
    private readonly travelRequests: TravelRequestsService,
    private readonly reports: ExpenseReportService,
    private readonly expenses: ExpenseService,
    private readonly imageStore: ReceiptImageStore,
    private readonly requestBuilder: VerifyRequestBuilder,
    private readonly verifyQueue: VerifyQueue,
  ) {}

  /**
   * D25: the expense is created when the photo is uploaded, "pendiente" and with no image
   * attempts, because the engine job (D23) needs its id. The photo is stored first: if the
   * database fails afterwards, an unused private file is left over, which is harmless; the
   * other order could leave an expense with no image.
   */
  async upload(
    employeeNumber: number,
    request: UploadReceiptRequest,
    image: Express.Multer.File | undefined,
  ): Promise<ReceiptUploadResponse> {
    // Cheap checks first, so a bad request never reaches the storage or the database.
    const format = requireImageFormat(image);
    await this.requireApprovedOwnRequest(employeeNumber, request);
    const report = await this.reports.requireOpenReport(
      request.travelRequestId,
    );
    const imageKey = buildImageKey(report.id, format);
    await this.imageStore.save(imageKey, image!.buffer, contentTypeOf(format));
    const expense = await this.expenses.createPending(
      toPendingExpense(report.id, imageKey, request),
    );
    // UC-02 step 4: hand the job to the engine. If the queue is down the expense stays "pendiente" (502).
    const verifyRequest = await this.requestBuilder.build(expense, {
      employeeNumber,
      travelRequestId: request.travelRequestId,
    });
    await this.publishOrFail(verifyRequest);
    return {
      expenseId: expense.id,
      expenseReportId: report.id,
      verificationStatus: 'pendiente',
      imageAttempts: expense.imageAttempts,
    };
  }

  /** A queue failure is the gateway's problem, not the employee's: 502, and the expense stays "pendiente". */
  private async publishOrFail(verifyRequest: VerifyRequest): Promise<void> {
    try {
      await this.verifyQueue.publish(verifyRequest);
    } catch (error) {
      throw new BadGatewayException(
        `No se pudo encolar la verificación del gasto ${verifyRequest.gasto_id} (job ${verifyRequest.job_id}): ${String(error)}`,
      );
    }
  }

  /** UC-02 business precondition: the trip was approved (UC-01) and belongs to the caller. */
  private async requireApprovedOwnRequest(
    employeeNumber: number,
    request: UploadReceiptRequest,
  ): Promise<void> {
    const travelRequest = await this.travelRequests.findReceiptContext(
      request.travelRequestId,
    );
    // The owner is checked against the token, never against a number sent by the client.
    if (travelRequest.employeeNumber !== employeeNumber) {
      throw new ForbiddenException(
        `La solicitud ${travelRequest.id} no es del empleado ${employeeNumber}`,
      );
    }
    if (travelRequest.status !== TravelRequestStatus.APPROVED) {
      throw new UnprocessableEntityException(
        `La solicitud ${travelRequest.id} no está aprobada: solo se cargan comprobantes de viajes aprobados`,
      );
    }
  }
}

function requireImageFormat(
  image: Express.Multer.File | undefined,
): ImageFormat {
  if (!image) {
    throw new BadRequestException(
      'Falta la foto: enviá el archivo en la parte "image"',
    );
  }
  const format = detectImageFormat(image.buffer);
  if (!format) {
    throw new UnsupportedMediaTypeException(
      `El archivo "${image.originalname}" no es una foto JPEG o PNG`,
    );
  }
  return format;
}

function toPendingExpense(
  expenseReportId: number,
  imageKey: string,
  request: UploadReceiptRequest,
): NewPendingExpense {
  const hasLocation =
    request.latitude !== undefined && request.longitude !== undefined;
  return {
    expenseReportId,
    category: CATEGORY_BY_EXPENSE_TYPE[request.expenseType],
    currency: request.currency ?? DEFAULT_CURRENCY,
    imageKey,
    provisionalDate: new Date(`${todayInArgentina(new Date())}T00:00:00Z`),
    // Ley 25.326: the location is kept only if the employee sent it (UC-02 2a).
    capture: hasLocation
      ? {
          latitude: request.latitude!,
          longitude: request.longitude!,
          capturedAt: request.capturedAt
            ? new Date(request.capturedAt)
            : undefined,
        }
      : undefined,
  };
}
