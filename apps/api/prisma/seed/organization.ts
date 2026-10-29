// Synthetic organization seed: D07 roles, employee categories, areas with managers and 10 employees.
import type { Prisma } from '../../src/generated/prisma/client.js';

type Transaction = Prisma.TransactionClient;

/** D07: the seven roles, with the exact names the guards will check. */
export const ROLE_NAMES = [
  'empleado',
  'aprobador',
  'agencia',
  'contaduria',
  'gerencia',
  'administrador',
  'auditor',
] as const;

type RoleName = (typeof ROLE_NAMES)[number];

/** Category names taken from the CATEGORIA_EMPLEADO examples of the Etapa 3 data dictionary. */
export const CATEGORY_NAMES = ['Junior', 'Senior', 'Gerencial'] as const;

type CategoryName = (typeof CATEGORY_NAMES)[number];

interface SyntheticArea {
  name: string;
  managerEmployeeNumber: number;
}

export const SYNTHETIC_AREAS: SyntheticArea[] = [
  {
    name: 'Administración y Finanzas (sintético)',
    managerEmployeeNumber: 1001,
  },
  { name: 'Comercial (sintético)', managerEmployeeNumber: 1004 },
  { name: 'Sistemas (sintético)', managerEmployeeNumber: 1007 },
];

interface SyntheticEmployee {
  employeeNumber: number;
  fullName: string;
  email: string;
  category: CategoryName;
  areaName: string;
  supervisorEmployeeNumber: number | null;
  substituteEmployeeNumber: number;
  roles: RoleName[];
}

const [ADMINISTRATION, COMMERCIAL, SYSTEMS] = SYNTHETIC_AREAS.map(
  (area) => area.name,
);

// D15: the approver is the supervisor; 1001 heads the hierarchy, so it is the only one without one.
// D33: nobody is their own supervisor or substitute.
export const SYNTHETIC_EMPLOYEES: SyntheticEmployee[] = [
  {
    employeeNumber: 1001,
    fullName: 'Laura Gómez (sintético)',
    email: 'laura.gomez@example.com',
    category: 'Gerencial',
    areaName: ADMINISTRATION,
    supervisorEmployeeNumber: null,
    substituteEmployeeNumber: 1004,
    roles: ['empleado', 'aprobador', 'gerencia'],
  },
  {
    employeeNumber: 1002,
    fullName: 'Martín Ruiz (sintético)',
    email: 'martin.ruiz@example.com',
    category: 'Senior',
    areaName: ADMINISTRATION,
    supervisorEmployeeNumber: 1001,
    substituteEmployeeNumber: 1003,
    roles: ['empleado', 'contaduria'],
  },
  {
    employeeNumber: 1003,
    fullName: 'Sofía Díaz (sintético)',
    email: 'sofia.diaz@example.com',
    category: 'Senior',
    areaName: ADMINISTRATION,
    supervisorEmployeeNumber: 1001,
    substituteEmployeeNumber: 1002,
    roles: ['empleado', 'auditor'],
  },
  {
    employeeNumber: 1004,
    fullName: 'Diego Fernández (sintético)',
    email: 'diego.fernandez@example.com',
    category: 'Gerencial',
    areaName: COMMERCIAL,
    supervisorEmployeeNumber: 1001,
    substituteEmployeeNumber: 1007,
    roles: ['empleado', 'aprobador', 'gerencia'],
  },
  {
    employeeNumber: 1005,
    fullName: 'Carla Benítez (sintético)',
    email: 'carla.benitez@example.com',
    category: 'Junior',
    areaName: COMMERCIAL,
    supervisorEmployeeNumber: 1004,
    substituteEmployeeNumber: 1006,
    roles: ['agencia'],
  },
  {
    employeeNumber: 1006,
    fullName: 'Pablo Sosa (sintético)',
    email: 'pablo.sosa@example.com',
    category: 'Junior',
    areaName: COMMERCIAL,
    supervisorEmployeeNumber: 1004,
    substituteEmployeeNumber: 1005,
    roles: ['empleado'],
  },
  {
    employeeNumber: 1007,
    fullName: 'Valeria Romero (sintético)',
    email: 'valeria.romero@example.com',
    category: 'Gerencial',
    areaName: SYSTEMS,
    supervisorEmployeeNumber: 1001,
    substituteEmployeeNumber: 1004,
    roles: ['empleado', 'aprobador', 'gerencia'],
  },
  {
    employeeNumber: 1008,
    fullName: 'Lucas Torres (sintético)',
    email: 'lucas.torres@example.com',
    category: 'Senior',
    areaName: SYSTEMS,
    supervisorEmployeeNumber: 1007,
    substituteEmployeeNumber: 1010,
    roles: ['empleado', 'aprobador'],
  },
  {
    employeeNumber: 1009,
    fullName: 'Camila Acosta (sintético)',
    email: 'camila.acosta@example.com',
    category: 'Junior',
    areaName: SYSTEMS,
    supervisorEmployeeNumber: 1008,
    substituteEmployeeNumber: 1010,
    roles: ['empleado'],
  },
  {
    employeeNumber: 1010,
    fullName: 'Nicolás Medina (sintético)',
    email: 'nicolas.medina@example.com',
    category: 'Senior',
    areaName: SYSTEMS,
    supervisorEmployeeNumber: 1007,
    substituteEmployeeNumber: 1008,
    roles: ['empleado', 'administrador'],
  },
];

/** D07: creates the roles that are missing and returns their ids by name. */
async function seedRoles(
  transaction: Transaction,
): Promise<Map<string, number>> {
  const roleIds = new Map<string, number>();
  for (const name of ROLE_NAMES) {
    // upsert = insert if missing; `update: {}` leaves an existing row untouched.
    const role = await transaction.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleIds.set(name, role.id);
  }
  return roleIds;
}

async function seedCategories(
  transaction: Transaction,
): Promise<Map<string, number>> {
  const categoryIds = new Map<string, number>();
  for (const name of CATEGORY_NAMES) {
    const category = await transaction.employeeCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryIds.set(name, category.id);
  }
  return categoryIds;
}

/** Areas have no unique name in the schema, so they are looked up before creating them. */
async function seedAreas(
  transaction: Transaction,
): Promise<Map<string, number>> {
  const areaIds = new Map<string, number>();
  for (const { name } of SYNTHETIC_AREAS) {
    const existing = await transaction.area.findFirst({ where: { name } });
    // Reuse the area if it is already there; create it otherwise.
    const area =
      existing ?? (await transaction.area.create({ data: { name } }));
    areaIds.set(name, area.id);
  }
  return areaIds;
}

function requireId(ids: Map<string, number>, name: string): number {
  const id = ids.get(name);
  if (id === undefined) {
    throw new Error(`Semilla: no se encontró el id de "${name}"`);
  }
  return id;
}

interface EmployeeSeedContext {
  categoryIds: Map<string, number>;
  areaIds: Map<string, number>;
  passwordHash: string;
}

/** Creates the employee without hierarchy; an existing employee keeps its password and data. */
async function seedEmployee(
  transaction: Transaction,
  employee: SyntheticEmployee,
  context: EmployeeSeedContext,
): Promise<void> {
  await transaction.employee.upsert({
    where: { employeeNumber: employee.employeeNumber },
    update: {},
    create: {
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      email: employee.email,
      categoryId: requireId(context.categoryIds, employee.category),
      areaId: requireId(context.areaIds, employee.areaName),
      passwordHash: context.passwordHash,
      // No second factor yet: RN30 roles set it up with an enrollment code (D36).
      totpSecret: null,
    },
  });
}

/** D15: supervisor and substitute go in a second pass because they point to other employees. */
async function seedHierarchy(transaction: Transaction): Promise<void> {
  for (const employee of SYNTHETIC_EMPLOYEES) {
    await transaction.employee.update({
      where: { employeeNumber: employee.employeeNumber },
      data: {
        supervisorEmployeeNumber: employee.supervisorEmployeeNumber,
        substituteEmployeeNumber: employee.substituteEmployeeNumber,
      },
    });
  }
  // D15: each area points to its manager, who must exist by now.
  for (const area of SYNTHETIC_AREAS) {
    await transaction.area.updateMany({
      where: { name: area.name },
      data: { managerEmployeeNumber: area.managerEmployeeNumber },
    });
  }
}

async function seedEmployeeRoles(
  transaction: Transaction,
  roleIds: Map<string, number>,
): Promise<void> {
  // One row per employee and role (RN29: several roles per employee).
  const assignments = SYNTHETIC_EMPLOYEES.flatMap((employee) =>
    employee.roles.map((role) => ({
      employeeNumber: employee.employeeNumber,
      roleId: requireId(roleIds, role),
    })),
  );
  await transaction.employeeRole.createMany({
    data: assignments,
    // Running the seed again does not fail on roles already granted.
    skipDuplicates: true,
  });
}

/** Seeds roles (D07), categories, areas (D15) and employees with an argon2 hash of SEED_PASSWORD. */
export async function seedOrganization(
  transaction: Transaction,
  passwordHash: string,
): Promise<void> {
  const roleIds = await seedRoles(transaction);
  const categoryIds = await seedCategories(transaction);
  const areaIds = await seedAreas(transaction);
  const context = { categoryIds, areaIds, passwordHash };
  // First every employee, then the hierarchy: a supervisor must exist before someone points to it.
  for (const employee of SYNTHETIC_EMPLOYEES) {
    await seedEmployee(transaction, employee, context);
  }
  await seedHierarchy(transaction);
  await seedEmployeeRoles(transaction, roleIds);
}
