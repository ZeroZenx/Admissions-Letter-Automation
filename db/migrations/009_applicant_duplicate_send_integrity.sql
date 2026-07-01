DO $$
DECLARE
  duplicate_original_sends integer;
BEGIN
  SELECT count(*)
    INTO duplicate_original_sends
    FROM (
      SELECT applicant_id
        FROM email_logs
       WHERE status IN ('pending', 'sent') AND resend_reason IS NULL
       GROUP BY applicant_id
      HAVING count(*) > 1
    ) duplicates;

  IF duplicate_original_sends > 0 THEN
    RAISE EXCEPTION 'email_logs contains % applicant(s) with duplicate original pending/sent emails. Add resend reasons or remove duplicate original sends before applying 009_applicant_duplicate_send_integrity.sql.', duplicate_original_sends;
  END IF;
END $$;

DROP INDEX IF EXISTS email_logs_one_original_send_idx;
DROP INDEX IF EXISTS email_logs_one_original_applicant_send_idx;

CREATE UNIQUE INDEX email_logs_one_original_applicant_send_idx
  ON email_logs(applicant_id)
  WHERE status IN ('pending', 'sent') AND resend_reason IS NULL;
