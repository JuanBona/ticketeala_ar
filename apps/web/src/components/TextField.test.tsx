// Checks that the text field is accessible: real label, hint and invalid state.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField.js';

describe('TextField', () => {
  it('links the label to the input', () => {
    render(<TextField label="Contraseña" type="password" />);

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('describes the input with its hint', () => {
    render(<TextField label="Código de habilitación" hint="Vence a las 24 horas." />);

    expect(screen.getByLabelText('Código de habilitación')).toHaveAccessibleDescription('Vence a las 24 horas.');
  });

  it('marks the input as invalid for screen readers', () => {
    render(<TextField label="Contraseña" invalid />);

    expect(screen.getByLabelText('Contraseña')).toBeInvalid();
  });
});
