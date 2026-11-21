// Approval of travel requests (UC-01 steps 9 to 13): part of solicitudes, in its own Nest module
// because it needs quotes, and quotes already depend on solicitudes (this avoids a circular import).
import { Module } from '@nestjs/common';
import { AdministrationModule } from '../../administracion/administration.module.js';
import { QuotesModule } from '../../cotizaciones/quotes.module.js';
import { TravelRequestsModule } from '../travel-requests.module.js';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';
import { ApproverResolver } from './approver-resolver.service.js';

@Module({
  imports: [AdministrationModule, TravelRequestsModule, QuotesModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApproverResolver],
})
export class ApprovalsModule {}
