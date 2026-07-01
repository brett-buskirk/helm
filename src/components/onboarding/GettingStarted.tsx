import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { CheckCircle2, Circle, X, Sparkles, ArrowRight, Compass } from 'lucide-react';
import { db } from '../../db';
import { Button } from '../ui/Button';
import { loadSampleData, hasDemoData } from '../../utils/sampleData';

const DISMISS_KEY = 'helm-onboarding-dismissed';

interface Step {
  key: string;
  label: string;
  done: boolean;
  to: string;
  cta: string;
}

/**
 * First-run guide shown at the top of the Dashboard. Tracks the first setup
 * steps with live completion, offers one-click sample data while the app is
 * empty, and self-hides once every step is done or the user dismisses it.
 */
export function GettingStarted() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [loading, setLoading] = useState(false);

  const clientCount = useLiveQuery(() => db.clients.count());
  const projectCount = useLiveQuery(() => db.projects.count());
  const invoiceCount = useLiveQuery(() => db.invoices.count());
  const settings = useLiveQuery(() => db.settings.limit(1).first());
  const demoLoaded = useLiveQuery(() => hasDemoData());

  // Hold rendering until counts resolve, so the card never flashes for existing users.
  if (clientCount === undefined || projectCount === undefined || invoiceCount === undefined) {
    return null;
  }

  const steps: Step[] = [
    { key: 'profile', label: 'Set up your business profile', done: !!settings?.businessName?.trim(), to: '/settings', cta: 'Open Settings' },
    { key: 'client', label: 'Add your first client', done: clientCount > 0, to: '/clients', cta: 'Add a client' },
    { key: 'project', label: 'Create a project', done: projectCount > 0, to: '/projects', cta: 'Create a project' },
    { key: 'invoice', label: 'Send your first invoice', done: invoiceCount > 0, to: '/invoices/new', cta: 'New invoice' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed || allDone) return null;

  const totallyEmpty = clientCount === 0 && projectCount === 0 && invoiceCount === 0 && !demoLoaded;
  const nextStep = steps.find((s) => !s.done);

  async function handleLoadSample() {
    setLoading(true);
    try {
      await loadSampleData();
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <section
      aria-labelledby="getting-started-heading"
      className="relative overflow-hidden rounded-2xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 p-5 sm:p-6"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss getting started"
        className="absolute right-3 top-3 rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-indigo-400" />
        <h2 id="getting-started-heading" className="text-lg font-semibold text-slate-100">
          Welcome to Helm
        </h2>
      </div>
      <p className="mt-1 max-w-xl text-sm text-slate-400">
        Your entire consulting back office in one place. A few quick steps to get going:
      </p>

      {/* Progress */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
          {doneCount} of {steps.length}
        </span>
      </div>

      {/* Checklist */}
      <ul className="mt-4 space-y-1">
        {steps.map((step) => (
          <li
            key={step.key}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-800/40"
          >
            {step.done ? (
              <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />
            ) : (
              <Circle size={17} className="shrink-0 text-slate-600" />
            )}
            <span className={['flex-1 text-sm', step.done ? 'text-slate-500 line-through' : 'text-slate-200'].join(' ')}>
              {step.label}
            </span>
            {!step.done && (
              <Link
                to={step.to}
                className={[
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  step.key === nextStep?.key
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'text-indigo-400 hover:bg-slate-800 hover:text-indigo-300',
                ].join(' ')}
              >
                {step.cta}
                <ArrowRight size={12} />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* Explore with sample data — only while the app is genuinely empty */}
      {totallyEmpty && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Compass size={16} className="mt-0.5 shrink-0 text-indigo-400" />
            <p className="text-sm text-slate-400">
              Just exploring? Load a realistic sample practice to see everything in action — clear it
              anytime, your own data stays separate.
            </p>
          </div>
          <Button variant="secondary" size="sm" loading={loading} onClick={handleLoadSample} className="shrink-0">
            Load sample data
          </Button>
        </div>
      )}
    </section>
  );
}
