// Approval tray (/aprobaciones): UC-01 step 12, 13 and 12a for the assigned approver.
import { useEffect, useState } from 'react';
import { Alert } from '../../components/Alert.js';
import { Button } from '../../components/Button.js';
import { PageHeader } from '../../components/PageHeader.js';
import { describeDecisionError } from './approval-errors.js';
import { ApprovalCard, type Decision } from './ApprovalCard.js';
import styles from './ApprovalsPage.module.css';
import type { ApprovalView } from './approvals-api.js';
import { useApprovalTray } from './use-approvals.js';

/** How long the confirmation of a decision stays before it leaves on its own. */
const CONFIRMATION_VISIBLE_MS = 6000;
const SKELETON_CARDS = 3;

type Feedback = { kind: 'approved' | 'rejected'; request: ApprovalView } | { kind: 'error'; message: string };

function feedbackOf(decision: Decision): Feedback {
  if (decision.kind === 'failed') {
    return { kind: 'error', message: describeDecisionError(decision.error, decision.request.requester.fullName) };
  }
  return decision;
}

function Confirmation({ feedback }: { feedback: Feedback }) {
  if (feedback.kind === 'error') {
    return <Alert>{feedback.message}</Alert>;
  }
  const { requester, destination } = feedback.request;
  const approved = feedback.kind === 'approved';
  return (
    <div className={`${styles.confirmation} ${approved ? styles.approved : styles.rejected}`} role="status">
      <span className={styles.tick} aria-hidden="true">
        {approved ? '✓' : '✕'}
      </span>
      <div>
        <span className={styles.confirmationTitle}>
          {approved ? 'Aprobaste' : 'Rechazaste'} el viaje de {requester.fullName} a {destination.city}
        </span>
        <span className={styles.confirmationBody}>
          {approved
            ? 'Le avisamos y ya puede pedir el adelanto de viáticos.'
            : 'Le avisamos junto con tu motivo.'}
        </span>
      </div>
    </div>
  );
}

function EmptyTray() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon} aria-hidden="true">
        ✓
      </div>
      <h3 className={styles.emptyTitle}>Estás al día.</h3>
      <p className={styles.emptyText}>
        No tenés solicitudes esperando tu aprobación. Cuando llegue una nueva, aparece acá.
      </p>
    </div>
  );
}

function TrayContent({ onDecision }: { onDecision: (decision: Decision) => void }) {
  const tray = useApprovalTray(true);
  if (tray.isPending) {
    return (
      <div role="status" aria-label="Cargando solicitudes">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div key={index} className={styles.skeleton} />
        ))}
      </div>
    );
  }
  if (tray.isError) {
    return (
      <>
        <Alert>No pudimos traer las solicitudes. Revisá tu conexión y probá de nuevo.</Alert>
        <Button variant="secondary" className={styles.retry} onClick={() => void tray.refetch()}>
          Reintentar
        </Button>
      </>
    );
  }
  if (tray.data.length === 0) {
    return <EmptyTray />;
  }
  return (
    <ul className={styles.list}>
      {tray.data.map((request, position) => (
        <li key={request.id}>
          <ApprovalCard request={request} position={position} onDecision={onDecision} />
        </li>
      ))}
    </ul>
  );
}

function pendingLabel(count: number | undefined): string {
  if (count === undefined) return '';
  return count === 1 ? '1 pendiente' : `${count} pendientes`;
}

export function ApprovalsPage() {
  const tray = useApprovalTray(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Confirmations leave on their own; errors stay until the next decision.
  useEffect(() => {
    if (feedback === null || feedback.kind === 'error') {
      return;
    }
    const timer = window.setTimeout(() => setFeedback(null), CONFIRMATION_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  return (
    <>
      <PageHeader eyebrow="UC-01" title="Aprobaciones.">
        Solicitudes de viaje que esperan tu decisión, con la cotización que eligió cada persona.
      </PageHeader>
      <section className={styles.panel} aria-labelledby="bandeja-titulo">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle} id="bandeja-titulo">
            Bandeja de aprobación
          </h2>
          <span className={styles.pending}>{pendingLabel(tray.data?.length)}</span>
        </div>
        {feedback !== null && <Confirmation key={JSON.stringify(feedback)} feedback={feedback} />}
        <TrayContent onDecision={(decision) => setFeedback(feedbackOf(decision))} />
      </section>
    </>
  );
}
