import crypto from 'node:crypto';

/**
 * Cryptographic security layer for 1688 Research Platform
 * - Per-password unique cryptographically random salt (16 bytes)
 * - PBKDF2 with SHA-256 and 100,000 iterations
 * - Formatted as: pbkdf2_sha256$100000$<saltHex>$<hashHex>
 * - Session tokens: raw token to client only; server stores SHA-256 hash digest
 */

const PBKDF2_ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, DIGEST);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const [algo, iterationsStr, saltHex, originalHashHex] = parts;
    if (algo !== 'pbkdf2_sha256') return false;

    const iterations = parseInt(iterationsStr, 10);
    const salt = Buffer.from(saltHex, 'hex');
    const originalHash = Buffer.from(originalHashHex, 'hex');

    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, originalHash.length, DIGEST);
    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch (err) {
    return false;
  }
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function generatePairGrant(): { rawGrant: string; grantHash: string } {
  const rawGrant = `grant_${crypto.randomBytes(16).toString('hex')}`;
  const grantHash = hashToken(rawGrant);
  return { rawGrant, grantHash };
}

export function generateMcpToken(): { rawToken: string; tokenHash: string } {
  const rawToken = `mcp_live_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * AES-256-GCM authenticated encryption for Cloud AI dynamic secrets
 * Uses process.env.AI_VAULT_SECRET or fallback deployment key
 */
const VAULT_SECRET = process.env.AI_VAULT_SECRET || process.env.SESSION_SECRET || 'vault_secret_1688_product_research_master_key_32b';
const VAULT_KEY = crypto.createHash('sha256').update(VAULT_SECRET).digest(); // 32 bytes

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `aes256gcm$${iv.toString('hex')}$${authTag.toString('hex')}$${encrypted.toString('hex')}`;
}

export function decryptSecret(cipherText: string): string {
  try {
    if (!cipherText.startsWith('aes256gcm$')) return cipherText; // Return as-is if unencrypted legacy
    const parts = cipherText.split('$');
    if (parts.length !== 4) return cipherText;
    const [, ivHex, authTagHex, encHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return '';
  }
}

