// Runs one request of a Login step: busy state, the error message, and the restart on an expired challenge.
import { useState } from 'react';
import { describeLoginError, type LoginStage } from './login-errors.js';

export interface LoginRequestState {
  busy: boolean;
  error: string | null;
  run: (action: () => Promise<void>) => Promise<void>;
}

export function useLoginRequest(stage: LoginStage, onRestart: (reason: string) => void): LoginRequestState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      const described = describeLoginError(caught, stage);
      if (described.mustRestart) {
        onRestart(described.message);
        return;
      }
      setError(described.message);
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}
