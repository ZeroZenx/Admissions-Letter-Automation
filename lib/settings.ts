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

const settingLimits = {
  defaultSubjectMaxLength: 160,
  defaultBodyMaxLength: 12000,
  stalePendingMinutesMin: 5,
  stalePendingMinutesMax: 1440
};

export async function getAppSettings() {
  const result = await query<{ key: keyof typeof settingKeys; value: unknown }>(
    "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
    [Object.keys(settingKeys)]
  );
  const values = new Map<string, unknown>();
  for (const row of result.rows) values.set(row.key, row.value);

  return {
    email: {
      defaultSubject: boundedStringSetting(
        values.get("email.defaultSubject"),
        defaultSettings.email.defaultSubject,
        settingLimits.defaultSubjectMaxLength
      ),
      defaultBody: boundedStringSetting(
        values.get("email.defaultBody"),
        defaultSettings.email.defaultBody,
        settingLimits.defaultBodyMaxLength
      ),
      stalePendingMinutes: boundedNumberSetting(
        values.get("email.stalePendingMinutes"),
        defaultSettings.email.stalePendingMinutes,
        settingLimits.stalePendingMinutesMin,
        settingLimits.stalePendingMinutesMax
      )
    },
    pdf: {
      converter: enumSetting(values.get("pdf.converter"), defaultSettings.pdf.converter, ["libreoffice"])
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
