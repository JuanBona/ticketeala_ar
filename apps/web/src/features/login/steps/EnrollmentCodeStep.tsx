// First login of an RN30 role: the enrollment code an administrator handed out in person (D36).
import { useState, type FormEvent } from 'react';
import { startEnrollment } from '../../../auth/auth-api.js';
import { Alert } from '../../../components/Alert.js';
import { Button } from '../../../components/Button.js';
import { TextField } from '../../../components/TextField.js';
import styles from '../LoginPage.module.css';
import { LoginFootnote } from '../LoginFootnote.js';
import { StepHeader } from '../StepHeader.js';
import { useLoginRequest } from '../use-login-request.js';
import type { StepCallbacks } from './step-props.js';

export function EnrollmentCodeStep({ challengeToken, onOutcome, onRestart }: StepCallbacks & { challengeToken: string }) {
  const [enrollmentCode, setEnrollmentCode] = useState('');
  const request = useLoginRequest('enrollmentCode', onRestart);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void request.run(async () => {
      const enrollment = await startEnrollment({ challengeToken, enrollmentCode: enrollmentCode.trim() });
      await onOutcome({ kind: 'nextStep', step: { name: 'enrollmentQr', ...enrollment } });
    });
  };

  return (
    <>
      <StepHeader eyebrow="Primer ingreso · 1 de 3" title="Activá tu segundo factor">
        Tu rol aprueba o maneja dinero, así que además de la contraseña vas a usar un código de tu celular.
      </StepHeader>
      <form className={styles.form} onSubmit={submit}>
        {request.error !== null && <Alert>{request.error}</Alert>}
        <TextField
          label="Código de habilitación"
          appearance="code"
          hint="Te lo entrega en persona un Administrador. Vence a las 24 horas."
          autoComplete="off"
          spellCheck={false}
          required
          autoFocus
          invalid={request.error !== null}
          value={enrollmentCode}
          onChange={(event) => setEnrollmentCode(event.target.value)}
        />
        <Button variant="primary" type="submit" busy={request.busy}>
          Continuar
        </Button>
      </form>
      <LoginFootnote />
    </>
  );
}
