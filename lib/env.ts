import { z } from "zod";

const authEnvSchema = z.object({
  AUTH_MODE: z.enum(["development", "entra"]).default(process.env.NODE_ENV === "production" ? "entra" : "development"),
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_API_AUDIENCE: z.string().optional()
});

const dbEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required")
});

const storageEnvSchema = z.object({
  APP_STORAGE_DIR: z.string().default("./storage")
});

const pdfEnvSchema = z.object({
  SOFFICE_PATH: z.string().optional()
});

const serverEnvSchema = authEnvSchema.merge(dbEnvSchema).merge(storageEnvSchema).merge(pdfEnvSchema);

export function getAuthEnv() {
  const env = authEnvSchema.parse(process.env);
  if (env.AUTH_MODE === "entra" && (!env.ENTRA_TENANT_ID || !env.ENTRA_CLIENT_ID)) {
    throw new Error("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required when AUTH_MODE=entra.");
  }
  return env;
}

export function getDbEnv() {
  return dbEnvSchema.parse(process.env);
}

export function getStorageEnv() {
  return storageEnvSchema.parse(process.env);
}

export function getPdfEnv() {
  return pdfEnvSchema.parse(process.env);
}

export function getServerEnv() {
  const env = serverEnvSchema.parse(process.env);
  if (env.AUTH_MODE === "entra" && (!env.ENTRA_TENANT_ID || !env.ENTRA_CLIENT_ID)) {
    throw new Error("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required when AUTH_MODE=entra.");
  }
  return env;
}
