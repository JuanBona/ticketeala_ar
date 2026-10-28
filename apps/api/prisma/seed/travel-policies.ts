// Synthetic travel seed: four destinations with real coordinates and policy version 1 per category and destination.
import type {
  CapUnit,
  ExpenseCategory,
  Prisma,
} from '../../src/generated/prisma/client.js';
import { CATEGORY_NAMES } from './organization.js';

type Transaction = Prisma.TransactionClient;

interface SyntheticDestination {
  city: string;
  country: string;
  latitude: string;
  longitude: string;
}

/** Real city-centre coordinates, needed by S10 (D16, D19). */
export const SYNTHETIC_DESTINATIONS: SyntheticDestination[] = [
  {
    city: 'Rosario',
    country: 'Argentina',
    latitude: '-32.94682000',
    longitude: '-60.63932000',
  },
  {
    city: 'Córdoba',
    country: 'Argentina',
    latitude: '-31.42008000',
    longitude: '-64.18877000',
  },
  {
    city: 'Buenos Aires',
    country: 'Argentina',
    latitude: '-34.60372000',
    longitude: '-58.38159000',
  },
  {
    city: 'Mendoza',
    country: 'Argentina',
    latitude: '-32.88946000',
    longitude: '-68.84584000',
  },
];

const SEED_POLICY_VERSION = 1;
const POLICY_CURRENCY = 'ARS';
const MINIMUM_ADVANCE_DAYS = 7;

/** Contaduría (1002) authors the initial policies. */
const POLICY_AUTHOR_EMPLOYEE_NUMBER = 1002;

interface PolicyAmounts {
  amountCap: number;
  dailyAllowance: number;
  caps: Record<ExpenseCategory, number>;
}

/** Synthetic amounts in ARS for a Junior employee; other categories scale them. */
const JUNIOR_AMOUNTS_BY_CITY: Record<string, PolicyAmounts> = {
  Rosario: {
    amountCap: 120000,
    dailyAllowance: 25000,
    caps: { LODGING: 60000, TRANSPORT: 30000, MEALS: 20000, OTHER: 10000 },
  },
  Córdoba: {
    amountCap: 250000,
    dailyAllowance: 30000,
    caps: { LODGING: 70000, TRANSPORT: 40000, MEALS: 25000, OTHER: 12000 },
  },
  'Buenos Aires': {
    amountCap: 300000,
    dailyAllowance: 35000,
    caps: { LODGING: 90000, TRANSPORT: 45000, MEALS: 30000, OTHER: 15000 },
  },
  Mendoza: {
    amountCap: 400000,
    dailyAllowance: 32000,
    caps: { LODGING: 80000, TRANSPORT: 50000, MEALS: 28000, OTHER: 14000 },
  },
};

const CATEGORY_MULTIPLIER: Record<(typeof CATEGORY_NAMES)[number], number> = {
  Junior: 1,
  Senior: 1.25,
  Gerencial: 1.5,
};

/** D26: lodging is capped per night, meals per day (nights + 1), the rest per receipt. */
const CAP_UNIT_BY_EXPENSE_CATEGORY: Record<ExpenseCategory, CapUnit> = {
  LODGING: 'PER_NIGHT',
  TRANSPORT: 'PER_RECEIPT',
  MEALS: 'PER_DAY',
  OTHER: 'PER_RECEIPT',
};

/** Destinations have no unique key in the schema, so they are looked up by city and country. */
async function seedDestination(
  transaction: Transaction,
  destination: SyntheticDestination,
): Promise<number> {
  const where = { city: destination.city, country: destination.country };
  const existing = await transaction.destination.findFirst({ where });
  if (existing) {
    return existing.id;
  }
  const created = await transaction.destination.create({ data: destination });
  return created.id;
}

function toMoney(amount: number): string {
  return amount.toFixed(2);
}

function buildExpenseCaps(amounts: PolicyAmounts, multiplier: number) {
  return Object.entries(CAP_UNIT_BY_EXPENSE_CATEGORY).map(
    ([category, unit]) => ({
      category: category as ExpenseCategory,
      unit,
      amount: toMoney(amounts.caps[category as ExpenseCategory] * multiplier),
    }),
  );
}

interface PolicyTarget {
  categoryId: number;
  categoryName: (typeof CATEGORY_NAMES)[number];
  destinationId: number;
  city: string;
}

/**
 * D01, D26: inserts version 1 with its caps. Versions are immutable (triggers), so an existing
 * version 1 is left as it is.
 */
async function seedPolicy(
  transaction: Transaction,
  target: PolicyTarget,
): Promise<void> {
  const existing = await transaction.expensePolicy.findFirst({
    where: {
      categoryId: target.categoryId,
      destinationId: target.destinationId,
      version: SEED_POLICY_VERSION,
    },
  });
  if (existing) {
    return;
  }
  const amounts = JUNIOR_AMOUNTS_BY_CITY[target.city];
  const multiplier = CATEGORY_MULTIPLIER[target.categoryName];
  await transaction.expensePolicy.create({
    data: {
      categoryId: target.categoryId,
      destinationId: target.destinationId,
      currency: POLICY_CURRENCY,
      amountCap: toMoney(amounts.amountCap * multiplier),
      minimumAdvanceDays: MINIMUM_ADVANCE_DAYS,
      dailyAllowance: toMoney(amounts.dailyAllowance * multiplier),
      version: SEED_POLICY_VERSION,
      authorEmployeeNumber: POLICY_AUTHOR_EMPLOYEE_NUMBER,
      expenseCaps: { create: buildExpenseCaps(amounts, multiplier) },
    },
  });
}

/** Seeds the destinations and one policy version 1 for every category and destination. */
export async function seedTravelPolicies(
  transaction: Transaction,
): Promise<void> {
  const categories = await transaction.employeeCategory.findMany({
    where: { name: { in: [...CATEGORY_NAMES] } },
  });
  for (const destination of SYNTHETIC_DESTINATIONS) {
    const destinationId = await seedDestination(transaction, destination);
    for (const category of categories) {
      await seedPolicy(transaction, {
        categoryId: category.id,
        categoryName: category.name as (typeof CATEGORY_NAMES)[number],
        destinationId,
        city: destination.city,
      });
    }
  }
}
