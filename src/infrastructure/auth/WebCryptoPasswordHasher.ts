import type { IPasswordHasher } from "@/application/ports";

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );
}

/** PBKDF2 via Web Crypto — native in Workers, no bcrypt dependency. */
export class WebCryptoPasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const derived = new Uint8Array(await deriveKey(password, salt));
    return `pbkdf2-sha256$${String(ITERATIONS)}$${toBase64(salt)}$${toBase64(derived)}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [scheme, iterationsRaw, saltB64, hashB64] = passwordHash.split("$");
    if (scheme !== "pbkdf2-sha256" || !iterationsRaw || !saltB64 || !hashB64) {
      return false;
    }

    const iterations = Number(iterationsRaw);
    void iterations;
    const salt = fromBase64(saltB64);
    const expected = fromBase64(hashB64);
    const derived = new Uint8Array(await deriveKey(password, salt.slice(0)));

    if (derived.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < derived.length; i += 1) {
      diff |= derived[i] ^ expected[i];
    }
    return diff === 0;
  }
}
