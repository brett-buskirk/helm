import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X, Upload, Sparkles, Image as ImageIcon, Github, ShieldCheck } from 'lucide-react';
import { db, DEFAULT_EXPENSE_CATEGORIES } from '../db';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PhoneInput } from '../components/ui/PhoneInput';
import { Textarea } from '../components/ui/Textarea';
import { FormField } from '../components/ui/FormField';
import { SectionCard } from '../components/ui/SectionCard';
import { loadSampleData, countDemoData } from '../utils/sampleData';
import { isEncryptionEnabled } from '../db/encryption';
import { fileToLogoDataUrl } from '../utils/image';
import { DEFAULT_BRAND } from '../utils/pdf';
import { BrandColorPicker } from '../components/settings/BrandColorPicker';
import { validateGitHubToken } from '../utils/github';
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
  brandColor: z.string().optional(),
  defaultRate: z.coerce.number().min(0, 'Must be a positive number'),
  taxRate: z.coerce
    .number()
    .min(0, 'Must be between 0 and 100')
    .max(100, 'Must be between 0 and 100'),
  invoicePrefix: z.string().min(1, 'Required'),
  invoiceNextNumber: z.coerce.number().int().min(1, 'Must be at least 1'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const settingsRecord = useLiveQuery(() => db.settings.limit(1).first());
  const [categories, setCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [newCategory, setNewCategory] = useState('');
  const { toast, showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const demoCount = useLiveQuery(() => countDemoData(), []) ?? 0;

  // Read-only here — the Integrations copy notes whether tokens are encrypted.
  // The encryption controls themselves live on the Security page.
  const encryptionEnabled = useLiveQuery(() => isEncryptionEnabled(), []);
  const [ghTokenInput, setGhTokenInput] = useState('');
  const [ghBusy, setGhBusy] = useState(false);

  const [logo, setLogo] = useState<string | undefined>();
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
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
      brandColor: DEFAULT_BRAND,
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
        brandColor: settingsRecord.brandColor ?? DEFAULT_BRAND,
        defaultRate: settingsRecord.defaultRate,
        taxRate: settingsRecord.taxRate,
        invoicePrefix: settingsRecord.invoicePrefix,
        // Show the padded value (e.g. "0002") so the width is preserved on re-save.
        invoiceNextNumber: String(settingsRecord.invoiceNextNumber).padStart(
          settingsRecord.invoiceNumberPadding ?? 0,
          '0',
        ) as unknown as number,
      });
      setCategories(settingsRecord.expenseCategories);
      setLogo(settingsRecord.logo);
    }
  }, [settingsRecord, reset]);

  async function handleLogoUpload(file: File | undefined) {
    if (!file) return;
    setLogoBusy(true);
    try {
      setLogo(await fileToLogoDataUrl(file));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not load that image.');
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function connectGitHub() {
    const token = ghTokenInput.trim();
    if (!token || !settingsRecord?.id) return;
    setGhBusy(true);
    try {
      const { login } = await validateGitHubToken(token);
      await db.settings.update(settingsRecord.id, { githubToken: token, githubUser: login, updatedAt: new Date() });
      setGhTokenInput('');
      showToast('success', `Connected to GitHub as @${login}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not connect to GitHub.');
    } finally {
      setGhBusy(false);
    }
  }

  async function disconnectGitHub() {
    if (!settingsRecord?.id) return;
    await db.settings.update(settingsRecord.id, { githubToken: '', githubUser: '', updatedAt: new Date() });
    showToast('success', 'GitHub disconnected.');
  }

  async function onSubmit(data: SettingsFormData) {
    setSaving(true);
    try {
      // Capture the zero-pad width from what the user actually typed (the raw
      // field string), since the coerced number loses leading zeros.
      const rawNext = String(watch('invoiceNextNumber') ?? '');
      const invoiceNumberPadding = rawNext.replace(/\D/g, '').length || undefined;
      const payload = {
        ...data,
        ein: data.ein || undefined,
        phone: data.phone || undefined,
        website: data.website || undefined,
        brandColor: data.brandColor || DEFAULT_BRAND,
        invoiceNumberPadding,
        logo: logo || undefined,
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Business profile, invoice defaults, branding, and integrations.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          <ShieldCheck size={14} className="shrink-0 text-slate-500" />
          Backup, restore, and encryption now live under{' '}
          <Link to="/security" className="font-medium text-indigo-400 hover:underline">
            Security
          </Link>
          .
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
                <PhoneInput control={control} name="phone" id="phone" />
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

          {/* Branding */}
          <SectionCard title="Branding">
            <p className="mb-4 text-sm text-slate-400">
              Personalize your client-facing PDFs (invoices, proposals, documents) with your logo
              and brand color.
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Brand color</label>
                <BrandColorPicker
                  value={watch('brandColor') || DEFAULT_BRAND}
                  onChange={(hex) => setValue('brandColor', hex, { shouldDirty: true })}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Logo</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                    {logo ? (
                      <img src={logo} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <ImageIcon size={20} className="text-slate-600" />
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                      className="hidden"
                    />
                    <Button type="button" size="sm" variant="secondary" loading={logoBusy} onClick={() => logoInputRef.current?.click()}>
                      <Upload size={14} />
                      {logo ? 'Replace' : 'Upload'}
                    </Button>
                    {logo && (
                      <button type="button" onClick={() => setLogo(undefined)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600">Auto-resized. Appears on your PDFs.</p>
              </div>
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
                  type="text"
                  inputMode="numeric"
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

          {/* Integrations */}
          <SectionCard title="Integrations">
            <div className="mb-4 flex items-start gap-2">
              <Github size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">GitHub</p>
                <p className="text-xs text-slate-500">
                  Optional. When connected, projects that link a GitHub repo show live open pull
                  requests and issues. Off until you connect.
                </p>
              </div>
            </div>

            {settingsRecord?.githubToken ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
                <p className="text-sm text-slate-300">
                  Connected as{' '}
                  <span className="font-medium text-emerald-400">@{settingsRecord.githubUser}</span>
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={disconnectGitHub}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={ghTokenInput}
                    onChange={(e) => setGhTokenInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void connectGitHub();
                      }
                    }}
                    placeholder="GitHub personal access token"
                    autoComplete="off"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500"
                  />
                  <Button type="button" onClick={connectGitHub} loading={ghBusy} disabled={!ghTokenInput.trim()}>
                    Connect
                  </Button>
                </div>
                <p className="text-xs text-slate-600">
                  Create a{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    read-only token
                  </a>{' '}
                  scoped to the repos you want to see. It's stored locally
                  {encryptionEnabled ? ' and encrypted at rest' : ''} — never sent anywhere but
                  github.com.
                </p>
              </div>
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

      <Toast toast={toast} />
    </div>
  );
}
