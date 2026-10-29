// Root module: business modules (auth, solicitudes, rendiciones…) get registered here as they are built.
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
})
export class AppModule {}
