// Lost phone: one of the recovery codes replaces the app code once (D36).
import { useState, type FormEvent } from 'react';
import { recoverWithCode } from '../../../auth/auth-api.js';
import { Alert } from '../../../components/Alert.js';
import { Button } from '../../../components/Button.js';
import { TextField } from '../../../components/TextField.js';
import styles from '../LoginPage.module.css';
import { LoginFootnote } from '../LoginFootnote.js';
import { StepHeader } from '../StepHeader.js';
import { useLoginRequest } from '../use-login-request.js';
import type { StepCallbacks } from './step-props.js';

interface RecoveryStepProps extends StepCallbacks {
  challengeToken: string;
  onBackToApp: () => void;
}

export function RecoveryStep({ challengeToken, onOutcome, onRestart, onBackToApp }: RecoveryStepProps) {
  const [recoveryCode, setRecoveryCode] = useState('');
  const request = useLoginRequest('recovery', onRestart);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void request.run(async () => {
      const tokens = await recoverWithCode({ challengeToken, recoveryCode: recoveryCode.trim() });
      await onOutcome({ kind: 'signedIn', tokens });
    });
  };

  return (
    <>
      <StepHeader eyebrow="Sin celular" title="Usá un código de recuperación">
        Es uno de los 8 códigos que guardaste al activar el segundo factor. Cada uno sirve una sola vez.
      </StepHeader>
      <form className={styles.form} onSubmit={submit}>
        {request.error !== null && <Alert>{request.error}</Alert>}
        <TextField
          label="Código de recuperación"
          appearance="code"
          autoComplete="off"
          spellCheck={false}
          required
          autoFocus
          invalid={request.error !== null}
          value={recoveryCode}
          onChange={(event) => setRecoveryCode(event.target.value)}
        />
        <div className={styles.actions}>
          <Button variant="dark" type="submit" busy={request.busy}>
            Ingresar
          </Button>
          <Button variant="link" onClick={onBackToApp}>
            Volver al código de la app
          </Button>
        </div>
      </form>
      <LoginFootnote>
        ¿Ya no te quedan códigos? Pedile a un Administrador un código de habilitación nuevo: reinicia tu segundo factor.
      </LoginFootnote>
    </>
  );
}
