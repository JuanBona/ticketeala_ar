// Checks that the menu only offers the screens each role may open.
import { describe, expect, it } from 'vitest';
import { visibleNavigation } from './navigation.js';

describe('visibleNavigation', () => {
  it('offers the approval tray to an approver', () => {
    expect(visibleNavigation(['empleado', 'aprobador']).map((item) => item.path)).toEqual(['/aprobaciones']);
  });

  it('hides the approval tray from an employee without the approver role', () => {
    expect(visibleNavigation(['empleado'])).toEqual([]);
  });
});
