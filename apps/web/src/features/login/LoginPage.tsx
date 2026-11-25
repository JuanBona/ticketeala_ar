// Login screen (/login): password, then the TOTP code, setup or recovery that RN30 roles owe (D35, D36).
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../auth/AuthProvider.js';
import { BrandPanel, type SetupProgress } from './BrandPanel.js';
import styles from './LoginPage.module.css';
import type { LoginOutcome, LoginStep } from './login-steps.js';
import { CredentialsStep } from './steps/CredentialsStep.js';
import { EnrollmentCodeStep } from './steps/EnrollmentCodeStep.js';
import { EnrollmentQrStep } from './steps/EnrollmentQrStep.js';
import { RecoveryCodesStep } from './steps/RecoveryCodesStep.js';
import { RecoveryStep } from './steps/RecoveryStep.js';
import type { StepCallbacks } from './steps/step-props.js';
import { TotpStep } from './steps/TotpStep.js';

const SETUP_PROGRESS: Partial<Record<LoginStep['name'], SetupProgress>> = {
  enrollmentCode: 0,
  enrollmentQr: 1,
  recoveryCodes: 2,
};

interface StepContext {
  callbacks: StepCallbacks;
  goTo: (next: LoginStep) => void;
  /** Why the person is back at step 1, if they were sent back. */
  notice: string | null;
}

function renderStep(step: LoginStep, { callbacks, goTo, notice }: StepContext) {
  switch (step.name) {
    case 'credentials':
      return <CredentialsStep {...callbacks} notice={notice} />;
    case 'totp':
      return (
        <TotpStep
          {...callbacks}
          challengeToken={step.challengeToken}
          onBack={() => goTo({ name: 'credentials' })}
          onLostPhone={() => goTo({ name: 'recovery', challengeToken: step.challengeToken })}
        />
      );
    case 'recovery':
      return (
        <RecoveryStep
          {...callbacks}
          challengeToken={step.challengeToken}
          onBackToApp={() => goTo({ name: 'totp', challengeToken: step.challengeToken })}
        />
      );
    case 'enrollmentCode':
      return <EnrollmentCodeStep {...callbacks} challengeToken={step.challengeToken} />;
    case 'enrollmentQr':
      return <EnrollmentQrStep {...callbacks} challengeToken={step.challengeToken} otpauthUri={step.otpauthUri} />;
    case 'recoveryCodes':
      return <RecoveryCodesStep {...callbacks} recoveryCodes={step.recoveryCodes} tokens={step.tokens} />;
  }
}

export function LoginPage() {
  const { state, signIn } = useAuth();
  const [step, setStep] = useState<LoginStep>({ name: 'credentials' });
  const [notice, setNotice] = useState<string | null>(null);
  const stepContainer = useRef<HTMLDivElement>(null);
  const isFirstStep = useRef(true);

  // Screen readers and keyboards follow the change of step: focus goes to the new title.
  useEffect(() => {
    if (isFirstStep.current) {
      isFirstStep.current = false;
      return;
    }
    stepContainer.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [step.name]);

  if (state.status === 'signedIn') {
    return <Navigate to="/" replace />;
  }

  const goTo = (next: LoginStep) => {
    setNotice(null);
    setStep(next);
  };
  const callbacks: StepCallbacks = {
    onOutcome: async (outcome: LoginOutcome) => {
      if (outcome.kind === 'signedIn') {
        await signIn(outcome.tokens);
        return;
      }
      goTo(outcome.step);
    },
    onRestart: (reason) => {
      setStep({ name: 'credentials' });
      setNotice(reason);
    },
  };

  return (
    <main className={styles.page}>
      <BrandPanel setupProgress={SETUP_PROGRESS[step.name]} />
      <section className={styles.side}>
        <div className={styles.box} ref={stepContainer}>
          <div className={styles.step} key={step.name}>
            {renderStep(step, { callbacks, goTo, notice })}
          </div>
        </div>
      </section>
    </main>
  );
}
