// Receipt upload (UC-02 steps 1 to 3): the endpoint, the image storage and the glue between requests and expenses.
import { Module } from '@nestjs/common';
import { TravelRequestsModule } from '../solicitudes/travel-requests.module.js';
import { ExpenseReportsModule } from './expense-reports.module.js';
import { ReceiptImageStore } from './receipt-image-store.js';
import { ReceiptUploadService } from './receipt-upload.service.js';
import { ReceiptsController } from './receipts.controller.js';

// Separate from ExpenseReportsModule because TravelRequestsModule already imports that one:
// importing it back would be a circle.
@Module({
  imports: [TravelRequestsModule, ExpenseReportsModule],
  controllers: [ReceiptsController],
  providers: [ReceiptUploadService, ReceiptImageStore],
})
export class ReceiptsModule {}
