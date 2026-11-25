// TOTP setup: scan the QR with any authenticator app and confirm with its first code (D35, D36).
import { useState, type FormEvent } from 'react';
import { verifyTotp } from '../../../auth/auth-api.js';
import { Alert } from '../../../components/Alert.js';
import { Button } from '../../../components/Button.js';
import { CODE_LENGTH, CodeInput } from '../../../components/CodeInput.js';
import { QrCode } from '../../../components/QrCode.js';
import styles from '../LoginPage.module.css';
import { manualEntryKey, outcomeOfVerification } from '../login-steps.js';
import { StepHeader } from '../StepHeader.js';
import { useLoginRequest } from '../use-login-request.js';
import type { StepCallbacks } from './step-props.js';

const QR_SIZE_PIXELS = 132;

interface EnrollmentQrStepProps extends StepCallbacks {
  challengeToken: string;
  otpauthUri: string;
}

export function EnrollmentQrStep({ challengeToken, otpauthUri, onOutcome, onRestart }: EnrollmentQrStepProps) {
  const [code, setCode] = useState('');
  const request = useLoginRequest('totp', onRestart);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void request.run(async () => {
      try {
        await onOutcome(outcomeOfVerification(await verifyTotp({ challengeToken, code })));
      } finally {
        setCode('');
      }
    });
  };

  return (
    <>
      <StepHeader eyebrow="Primer ingreso · 2 de 3" title="Escaneá el código" />
      <div className={styles.qrCard}>
        <QrCode text={otpauthUri} label="Código QR para tu app de autenticación" size={QR_SIZE_PIXELS} />
        <ol className={styles.qrSteps}>
          <li>Abrí Google Authenticator, Microsoft Authenticator u otra app.</li>
          <li>
            Tocá <strong>Agregar</strong> y escaneá este código.
          </li>
          <li>Escribí abajo el código que aparece.</li>
        </ol>
      </div>
      <details className={styles.manualKey}>
        <summary>¿No podés escanear? Ingresá la clave a mano</summary>
        <p className={styles.secret}>{manualEntryKey(otpauthUri)}</p>
      </details>
      <form className={styles.form} onSubmit={submit}>
        {request.error !== null && <Alert>{request.error}</Alert>}
        <CodeInput label="Código de 6 dígitos de la app" value={code} onChange={setCode} invalid={request.error !== null} />
        <Button variant="dark" type="submit" busy={request.busy} disabled={code.length < CODE_LENGTH}>
          Activar e ingresar
        </Button>
      </form>
    </>
  );
}
