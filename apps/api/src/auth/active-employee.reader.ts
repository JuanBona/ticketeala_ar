// Reads the employee data that authentication needs: only active employees count (RN28).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isRole, type Role } from './role.js';

export interface ActiveEmployee {
  employeeNumber: number;
  email: string;
  passwordHash: string;
  roles: Role[];
  /** True once the employee finished setting up TOTP (RN30). */
  hasSecondFactor: boolean;
}

export type EmployeeLookup = { email: string } | { employeeNumber: number };

@Injectable()
export class ActiveEmployeeReader {
  constructor(private readonly prisma: PrismaService) {}

  /** RN28: a deactivated employee is treated as if it did not exist. */
  async find(lookup: EmployeeLookup): Promise<ActiveEmployee | null> {
    // Search by email (login) or employee number (refresh, TOTP), always with its roles.
    const employee = await this.prisma.employee.findFirst({
      where: { ...lookup, active: true },
      include: { roles: { include: { role: true } } },
    });
    if (!employee) {
      return null;
    }
    return {
      employeeNumber: employee.employeeNumber,
      email: employee.email,
      passwordHash: employee.passwordHash,
      // Keep only role names the code knows (D07); any other row in `rol` is ignored.
      roles: employee.roles.map((grant) => grant.role.name).filter(isRole),
      hasSecondFactor: employee.totpSecret !== null,
    };
  }
}
