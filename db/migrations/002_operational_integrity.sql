DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imports_counts_nonnegative_chk') THEN
    ALTER TABLE imports
      ADD CONSTRAINT imports_counts_nonnegative_chk
      CHECK (total_rows >= 0 AND valid_rows >= 0 AND invalid_rows >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imports_status_chk') THEN
    ALTER TABLE imports
      ADD CONSTRAINT imports_status_chk
      CHECK (status IN ('review', 'imported', 'failed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_email_status_chk') THEN
    ALTER TABLE applicants
      ADD CONSTRAINT applicants_email_status_chk
      CHECK (email_status IN ('Not Sent', 'Queued', 'Sending', 'Sent', 'Failed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_email_format_chk') THEN
    ALTER TABLE applicants
      ADD CONSTRAINT applicants_email_format_chk
      CHECK (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'generated_letters_status_chk') THEN
    ALTER TABLE generated_letters
      ADD CONSTRAINT generated_letters_status_chk
      CHECK (status IN ('docx_generated', 'pdf_generated', 'failed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_status_chk') THEN
    ALTER TABLE email_logs
      ADD CONSTRAINT email_logs_status_chk
      CHECK (status IN ('pending', 'sent', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS imports_imported_at_idx ON imports(imported_at DESC);
CREATE INDEX IF NOT EXISTS generated_letters_applicant_idx ON generated_letters(applicant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_generated_letter_idx ON email_logs(generated_letter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id, created_at DESC);

DROP INDEX IF EXISTS email_logs_one_original_send_idx;

CREATE UNIQUE INDEX email_logs_one_original_send_idx
  ON email_logs(generated_letter_id)
  WHERE status IN ('pending', 'sent') AND resend_reason IS NULL;
