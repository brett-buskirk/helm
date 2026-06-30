import { CheckCircle, AlertCircle } from 'lucide-react';

export interface ToastData {
  type: 'success' | 'error';
  message: string;
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div
      className={[
        'fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border px-4 py-3',
        'text-sm font-medium shadow-xl',
        toast.type === 'success'
          ? 'border-emerald-700 bg-emerald-900 text-emerald-100'
          : 'border-red-700 bg-red-900 text-red-100',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      {toast.type === 'success' ? (
        <CheckCircle size={16} className="shrink-0 text-emerald-400" />
      ) : (
        <AlertCircle size={16} className="shrink-0 text-red-400" />
      )}
      {toast.message}
    </div>
  );
}
