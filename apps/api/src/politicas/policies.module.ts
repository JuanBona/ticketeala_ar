// Policies and engine parameters module (UC-07): owns politica_gasto and its versions.
import { Module } from '@nestjs/common';
import { EngineParametersService } from './engine-parameters.service.js';
import { ExpensePolicyService } from './expense-policy.service.js';

@Module({
  providers: [ExpensePolicyService, EngineParametersService],
  exports: [ExpensePolicyService, EngineParametersService],
})
export class PoliciesModule {}
