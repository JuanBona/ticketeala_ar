// Reads employees for other modules (UC-10 owns the `empleado` table): who someone is and where they sit.
import { Injectable } from '@nestjs/common';
import { isRole, type Role } from '../auth/role.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** What other modules may know about an employee. */
export interface EmployeeProfile {
  employeeNumber: number;
  categoryId: number;
  areaId: number;
  /** RN28: false once deactivated; the record stays for history. */
  active: boolean;
  roles: Role[];
  /** D15: the direct supervisor approves the employee's requests. */
  supervisorEmployeeNumber: number | null;
  /** D15: takes over when the employee, as approver, is deactivated (UC-01 10a). */
  substituteEmployeeNumber: number | null;
}

@Injectable()
export class EmployeeDirectory {
  constructor(private readonly prisma: PrismaService) {}

  /** Any employee, active or not: approver resolution needs to know who was deactivated (10a). */
  async find(employeeNumber: number): Promise<EmployeeProfile | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeNumber },
      include: { roles: { include: { role: true } } },
    });
    if (!employee) {
      return null;
    }
    return {
      employeeNumber: employee.employeeNumber,
      categoryId: employee.categoryId,
      areaId: employee.areaId,
      active: employee.active,
      roles: employee.roles.map((grant) => grant.role.name).filter(isRole),
      supervisorEmployeeNumber: employee.supervisorEmployeeNumber,
      substituteEmployeeNumber: employee.substituteEmployeeNumber,
    };
  }

  /** RN28: a deactivated employee is treated as missing (null). */
  async findActive(employeeNumber: number): Promise<EmployeeProfile | null> {
    const employee = await this.find(employeeNumber);
    return employee?.active ? employee : null;
  }

  /** D15: the manager of an area, the last step of the hierarchy (D41). */
  async findAreaManager(areaId: number): Promise<number | null> {
    const area = await this.prisma.area.findUnique({ where: { id: areaId } });
    return area?.managerEmployeeNumber ?? null;
  }
}
