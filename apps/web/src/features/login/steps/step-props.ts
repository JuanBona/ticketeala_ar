// What every Login step receives from LoginPage.
import type { LoginOutcome } from '../login-steps.js';

export interface StepCallbacks {
  /** Signs in, or moves to the step the API answer leads to. */
  onOutcome: (outcome: LoginOutcome) => Promise<void>;
  /** Back to the password step, showing why (expired challenge, D35). */
  onRestart: (reason: string) => void;
}
