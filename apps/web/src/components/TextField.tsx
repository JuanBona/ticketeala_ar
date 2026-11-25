// Labeled text input; `code` uses the monospaced style for codes like ABCD-EFGH-JKLM-NPQR.
import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  hint?: string;
  invalid?: boolean;
  appearance?: 'text' | 'code';
}

export function TextField({ label, hint, invalid = false, appearance = 'text', ...inputProps }: TextFieldProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputClass = appearance === 'code' ? `${styles.input} ${styles.code}` : styles.input;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        className={inputClass}
        aria-invalid={invalid}
        aria-describedby={hint === undefined ? undefined : hintId}
      />
      {hint !== undefined && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}
