// Supplier catalog (UC-10): checks that a CUIT given by the agency belongs to a registered supplier.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SupplierCatalog {
  constructor(private readonly prisma: PrismaService) {}

  /** D31: CUITs are stored as 11 digits without dashes, so the lookup uses that form. */
  async exists(cuit: string): Promise<boolean> {
    const supplier = await this.prisma.supplier.findUnique({ where: { cuit } });
    return supplier !== null;
  }
}
