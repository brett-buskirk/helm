import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { db } from '../index';
import type { Client } from '../../types';
import {
  enableEncryption,
  disableEncryption,
  unlockVault,
  isEncryptionEnabled,
} from '../encryption';
import * as vault from '../../utils/vault';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

function makeClient(over: Partial<Client> = {}): Client {
  return {
    company: 'Acme Corp',
    contactName: 'Jane Doe',
    email: 'jane@acme.com',
    phone: '555-0100',
    address: '1 Main St',
    taxId: '12-3456789',
    status: 'active',
    notes: 'Prefers email',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over,
  };
}

/** Read a row with the vault locked, so the reading hook returns raw storage. */
async function raw(table: string, id: number) {
  vault.clearKey();
  return db.table(table).get(id);
}

beforeEach(async () => {
  vault.clearKey();
  vault.resume();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('at-rest encryption engine', () => {
  it('stores plaintext while encryption is disabled', async () => {
    const id = await db.clients.add(makeClient());
    expect((await db.clients.get(id))?.company).toBe('Acme Corp');
  });

  it('encrypts existing data on enable and decrypts it on read', async () => {
    const id = await db.clients.add(makeClient());
    await enableEncryption('correct horse');
    expect(await isEncryptionEnabled()).toBe(true);

    const rawRow = await raw('clients', id as number);
    expect(rawRow?.company).not.toBe('Acme Corp');
    expect(vault.isEncrypted(rawRow?.company)).toBe(true);
    expect(vault.isEncrypted(rawRow?.email)).toBe(true);

    expect(await unlockVault('correct horse')).toBe(true);
    const back = await db.clients.get(id);
    expect(back?.company).toBe('Acme Corp');
    expect(back?.email).toBe('jane@acme.com');
    expect(back?.status).toBe('active'); // structural field untouched
  });

  it('encrypts new records written while unlocked', async () => {
    await enableEncryption('pw');
    const id = await db.clients.add(makeClient({ company: 'New Co' }));
    expect(vault.isEncrypted((await raw('clients', id as number))?.company)).toBe(true);

    await unlockVault('pw');
    expect((await db.clients.get(id))?.company).toBe('New Co');
  });

  it('rejects a wrong passphrase on unlock and holds no key', async () => {
    await db.clients.add(makeClient());
    await enableEncryption('right');
    vault.clearKey();

    expect(await unlockVault('wrong')).toBe(false);
    expect(vault.hasKey()).toBe(false);
    expect(await unlockVault('right')).toBe(true);
    expect(vault.hasKey()).toBe(true);
  });

  it('round-trips data through enable → disable unchanged', async () => {
    const id = await db.clients.add(makeClient());
    await enableEncryption('pw');
    await unlockVault('pw');
    await disableEncryption('pw');

    expect(await isEncryptionEnabled()).toBe(false);
    const row = await db.clients.get(id);
    expect(row?.company).toBe('Acme Corp'); // plaintext again
    expect(row?.taxId).toBe('12-3456789');
    expect(vault.hasKey()).toBe(false);
  });

  it('refuses to disable with the wrong passphrase (data stays encrypted)', async () => {
    const id = await db.clients.add(makeClient());
    await enableEncryption('right');
    await expect(disableEncryption('wrong')).rejects.toThrow(/incorrect passphrase/i);
    expect(vault.isEncrypted((await raw('clients', id as number))?.company)).toBe(true);
  });

  it('encrypts numeric and object fields too (amounts, line items)', async () => {
    const clientId = (await db.clients.add(makeClient())) as number;
    const invId = (await db.invoices.add({
      clientId,
      invoiceNumber: 'INV-1',
      status: 'draft',
      issueDate: new Date(),
      dueDate: new Date(),
      lineItems: [{ description: 'Work', quantity: 2, unitPrice: 100, amount: 200 }],
      subtotal: 200,
      taxRate: 0,
      taxAmount: 0,
      total: 200,
      amountPaid: 0,
      balanceDue: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    await enableEncryption('pw');
    const rawInv = await raw('invoices', invId);
    expect(vault.isEncrypted(rawInv?.total)).toBe(true);
    expect(vault.isEncrypted(rawInv?.lineItems)).toBe(true);

    await unlockVault('pw');
    const inv = await db.invoices.get(invId);
    expect(inv?.total).toBe(200);
    expect(inv?.lineItems[0].amount).toBe(200);
    expect(inv?.invoiceNumber).toBe('INV-1'); // structural, untouched
  });
});
