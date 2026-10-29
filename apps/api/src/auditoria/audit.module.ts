// Audit module (D13, 12.4): owns registro_auditoria. Other modules record through AuditService
// or by marking endpoints with @Audited, which the global AuditInterceptor handles.
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditService } from './audit.service.js';

@Module({
  providers: [
    AuditService,
    // Registered as global: it wraps every endpoint, but acts only on the @Audited ones.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
