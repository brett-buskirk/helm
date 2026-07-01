/**
 * Passphrase-based encryption for Helm backups.
 *
 * AES-256-GCM (authenticated) with a key derived from the user's passphrase via
 * PBKDF2-SHA256. Uses the Web Crypto API, which is present in browsers and the
 * Tauri webview — no dependencies. The passphrase is never stored; a wrong one
 * fails the GCM auth check on decrypt.
 */

const MARKER = 'helm-encrypted-backup';
const PBKDF2_ITERATIONS = 210_000;

interface Envelope {
  format: typeof MARKER;
  v: 1;
  cipher: 'AES-GCM';
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  iv: string;
  data: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a JSON-serializable value into a self-describing envelope string. */
export async function encryptJSON(data: unknown, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error('A passphrase is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource),
  );
  const envelope: Envelope = {
    format: MARKER,
    v: 1,
    cipher: 'AES-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
  return JSON.stringify(envelope, null, 2);
}

/** True if the text looks like a Helm encrypted-backup envelope. */
export function isEncryptedBackup(text: string): boolean {
  try {
    return (JSON.parse(text) as Envelope)?.format === MARKER;
  } catch {
    return false;
  }
}

/** Decrypt an envelope produced by {@link encryptJSON}. Throws on a wrong passphrase or tampering. */
export async function decryptJSON(text: string, passphrase: string): Promise<unknown> {
  let envelope: Envelope;
  try {
    envelope = JSON.parse(text) as Envelope;
  } catch {
    throw new Error('Not a valid backup file.');
  }
  if (envelope?.format !== MARKER) throw new Error('This file is not an encrypted Helm backup.');

  const key = await deriveKey(passphrase, base64ToBytes(envelope.kdf.salt), envelope.kdf.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as BufferSource },
      key,
      base64ToBytes(envelope.data) as BufferSource,
    );
  } catch {
    throw new Error('Incorrect passphrase, or the file has been altered.');
  }
  return JSON.parse(new TextDecoder().decode(plaintext));
}
