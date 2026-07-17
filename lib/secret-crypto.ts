import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEncryptionEnv } from "@/lib/env";

const VERSION = "v1";

export function encryptSecret(value: string) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}
export function decryptSecret(value: string) {
  const [version, ivValue, tagValue, ciphertextValue, ...extra] = value.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue || extra.length) {
    throw new Error("Stored sender password has an unsupported encrypted format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64")), decipher.final()]).toString("utf8");
}

function encryptionKey() {
  const encoded = getEncryptionEnv().APP_ENCRYPTION_KEY;
  const key = Buffer.from(encoded, "base64");
  if (key.byteLength !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}
