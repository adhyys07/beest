import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';
import type { ValueTransformer } from 'typeorm';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // iv.tag.ciphertext — all base64url for safe storage
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decrypt(encoded: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const parts = encoded.split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted value');

  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * TypeORM column transformer that encrypts on write and decrypts on read.
 * Reads DB_ENCRYPTION_KEY from process.env (available after ConfigModule.forRoot).
 */
export const encryptedTransformer: ValueTransformer = {
  to(value: string | null): string | null {
    if (!value) return value;
    const key = process.env.DB_ENCRYPTION_KEY;
    if (!key) throw new Error('DB_ENCRYPTION_KEY is not set');
    return encrypt(value, key);
  },
  from(value: string | null): string | null {
    if (!value) return value;
    const key = process.env.DB_ENCRYPTION_KEY;
    if (!key) throw new Error('DB_ENCRYPTION_KEY is not set');
    return decrypt(value, key);
  },
};
