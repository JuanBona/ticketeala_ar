// Expense reports and allowances module (UC-02, UC-04, UC-06): owns rendicion, gasto and viatico.
import { Module } from '@nestjs/common';
import { ExpenseReportService } from './expense-report.service.js';
import { ExpenseService } from './expense.service.js';
import { TravelAllowanceService } from './travel-allowance.service.js';

@Module({
  providers: [TravelAllowanceService, ExpenseReportService, ExpenseService],
  exports: [TravelAllowanceService, ExpenseReportService, ExpenseService],
})
export class ExpenseReportsModule {}
