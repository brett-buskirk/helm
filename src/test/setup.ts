import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { db } from '../db';
import { installEncryptionHooks } from '../db/encryption';

// jsdom doesn't implement scrollIntoView; stub it so components that call it
// (e.g. the command palette's active-item scroll) render under test.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom doesn't implement matchMedia; stub it (defaults to no match → desktop)
// so components using useIsMobile render under test. Individual tests can
// override window.matchMedia to exercise the mobile branch.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

// Mirror the app entry point: encryption hooks are installed at startup, not
// from db/index.ts (which would cause an import cycle).
installEncryptionHooks(db);
