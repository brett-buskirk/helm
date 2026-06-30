import { useRouteError, isRouteErrorResponse, Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage() {
  const error = useRouteError();

  let message = 'An unexpected error occurred.';
  if (isRouteErrorResponse(error)) {
    message = error.statusText || `${error.status} error`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="max-w-md text-center">
        <AlertTriangle size={40} className="mx-auto mb-4 text-red-400" />
        <h1 className="mb-2 text-xl font-semibold text-slate-100">Something went wrong</h1>
        <p className="mb-1 text-sm text-slate-400">{message}</p>
        <p className="mb-6 text-xs text-slate-600">
          If this keeps happening, try clearing your browser data for this site.
        </p>
        <Link
          to="/"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
