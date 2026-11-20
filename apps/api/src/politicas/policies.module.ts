// Policies and engine parameters module (UC-07): owns politica_gasto and its versions.
import { Module } from '@nestjs/common';
import { ExpensePolicyService } from './expense-policy.service.js';

@Module({
  providers: [ExpensePolicyService],
  exports: [ExpensePolicyService],
})
export class PoliciesModule {}
