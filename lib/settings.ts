import { query, withTransaction } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";

export type EmailProvider = "graph" | "smtp";

export type AppSettings = {
  email: {
    defaultSubject: string;
    defaultBody: string;
    stalePendingMinutes: number;
    provider: EmailProvider;
    senderEmail: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUsername: string;
    passwordConfigured: boolean;
  };
  pdf: { converter: "libreoffice" };
};

export type AppSettingsUpdate = AppSettings & {
  email: AppSettings["email"] & { password?: string; clearPassword?: boolean };
};

export type StoredSmtpConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  senderEmail: string;
};

export const defaultSettings: AppSettings = {
  email: {
    defaultSubject: "Your COSTAATT admissions letter",
    defaultBody: "Dear applicant,<br><br>Please find your COSTAATT admissions letter attached.",
    stalePendingMinutes: 30,
    provider: "graph",
    senderEmail: "",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: "",
    passwordConfigured: false
  },
  pdf: { converter: "libreoffice" }
};

const settingKeys = {
  "email.defaultSubject": defaultSettings.email.defaultSubject,
  "email.defaultBody": defaultSettings.email.defaultBody,
  "email.stalePendingMinutes": defaultSettings.email.stalePendingMinutes,
  "pdf.converter": defaultSettings.pdf.converter
} as const;

const settingLimits = {
  defaultSubjectMaxLength: 160,
  defaultBodyMaxLength: 12000,
  stalePendingMinutesMin: 5,
  stalePendingMinutesMax: 1440
};

type SenderRow = {
  provider: EmailProvider;
  sender_email: string | null;
  smtp_host: string | null;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string | null;
  password_encrypted: string | null;
};

export async function getAppSettings() {
  const [result, senderResult] = await Promise.all([
    query<{ key: keyof typeof settingKeys; value: unknown }>(
      "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
      [Object.keys(settingKeys)]
    ),
    query<SenderRow>(
      `SELECT provider, sender_email, smtp_host, smtp_port, smtp_secure, smtp_username, password_encrypted
         FROM email_sender_settings WHERE id = 1`
    )
  ]);
  const values = new Map<string, unknown>();
  for (const row of result.rows) values.set(row.key, row.value);
  const sender = senderResult.rows[0];

  return {
    email: {
      defaultSubject: boundedStringSetting(values.get("email.defaultSubject"), defaultSettings.email.defaultSubject, settingLimits.defaultSubjectMaxLength),
      defaultBody: boundedStringSetting(values.get("email.defaultBody"), defaultSettings.email.defaultBody, settingLimits.defaultBodyMaxLength),
      stalePendingMinutes: boundedNumberSetting(values.get("email.stalePendingMinutes"), defaultSettings.email.stalePendingMinutes, settingLimits.stalePendingMinutesMin, settingLimits.stalePendingMinutesMax),
      provider: sender?.provider ?? defaultSettings.email.provider,
      senderEmail: sender?.sender_email ?? "",
      smtpHost: sender?.smtp_host ?? defaultSettings.email.smtpHost,
      smtpPort: sender?.smtp_port ?? defaultSettings.email.smtpPort,
      smtpSecure: sender?.smtp_secure ?? defaultSettings.email.smtpSecure,
      smtpUsername: sender?.smtp_username ?? "",
      passwordConfigured: Boolean(sender?.password_encrypted)
    },
    pdf: { converter: enumSetting(values.get("pdf.converter"), defaultSettings.pdf.converter, ["libreoffice"]) }
  } satisfies AppSettings;
}

export async function getStoredSmtpConfiguration(): Promise<StoredSmtpConfiguration> {
  const result = await query<SenderRow>(
    `SELECT provider, sender_email, smtp_host, smtp_port, smtp_secure, smtp_username, password_encrypted
       FROM email_sender_settings WHERE id = 1`
  );
  const sender = result.rows[0];
  if (sender?.provider !== "smtp") throw new Error("Shared SMTP sender is not selected.");
  if (!sender.sender_email || !sender.smtp_host || !sender.smtp_username || !sender.password_encrypted) {
    throw new Error("Shared SMTP sender settings are incomplete.");
  }
  return {
    host: sender.smtp_host,
    port: sender.smtp_port,
    secure: sender.smtp_secure,
    username: sender.smtp_username,
    password: decryptSecret(sender.password_encrypted),
    senderEmail: sender.sender_email
  };
}

export async function upsertAppSettings(settings: AppSettingsUpdate, updatedBy: string) {
  await withTransaction(async (client) => {
    const rows: Array<[string, string]> = [
      ["email.defaultSubject", settings.email.defaultSubject],
      ["email.defaultBody", settings.email.defaultBody],
      ["email.stalePendingMinutes", String(settings.email.stalePendingMinutes)],
      ["pdf.converter", settings.pdf.converter]
    ];
    for (const [key, value] of rows) {
      await client.query(
        `INSERT INTO app_settings (key, value, updated_by, updated_at)
         VALUES ($1, to_jsonb($2::text), $3, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, value, updatedBy]
      );
    }

    const current = await client.query<{ password_encrypted: string | null }>(
      "SELECT password_encrypted FROM email_sender_settings WHERE id = 1 FOR UPDATE"
    );
    const passwordEncrypted = settings.email.password
      ? encryptSecret(settings.email.password)
      : settings.email.clearPassword
        ? null
        : current.rows[0]?.password_encrypted ?? null;
    if (settings.email.provider === "smtp" && !passwordEncrypted) {
      throw new Error("Enter the shared sender password before selecting SMTP.");
    }
    await client.query(
      `INSERT INTO email_sender_settings
         (id, provider, sender_email, smtp_host, smtp_port, smtp_secure, smtp_username, password_encrypted, updated_by, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider, sender_email = EXCLUDED.sender_email,
         smtp_host = EXCLUDED.smtp_host, smtp_port = EXCLUDED.smtp_port,
         smtp_secure = EXCLUDED.smtp_secure, smtp_username = EXCLUDED.smtp_username,
         password_encrypted = EXCLUDED.password_encrypted, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [settings.email.provider, nullable(settings.email.senderEmail), nullable(settings.email.smtpHost), settings.email.smtpPort, settings.email.smtpSecure, nullable(settings.email.smtpUsername), passwordEncrypted, updatedBy]
    );
  });
}

function nullable(value: string) { return value.trim() || null; }
function boundedStringSetting(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : fallback;
}
function boundedNumberSetting(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
function enumSetting<T extends string>(value: unknown, fallback: T, allowed: readonly T[]) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}
