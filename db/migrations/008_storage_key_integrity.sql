CREATE OR REPLACE FUNCTION is_safe_storage_key(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT value IS NOT NULL
     AND length(value) > 0
     AND value !~ '(^|/)\.\.(/|$)'
     AND value !~ '^/'
     AND value !~ '^[A-Za-z]:'
     AND position(E'\\' in value) = 0
$$;

DO $$
DECLARE
  invalid_templates integer;
  invalid_generated_letters integer;
BEGIN
  SELECT count(*)
    INTO invalid_templates
    FROM templates
   WHERE NOT is_safe_storage_key(storage_key);

  IF invalid_templates > 0 THEN
    RAISE EXCEPTION 'templates contains % unsafe storage_key value(s). Remove absolute paths, traversal segments, and backslashes before applying 008_storage_key_integrity.sql.', invalid_templates;
  END IF;

  SELECT count(*)
    INTO invalid_generated_letters
    FROM generated_letters
   WHERE NOT is_safe_storage_key(docx_storage_key)
      OR (pdf_storage_key IS NOT NULL AND NOT is_safe_storage_key(pdf_storage_key));

  IF invalid_generated_letters > 0 THEN
    RAISE EXCEPTION 'generated_letters contains % unsafe storage key value(s). Remove absolute paths, traversal segments, and backslashes before applying 008_storage_key_integrity.sql.', invalid_generated_letters;
  END IF;
END $$;

ALTER TABLE templates
  DROP CONSTRAINT IF EXISTS templates_storage_key_safe_chk;

ALTER TABLE templates
  ADD CONSTRAINT templates_storage_key_safe_chk
  CHECK (is_safe_storage_key(storage_key));

ALTER TABLE generated_letters
  DROP CONSTRAINT IF EXISTS generated_letters_storage_keys_safe_chk;

ALTER TABLE generated_letters
  ADD CONSTRAINT generated_letters_storage_keys_safe_chk
  CHECK (
    is_safe_storage_key(docx_storage_key)
    AND (pdf_storage_key IS NULL OR is_safe_storage_key(pdf_storage_key))
  );
