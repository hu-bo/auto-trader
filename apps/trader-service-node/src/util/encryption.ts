import crypto from 'crypto';

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeKey(key: string): Buffer {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('ENCRYPTION_KEY is required');
  }

  // Try strict base64 decode first (compatible with Python base64.b64decode(validate=True)).
  if (trimmed.length % 4 === 0 && BASE64_RE.test(trimmed)) {
    const raw = Buffer.from(trimmed, 'base64');
    if (raw.length === 32 && raw.toString('base64') === trimmed) {
      return raw;
    }
  }

  const raw = Buffer.from(trimmed, 'utf8');
  if (raw.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (raw) or base64-encoded 32 bytes');
  }
  return raw;
}

// AES-256-GCM compatible with apps/trader-service/app/utils/encryption.py (nonce + ciphertext+tag, base64 encoded).
export class AesGcmEncryptor {
  private readonly key: Buffer;

  private constructor(key: Buffer) {
    this.key = key;
  }

  static fromKey(key: string): AesGcmEncryptor {
    return new AesGcmEncryptor(decodeKey(key));
  }

  encrypt(plaintext: string): string {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, ciphertext, tag]).toString('base64');
  }

  decrypt(token: string): string {
    const data = Buffer.from(token, 'base64');
    if (data.length < 12 + 16) {
      throw new Error('Invalid encrypted token');
    }

    const nonce = data.subarray(0, 12);
    const tag = data.subarray(data.length - 16);
    const ciphertext = data.subarray(12, data.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }
}

