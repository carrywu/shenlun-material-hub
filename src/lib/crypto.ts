import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

/** Check if the encryption key is configured (non-throwing) */
export function hasEncryptionKey(): boolean {
  return !!process.env.AI_CONFIG_ENCRYPTION_KEY;
}

function getKey(): Buffer {
  const key = process.env.AI_CONFIG_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("AI_CONFIG_ENCRYPTION_KEY 环境变量未设置");
  }
  const keyBuffer = Buffer.from(key, "utf-8");
  if (keyBuffer.length < 32) {
    throw new Error(
      `AI_CONFIG_ENCRYPTION_KEY 长度不足：需要 32 字节，当前 ${keyBuffer.length} 字节。` +
        "请使用 openssl rand -hex 32 生成。"
    );
  }
  return keyBuffer.subarray(0, 32);
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  // iv:ciphertext (both hex-encoded)
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) {
    throw new Error("加密格式无效");
  }
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}
