// Destination catalog (UC-10): the cities a trip can go to or start from.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DestinationSummary } from './dto/destination.responses.js';

export type { DestinationSummary } from './dto/destination.responses.js';

@Injectable()
export class DestinationCatalog {
  constructor(private readonly prisma: PrismaService) {}

  /** UC-01 step 2: the options of the destination field, sorted by city. */
  list(): Promise<DestinationSummary[]> {
    return this.prisma.destination.findMany({
      select: { id: true, city: true, country: true },
      orderBy: { city: 'asc' },
    });
  }

  /** S10: where the destination is; both values are null if the catalog has no coordinates for it. */
  async findCoordinates(id: number): Promise<{
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
  }> {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: { latitude: true, longitude: true },
    });
    return destination ?? { latitude: null, longitude: null };
  }

  find(id: number): Promise<DestinationSummary | null> {
    return this.prisma.destination.findUnique({
      where: { id },
      select: { id: true, city: true, country: true },
    });
  }
}
