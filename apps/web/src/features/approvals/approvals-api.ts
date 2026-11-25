// Calls to the approval endpoints (UC-01 steps 12, 13 and 12a), always with the session JWT.
import type { components } from '../../api/schema.js';
import type { Session } from '../../auth/session.js';

export type ApprovalView = components['schemas']['ApprovalView'];

export function listToApprove(session: Session): Promise<ApprovalView[]> {
  return session.request('/travel-requests/to-approve', { method: 'GET' });
}

/** UC-01 step 13: approved; RN03 enables the allowance advance. */
export function approveRequest(session: Session, travelRequestId: number): Promise<ApprovalView> {
  return session.request(`/travel-requests/${travelRequestId}/approval`, { method: 'POST' });
}

/** UC-01 12a: rejected with the reason the employee will read. */
export function rejectRequest(session: Session, decision: { travelRequestId: number; reason: string }): Promise<ApprovalView> {
  return session.request(`/travel-requests/${decision.travelRequestId}/rejection`, {
    method: 'POST',
    body: { reason: decision.reason },
  });
}
