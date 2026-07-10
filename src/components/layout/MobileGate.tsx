/**
 * Shown instead of the app on phone-sized viewports (see {@link useIsMobile}).
 *
 * Helm is a dense, keyboard-driven, local-first desktop workspace — and because
 * data lives in each browser's own local storage, a phone has nothing to show
 * anyway. So rather than a broken layout, mobile visitors get this branded card,
 * which doubles as a lightweight "what is Helm" explainer.
 */
export function MobileGate() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-6 py-12 text-center">
      <div className="w-full max-w-sm">
        <img src="/helm-icon.svg" alt="" className="mx-auto mb-6 h-16 w-16" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Helm</h1>
        <p className="mt-2 text-sm font-medium text-indigo-400">
          A local-first PSA for the solo consultant
        </p>
        <p className="mt-5 text-sm leading-relaxed text-slate-400">
          Your entire consulting back office — clients, proposals, invoices, time,
          expenses, taxes, and contract documents — in one connected place that
          runs entirely on your own machine. No server, no accounts, no cloud.
        </p>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5 text-left">
          <p className="text-sm font-semibold text-slate-200">Built for desktop</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Helm is a dense, keyboard-driven workspace, and your data lives locally
            in the browser you work from — so it's meant for a larger screen. Open{' '}
            <span className="whitespace-nowrap font-medium text-slate-300">
              helm.brett-buskirk.dev
            </span>{' '}
            on a laptop or desktop to explore the full app.
          </p>
        </div>

        <p className="mt-8 text-[11px] uppercase tracking-[0.15em] text-slate-600">
          Local-first · Offline-capable · Private by design
        </p>
      </div>
    </div>
  );
}
