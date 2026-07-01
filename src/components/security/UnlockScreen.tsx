import { useState } from 'react';
import { Lock } from 'lucide-react';
import { unlockVault } from '../../db/encryption';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/** Full-screen passphrase gate shown when encryption is on and the vault is locked. */
export function UnlockScreen() {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase) return;
    setUnlocking(true);
    setError('');
    try {
      const ok = await unlockVault(passphrase);
      if (!ok) {
        setError('Incorrect passphrase.');
        setPassphrase('');
      }
      // On success the vault key is set → the gate re-renders into the app.
    } catch {
      setError('Something went wrong unlocking.');
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-900 p-6">
      <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-700 bg-slate-800 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600">
            <Lock size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Helm is locked</h1>
            <p className="mt-1 text-sm text-slate-400">Enter your passphrase to decrypt your data.</p>
          </div>
        </div>

        <div>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase"
            error={error || undefined}
          />
          {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
        </div>

        <Button type="submit" className="w-full justify-center" loading={unlocking} disabled={!passphrase}>
          Unlock
        </Button>

        <p className="text-center text-xs text-slate-600">
          Your passphrase never leaves this device. There is no recovery if it's lost.
        </p>
      </form>
    </div>
  );
}
