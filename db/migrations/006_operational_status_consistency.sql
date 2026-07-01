DO $$
DECLARE
  invalid_imports integer;
  invalid_generated_letters integer;
  invalid_email_logs integer;
BEGIN
  SELECT count(*)
    INTO invalid_imports
    FROM imports
   WHERE total_rows <> valid_rows + invalid_rows;

  IF invalid_imports > 0 THEN
    RAISE EXCEPTION 'imports contains % row count mismatch(es). Fix total_rows, valid_rows, and invalid_rows before applying 006_operational_status_consistency.sql.', invalid_imports;
  END IF;

  SELECT count(*)
    INTO invalid_generated_letters
    FROM generated_letters
   WHERE (status = 'pdf_generated' AND pdf_storage_key IS NULL)
      OR (status = 'failed' AND NULLIF(trim(error_message), '') IS NULL);

  IF invalid_generated_letters > 0 THEN
    RAISE EXCEPTION 'generated_letters contains % status consistency violation(s). Fix pdf_storage_key or error_message before applying 006_operational_status_consistency.sql.', invalid_generated_letters;
  END IF;

  SELECT count(*)
    INTO invalid_email_logs
    FROM email_logs
   WHERE (status = 'sent' AND sent_at IS NULL)
      OR (status = 'failed' AND NULLIF(trim(error_message), '') IS NULL)
      OR (status = 'pending' AND sent_at IS NOT NULL);

  IF invalid_email_logs > 0 THEN
    RAISE EXCEPTION 'email_logs contains % status consistency violation(s). Fix sent_at or error_message before applying 006_operational_status_consistency.sql.', invalid_email_logs;
  END IF;
END $$;

ALTER TABLE imports
  DROP CONSTRAINT IF EXISTS imports_counts_consistent_chk;

ALTER TABLE imports
  ADD CONSTRAINT imports_counts_consistent_chk
  CHECK (total_rows = valid_rows + invalid_rows);

ALTER TABLE generated_letters
  DROP CONSTRAINT IF EXISTS generated_letters_status_consistency_chk;

ALTER TABLE generated_letters
  ADD CONSTRAINT generated_letters_status_consistency_chk
  CHECK (
    (status <> 'pdf_generated' OR pdf_storage_key IS NOT NULL)
    AND (status <> 'failed' OR NULLIF(trim(error_message), '') IS NOT NULL)
  );

ALTER TABLE email_logs
  DROP CONSTRAINT IF EXISTS email_logs_status_consistency_chk;

ALTER TABLE email_logs
  ADD CONSTRAINT email_logs_status_consistency_chk
  CHECK (
    (status <> 'sent' OR sent_at IS NOT NULL)
    AND (status <> 'failed' OR NULLIF(trim(error_message), '') IS NOT NULL)
    AND (status <> 'pending' OR sent_at IS NULL)
  );
