// Synthetic travel requests waiting for approval, shaped like ApprovalView of the contract.
import type { ApprovalView } from '../features/approvals/approvals-api.js';

const POLICY = { id: 7, version: 1, currency: 'ARS', amountCap: '300000.00', minimumAdvanceDays: 7, dailyAllowance: '35000.00' };

function quote(amount: string, exceedsCap: boolean): NonNullable<ApprovalView['selectedQuote']> {
  return {
    origin: 'agencia',
    id: 90,
    description: 'Vuelo y hotel (sintético)',
    supplierCuit: null,
    source: null,
    amount,
    validUntil: null,
    expired: false,
    exceedsCap,
    savingsAgainstExternal: null,
    selected: true,
  };
}

export function syntheticApproval(overrides: Partial<ApprovalView> = {}): ApprovalView {
  return {
    id: 14,
    status: 'pendiente',
    requester: { employeeNumber: 1009, fullName: 'Camila Acosta (sintético)', areaName: 'Sistemas (sintético)' },
    destination: { id: 2, city: 'Córdoba', country: 'Argentina' },
    origin: null,
    startDate: '2026-12-09',
    endDate: '2026-12-11',
    nights: 2,
    reason: 'Capacitación en seguridad informática',
    advanceJustification: null,
    overCapJustification: null,
    approverEmployeeNumber: 1008,
    rejectionReason: null,
    policy: POLICY,
    estimatedAllowance: '70000.00',
    selectedQuote: quote('187500.00', false),
    ...overrides,
  };
}

export const OVER_CAP_APPROVAL = syntheticApproval({
  id: 15,
  requester: { employeeNumber: 1007, fullName: 'Valeria Romero (sintético)', areaName: 'Sistemas (sintético)' },
  destination: { id: 3, city: 'Buenos Aires', country: 'Argentina' },
  reason: 'Reunión con proveedor de servidores',
  overCapJustification: 'Única fecha con lugar en el hotel cercano al datacenter.',
  advanceJustification: 'El proveedor confirmó la reunión el lunes.',
  selectedQuote: quote('354000.00', true),
});
