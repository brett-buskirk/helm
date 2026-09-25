import { db } from './index';

/**
 * Date-type integrity for the live database.
 *
 * Dates are stored as real `Date` objects so Dexie's indexes order them
 * chronologically. JSON has no date type, though, so a backup round-trip turns
 * every one of them into an ISO string — and IndexedDB orders keys by *type*
 * first (number < date < string), so a restored table sorts as two separate
 * runs stuck together rather than one chronological list. The display helpers
 * (`formatDate`, `coerceDate`, `isInPeriod`) all accept strings, so the dates
 * still render correctly and only the ordering is visibly wrong.
 *
 * `reviveDateFields` is applied on import so restores stay well-typed;
 * `repairDateFields` fixes a database that was restored before that existed.
 */

/**
 * Per-table fields stored as `Date`. Mirrors the shape of `ENCRYPTED_FIELDS`.
 *
 * The `security` table is deliberately absent: it isn't part of a backup and
 * `db/encryption.ts` owns every write to it.
 */
export const DATE_FIELDS: Record<string, string[]> = {
  clients: ['createdAt', 'updatedAt'],
  projects: ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  proposals: ['validUntil', 'createdAt', 'updatedAt'],
  agreements: ['createdAt', 'updatedAt'],
  invoices: ['issueDate', 'dueDate', 'createdAt', 'updatedAt'],
  payments: ['date', 'createdAt'],
  expenses: ['date', 'nextDue', 'createdAt', 'updatedAt'],
  documents: ['createdAt', 'updatedAt'],
  timeEntries: ['date', 'createdAt', 'updatedAt'],
  toolLinks: ['createdAt', 'updatedAt'],
  settings: ['updatedAt'],
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * True if `value` is a string that should be a `Date`. Anything unparseable is
 * left alone — no date field is ever encrypted (the vault deliberately keeps
 * dates in the clear so queries work), but this still means a stray ciphertext
 * or a free-text value can never be mangled into a bogus date.
 */
function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

/**
 * Convert this row's known date fields from ISO strings back to `Date`.
 * Mutates and returns the row. Already-typed rows pass through untouched, so
 * it's safe to apply to a mix of old and new backups.
 */
export function reviveDateFields(row: Record<string, any>, fields: string[]): Record<string, any> {
  for (const f of fields) {
    if (isDateString(row[f])) row[f] = new Date(row[f]);
  }
  return row;
}

/**
 * Revive every date in a parsed backup payload, in place. Unknown tables and
 * absent tables are skipped, which keeps older backup versions importable.
 */
export function reviveBackupDates(data: Record<string, unknown>): void {
  for (const [table, fields] of Object.entries(DATE_FIELDS)) {
    const rows = data[table];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row && typeof row === 'object') reviveDateFields(row as Record<string, any>, fields);
    }
  }
}

/** How many stored rows still hold at least one date as a string. */
export async function countRowsWithStringDates(): Promise<number> {
  let affected = 0;
  for (const [name, fields] of Object.entries(DATE_FIELDS)) {
    const rows = await db.table(name).toArray();
    for (const row of rows) {
      if (fields.some((f) => isDateString(row[f]))) affected += 1;
    }
  }
  return affected;
}

/**
 * Rewrite every string-typed date back to a real `Date`, restoring index
 * ordering. Returns how many rows were changed.
 *
 * Only the date fields are written, so the encryption `updating` hook sees no
 * encryptable field in the patch and passes it straight through — the repair
 * works the same whether or not at-rest encryption is on.
 */
export async function repairDateFields(): Promise<number> {
  const tables = Object.keys(DATE_FIELDS).map((name) => db.table(name));
  return db.transaction('rw', tables, async () => {
    let repaired = 0;
    for (const [name, fields] of Object.entries(DATE_FIELDS)) {
      const table = db.table(name);
      const rows = await table.toArray();
      for (const row of rows) {
        const patch: Record<string, Date> = {};
        for (const f of fields) {
          if (isDateString(row[f])) patch[f] = new Date(row[f]);
        }
        if (Object.keys(patch).length && row.id != null) {
          await table.update(row.id, patch);
          repaired += 1;
        }
      }
    }
    return repaired;
  });
}
