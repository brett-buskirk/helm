import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { db } from '../db';
import { installEncryptionHooks } from '../db/encryption';

// Mirror the app entry point: encryption hooks are installed at startup, not
// from db/index.ts (which would cause an import cycle).
installEncryptionHooks(db);
