import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import * as vault from '../vault';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

afterEach(() => {
  vault.clearKey();
  vault.resume();
});

describe('deriveKey', () => {
  it('is deterministic for the same passphrase, salt, and iterations', async () => {
    const salt = vault.randomSaltB64();
    const a = await vault.deriveKey('pw', salt, 50_000);
    const b = await vault.deriveKey('pw', salt, 50_000);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a.length).toBe(32);
  });

  it('differs for a different passphrase', async () => {
    const salt = vault.randomSaltB64();
    const a = await vault.deriveKey('pw', salt, 50_000);
    const b = await vault.deriveKey('other', salt, 50_000);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe('encryptValue / decryptValue', () => {
  beforeEach(async () => {
    vault.setKey(await vault.deriveKey('pw', vault.randomSaltB64(), 50_000));
  });

  it('round-trips strings, numbers, and objects', () => {
    for (const value of ['hello', 4200.5, { a: 1, b: [2, 3] }, ['x', 'y']]) {
      const enc = vault.encryptValue(value);
      expect(vault.isEncrypted(enc)).toBe(true);
      expect(vault.decryptValue(enc)).toEqual(value);
    }
  });

  it('produces different ciphertext each time (fresh nonce)', () => {
    expect(vault.encryptValue('same')).not.toBe(vault.encryptValue('same'));
  });

  it('passes through values that are not encrypted markers', () => {
    expect(vault.decryptValue('plain text')).toBe('plain text');
    expect(vault.decryptValue(42)).toBe(42);
    expect(vault.decryptValue(null)).toBe(null);
  });
});

describe('locked vault', () => {
  it('throws when encrypting without a key', () => {
    vault.clearKey();
    expect(() => vault.encryptValue('x')).toThrow(/locked/i);
  });

  it('passes encrypted values through unchanged when locked', () => {
    vault.clearKey();
    expect(vault.decryptValue('nacl:whatever')).toBe('nacl:whatever');
  });
});
