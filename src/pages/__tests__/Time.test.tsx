import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import Time from '../Time';
import { db } from '../../db';
import type { TimeEntry } from '../../types';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Time />
    </MemoryRouter>,
  );
}

/** The detail drawer, identified by its heading. */
function detailDrawer(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Time Entry' });
}

/**
 * Drawers stay mounted when closed — they slide off-screen and go `inert`
 * rather than unmounting — so "closed" is an attribute check, not absence.
 */
function expectClosed(dialog: HTMLElement) {
  expect(dialog).toHaveAttribute('inert');
}

const LONG_DESCRIPTION =
  'Traced the intermittent 502s to a connection-pool exhaustion under burst load, then reworked the health check so the pod is pulled before it starts refusing traffic.';

let clientId: number;
let projectId: number;
let billedEntryId: number;

beforeEach(async () => {
  navigate.mockClear();
  await db.timeEntries.clear();
  await db.clients.clear();
  await db.projects.clear();
  await db.invoices.clear();

  clientId = (await db.clients.add({
    company: 'Acme Corp',
    contactName: 'A',
    email: 'a@acme.test',
    status: 'active',
    defaultRate: 150,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never)) as number;

  projectId = (await db.projects.add({
    clientId,
    name: 'Platform Hardening',
    type: 'hourly',
    status: 'active',
    rate: 200,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never)) as number;

  const entry = (extra: Partial<TimeEntry>) =>
    ({
      clientId,
      projectId,
      date: new Date(),
      hours: 3,
      description: LONG_DESCRIPTION,
      billable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extra,
    }) as TimeEntry;

  await db.timeEntries.add(entry({}) as never);
  billedEntryId = (await db.timeEntries.add(
    entry({ description: 'Already invoiced work', hours: 2, invoiceId: 99 }) as never,
  )) as number;
});

describe('Time entry detail drawer', () => {
  it('opens from a row click and shows the description in full', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByText(LONG_DESCRIPTION));

    const drawer = detailDrawer();
    expect(within(drawer).getByText(LONG_DESCRIPTION)).toBeInTheDocument();
    expect(within(drawer).getByText('Acme Corp')).toBeInTheDocument();
    expect(within(drawer).getByText('Platform Hardening')).toBeInTheDocument();
  });

  it('values the entry at the project rate', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByText(LONG_DESCRIPTION));
    // 3 hrs at the project's own $200 rate, not the client's $150 default.
    expect(within(detailDrawer()).getByText('$600.00')).toBeInTheDocument();
  });

  it('is reachable by keyboard, since a <tr> cannot take focus', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    const trigger = within(table).getByRole('button', { name: LONG_DESCRIPTION });
    trigger.focus();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(within(detailDrawer()).getByText('Acme Corp')).toBeInTheDocument();
  });

  it('offers edit and delete for an unbilled entry', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByText(LONG_DESCRIPTION));

    const drawer = detailDrawer();
    expect(within(drawer).getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(within(drawer).getByText('Unbilled')).toBeInTheDocument();
  });

  it('locks a billed entry and links to its invoice instead', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByText('Already invoiced work'));

    const drawer = detailDrawer();
    expect(within(drawer).getByText('Billed')).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument();
    expect(within(drawer).getByText(/these hours are on an invoice/i)).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole('button', { name: /view invoice/i }));
    expect(navigate).toHaveBeenCalledWith('/invoices/99');
    expect(billedEntryId).toBeGreaterThan(0);
  });

  it('swaps to the edit form rather than stacking two drawers', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getByText(LONG_DESCRIPTION));
    await userEvent.click(within(detailDrawer()).getByRole('button', { name: /edit/i }));

    // The detail drawer has closed and the edit form has taken its place,
    // rather than the two stacking and trapping focus in the wrong one.
    expectClosed(detailDrawer());
    expect(await screen.findByRole('dialog', { name: 'Edit Time Entry' })).not.toHaveAttribute(
      'inert',
    );
  });

  it('keeps the row action buttons from also opening the drawer', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getAllByRole('button', { name: 'Edit time entry' })[0]);

    // The row's own click handler must not have fired as well.
    expectClosed(detailDrawer());
    expect(await screen.findByRole('dialog', { name: 'Edit Time Entry' })).not.toHaveAttribute(
      'inert',
    );
  });
});

describe('Ranged invoice generation', () => {
  /** Select the seeded project so the billing controls appear. */
  async function selectProject() {
    renderPage();
    const projectSelect = await screen.findByDisplayValue('All projects');
    await userEvent.selectOptions(projectSelect, 'Platform Hardening');
  }

  beforeEach(async () => {
    // One entry today, one a week back, both unbilled and billable.
    await db.timeEntries.clear();
    const base = {
      clientId,
      projectId,
      description: 'Ranged work',
      billable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    await db.timeEntries.bulkAdd([
      { ...base, date: new Date(), hours: 2 },
      { ...base, date: weekAgo, hours: 5, description: 'Older work' },
    ] as never[]);
  });

  it('shows the billing window controls once a project is chosen', async () => {
    await selectProject();
    expect(await screen.findByText('Bill from')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /generate invoice/i })).toBeEnabled();
  });

  it('counts every unbilled hour when no window is set', async () => {
    await selectProject();
    // 7 hrs at the project's $200 rate.
    expect(await screen.findByText(/7 hrs unbilled/)).toBeInTheDocument();
    expect(screen.getByText('$1,400.00')).toBeInTheDocument();
  });

  it('narrows the preview once a start date is picked', async () => {
    await selectProject();

    // "Today" as the start excludes the entry from a week ago.
    const fromTrigger = screen.getByLabelText('Bill from');
    await userEvent.click(fromTrigger);
    await userEvent.click(await screen.findByRole('button', { name: 'Today' }));

    expect(await screen.findByText(/2 hrs unbilled/)).toBeInTheDocument();
    expect(screen.getByText('$400.00')).toBeInTheDocument();
    expect(screen.getByText('in range')).toBeInTheDocument();
  });

  it('only bills the hours inside the window', async () => {
    await selectProject();

    const fromTrigger = screen.getByLabelText('Bill from');
    await userEvent.click(fromTrigger);
    await userEvent.click(await screen.findByRole('button', { name: 'Today' }));
    await userEvent.click(screen.getByRole('button', { name: /generate invoice/i }));

    await vi.waitFor(async () => {
      expect(await db.invoices.count()).toBe(1);
    });
    const [invoice] = await db.invoices.toArray();
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.subtotal).toBe(400);

    // The older entry is still unbilled and can be invoiced separately.
    const unbilled = (await db.timeEntries.toArray()).filter((e) => e.invoiceId == null);
    expect(unbilled.map((e) => e.description)).toEqual(['Older work']);
  });
});
