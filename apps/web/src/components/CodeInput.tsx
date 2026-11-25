// Six boxes for the TOTP code (D35): typing moves forward, Backspace goes back, pasting fills them all.
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import styles from './CodeInput.module.css';

export const CODE_LENGTH = 6;

interface CodeInputProps {
  /** Only digits, up to CODE_LENGTH. */
  value: string;
  onChange: (code: string) => void;
  label: string;
  invalid?: boolean;
  autoFocus?: boolean;
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function CodeInput({ value, onChange, label, invalid = false, autoFocus = false }: CodeInputProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const focusBox = (index: number) => boxes.current[Math.max(0, Math.min(index, CODE_LENGTH - 1))]?.focus();

  const typeDigit = (index: number, typed: string) => {
    const digit = onlyDigits(typed).slice(-1);
    if (digit === '') {
      return;
    }
    // Typing in a box past the end of what was written appends: the code never has gaps.
    const position = Math.min(index, value.length);
    onChange(onlyDigits(value.slice(0, position) + digit + value.slice(position + 1)));
    focusBox(position + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const position = index < value.length ? index : value.length - 1;
      onChange(value.slice(0, Math.max(position, 0)));
      focusBox(position);
    }
    if (event.key === 'ArrowLeft') focusBox(index - 1);
    if (event.key === 'ArrowRight') focusBox(index + 1);
  };

  // Authenticator apps let you copy the whole code: pasting it fills the six boxes at once.
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = onlyDigits(event.clipboardData.getData('text'));
    onChange(pasted);
    focusBox(pasted.length);
  };

  return (
    <div className={styles.digits} role="group" aria-label={label} aria-invalid={invalid}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          className={styles.digit}
          aria-label={`Dígito ${index + 1} de ${CODE_LENGTH}`}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={2}
          value={value[index] ?? ''}
          autoFocus={autoFocus && index === 0}
          onChange={(event) => typeDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
