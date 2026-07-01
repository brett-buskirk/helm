import { useReducer, useEffect, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isEncryptionEnabled } from '../../db/encryption';
import * as vault from '../../utils/vault';
import { UnlockScreen } from './UnlockScreen';

/**
 * Gates the app behind the passphrase when encryption is enabled. Re-renders on
 * lock/unlock (the vault key lives in memory, so a reload re-locks). A no-op
 * when encryption is disabled.
 */
export function VaultGate({ children }: { children: ReactNode }) {
  const enabled = useLiveQuery(() => isEncryptionEnabled());
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => vault.subscribe(force), []);

  if (enabled === undefined) return null; // security state still loading
  if (enabled && !vault.hasKey()) return <UnlockScreen />;
  return <>{children}</>;
}
