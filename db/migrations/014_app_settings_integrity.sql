INSERT INTO app_settings (key, value)
VALUES ('email.stalePendingMinutes', '"30"'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  invalid_settings integer;
BEGIN
  SELECT count(*)
    INTO invalid_settings
    FROM app_settings
   WHERE key NOT IN ('email.defaultSubject', 'email.defaultBody', 'email.stalePendingMinutes', 'pdf.converter')
      OR jsonb_typeof(value) <> 'string'
      OR CASE key
           WHEN 'email.defaultSubject' THEN char_length(value #>> '{}') NOT BETWEEN 1 AND 160
           WHEN 'email.defaultBody' THEN char_length(value #>> '{}') NOT BETWEEN 1 AND 12000
           WHEN 'email.stalePendingMinutes' THEN NOT ((value #>> '{}') ~ '^[0-9]+$' AND (value #>> '{}')::int BETWEEN 5 AND 1440)
           WHEN 'pdf.converter' THEN (value #>> '{}') <> 'libreoffice'
           ELSE true
         END;

  IF invalid_settings > 0 THEN
    RAISE EXCEPTION 'app_settings contains % invalid value(s). Fix setting keys, value types, email lengths, stale timeout range, or converter before applying 014_app_settings_integrity.sql.', invalid_settings;
  END IF;
END $$;

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_known_key_value_chk;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_known_key_value_chk
  CHECK (
    key IN ('email.defaultSubject', 'email.defaultBody', 'email.stalePendingMinutes', 'pdf.converter')
    AND jsonb_typeof(value) = 'string'
    AND CASE key
          WHEN 'email.defaultSubject' THEN char_length(value #>> '{}') BETWEEN 1 AND 160
          WHEN 'email.defaultBody' THEN char_length(value #>> '{}') BETWEEN 1 AND 12000
          WHEN 'email.stalePendingMinutes' THEN (value #>> '{}') ~ '^[0-9]+$' AND (value #>> '{}')::int BETWEEN 5 AND 1440
          WHEN 'pdf.converter' THEN (value #>> '{}') = 'libreoffice'
          ELSE false
        END
  );
