// Checks the 6-box TOTP code input: typing, deleting and pasting.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CodeInput } from './CodeInput.js';

function ControlledCodeInput() {
  const [code, setCode] = useState('');
  return (
    <>
      <CodeInput label="Código" value={code} onChange={setCode} />
      <output aria-label="valor">{code}</output>
    </>
  );
}

const digitBox = (position: number) => screen.getByLabelText(`Dígito ${position} de 6`);

describe('CodeInput', () => {
  it('moves to the next box after each digit', async () => {
    render(<ControlledCodeInput />);

    await userEvent.click(digitBox(1));
    await userEvent.keyboard('481');

    expect(screen.getByLabelText('valor')).toHaveTextContent('481');
    expect(digitBox(4)).toHaveFocus();
  });

  it('ignores letters', async () => {
    render(<ControlledCodeInput />);

    await userEvent.click(digitBox(1));
    await userEvent.keyboard('4a8');

    expect(screen.getByLabelText('valor')).toHaveTextContent('48');
  });

  it('fills every box when the whole code is pasted', async () => {
    render(<ControlledCodeInput />);

    await userEvent.click(digitBox(1));
    await userEvent.paste('209 571');

    expect(screen.getByLabelText('valor')).toHaveTextContent('209571');
  });

  it('deletes the last digit and goes back with Backspace', async () => {
    render(<ControlledCodeInput />);

    await userEvent.click(digitBox(1));
    await userEvent.keyboard('481{Backspace}');

    expect(screen.getByLabelText('valor')).toHaveTextContent('48');
    expect(digitBox(3)).toHaveFocus();
  });
});
