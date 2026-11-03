import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits is recommended for AES-GCM

/**
 * Derives a 32-byte key from NEXTAUTH_SECRET (or fallback in development).
 */
function getSecretKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || "default_padel_secret_key_32_bytes_long!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt sensitive Personal Identifiable Information (PII) using AES-256-GCM.
 * Formats result as: <iv_hex>:<authTag_hex>:<encrypted_hex>
 */
export function encryptPII(text: string): string {
  if (!text) return "";

  const key = getSecretKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt sensitive PII ciphertext encrypted with encryptPII (AES-256-GCM).
 * In default mode, falls back gracefully to original text if ciphertext is legacy plain text.
 * If strict is true, throws an error on invalid format or authentication tag failure.
 */
export function decryptPII(ciphertext: string, strict: boolean = false): string {
  if (!ciphertext) return "";

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    if (strict) {
      throw new Error("Invalid ciphertext format for AES-256-GCM decryption");
    }
    // Graceful fallback for unencrypted legacy plain text
    return ciphertext;
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getSecretKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    if (strict) {
      throw err;
    }
    // Return original text if decryption fails
    return ciphertext;
  }
}

/**
 * Generate a deterministic HMAC-SHA256 blind index for fast exact-match searches
 * over encrypted data (e.g. phone, email).
 * Normalizes input (trims whitespace, converts to lowercase) for consistent searching.
 */
export function generateBlindIndex(term: string): string {
  if (!term) return "";
  const normalized = term.trim().toLowerCase();
  const key = getSecretKey();
  return crypto.createHmac("sha256", key).update(normalized).digest("hex");
}

/**
 * Encrypt arbitrary JSON object into AES-256-GCM ciphertext.
 */
export function encryptJSON(data: any): string {
  if (data === null || data === undefined) return "";
  try {
    const jsonStr = typeof data === "string" ? data : JSON.stringify(data);
    return encryptPII(jsonStr);
  } catch {
    return "";
  }
}

/**
 * Decrypt AES-256-GCM ciphertext back into typed JSON object.
 */
export function decryptJSON<T = any>(ciphertext: string | null | undefined): T | null {
  if (!ciphertext) return null;
  try {
    const raw = decryptPII(ciphertext);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Mask sensitive PII for presentation layer when full display is not needed.
 */
export function maskPII(text: string, type: "email" | "phone" | "name" = "phone"): string {
  if (!text) return "";
  if (type === "email" && text.includes("@")) {
    return text.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => `${first}${"•".repeat(Math.min(5, middle.length))}${domain}`);
  }
  if (type === "phone") {
    const clean = text.trim();
    if (clean.length > 7) {
      return `${clean.slice(0, 4)}••••${clean.slice(-3)}`;
    }
    return `${clean.slice(0, 2)}••••`;
  }
  if (type === "name") {
    const parts = text.trim().split(" ");
    return parts.map((p, idx) => (idx === 0 ? p : `${p[0]}***`)).join(" ");
  }
  return text;
}
