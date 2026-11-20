// Destination catalog (UC-10): the cities a trip can go to or start from.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DestinationSummary {
  id: number;
  city: string;
  country: string;
}

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

  find(id: number): Promise<DestinationSummary | null> {
    return this.prisma.destination.findUnique({
      where: { id },
      select: { id: true, city: true, country: true },
    });
  }
}
