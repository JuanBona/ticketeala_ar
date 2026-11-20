// Reads employees for other modules (UC-10 owns the `empleado` table): who someone is and where they sit.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** What other modules may know about an active employee. */
export interface EmployeeProfile {
  employeeNumber: number;
  categoryId: number;
  areaId: number;
  /** D15: the direct supervisor approves the employee's requests. */
  supervisorEmployeeNumber: number | null;
  /** D15: takes over when the supervisor is deactivated. */
  substituteEmployeeNumber: number | null;
}

@Injectable()
export class EmployeeDirectory {
  constructor(private readonly prisma: PrismaService) {}

  /** RN28: a deactivated employee is treated as missing (null). */
  async findActive(employeeNumber: number): Promise<EmployeeProfile | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { employeeNumber, active: true },
    });
    if (!employee) {
      return null;
    }
    return {
      employeeNumber: employee.employeeNumber,
      categoryId: employee.categoryId,
      areaId: employee.areaId,
      supervisorEmployeeNumber: employee.supervisorEmployeeNumber,
      substituteEmployeeNumber: employee.substituteEmployeeNumber,
    };
  }
}
