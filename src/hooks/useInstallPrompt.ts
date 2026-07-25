import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Wraps the PWA install flow. `canInstall` is true only on browsers that fire
 * `beforeinstallprompt` (Chromium-based) when the app is installable and not
 * already installed; `promptInstall` shows the native install dialog. On
 * browsers that don't support it (e.g. Safari, which uses Add to Home Screen),
 * `canInstall` stays false and the UI falls back to text guidance.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // stash it so we can trigger the prompt on our own button
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null); // a prompt can only be used once
  }

  return { canInstall: !!deferred && !installed, installed, promptInstall };
}
