import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '../command/CommandPalette';

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // On navigation, if focus was left dangling (e.g. a control unmounted), move it
  // into the main region so keyboard users aren't stranded on <body>. Skips when
  // a page has already claimed focus (e.g. an autofocused form field).
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <div className="flex h-full bg-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <Sidebar onSearchOpen={() => setSearchOpen(true)} />
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 overflow-y-auto focus:outline-none"
      >
        <Outlet />
      </main>
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
