import type Dexie from 'dexie';
import { db } from './index';
import type { SecurityConfig } from '../types';
import * as vault from '../utils/vault';

/**
 * At-rest field encryption for the live database.
 *
 * Sensitive content + identity fields are encrypted in IndexedDB via Dexie
 * hooks; the structural graph (foreign keys, dates, statuses, invoice numbers,
 * categories) stays in the clear so queries keep working. Everything is opt-in:
 * with no key set, the hooks pass through and the DB behaves exactly as before.
 */

const PBKDF2_ITERATIONS = 210_000;
const VERIFY_TOKEN = 'helm-vault-verified';

/** Per-table fields to encrypt. Anything not listed (ids, links, dates, status) stays clear. */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  clients: ['company', 'contactName', 'email', 'phone', 'address', 'taxId', 'notes', 'defaultRate'],
  projects: ['name', 'description', 'links', 'rate'],
  proposals: ['title', 'scope', 'deliverables', 'pricing', 'pricingNote', 'notes'],
  agreements: ['title', 'scope', 'deliverables', 'notes'],
  invoices: ['lineItems', 'subtotal', 'taxRate', 'taxAmount', 'total', 'amountPaid', 'balanceDue', 'paymentTerms', 'notes'],
  payments: ['amount', 'method', 'notes'],
  expenses: ['vendor', 'amount', 'notes', 'receiptPath'],
  documents: ['title', 'content'],
  timeEntries: ['description', 'hours'],
  toolLinks: ['label', 'url'],
  settings: ['businessName', 'ownerName', 'ein', 'address', 'email', 'phone', 'website', 'paymentInstructions', 'defaultRate', 'githubToken'],
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Register encrypt-on-write / decrypt-on-read hooks. No-op until a key is set. */
export function installEncryptionHooks(database: Dexie): void {
  for (const [name, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const table = database.table(name);

    table.hook('creating', (_primKey: unknown, obj: any) => {
      if (!vault.isActive()) return;
      for (const f of fields) {
        if (obj[f] != null && !vault.isEncrypted(obj[f])) obj[f] = vault.encryptValue(obj[f]);
      }
    });

    table.hook('updating', (mods: any) => {
      if (!vault.isActive()) return;
      const out: Record<string, unknown> = {};
      let changed = false;
      for (const f of fields) {
        if (f in mods && mods[f] != null && !vault.isEncrypted(mods[f])) {
          out[f] = vault.encryptValue(mods[f]);
          changed = true;
        }
      }
      return changed ? out : undefined;
    });

    table.hook('reading', (obj: any) => {
      if (!vault.isActive() || !obj) return obj;
      let result = obj;
      for (const f of fields) {
        if (vault.isEncrypted(obj[f])) {
          if (result === obj) result = { ...obj };
          try {
            result[f] = vault.decryptValue(obj[f]);
          } catch {
            /* leave the field ciphertext rather than throwing mid-render */
          }
        }
      }
      return result;
    });
  }
}

export async function getSecurity(): Promise<SecurityConfig | undefined> {
  return db.security.limit(1).first();
}

export async function isEncryptionEnabled(): Promise<boolean> {
  return !!(await getSecurity())?.enabled;
}

function verifyCurrentKey(verifier: string): boolean {
  try {
    return vault.decryptValue(verifier) === VERIFY_TOKEN;
  } catch {
    return false;
  }
}

/** Re-write every encryptable table through `transform`, with hooks suspended. */
async function rewriteAll(transform: (row: any, fields: string[]) => void): Promise<void> {
  vault.suspend();
  try {
    for (const [name, fields] of Object.entries(ENCRYPTED_FIELDS)) {
      const table = db.table(name);
      const rows = await table.toArray();
      if (!rows.length) continue;
      for (const row of rows) transform(row, fields);
      await table.bulkPut(rows);
    }
  } finally {
    vault.resume();
  }
}

/** Turn on encryption: derive a key, encrypt all existing data, persist config. */
export async function enableEncryption(passphrase: string): Promise<void> {
  if (await isEncryptionEnabled()) throw new Error('Encryption is already enabled.');
  const kdfSalt = vault.randomSaltB64();
  vault.setKey(await vault.deriveKey(passphrase, kdfSalt, PBKDF2_ITERATIONS));
  const verifier = vault.encryptValue(VERIFY_TOKEN);

  await rewriteAll((row, fields) => {
    for (const f of fields) {
      if (row[f] != null && !vault.isEncrypted(row[f])) row[f] = vault.encryptValue(row[f]);
    }
  });

  await db.security.clear();
  await db.security.add({ enabled: true, kdfSalt, iterations: PBKDF2_ITERATIONS, verifier, updatedAt: new Date() });
}

/** Verify the passphrase and, if correct, hold the key in memory. */
export async function unlockVault(passphrase: string): Promise<boolean> {
  const sec = await getSecurity();
  if (!sec?.enabled) return true;
  vault.setKey(await vault.deriveKey(passphrase, sec.kdfSalt, sec.iterations));
  if (!verifyCurrentKey(sec.verifier)) {
    vault.clearKey();
    return false;
  }
  return true;
}

/** Turn off encryption: verify the passphrase, decrypt all data, drop config. */
export async function disableEncryption(passphrase: string): Promise<void> {
  const sec = await getSecurity();
  if (!sec?.enabled) throw new Error('Encryption is not enabled.');
  vault.setKey(await vault.deriveKey(passphrase, sec.kdfSalt, sec.iterations));
  if (!verifyCurrentKey(sec.verifier)) {
    vault.clearKey();
    throw new Error('Incorrect passphrase.');
  }

  await rewriteAll((row, fields) => {
    for (const f of fields) {
      if (vault.isEncrypted(row[f])) row[f] = vault.decryptValue(row[f]);
    }
  });

  await db.security.clear();
  vault.clearKey();
}
