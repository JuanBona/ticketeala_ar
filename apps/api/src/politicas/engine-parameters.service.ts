// Engine parameters (UC-07): reads the version in force of the verification engine and its signal rows (D23, D24).
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EngineParametersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * D23, D24: versions are immutable and a change inserts a newer one, so the one in force is the
   * highest number. Throws if none exists: without parameters the engine cannot run.
   */
  async findInForce() {
    const version = await this.prisma.parameterVersion.findFirst({
      orderBy: { number: 'desc' },
      include: { signals: { orderBy: { code: 'asc' } } },
    });
    if (!version) {
      throw new InternalServerErrorException(
        'No hay versión de parámetros del motor cargada (D24): correr el seed o cargarla en UC-07',
      );
    }
    return version;
  }
}
