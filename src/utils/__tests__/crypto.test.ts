import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { encryptJSON, decryptJSON, isEncryptedBackup } from '../crypto';

// jsdom's global crypto may lack `subtle`; use Node's Web Crypto in tests.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

const sample = {
  clients: [{ id: 1, company: 'Acme', ein: '12-3456789' }],
  settings: [{ businessName: 'Brett LLC' }],
};

describe('encryptJSON / decryptJSON', () => {
  it('round-trips a value with the correct passphrase', async () => {
    const blob = await encryptJSON(sample, 'correct horse battery staple');
    const back = await decryptJSON(blob, 'correct horse battery staple');
    expect(back).toEqual(sample);
  });

  it('produces an opaque envelope that does not leak plaintext', async () => {
    const blob = await encryptJSON(sample, 'pw');
    expect(blob).not.toContain('Acme');
    expect(blob).not.toContain('12-3456789');
    expect(blob).not.toContain('Brett LLC');
  });

  it('fails with the wrong passphrase', async () => {
    const blob = await encryptJSON(sample, 'right');
    await expect(decryptJSON(blob, 'wrong')).rejects.toThrow(/incorrect passphrase|altered/i);
  });

  it('fails if the ciphertext is tampered with', async () => {
    const blob = await encryptJSON(sample, 'pw');
    const env = JSON.parse(blob);
    // Flip a character in the base64 ciphertext
    env.data = env.data.slice(0, -2) + (env.data.endsWith('A') ? 'B' : 'A') + '=';
    await expect(decryptJSON(JSON.stringify(env), 'pw')).rejects.toThrow();
  });

  it('uses a fresh salt and IV each time (different ciphertext for same input)', async () => {
    const a = await encryptJSON(sample, 'pw');
    const b = await encryptJSON(sample, 'pw');
    expect(a).not.toBe(b);
  });

  it('requires a passphrase to encrypt', async () => {
    await expect(encryptJSON(sample, '')).rejects.toThrow(/passphrase/i);
  });
});

describe('isEncryptedBackup', () => {
  it('recognizes an encrypted envelope', async () => {
    const blob = await encryptJSON(sample, 'pw');
    expect(isEncryptedBackup(blob)).toBe(true);
  });

  it('returns false for a plain JSON backup', () => {
    expect(isEncryptedBackup(JSON.stringify({ version: 3, clients: [] }))).toBe(false);
  });

  it('returns false for non-JSON text', () => {
    expect(isEncryptedBackup('not json')).toBe(false);
  });
});
