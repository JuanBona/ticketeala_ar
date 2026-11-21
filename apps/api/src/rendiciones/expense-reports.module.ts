// Expense reports and allowances module (UC-02, UC-04, UC-06): owns rendicion, gasto and viatico.
import { Module } from '@nestjs/common';
import { TravelAllowanceService } from './travel-allowance.service.js';

@Module({
  providers: [TravelAllowanceService],
  exports: [TravelAllowanceService],
})
export class ExpenseReportsModule {}
