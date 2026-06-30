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

const clientAuthEnvSchema = z.object({
  NEXT_PUBLIC_AUTH_MODE: z.enum(["development", "entra"]).default(process.env.NODE_ENV === "production" ? "entra" : "development"),
  NEXT_PUBLIC_ENTRA_TENANT_ID: z.string().optional(),
  NEXT_PUBLIC_ENTRA_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_ENTRA_REDIRECT_URI: z.string().optional(),
  NEXT_PUBLIC_ENTRA_API_SCOPE: z.string().optional(),
  NEXT_PUBLIC_GRAPH_SCOPES: z.string().default("User.Read Mail.Send")
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

export function getClientAuthEnv() {
  const env = clientAuthEnvSchema.parse(process.env);
  const graphScopes = env.NEXT_PUBLIC_GRAPH_SCOPES.split(/\s+/).filter(Boolean);
  if (env.NEXT_PUBLIC_AUTH_MODE === "entra") {
    const missing = [
      env.NEXT_PUBLIC_ENTRA_TENANT_ID ? "" : "NEXT_PUBLIC_ENTRA_TENANT_ID",
      env.NEXT_PUBLIC_ENTRA_CLIENT_ID ? "" : "NEXT_PUBLIC_ENTRA_CLIENT_ID",
      env.NEXT_PUBLIC_ENTRA_API_SCOPE ? "" : "NEXT_PUBLIC_ENTRA_API_SCOPE",
      graphScopes.includes("Mail.Send") ? "" : "Mail.Send graph scope"
    ].filter(Boolean);
    if (missing.length) throw new Error(`Client Entra configuration is incomplete: ${missing.join(", ")}.`);
  }
  return { ...env, graphScopes };
}

export function getServerEnv() {
  const env = serverEnvSchema.parse(process.env);
  if (env.AUTH_MODE === "entra" && (!env.ENTRA_TENANT_ID || !env.ENTRA_CLIENT_ID)) {
    throw new Error("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required when AUTH_MODE=entra.");
  }
  return env;
}
