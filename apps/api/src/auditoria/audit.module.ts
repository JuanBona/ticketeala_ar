// Audit module (D13, 12.4): owns registro_auditoria; other modules record through AuditService.
import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
