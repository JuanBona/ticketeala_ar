// UC-01 step 10, 9a and 10a (D15, D41): who approves a request.
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  EmployeeDirectory,
  type EmployeeProfile,
} from '../../administracion/employee-directory.service.js';

const APPROVER_ROLE = 'aprobador';

@Injectable()
export class ApproverResolver {
  constructor(private readonly employees: EmployeeDirectory) {}

  /**
   * D41: the direct supervisor; over the cap (9a), one level up: the supervisor's supervisor or,
   * failing that, the area manager. If that person was deactivated, their substitute (10a, R02).
   */
  async resolve(requester: EmployeeProfile, overCap: boolean): Promise<number> {
    const designated = overCap
      ? await this.higherLevel(requester)
      : requester.supervisorEmployeeNumber;
    // Nobody above (the head of the hierarchy) or the requester themselves: nobody can approve.
    if (designated === null || designated === requester.employeeNumber) {
      throw new UnprocessableEntityException(
        `No hay aprobador configurado para el empleado ${requester.employeeNumber} (D15)`,
      );
    }
    return this.activeOrSubstitute(designated, requester.employeeNumber);
  }

  /** 9a: the supervisor's supervisor; without one, the manager of the requester's area. */
  private async higherLevel(
    requester: EmployeeProfile,
  ): Promise<number | null> {
    const supervisor = requester.supervisorEmployeeNumber
      ? await this.employees.find(requester.supervisorEmployeeNumber)
      : null;
    return (
      supervisor?.supervisorEmployeeNumber ??
      this.employees.findAreaManager(requester.areaId)
    );
  }

  /** 10a, R02: a deactivated approver hands over only to an explicitly configured substitute. */
  private async activeOrSubstitute(
    designated: number,
    requesterNumber: number,
  ): Promise<number> {
    const approver = await this.employees.find(designated);
    if (approver?.active) {
      return assertCanApprove(approver, requesterNumber);
    }
    const substituteNumber = approver?.substituteEmployeeNumber ?? null;
    const substitute = substituteNumber
      ? await this.employees.find(substituteNumber)
      : null;
    if (!substitute?.active) {
      throw new UnprocessableEntityException(
        `El aprobador ${designated} está dado de baja y no tiene un suplente activo configurado (UC-01 10a, R02)`,
      );
    }
    return assertCanApprove(substitute, requesterNumber);
  }
}

/** The chosen person must hold the approver role and must not be the requester (D33 in spirit). */
function assertCanApprove(
  approver: EmployeeProfile,
  requesterNumber: number,
): number {
  if (approver.employeeNumber === requesterNumber) {
    throw new UnprocessableEntityException(
      `El empleado ${requesterNumber} quedaría como aprobador de su propia solicitud`,
    );
  }
  if (!approver.roles.includes(APPROVER_ROLE)) {
    throw new UnprocessableEntityException(
      `El empleado ${approver.employeeNumber} debería aprobar pero no tiene el rol aprobador`,
    );
  }
  return approver.employeeNumber;
}
