import crypto from "crypto";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12; // recommended length for GCM
const TAG_LEN = 16;
const SCRYPT_SALT = "talespinner.llm_tokens.v1";
let cachedMasterKey: string | null = null;
let cachedDerivedKey: Buffer | null = null;

function getMasterKey(): string {
  const key = process.env.TOKENS_MASTER_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "TOKENS_MASTER_KEY is not set. Token encryption is required."
    );
  }
  return key.trim();
}

function deriveKey(masterKey: string): Buffer {
  if (cachedMasterKey === masterKey && cachedDerivedKey) {
    return cachedDerivedKey;
  }

  const derived = crypto.scryptSync(masterKey, SCRYPT_SALT, KEY_LEN);
  cachedMasterKey = masterKey;
  cachedDerivedKey = derived;
  return derived;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty secret");
  }

  const key = deriveKey(getMasterKey());
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LEN) {
    // Should never happen, but keep format strict.
    throw new Error("Unexpected GCM auth tag length");
  }

  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, ciphertextB64, ...rest] = payload.split(".");
  if (!ivB64 || !tagB64 || !ciphertextB64 || rest.length > 0) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const key = deriveKey(getMasterKey());
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  if (!plaintext) {
    throw new Error("Decrypted secret is empty");
  }
  return plaintext;
}

export function maskToken(token: string): string {
  const value = token?.trim() ?? "";
  if (!value) return "";

  const last4 = value.length >= 4 ? value.slice(-4) : value;
  if (value.startsWith("sk-")) {
    return `sk-…${last4}`;
  }
  return `…${last4}`;
}

