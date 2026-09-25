import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, Lock, ShieldCheck, ShieldOff, CalendarCheck, Wrench } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormField } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { SectionCard } from '../components/ui/SectionCard';
import { exportAllData, exportEncryptedData, importData } from '../utils/backup';
import { isEncryptionEnabled, enableEncryption, disableEncryption } from '../db/encryption';
import { countRowsWithStringDates, repairDateFields } from '../db/dates';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';

/**
 * Security — the home for all data-safety controls: backup/restore and at-rest
 * encryption. Split out of Settings so those controls live in one place (and to
 * give the daily auto-backup a home as it lands). Settings keeps the business
 * profile, invoice defaults, branding, and integrations.
 */
export default function Security() {
  const { toast, showToast } = useToast();

  // Backup / restore
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPass, setImportPass] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);
  const [encryptModalOpen, setEncryptModalOpen] = useState(false);
  const [exportPass, setExportPass] = useState('');
  const [exportPass2, setExportPass2] = useState('');
  const [exporting, setExporting] = useState(false);

  // Data health — rows whose dates came back from a backup as strings
  const staleDateRows = useLiveQuery(() => countRowsWithStringDates(), []);
  const [repairing, setRepairing] = useState(false);

  // At-rest encryption
  const encryptionEnabled = useLiveQuery(() => isEncryptionEnabled(), []);
  const [enableModalOpen, setEnableModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [vaultPass, setVaultPass] = useState('');
  const [vaultPass2, setVaultPass2] = useState('');
  const [vaultBusy, setVaultBusy] = useState(false);

  async function handleExport() {
    try {
      await exportAllData();
      showToast('success', 'Backup downloaded.');
    } catch {
      showToast('error', 'Export failed.');
    }
  }

  async function handleExportEncrypted() {
    if (exportPass.length < 8) {
      showToast('error', 'Use a passphrase of at least 8 characters.');
      return;
    }
    if (exportPass !== exportPass2) {
      showToast('error', 'Passphrases do not match.');
      return;
    }
    setExporting(true);
    try {
      await exportEncryptedData(exportPass);
      showToast('success', 'Encrypted backup downloaded.');
      setEncryptModalOpen(false);
      setExportPass('');
      setExportPass2('');
    } catch {
      showToast('error', 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function handleEnableEncryption() {
    if (vaultPass.length < 8) {
      showToast('error', 'Use a passphrase of at least 8 characters.');
      return;
    }
    if (vaultPass !== vaultPass2) {
      showToast('error', 'Passphrases do not match.');
      return;
    }
    setVaultBusy(true);
    try {
      await enableEncryption(vaultPass);
      showToast('success', 'Encryption enabled. Your data is now encrypted at rest.');
      setEnableModalOpen(false);
      setVaultPass('');
      setVaultPass2('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not enable encryption.');
    } finally {
      setVaultBusy(false);
    }
  }

  async function handleDisableEncryption() {
    setVaultBusy(true);
    try {
      await disableEncryption(vaultPass);
      showToast('success', 'Encryption disabled. Data is stored unencrypted again.');
      setDisableModalOpen(false);
      setVaultPass('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not disable encryption.');
    } finally {
      setVaultBusy(false);
    }
  }

  async function handleRepairDates() {
    setRepairing(true);
    try {
      const n = await repairDateFields();
      showToast('success', `Repaired ${n} record${n === 1 ? '' : 's'}. Date ordering is correct again.`);
    } catch {
      showToast('error', 'Could not repair date fields.');
    } finally {
      setRepairing(false);
    }
  }

  async function handleImport() {
    const file = importFileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      await importData(file, importPass || undefined);
      setImportModalOpen(false);
      setImportPass('');
      showToast('success', 'Data restored from backup.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Import failed — invalid backup file.');
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">Security</h1>
        <p className="mt-1 text-sm text-slate-400">
          Keep your data safe — back it up, restore it, and encrypt it at rest.
        </p>
      </div>

      <div className="space-y-6">
        {/* Data & Backup */}
        <SectionCard title="Data & Backup">
          <p className="mb-4 text-sm text-slate-400">
            All data is stored locally in your browser. Export a backup regularly — clearing
            browser data will wipe it. Use <span className="text-slate-300">Export Encrypted</span>{' '}
            to passphrase-protect a backup you'll store off your machine.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={handleExport}>
              <Download size={15} />
              Export All Data
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEncryptModalOpen(true)}>
              <Lock size={15} />
              Export Encrypted
            </Button>
            <Button type="button" variant="secondary" onClick={() => setImportModalOpen(true)}>
              <Upload size={15} />
              Import Backup
            </Button>
          </div>
        </SectionCard>

        {/* Data health — only surfaces when there's something to fix */}
        {!!staleDateRows && (
          <SectionCard title="Data Health">
            <div className="mb-4 flex items-start gap-2 text-sm">
              <CalendarCheck size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="text-slate-300">
                <p>
                  <span className="font-medium text-amber-400">
                    {staleDateRows} record{staleDateRows === 1 ? '' : 's'}
                  </span>{' '}
                  store a date as text rather than a real date. Backups written before Helm
                  1.2 lost the date type on restore.
                </p>
                <p className="mt-1.5 text-slate-400">
                  Everything still displays correctly, but lists sorted by date — expenses,
                  time entries, invoices — come out in the wrong order. Repairing rewrites
                  only the date fields; no other data is touched.
                </p>
              </div>
            </div>
            <Button type="button" onClick={handleRepairDates} loading={repairing}>
              <Wrench size={15} />
              Repair Dates
            </Button>
          </SectionCard>
        )}

        {/* Encryption at rest */}
        <SectionCard title="Encryption">
          {encryptionEnabled ? (
            <>
              <div className="mb-4 flex items-start gap-2 text-sm">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <p className="text-slate-300">
                  Your data is <span className="font-medium text-emerald-400">encrypted at rest</span>.
                  You'll be asked for your passphrase each time the app loads.
                </p>
              </div>
              <Button type="button" variant="danger" onClick={() => setDisableModalOpen(true)}>
                <ShieldOff size={15} />
                Disable Encryption
              </Button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-400">
                Encrypt your data at rest with a passphrase (AES via NaCl). Client details,
                amounts, notes, documents, and tokens become ciphertext in the database; only the
                structural graph (links, dates, statuses) stays readable. You'll unlock the app
                with your passphrase on each load.
              </p>
              <p className="mb-4 rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
                There is no recovery — if you forget the passphrase, the data can't be decrypted.
                Keep an unencrypted or separately-remembered backup until you trust it.
              </p>
              <Button type="button" onClick={() => setEnableModalOpen(true)}>
                <ShieldCheck size={15} />
                Enable Encryption
              </Button>
            </>
          )}
        </SectionCard>
      </div>

      {/* Import confirmation modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportPass('');
        }}
        title="Import Backup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleImport} loading={importing}>
              Replace All Data
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            This will <strong className="text-red-400">replace all existing data</strong> with
            the contents of the backup file. This cannot be undone.
          </p>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-600"
          />
          <FormField label="Passphrase" htmlFor="import-pass" hint="Only needed if the backup is encrypted">
            <Input
              id="import-pass"
              type="password"
              autoComplete="off"
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              placeholder="Leave blank for a plain backup"
            />
          </FormField>
        </div>
      </Modal>

      {/* Encrypted export */}
      <Modal
        isOpen={encryptModalOpen}
        onClose={() => {
          setEncryptModalOpen(false);
          setExportPass('');
          setExportPass2('');
        }}
        title="Export Encrypted Backup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEncryptModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportEncrypted} loading={exporting}>
              <Lock size={15} />
              Encrypt &amp; Download
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            The backup file will be encrypted with your passphrase (AES-256-GCM). You'll need the
            same passphrase to restore it.
          </p>
          <p className="rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
            There is no recovery — if you lose the passphrase, the backup is unreadable.
          </p>
          <FormField label="Passphrase" htmlFor="export-pass" hint="At least 8 characters">
            <Input
              id="export-pass"
              type="password"
              autoComplete="new-password"
              value={exportPass}
              onChange={(e) => setExportPass(e.target.value)}
            />
          </FormField>
          <FormField label="Confirm passphrase" htmlFor="export-pass2">
            <Input
              id="export-pass2"
              type="password"
              autoComplete="new-password"
              value={exportPass2}
              onChange={(e) => setExportPass2(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* Enable encryption */}
      <Modal
        isOpen={enableModalOpen}
        onClose={() => {
          setEnableModalOpen(false);
          setVaultPass('');
          setVaultPass2('');
        }}
        title="Enable Encryption"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnableModalOpen(false)} disabled={vaultBusy}>
              Cancel
            </Button>
            <Button onClick={handleEnableEncryption} loading={vaultBusy}>
              <ShieldCheck size={15} />
              Enable
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Choose a passphrase. Your existing data will be encrypted now, and you'll enter this
            passphrase to unlock Helm on each load.
          </p>
          <p className="rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
            No recovery: if you forget it, the data can't be decrypted. Consider keeping a backup
            until you're confident.
          </p>
          <FormField label="Passphrase" htmlFor="vault-pass" hint="At least 8 characters">
            <Input
              id="vault-pass"
              type="password"
              autoComplete="new-password"
              value={vaultPass}
              onChange={(e) => setVaultPass(e.target.value)}
            />
          </FormField>
          <FormField label="Confirm passphrase" htmlFor="vault-pass2">
            <Input
              id="vault-pass2"
              type="password"
              autoComplete="new-password"
              value={vaultPass2}
              onChange={(e) => setVaultPass2(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* Disable encryption */}
      <Modal
        isOpen={disableModalOpen}
        onClose={() => {
          setDisableModalOpen(false);
          setVaultPass('');
        }}
        title="Disable Encryption"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisableModalOpen(false)} disabled={vaultBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDisableEncryption} loading={vaultBusy}>
              <ShieldOff size={15} />
              Disable &amp; Decrypt
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            This decrypts all data back to plaintext storage. Enter your passphrase to confirm.
          </p>
          <FormField label="Passphrase" htmlFor="vault-disable-pass">
            <Input
              id="vault-disable-pass"
              type="password"
              autoComplete="current-password"
              value={vaultPass}
              onChange={(e) => setVaultPass(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
