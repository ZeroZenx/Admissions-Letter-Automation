CREATE INDEX IF NOT EXISTS applicants_import_valid_idx
  ON applicants(import_id, created_at)
  WHERE validation_errors = '[]'::jsonb;

CREATE INDEX IF NOT EXISTS applicants_created_at_idx
  ON applicants(created_at DESC);

CREATE INDEX IF NOT EXISTS applicants_counselor_created_idx
  ON applicants(counselor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS generated_letters_generated_at_idx
  ON generated_letters(generated_at DESC);

CREATE INDEX IF NOT EXISTS email_logs_created_at_idx
  ON email_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS email_logs_applicant_created_idx
  ON email_logs(applicant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS field_mappings_template_idx
  ON field_mappings(template_id);
