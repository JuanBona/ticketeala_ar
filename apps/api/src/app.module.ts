// Root module: business modules (auth, solicitudes, rendiciones…) get registered here as they are built.
import { Module } from '@nestjs/common';
import { AuditModule } from './auditoria/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { QuotesModule } from './cotizaciones/quotes.module.js';
import { TravelRequestsModule } from './solicitudes/travel-requests.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    TravelRequestsModule,
    QuotesModule,
  ],
})
export class AppModule {}
