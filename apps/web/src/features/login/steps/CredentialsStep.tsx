// Step 1 of the Login: institutional email and password (D12).
import { useState, type FormEvent } from 'react';
import { login } from '../../../auth/auth-api.js';
import { Alert } from '../../../components/Alert.js';
import { Button } from '../../../components/Button.js';
import { TextField } from '../../../components/TextField.js';
import styles from '../LoginPage.module.css';
import { outcomeOfLogin } from '../login-steps.js';
import { LoginFootnote } from '../LoginFootnote.js';
import { StepHeader } from '../StepHeader.js';
import { useLoginRequest } from '../use-login-request.js';
import type { StepCallbacks } from './step-props.js';

export function CredentialsStep({ onOutcome, onRestart, notice }: StepCallbacks & { notice: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const request = useLoginRequest('credentials', onRestart);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void request.run(async () => onOutcome(outcomeOfLogin(await login({ email, password }))));
  };

  const message = request.error ?? notice;
  return (
    <>
      <StepHeader eyebrow="Paso 1 de 2" title="Ingresar" />
      <form className={styles.form} onSubmit={submit}>
        {message !== null && <Alert>{message}</Alert>}
        <TextField
          label="Correo institucional"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          invalid={request.error !== null}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button variant="primary" type="submit" busy={request.busy}>
          Continuar
        </Button>
      </form>
      <LoginFootnote />
    </>
  );
}
