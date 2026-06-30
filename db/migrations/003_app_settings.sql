CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES
  ('email.defaultSubject', '"Your COSTAATT admissions letter"'::jsonb),
  ('email.defaultBody', '"Dear applicant,<br><br>Please find your COSTAATT admissions letter attached."'::jsonb),
  ('pdf.converter', '"libreoffice"'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS app_settings_updated_at_idx ON app_settings(updated_at DESC);
