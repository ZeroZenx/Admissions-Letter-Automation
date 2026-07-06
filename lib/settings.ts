import { query } from "@/lib/db";

export type AppSettings = {
  email: {
    defaultSubject: string;
    defaultBody: string;
    stalePendingMinutes: number;
  };
  pdf: {
    converter: string;
  };
};

export const defaultSettings: AppSettings = {
  email: {
    defaultSubject: "Your COSTAATT admissions letter",
    defaultBody: "Dear applicant,<br><br>Please find your COSTAATT admissions letter attached.",
    stalePendingMinutes: 30
  },
  pdf: {
    converter: "libreoffice"
  }
};

const settingKeys = {
  "email.defaultSubject": defaultSettings.email.defaultSubject,
  "email.defaultBody": defaultSettings.email.defaultBody,
  "email.stalePendingMinutes": defaultSettings.email.stalePendingMinutes,
  "pdf.converter": defaultSettings.pdf.converter
} as const;

export async function getAppSettings() {
  const result = await query<{ key: keyof typeof settingKeys; value: unknown }>(
    "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
    [Object.keys(settingKeys)]
  );
  const values = new Map<string, unknown>();
  for (const row of result.rows) values.set(row.key, row.value);

  return {
    email: {
      defaultSubject: stringifySetting(values.get("email.defaultSubject"), defaultSettings.email.defaultSubject),
      defaultBody: stringifySetting(values.get("email.defaultBody"), defaultSettings.email.defaultBody),
      stalePendingMinutes: numberSetting(values.get("email.stalePendingMinutes"), defaultSettings.email.stalePendingMinutes)
    },
    pdf: {
      converter: stringifySetting(values.get("pdf.converter"), defaultSettings.pdf.converter)
    }
  } satisfies AppSettings;
}

export async function upsertAppSettings(settings: AppSettings, updatedBy: string) {
  const rows: Array<[string, string]> = [
    ["email.defaultSubject", settings.email.defaultSubject],
    ["email.defaultBody", settings.email.defaultBody],
    ["email.stalePendingMinutes", String(settings.email.stalePendingMinutes)],
    ["pdf.converter", settings.pdf.converter]
  ];

  for (const [key, value] of rows) {
    await query(
      `INSERT INTO app_settings (key, value, updated_by, updated_at)
       VALUES ($1, to_jsonb($2::text), $3, now())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [key, value, updatedBy]
    );
  }
}

function stringifySetting(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberSetting(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}
