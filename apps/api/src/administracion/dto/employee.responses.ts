// Response bodies about employees that other screens show (UC-10 owns the `empleado` table).

/** Who someone is, as a person reads it: the tray says who asks for the trip, the panel who signed in. */
export class EmployeeCard {
  employeeNumber: number;
  fullName: string;
  /** Name of the area the employee belongs to (D15). */
  areaName: string;
}
