// Step 2 of the Login for RN30 roles: the 6-digit code of the authenticator app (D35).
import { useState, type FormEvent } from 'react';
import { verifyTotp } from '../../../auth/auth-api.js';
import { Alert } from '../../../components/Alert.js';
import { Button } from '../../../components/Button.js';
import { CODE_LENGTH, CodeInput } from '../../../components/CodeInput.js';
import styles from '../LoginPage.module.css';
import { outcomeOfVerification } from '../login-steps.js';
import { LoginFootnote } from '../LoginFootnote.js';
import { StepHeader } from '../StepHeader.js';
import { useLoginRequest } from '../use-login-request.js';
import type { StepCallbacks } from './step-props.js';

interface TotpStepProps extends StepCallbacks {
  challengeToken: string;
  onBack: () => void;
  onLostPhone: () => void;
}

export function TotpStep({ challengeToken, onOutcome, onRestart, onBack, onLostPhone }: TotpStepProps) {
  const [code, setCode] = useState('');
  const request = useLoginRequest('totp', onRestart);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void request.run(async () => {
      try {
        await onOutcome(outcomeOfVerification(await verifyTotp({ challengeToken, code })));
      } finally {
        // A TOTP code works only once (D35): after any attempt the next one starts empty.
        setCode('');
      }
    });
  };

  return (
    <>
      <StepHeader eyebrow="Paso 2 de 2" title="Verificá que sos vos">
        Ingresá el código de 6 dígitos que muestra tu app de autenticación. Cambia cada 30 segundos.
      </StepHeader>
      <form className={styles.form} onSubmit={submit}>
        {request.error !== null && <Alert>{request.error}</Alert>}
        <CodeInput label="Código de 6 dígitos" value={code} onChange={setCode} invalid={request.error !== null} autoFocus />
        <div className={styles.actions}>
          <Button variant="dark" type="submit" busy={request.busy} disabled={code.length < CODE_LENGTH}>
            Verificar e ingresar
          </Button>
          <div className={styles.links}>
            <Button variant="link" onClick={onBack}>
              Volver al paso anterior
            </Button>
            <Button variant="link" onClick={onLostPhone}>
              Perdí mi celular
            </Button>
          </div>
        </div>
      </form>
      <LoginFootnote />
    </>
  );
}
