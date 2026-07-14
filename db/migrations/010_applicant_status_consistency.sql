DO $$
DECLARE
  invalid_applicants integer;
BEGIN
  SELECT count(*)
    INTO invalid_applicants
    FROM applicants
   WHERE (email_status = 'Sent' AND sent_date IS NULL)
      OR (email_status = 'Failed' AND NULLIF(trim(error_message), '') IS NULL);

  IF invalid_applicants > 0 THEN
    RAISE EXCEPTION 'applicants contains % email status consistency violation(s). Fix sent_date or error_message before applying 010_applicant_status_consistency.sql.', invalid_applicants;
  END IF;
END $$;

ALTER TABLE applicants
  DROP CONSTRAINT IF EXISTS applicants_email_status_consistency_chk;

ALTER TABLE applicants
  ADD CONSTRAINT applicants_email_status_consistency_chk
  CHECK (
    (email_status <> 'Sent' OR sent_date IS NOT NULL)
    AND (email_status <> 'Failed' OR NULLIF(trim(error_message), '') IS NOT NULL)
  );
