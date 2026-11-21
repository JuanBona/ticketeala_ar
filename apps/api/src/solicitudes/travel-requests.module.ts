// Travel requests module (UC-01): owns solicitud_viaje; reads employees, destinations and policies
// through their modules and writes the allowance estimate through rendiciones.
import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administracion/administration.module.js';
import { PoliciesModule } from '../politicas/policies.module.js';
import { ExpenseReportsModule } from '../rendiciones/expense-reports.module.js';
import { TravelRequestsController } from './travel-requests.controller.js';
import { TravelRequestsService } from './travel-requests.service.js';

@Module({
  imports: [AdministrationModule, PoliciesModule, ExpenseReportsModule],
  controllers: [TravelRequestsController],
  providers: [TravelRequestsService],
})
export class TravelRequestsModule {}
