// The approval tray against a fake API: UC-01 steps 12, 13 and 12a, and what happens when it fails.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  apiError,
  apiPath,
  currentEmployeeIs,
  fakeApi,
  recordingPost,
  SYNTHETIC_APPROVER,
  SYNTHETIC_EMPLOYEE,
  SYNTHETIC_TOKENS,
  trayContains,
} from '../../test/fake-api.js';
import { renderApp } from '../../test/render-app.js';
import { OVER_CAP_APPROVAL, syntheticApproval } from '../../test/synthetic-approvals.js';
import type { ApprovalView } from './approvals-api.js';

const WITHIN_POLICY = syntheticApproval();

/** A signed-in session after a reload: only the refresh token is stored. */
function restoreSessionOf(employee: typeof SYNTHETIC_APPROVER) {
  window.sessionStorage.setItem('amr-viajes.refresh-token', 'refresh-guardado');
  fakeApi.use(http.post(apiPath('/auth/refresh'), () => HttpResponse.json(SYNTHETIC_TOKENS)), currentEmployeeIs(employee));
}

/** A tray the API empties as requests get decided, like the real one. */
function liveTray(initial: ApprovalView[]) {
  let pending = [...initial];
  const decided = (id: number) => {
    pending = pending.filter((request) => request.id !== id);
  };
  return { handler: http.get(apiPath('/travel-requests/to-approve'), () => HttpResponse.json(pending)), decided };
}

const cardOf = (fullName: string) => screen.findByRole('article', { name: `Solicitud de ${fullName}` });

describe('Approval tray', () => {
  it('shows who asks, the trip, the chosen quote and that it is within policy', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    fakeApi.use(trayContains([WITHIN_POLICY]));
    renderApp('/aprobaciones');

    const card = await cardOf('Camila Acosta (sintético)');

    expect(card).toHaveTextContent('Sistemas (sintético)');
    expect(card).toHaveTextContent('Córdoba · Capacitación en seguridad informática · 9–11 dic');
    expect(card).toHaveTextContent(/\$\s187\.500/);
    expect(card).toHaveTextContent('Dentro de política');
  });

  it('shows the excess over the cap and both justifications to the approver (4a, 9a)', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    fakeApi.use(trayContains([OVER_CAP_APPROVAL]));
    renderApp('/aprobaciones');

    const card = await cardOf('Valeria Romero (sintético)');

    expect(card).toHaveTextContent('Excede tope +18 %');
    expect(card).toHaveTextContent('Única fecha con lugar en el hotel cercano al datacenter.');
    expect(card).toHaveTextContent('El proveedor confirmó la reunión el lunes.');
  });

  it('approves, confirms it and takes the request out of the tray (UC-01 step 13)', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    const tray = liveTray([WITHIN_POLICY]);
    const approval = recordingPost('/travel-requests/14/approval', () => {
      tray.decided(14);
      return HttpResponse.json({ ...WITHIN_POLICY, status: 'aprobada' });
    });
    fakeApi.use(tray.handler, approval.handler);
    renderApp('/aprobaciones');

    await userEvent.click(within(await cardOf('Camila Acosta (sintético)')).getByRole('button', { name: 'Aprobar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Aprobaste el viaje de Camila Acosta (sintético) a Córdoba');
    expect(await screen.findByText('Estás al día.')).toBeInTheDocument();
    expect(approval.bodies).toEqual([null]);
  });

  it('asks for a reason before rejecting and sends it (12a)', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    const tray = liveTray([WITHIN_POLICY]);
    const rejection = recordingPost('/travel-requests/14/rejection', () => {
      tray.decided(14);
      return HttpResponse.json({ ...WITHIN_POLICY, status: 'rechazada' });
    });
    fakeApi.use(tray.handler, rejection.handler);
    renderApp('/aprobaciones');

    const card = await cardOf('Camila Acosta (sintético)');
    await userEvent.click(within(card).getByRole('button', { name: /Rechazar la solicitud/ }));
    const confirm = within(card).getByRole('button', { name: 'Confirmar rechazo' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(card).getByLabelText('Motivo del rechazo (obligatorio)'), 'Se puede hacer en línea.');
    await userEvent.click(confirm);

    expect(await screen.findByRole('status')).toHaveTextContent('Rechazaste el viaje de Camila Acosta (sintético)');
    expect(rejection.bodies).toEqual([{ reason: 'Se puede hacer en línea.' }]);
  });

  it('explains a request cancelled meanwhile and refreshes the tray (409, 9b)', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    const tray = liveTray([WITHIN_POLICY]);
    fakeApi.use(
      tray.handler,
      http.post(apiPath('/travel-requests/14/approval'), () => {
        tray.decided(14);
        return apiError(409, 'La solicitud 14 está cancelada: no se puede pasar a aprobada');
      }),
    );
    renderApp('/aprobaciones');

    await userEvent.click(within(await cardOf('Camila Acosta (sintético)')).getByRole('button', { name: 'Aprobar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ya no está pendiente');
    expect(await screen.findByText('Estás al día.')).toBeInTheDocument();
  });

  it('offers to retry when the tray cannot be loaded', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    fakeApi.use(http.get(apiPath('/travel-requests/to-approve'), () => apiError(500, 'Error interno')));
    renderApp('/aprobaciones');

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('counts the pending requests in the menu', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    fakeApi.use(trayContains([WITHIN_POLICY, OVER_CAP_APPROVAL]));
    renderApp('/aprobaciones');

    const menu = await screen.findByRole('navigation', { name: 'Principal' });

    expect(await within(menu).findByLabelText('2 pendientes')).toBeInTheDocument();
  });
});

describe('Cached data and sign out', () => {
  it("never shows the previous person's tray to whoever signs in next in the same tab", async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    let trayOwner = 'lucas';
    fakeApi.use(
      http.get(apiPath('/travel-requests/to-approve'), async () => {
        if (trayOwner === 'lucas') return HttpResponse.json([WITHIN_POLICY]);
        await delay('infinite');
        return HttpResponse.json([]);
      }),
      http.post(apiPath('/auth/logout'), () => new HttpResponse(null, { status: 204 })),
      http.post(apiPath('/auth/login'), () => HttpResponse.json({ step: 'authenticated', ...SYNTHETIC_TOKENS })),
    );
    renderApp('/aprobaciones');
    await cardOf('Camila Acosta (sintético)');

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    trayOwner = 'valeria';
    fakeApi.use(currentEmployeeIs({ ...SYNTHETIC_APPROVER, employeeNumber: 1007, fullName: 'Valeria Romero (sintético)' }));
    await userEvent.type(await screen.findByLabelText('Correo institucional'), 'valeria@example.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-sintetica');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('status', { name: 'Cargando solicitudes' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /Camila Acosta/ })).not.toBeInTheDocument();
  });
});

describe('Panel by role', () => {
  it('shows the signed-in person with name, area and role', async () => {
    restoreSessionOf(SYNTHETIC_APPROVER);
    fakeApi.use(trayContains([]));
    renderApp('/aprobaciones');

    const menu = await screen.findByRole('navigation', { name: 'Principal' });

    expect(within(menu).getByText('Lucas Torres (sintético)')).toBeInTheDocument();
    expect(within(menu).getByText('Sistemas (sintético) · Aprobador')).toBeInTheDocument();
  });

  it('sends an employee without the approver role away from the tray (RN29)', async () => {
    restoreSessionOf(SYNTHETIC_EMPLOYEE);
    renderApp('/aprobaciones');

    expect(await screen.findByRole('heading', { name: 'Hola, Pablo Sosa (sintético).' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Aprobaciones/ })).not.toBeInTheDocument();
  });
});
