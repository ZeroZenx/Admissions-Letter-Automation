import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_STORAGE_DIR: z.string().default("./storage"),
  SOFFICE_PATH: z.string().optional(),
  AUTH_MODE: z.enum(["development", "entra"]).default(process.env.NODE_ENV === "production" ? "entra" : "development"),
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_CLIENT_ID: z.string().optional()
});

export function getServerEnv() {
  const env = serverEnvSchema.parse(process.env);
  if (env.AUTH_MODE === "entra" && (!env.ENTRA_TENANT_ID || !env.ENTRA_CLIENT_ID)) {
    throw new Error("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required when AUTH_MODE=entra.");
  }
  return env;
}
