import nacl from 'tweetnacl';

/**
 * The vault: an in-memory encryption key plus synchronous field encryption.
 *
 * The key is derived from the user's passphrase (PBKDF2, async, at unlock) and
 * held only in memory — a reload re-locks. Field encryption itself is
 * synchronous (tweetnacl secretbox) because Dexie's read/write hooks are sync.
 *
 * Encrypted field values are tagged with a marker prefix so decryption is
 * idempotent and mixed plaintext/ciphertext states (mid-migration) are safe.
 */

const MARKER = 'nacl:';
const enc = new TextEncoder();
const dec = new TextDecoder();

let key: Uint8Array | null = null;
let suspended = false;
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

/** Subscribe to lock/unlock changes (for the React gate). Returns an unsubscribe. */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setKey(k: Uint8Array): void {
  key = new Uint8Array(k); // normalize realm for tweetnacl's instanceof checks
  notify();
}
export function clearKey(): void {
  key = null;
  notify();
}
export function hasKey(): boolean {
  return key !== null;
}

/** During migrations, hooks pass through so we can encrypt/decrypt explicitly. */
export function suspend(): void {
  suspended = true;
}
export function resume(): void {
  suspended = false;
}
/** True when hooks should actively encrypt/decrypt (unlocked and not migrating). */
export function isActive(): boolean {
  return key !== null && !suspended;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(MARKER);
}

/** Encrypt any JSON-serializable value into a marked, self-contained string. */
export function encryptValue(value: unknown): string {
  if (!key) throw new Error('Vault is locked.');
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  // Wrap in a fresh Uint8Array so tweetnacl's instanceof check holds even if
  // TextEncoder returns a cross-realm array (e.g. under jsdom in tests).
  const message = new Uint8Array(enc.encode(JSON.stringify(value)));
  const box = nacl.secretbox(message, nonce, key);
  const combined = new Uint8Array(nonce.length + box.length);
  combined.set(nonce);
  combined.set(box, nonce.length);
  return MARKER + bytesToBase64(combined);
}

/** Decrypt a marked value; returns non-marked values unchanged (passthrough). */
export function decryptValue(value: unknown): unknown {
  if (!isEncrypted(value) || !key) return value;
  const combined = base64ToBytes(value.slice(MARKER.length));
  const nonce = combined.slice(0, nacl.secretbox.nonceLength);
  const box = combined.slice(nacl.secretbox.nonceLength);
  const msg = nacl.secretbox.open(box, nonce, key);
  if (!msg) throw new Error('Decryption failed.');
  return JSON.parse(dec.decode(msg));
}

/** Derive a 32-byte key from a passphrase via PBKDF2-SHA256 (async; used at unlock). */
export async function deriveKey(passphrase: string, saltB64: string, iterations: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64) as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

export function randomSaltB64(): string {
  return bytesToBase64(nacl.randomBytes(16));
}
