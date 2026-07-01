import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X, Download, Upload, Sparkles, Lock, ShieldCheck, ShieldOff } from 'lucide-react';
import { db, DEFAULT_EXPENSE_CATEGORIES } from '../db';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { FormField } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { exportAllData, exportEncryptedData, importData } from '../utils/backup';
import { loadSampleData, countDemoData } from '../utils/sampleData';
import { isEncryptionEnabled, enableEncryption, disableEncryption } from '../db/encryption';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';

const settingsSchema = z.object({
  businessName: z.string().min(1, 'Required'),
  ownerName: z.string().min(1, 'Required'),
  ein: z.string().optional(),
  address: z.string().min(1, 'Required'),
  email: z.string().email('Must be a valid email'),
  phone: z.string().optional(),
  website: z.string().optional(),
  paymentInstructions: z.string().min(1, 'Required'),
  defaultRate: z.coerce.number().min(0, 'Must be a positive number'),
  taxRate: z.coerce
    .number()
    .min(0, 'Must be between 0 and 100')
    .max(100, 'Must be between 0 and 100'),
  invoicePrefix: z.string().min(1, 'Required'),
  invoiceNextNumber: z.coerce.number().int().min(1, 'Must be at least 1'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function Settings() {
  const settingsRecord = useLiveQuery(() => db.settings.limit(1).first());
  const [categories, setCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [newCategory, setNewCategory] = useState('');
  const { toast, showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPass, setImportPass] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const demoCount = useLiveQuery(() => countDemoData(), []) ?? 0;
  const [encryptModalOpen, setEncryptModalOpen] = useState(false);
  const [exportPass, setExportPass] = useState('');
  const [exportPass2, setExportPass2] = useState('');
  const [exporting, setExporting] = useState(false);

  const encryptionEnabled = useLiveQuery(() => isEncryptionEnabled(), []);
  const [enableModalOpen, setEnableModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [vaultPass, setVaultPass] = useState('');
  const [vaultPass2, setVaultPass2] = useState('');
  const [vaultBusy, setVaultBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: '',
      ownerName: '',
      ein: '',
      address: '',
      email: '',
      phone: '',
      website: '',
      paymentInstructions:
        'Payment due within 30 days of invoice date.\nACH / wire transfer preferred. Details provided upon request.',
      defaultRate: 0,
      taxRate: 25,
      invoicePrefix: 'INV-',
      invoiceNextNumber: 1001,
    },
  });

  useEffect(() => {
    if (settingsRecord) {
      reset({
        businessName: settingsRecord.businessName,
        ownerName: settingsRecord.ownerName,
        ein: settingsRecord.ein ?? '',
        address: settingsRecord.address,
        email: settingsRecord.email,
        phone: settingsRecord.phone ?? '',
        website: settingsRecord.website ?? '',
        paymentInstructions: settingsRecord.paymentInstructions,
        defaultRate: settingsRecord.defaultRate,
        taxRate: settingsRecord.taxRate,
        invoicePrefix: settingsRecord.invoicePrefix,
        invoiceNextNumber: settingsRecord.invoiceNextNumber,
      });
      setCategories(settingsRecord.expenseCategories);
    }
  }, [settingsRecord, reset]);

  async function onSubmit(data: SettingsFormData) {
    setSaving(true);
    try {
      const payload = {
        ...data,
        ein: data.ein || undefined,
        phone: data.phone || undefined,
        website: data.website || undefined,
        expenseCategories: categories,
        updatedAt: new Date(),
      };
      if (settingsRecord?.id) {
        await db.settings.update(settingsRecord.id, payload);
      } else {
        await db.settings.add(payload);
      }
      showToast('success', 'Settings saved.');
    } catch {
      showToast('error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  function addCategory() {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      setNewCategory('');
    }
  }

  function removeCategory(cat: string) {
    setCategories((prev) => prev.filter((c) => c !== cat));
  }

  async function handleExport() {
    try {
      await exportAllData();
      showToast('success', 'Backup downloaded.');
    } catch {
      showToast('error', 'Export failed.');
    }
  }

  async function handleLoadSample() {
    setLoadingSample(true);
    try {
      await loadSampleData();
      showToast('success', 'Sample data loaded.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not load sample data.');
    } finally {
      setLoadingSample(false);
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
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Business profile, invoice defaults, and data management.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-6">
          {/* Business Profile */}
          <SectionCard title="Business Profile">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Business Name"
                htmlFor="businessName"
                error={errors.businessName?.message}
                required
              >
                <Input id="businessName" {...register('businessName')} error={errors.businessName?.message} />
              </FormField>
              <FormField
                label="Owner Name"
                htmlFor="ownerName"
                error={errors.ownerName?.message}
                required
              >
                <Input id="ownerName" {...register('ownerName')} error={errors.ownerName?.message} />
              </FormField>
              <FormField label="EIN / Tax ID" htmlFor="ein" hint="Optional">
                <Input id="ein" placeholder="XX-XXXXXXX" {...register('ein')} />
              </FormField>
              <FormField
                label="Business Email"
                htmlFor="email"
                error={errors.email?.message}
                required
              >
                <Input id="email" type="email" {...register('email')} error={errors.email?.message} />
              </FormField>
              <FormField label="Phone" htmlFor="phone" hint="Optional">
                <Input id="phone" type="tel" {...register('phone')} />
              </FormField>
              <FormField label="Website" htmlFor="website" hint="Optional">
                <Input id="website" type="url" placeholder="https://" {...register('website')} />
              </FormField>
              <FormField
                label="Address"
                htmlFor="address"
                error={errors.address?.message}
                required
                className="sm:col-span-2"
              >
                <Textarea
                  id="address"
                  rows={3}
                  placeholder="123 Main St&#10;City, ST 00000"
                  {...register('address')}
                  error={errors.address?.message}
                />
              </FormField>
            </div>
          </SectionCard>

          {/* Invoice Settings */}
          <SectionCard title="Invoice Settings">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                label="Invoice Prefix"
                htmlFor="invoicePrefix"
                error={errors.invoicePrefix?.message}
                hint='e.g. "INV-" → INV-1001'
                required
              >
                <Input id="invoicePrefix" {...register('invoicePrefix')} error={errors.invoicePrefix?.message} />
              </FormField>
              <FormField
                label="Next Invoice #"
                htmlFor="invoiceNextNumber"
                error={errors.invoiceNextNumber?.message}
                required
              >
                <Input
                  id="invoiceNextNumber"
                  type="number"
                  min={1}
                  {...register('invoiceNextNumber')}
                  error={errors.invoiceNextNumber?.message}
                />
              </FormField>
            </div>
          </SectionCard>

          {/* Financial Settings */}
          <SectionCard title="Financial Settings">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Default Hourly Rate ($)"
                htmlFor="defaultRate"
                error={errors.defaultRate?.message}
                hint="Used as fallback on new clients and projects"
                required
              >
                <Input
                  id="defaultRate"
                  type="number"
                  min={0}
                  step={5}
                  {...register('defaultRate')}
                  error={errors.defaultRate?.message}
                />
              </FormField>
              <FormField
                label="Tax Set-aside Rate (%)"
                htmlFor="taxRate"
                error={errors.taxRate?.message}
                hint="Recommended: 25–30% for self-employment tax"
                required
              >
                <Input
                  id="taxRate"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  {...register('taxRate')}
                  error={errors.taxRate?.message}
                />
              </FormField>
            </div>
          </SectionCard>

          {/* Payment Instructions */}
          <SectionCard title="Payment Instructions">
            <FormField
              label="Invoice Payment Instructions"
              htmlFor="paymentInstructions"
              error={errors.paymentInstructions?.message}
              hint="Appears at the bottom of every invoice"
              required
            >
              <Textarea
                id="paymentInstructions"
                rows={4}
                {...register('paymentInstructions')}
                error={errors.paymentInstructions?.message}
              />
            </FormField>
          </SectionCard>

          {/* Expense Categories */}
          <SectionCard title="Expense Categories">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-700 px-3 py-1 text-xs text-slate-200"
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => removeCategory(cat)}
                    className="text-slate-400 hover:text-red-400 transition-colors"
                    aria-label={`Remove ${cat}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="Add category…"
                className="max-w-xs"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addCategory}>
                <Plus size={14} />
                Add
              </Button>
            </div>
          </SectionCard>

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
              <Button
                type="button"
                variant="secondary"
                onClick={() => setImportModalOpen(true)}
              >
                <Upload size={15} />
                Import Backup
              </Button>
            </div>
          </SectionCard>

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

          {/* Demo data */}
          <SectionCard title="Demo Data">
            <p className="mb-4 text-sm text-slate-400">
              Load a realistic sample practice — clients, projects, proposals, invoices, expenses,
              and time — to explore the app. Demo records are kept separate from your real data:
              clearing them (from the sidebar button that appears) never touches anything you've
              created.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleLoadSample}
                loading={loadingSample}
                disabled={demoCount > 0}
              >
                <Sparkles size={15} />
                Load Sample Data
              </Button>
              {demoCount > 0 && (
                <span className="text-sm text-slate-400">
                  Sample data is loaded ({demoCount} demo records). Use{' '}
                  <span className="font-medium text-amber-400">Clear demo data</span> in the sidebar
                  to remove it.
                </span>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Save */}
        <div className="mt-6 flex justify-end">
          <Button type="submit" size="lg" loading={saving}>
            Save Settings
          </Button>
        </div>
      </form>

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
