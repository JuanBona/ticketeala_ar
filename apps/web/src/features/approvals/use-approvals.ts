// Server state of the approval tray (TanStack Query): the list, and approving or rejecting refreshes it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider.js';
import { approveRequest, listToApprove, rejectRequest, type ApprovalView } from './approvals-api.js';

/** Same key everywhere: the sidebar counter and the tray share one request and one cache. */
export const APPROVAL_TRAY_KEY = ['travel-requests', 'to-approve'] as const;

export function useApprovalTray(enabled: boolean) {
  const { session } = useAuth();
  return useQuery({ queryKey: APPROVAL_TRAY_KEY, queryFn: () => listToApprove(session), enabled });
}

/** After any decision, attempt or failure the tray is read again: someone else may have changed it. */
function useTrayMutation<Variables>(decide: (variables: Variables) => Promise<ApprovalView>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decide,
    onSettled: () => queryClient.invalidateQueries({ queryKey: APPROVAL_TRAY_KEY }),
  });
}

export function useApprove() {
  const { session } = useAuth();
  return useTrayMutation((travelRequestId: number) => approveRequest(session, travelRequestId));
}

export function useReject() {
  const { session } = useAuth();
  return useTrayMutation((decision: { travelRequestId: number; reason: string }) => rejectRequest(session, decision));
}
