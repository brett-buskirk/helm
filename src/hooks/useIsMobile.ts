import { useSyncExternalStore } from 'react';

// Phones get the desktop gate; tablets (>= 768px, Tailwind's `md`) and up run
// the full app. This matches on the *layout* viewport, so it relies on the
// `width=device-width` viewport meta in index.html.
const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// No SSR (Vite SPA) — assume desktop for the server snapshot.
function getServerSnapshot(): boolean {
  return false;
}

/** True on phone-sized viewports (< 768px). Reactive to resize / rotation. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
