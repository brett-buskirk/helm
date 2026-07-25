import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Download, WifiOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { db } from '../../db';
import { Button } from '../ui/Button';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

const DISMISS_KEY = 'helm-intro-dismissed';

/**
 * Product-identity hero shown above the getting-started checklist for new
 * users. A first-time visitor sees a working dashboard and can't tell Helm is a
 * real, installable app versus a demo — this says what Helm is and that it's a
 * genuine local-first PWA you install and own. Self-hides once a business
 * profile is set (an established user) or the user dismisses it.
 */
export function WelcomeIntro() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const settings = useLiveQuery(() => db.settings.limit(1).first());
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  // Once someone has set up their business profile they clearly know what Helm
  // is; brand-new users (no profile) and non-dismissers still see it.
  if (dismissed || settings?.businessName?.trim()) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <section
      aria-labelledby="welcome-intro-heading"
      className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60"
    >
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-indigo-400 to-sky-400" />
      <button
        onClick={dismiss}
        aria-label="Dismiss introduction"
        className="absolute right-3 top-4 rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
      >
        <X size={16} />
      </button>

      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <img src="/helm-icon.svg" alt="" className="h-9 w-9" />
          <div>
            <h2 id="welcome-intro-heading" className="text-lg font-semibold text-slate-100">
              Your consulting back office, in one place
            </h2>
            <p className="text-sm font-medium text-indigo-400">
              Helm — a local-first PSA for the independent consultant
            </p>
          </div>
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Clients, proposals, SOWs, invoices, time, expenses, taxes, and contract documents — one
          connected tool shaped around a solo consultant's workflow. It's a real, free app you
          install and use every day, <span className="font-medium text-slate-300">not a demo</span>.
        </p>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Download size={13} className="text-indigo-400" /> Installable app
          </span>
          <span className="flex items-center gap-1.5">
            <WifiOff size={13} className="text-indigo-400" /> Works fully offline
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-indigo-400" /> Your data stays on your device
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {canInstall ? (
            <Button size="sm" onClick={promptInstall}>
              <Download size={14} /> Install Helm
            </Button>
          ) : installed ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 size={14} /> Installed as an app
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              To install: look for the install icon in your browser's address bar, or use Share → Add
              to Home Screen.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
