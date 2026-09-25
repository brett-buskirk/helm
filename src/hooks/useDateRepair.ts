import { useEffect, useRef } from 'react';
import { countRowsWithStringDates, repairDateFields } from '../db/dates';

/**
 * Repair string-typed dates once per app load.
 *
 * A backup restored before Helm 1.2 wrote every date as text, and IndexedDB
 * orders keys by type before value — so date-sorted lists come out scrambled
 * while still *displaying* correctly (see `db/dates.ts`). The repair has been
 * available as a button on Security since that fix shipped, but a database can
 * sit broken indefinitely if nobody thinks to go and press it. Twice now the
 * symptom has been reported with the cure one unvisited page away, so it runs
 * on its own.
 *
 * Safe to run unattended: it is idempotent, writes only date fields (so the
 * encryption hook passes the patch straight through and it behaves the same
 * locked or unlocked), and converts a string to the `Date` of that same instant
 * rather than changing any value. On a healthy database it is a read-only scan
 * and nothing is written.
 *
 * Call this from inside the vault gate, so an encrypted database is unlocked
 * before anything touches it.
 */
export function useDateRepair(onRepaired: (count: number) => void): void {
  // The callback lives in a ref so a caller passing an inline function can't
  // re-trigger the pass on every render.
  const onRepairedRef = useRef(onRepaired);
  onRepairedRef.current = onRepaired;

  // Guards against React StrictMode's double-invoked effect in development.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        // Count first: a read-only scan avoids opening a read-write transaction
        // across every table on each load, which is the normal case.
        if ((await countRowsWithStringDates()) === 0 || cancelled) return;
        const repaired = await repairDateFields();
        if (!cancelled && repaired > 0) onRepairedRef.current(repaired);
      } catch {
        // A maintenance pass must never stop the app from starting. The manual
        // control on Security remains as the fallback.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
