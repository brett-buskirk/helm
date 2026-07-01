import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { db } from './db';
import { installEncryptionHooks } from './db/encryption';

// Install the transparent-encryption hooks once, at startup, before anything
// touches the database. Done here (not in db/index.ts) to avoid an import cycle.
installEncryptionHooks(db);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
