// Response bodies of the second factor endpoints (RN30, D35, D36).
import { TokenPair } from './auth.responses.js';

/** POST /auth/totp/enroll: what the employee needs to set up the authenticator app. */
export class EnrollmentStart {
  /** New challenge that carries the pending setup; send it with the first code. */
  challengeToken: string;
  /** otpauth:// link; the web or the app draws it as a QR code. */
  otpauthUri: string;
}

/** POST /auth/totp/verify: the session tokens; at the end of a setup also the recovery codes. */
export class SecondFactorResult extends TokenPair {
  /** D36: 8 one-time codes, shown only this once, after a setup. */
  recoveryCodes?: string[];
}

/** POST /auth/totp/enrollment-codes: the code the administrator hands over in person (D36). */
export class IssuedEnrollmentCode {
  /** Format ABCD-EFGH-JKLM-NPQR; works once. */
  enrollmentCode: string;
  /** 24 hours after it was issued. */
  expiresAt: Date;
}
