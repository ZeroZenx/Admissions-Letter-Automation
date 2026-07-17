ALTER TABLE imports
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS storage_key text;

CREATE INDEX IF NOT EXISTS imports_active_imported_at_idx
  ON imports(imported_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS email_sender_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider text NOT NULL DEFAULT 'graph' CHECK (provider IN ('graph', 'smtp')),
  sender_email text,
  smtp_host text,
  smtp_port integer NOT NULL DEFAULT 587 CHECK (smtp_port BETWEEN 1 AND 65535),
  smtp_secure boolean NOT NULL DEFAULT false,
  smtp_username text,
  password_encrypted text,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    provider = 'graph'
    OR (
      sender_email IS NOT NULL AND sender_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
      AND smtp_host IS NOT NULL AND char_length(smtp_host) BETWEEN 1 AND 253
      AND smtp_username IS NOT NULL AND char_length(smtp_username) BETWEEN 1 AND 320
    )
  )
);

INSERT INTO email_sender_settings (id, provider)
VALUES (1, 'graph')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS sender_address text;

ALTER TABLE email_logs
  DROP CONSTRAINT IF EXISTS email_logs_provider_chk;

ALTER TABLE email_logs
  ADD CONSTRAINT email_logs_provider_chk
  CHECK (provider IS NULL OR provider IN ('graph', 'smtp'));

ALTER TABLE imports
  DROP CONSTRAINT IF EXISTS imports_storage_key_chk;

ALTER TABLE imports
  ADD CONSTRAINT imports_storage_key_chk
  CHECK (storage_key IS NULL OR (char_length(storage_key) <= 1000 AND is_safe_storage_key(storage_key)));
