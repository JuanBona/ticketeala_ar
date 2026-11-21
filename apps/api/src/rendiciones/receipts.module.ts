// Receipt upload (UC-02 steps 1 to 4): the endpoint, the image storage and the glue between requests and expenses.
import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administracion/administration.module.js';
import { PoliciesModule } from '../politicas/policies.module.js';
import { TravelRequestsModule } from '../solicitudes/travel-requests.module.js';
import { ExpenseReportsModule } from './expense-reports.module.js';
import { ReceiptImageStore } from './receipt-image-store.js';
import { ReceiptUploadService } from './receipt-upload.service.js';
import { VerifyQueue } from './verify-queue.js';
import { VerifyRequestBuilder } from './verify-request-builder.js';
import { ReceiptsController } from './receipts.controller.js';

// Separate from ExpenseReportsModule because TravelRequestsModule already imports that one:
// importing it back would be a circle.
@Module({
  imports: [
    TravelRequestsModule,
    ExpenseReportsModule,
    AdministrationModule,
    PoliciesModule,
  ],
  controllers: [ReceiptsController],
  providers: [
    ReceiptUploadService,
    ReceiptImageStore,
    VerifyRequestBuilder,
    VerifyQueue,
  ],
})
export class ReceiptsModule {}
