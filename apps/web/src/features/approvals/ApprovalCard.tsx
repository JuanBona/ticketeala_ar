// One request in the approval tray: who asks, the trip, the chosen quote against the cap, and the decision.
import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { Button } from '../../components/Button.js';
import type { ApprovalView } from './approvals-api.js';
import styles from './ApprovalCard.module.css';
import { formatAmount, formatDateRange, initialsOf, nightsLabel, policyStatus } from './approval-format.js';
import { useApprove, useReject } from './use-approvals.js';

/** Matches the maxLength of RejectRequest.reason in the contract. */
const MAXIMUM_REASON_LENGTH = 500;

export type Decision = { kind: 'approved' | 'rejected'; request: ApprovalView } | { kind: 'failed'; error: unknown; request: ApprovalView };

interface ApprovalCardProps {
  request: ApprovalView;
  onDecision: (decision: Decision) => void;
  /** Position in the list, so the cards enter one after another. */
  position: number;
}

function PolicyChip({ request }: { request: ApprovalView }) {
  const status = policyStatus(request);
  if (status.withinPolicy) {
    return <span className={`${styles.chip} ${styles.withinPolicy}`}>✓ Dentro de política</span>;
  }
  return <span className={`${styles.chip} ${styles.overCap}`}>↑ Excede tope +{status.excessPercent} %</span>;
}

/** UC-01 4a and 9a: the justifications "stay visible for the Approver". */
function Justifications({ request }: { request: ApprovalView }) {
  return (
    <>
      {request.overCapJustification !== null && (
        <blockquote className={styles.justification}>
          <span className={styles.justificationLabel}>Justificación del exceso · te llega por ser nivel superior</span>
          <p>{request.overCapJustification}</p>
        </blockquote>
      )}
      {request.advanceJustification !== null && (
        <blockquote className={styles.justification}>
          <span className={styles.justificationLabel}>
            Justificación de anticipación · mínimo {request.policy.minimumAdvanceDays} días
          </span>
          <p>{request.advanceJustification}</p>
        </blockquote>
      )}
    </>
  );
}

function RequestSummary({ request }: { request: ApprovalView }) {
  const { requester, policy, selectedQuote } = request;
  const trip = [request.destination.city, request.reason, formatDateRange(request.startDate, request.endDate)]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={styles.top}>
      <div className={styles.avatar} aria-hidden="true">
        {initialsOf(requester.fullName)}
      </div>
      <div className={styles.info}>
        <h3 className={styles.name}>
          {requester.fullName} <span className={styles.area}>· {requester.areaName}</span>
        </h3>
        <p className={styles.trip}>{trip}</p>
        <ul className={styles.meta}>
          <li>{nightsLabel(request.nights)}</li>
          <li>Viático estimado {formatAmount(request.estimatedAllowance, policy.currency)}</li>
          <li>Tope {formatAmount(policy.amountCap, policy.currency)}</li>
          <li>N.º {request.id}</li>
        </ul>
      </div>
      <div className={styles.money}>
        {selectedQuote !== null && <span className={styles.amount}>{formatAmount(selectedQuote.amount, policy.currency)}</span>}
        <PolicyChip request={request} />
      </div>
    </div>
  );
}

export function ApprovalCard({ request, onDecision, position }: ApprovalCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const approve = useApprove();
  const reject = useReject();
  const firstName = request.requester.fullName.split(' ')[0] ?? request.requester.fullName;
  const busy = approve.isPending || reject.isPending;

  const handleApprove = () =>
    approve.mutate(request.id, {
      onSuccess: () => onDecision({ kind: 'approved', request }),
      onError: (error) => onDecision({ kind: 'failed', error, request }),
    });

  const handleReject = (event: FormEvent) => {
    event.preventDefault();
    reject.mutate(
      { travelRequestId: request.id, reason: reason.trim() },
      {
        onSuccess: () => onDecision({ kind: 'rejected', request }),
        onError: (error) => onDecision({ kind: 'failed', error, request }),
      },
    );
  };

  return (
    <article
      className={styles.card}
      aria-label={`Solicitud de ${request.requester.fullName}`}
      style={{ animationDelay: `calc(var(--motion-list-stagger) * ${position})` } as CSSProperties}
    >
      <RequestSummary request={request} />
      <Justifications request={request} />
      {!rejecting && (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={styles.rejectIcon}
            aria-label={`Rechazar la solicitud de ${request.requester.fullName}`}
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            ✕
          </Button>
          <Button variant="dark" className={styles.approve} busy={approve.isPending} disabled={busy} onClick={handleApprove}>
            Aprobar
          </Button>
        </div>
      )}
      {rejecting && (
        <form className={styles.rejectForm} onSubmit={handleReject}>
          <label className={styles.label} htmlFor={reasonId}>
            Motivo del rechazo (obligatorio)
          </label>
          <textarea
            id={reasonId}
            className={styles.reason}
            rows={2}
            maxLength={MAXIMUM_REASON_LENGTH}
            placeholder="Ej.: buscar alojamiento dentro del tope"
            aria-describedby={`${reasonId}-hint`}
            autoFocus
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <span className={styles.hint} id={`${reasonId}-hint`}>
            {firstName} lo va a ver junto con el rechazo.
          </span>
          <div className={styles.rejectActions}>
            <Button variant="secondary" className={styles.cancel} disabled={busy} onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button variant="dark" type="submit" className={styles.confirmReject} busy={reject.isPending} disabled={reason.trim() === ''}>
              Confirmar rechazo
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
