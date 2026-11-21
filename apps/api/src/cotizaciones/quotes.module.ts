// Quotes module (UC-03, UC-01 steps 7 to 9): owns cotizacion; reads requests and suppliers through their modules.
import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administracion/administration.module.js';
import { TravelRequestsModule } from '../solicitudes/travel-requests.module.js';
import { QuotesController } from './quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [AdministrationModule, TravelRequestsModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
