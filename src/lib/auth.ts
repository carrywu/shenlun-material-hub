// Web Crypto API based JWT and hashing utilities for Node.js & Edge Runtime compatibility

const encoder = new TextEncoder();
const DEFAULT_USERNAME = "admin";
// SHA-256 hash for "admin123"
const DEFAULT_PASSWORD_HASH =
  "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
const DEFAULT_JWT_SECRET = "shenlun-material-hub-super-secret-jwt-key";

export interface AuthConfig {
  username: string;
  passwordHash: string;
  jwtSecret: string;
  usingDefaults: boolean;
}

export function getAuthConfig(
  env: NodeJS.ProcessEnv = process.env
): { ok: true; config: AuthConfig } | { ok: false; message: string } {
  const isProduction = env.NODE_ENV === "production";
  const missing: string[] = [];

  if (!env.ADMIN_USERNAME) missing.push("ADMIN_USERNAME");
  if (!env.ADMIN_PASSWORD_HASH) missing.push("ADMIN_PASSWORD_HASH");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");

  if (isProduction && missing.length > 0) {
    return {
      ok: false,
      message: `生产环境缺少鉴权配置: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    config: {
      username: env.ADMIN_USERNAME || DEFAULT_USERNAME,
      passwordHash: env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH,
      jwtSecret: env.JWT_SECRET || DEFAULT_JWT_SECRET,
      usingDefaults: missing.length > 0,
    },
  };
}

// Base64Url encoding helpers
function base64UrlEncode(str: string): string {
  const binary = String.fromCharCode(...encoder.encode(str));
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return new TextDecoder().decode(
    Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  );
}

// Convert a secret string to a CryptoKey
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 86400
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await getCryptoKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(dataToSign)
  );

  const encodedSignature = base64UrlEncodeBuffer(signatureBuffer);
  return `${dataToSign}.${encodedSignature}`;
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const key = await getCryptoKey(secret);
    
    // Base64Url decode signature to binary buffer
    let base64 = encodedSignature.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const sigBinary = atob(base64);
    const sigBuffer = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBuffer[i] = sigBinary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer,
      encoder.encode(dataToVerify)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Token expired
    }

    return payload;
  } catch (_error) {
    return null;
  }
}

// SHA-256 hashing for password storage
export async function hashPassword(password: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  
  // Timing safe equal check to prevent timing attacks
  if (inputHash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < inputHash.length; i++) {
    result |= inputHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}
