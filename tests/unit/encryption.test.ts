import { describe, it, expect } from "vitest";
import {
  encryptPII,
  decryptPII,
  generateBlindIndex,
  encryptJSON,
  decryptJSON,
  maskPII,
} from "@/lib/encryption";

describe("AES-256-GCM PII Encryption & Blind Index", () => {
  it("encrypts and decrypts PII data reversibly", () => {
    const originalEmail = "player.budi@example.com";
    const originalPhone = "+6281234567890";

    const encryptedEmail = encryptPII(originalEmail);
    const encryptedPhone = encryptPII(originalPhone);

    expect(encryptedEmail).toBeDefined();
    expect(encryptedEmail).not.toBe(originalEmail);
    expect(encryptedEmail.split(":")).toHaveLength(3);

    const decryptedEmail = decryptPII(encryptedEmail);
    const decryptedPhone = decryptPII(encryptedPhone);

    expect(decryptedEmail).toBe(originalEmail);
    expect(decryptedPhone).toBe(originalPhone);
  });

  it("produces non-deterministic ciphertexts for the same plaintext due to random IV", () => {
    const text = "sensitivedata123";
    const cipher1 = encryptPII(text);
    const cipher2 = encryptPII(text);

    expect(cipher1).not.toBe(cipher2);
    expect(decryptPII(cipher1)).toBe(text);
    expect(decryptPII(cipher2)).toBe(text);
  });

  it("fails to decrypt tampered ciphertexts or invalid auth tags in strict mode", () => {
    const text = "081999888777";
    const encrypted = encryptPII(text);
    const [ivHex, tagHex, dataHex] = encrypted.split(":");

    // Tamper with data
    const tamperedData = (parseInt(dataHex[0], 16) ^ 1).toString(16) + dataHex.slice(1);
    const tamperedCipher = `${ivHex}:${tagHex}:${tamperedData}`;

    expect(() => decryptPII(tamperedCipher, true)).toThrow();

    // Tamper with auth tag
    const tamperedTag = (parseInt(tagHex[0], 16) ^ 1).toString(16) + tagHex.slice(1);
    const tamperedTagCipher = `${ivHex}:${tamperedTag}:${dataHex}`;

    expect(() => decryptPII(tamperedTagCipher, true)).toThrow();
  });

  it("rejects invalid ciphertext formats in strict mode and falls back in default mode", () => {
    expect(() => decryptPII("invalid-ciphertext-string", true)).toThrow(
      "Invalid ciphertext format for AES-256-GCM decryption"
    );
    expect(decryptPII("plain-text-legacy-phone")).toBe("plain-text-legacy-phone");
  });

  it("handles empty strings cleanly", () => {
    expect(encryptPII("")).toBe("");
    expect(decryptPII("")).toBe("");
    expect(generateBlindIndex("")).toBe("");
  });

  it("generates deterministic blind index for exact-match searches", () => {
    const email1 = "john.doe@rallypadel.id";
    const email2 = "JOHN.DOE@RALLYPADEL.ID";
    const email3 = "  john.doe@rallypadel.id  ";

    const index1 = generateBlindIndex(email1);
    const index2 = generateBlindIndex(email2);
    const index3 = generateBlindIndex(email3);

    expect(index1).toBeDefined();
    expect(index1).toHaveLength(64); // SHA-256 hex length
    expect(index1).toBe(index2);
    expect(index1).toBe(index3);
  });

  it("produces different blind indexes for different values", () => {
    const indexA = generateBlindIndex("08123456789");
    const indexB = generateBlindIndex("08123456780");

    expect(indexA).not.toBe(indexB);
  });

  it("encrypts and decrypts structured JSON transaction payloads reversibly", () => {
    const payload = {
      orderId: "RLY-1234",
      amount: 350000,
      vaNumber: "9887711223344",
      bank: "bca",
      customer: {
        name: "Budi Santoso",
        phone: "08123456789",
      },
    };

    const encrypted = encryptJSON(payload);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toContain("9887711223344");
    expect(encrypted).not.toContain("Budi Santoso");

    const decrypted = decryptJSON(encrypted);
    expect(decrypted).toEqual(payload);
  });

  it("masks PII correctly for preview / logging", () => {
    expect(maskPII("budi.santoso@example.com", "email")).toBe("b•••••@example.com");
    expect(maskPII("081234567890", "phone")).toBe("0812••••890");
    expect(maskPII("Budi Santoso", "name")).toBe("Budi S***");
  });
});
