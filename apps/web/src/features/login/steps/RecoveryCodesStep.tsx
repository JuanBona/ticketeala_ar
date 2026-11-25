// Last step of the TOTP setup: the 8 recovery codes, shown only this once (D36).
import { useState, type CSSProperties } from 'react';
import type { TokenPair } from '../../../auth/auth-api.js';
import { Alert } from '../../../components/Alert.js';
import { Button } from '../../../components/Button.js';
import styles from '../LoginPage.module.css';
import { StepHeader } from '../StepHeader.js';
import { useLoginRequest } from '../use-login-request.js';
import type { StepCallbacks } from './step-props.js';

const DOWNLOAD_FILE_NAME = 'amr-viajes-codigos-de-recuperacion.txt';

interface RecoveryCodesStepProps extends StepCallbacks {
  recoveryCodes: string[];
  tokens: TokenPair;
}

function downloadCodes(recoveryCodes: string[]): void {
  const text = ['AMR Viajes · códigos de recuperación', 'Cada código sirve una sola vez.', '', ...recoveryCodes].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  link.download = DOWNLOAD_FILE_NAME;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function RecoveryCodesStep({ recoveryCodes, tokens, onOutcome, onRestart }: RecoveryCodesStepProps) {
  const [saved, setSaved] = useState(false);
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  const request = useLoginRequest('totp', onRestart);

  // Some browsers block the clipboard (no permission, not HTTPS): the download still works.
  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopyResult('copied');
    } catch (error) {
      console.warn('No se pudieron copiar los códigos de recuperación', error);
      setCopyResult('failed');
    }
  };

  return (
    <>
      <StepHeader eyebrow="Primer ingreso · 3 de 3" title="Guardá estos códigos">
        Si perdés el celular, cada uno te deja entrar una vez en lugar del código de la app.
      </StepHeader>
      <div className={styles.notice} role="note">
        Se muestran solo ahora. Después no hay forma de volver a verlos.
      </div>
      <ul className={styles.codes} aria-label="Códigos de recuperación">
        {recoveryCodes.map((code, index) => (
          <li key={code} className={styles.code} style={{ animationDelay: `calc(var(--motion-list-stagger) * ${index})` } as CSSProperties}>
            {code}
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <Button variant="secondary" onClick={() => void copyCodes()}>
          {copyResult === 'copied' ? 'Copiados' : 'Copiar'}
        </Button>
        <Button variant="secondary" onClick={() => downloadCodes(recoveryCodes)}>
          Descargar .txt
        </Button>
      </div>
      {copyResult === 'failed' && <Alert>No se pudieron copiar. Usá "Descargar .txt" o anotalos a mano.</Alert>}
      {request.error !== null && <Alert>{request.error}</Alert>}
      <label className={styles.check}>
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        Los guardé en un lugar seguro
      </label>
      <Button
        variant="primary"
        busy={request.busy}
        disabled={!saved}
        onClick={() => void request.run(() => onOutcome({ kind: 'signedIn', tokens }))}
      >
        Ingresar al panel
      </Button>
    </>
  );
}
