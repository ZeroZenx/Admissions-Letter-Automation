ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text;

UPDATE templates
   SET email_subject = COALESCE(
         NULLIF(btrim(email_subject), ''),
         (SELECT value #>> '{}' FROM app_settings WHERE key = 'email.defaultSubject'),
         'Your COSTAATT admissions letter'
       ),
       email_body = COALESCE(
         NULLIF(btrim(email_body), ''),
         (SELECT value #>> '{}' FROM app_settings WHERE key = 'email.defaultBody'),
         'Dear applicant,<br><br>Please find your COSTAATT admissions letter attached.'
       );

ALTER TABLE templates
  ALTER COLUMN email_subject SET DEFAULT 'Your COSTAATT admissions letter',
  ALTER COLUMN email_subject SET NOT NULL,
  ALTER COLUMN email_body SET DEFAULT 'Dear applicant,<br><br>Please find your COSTAATT admissions letter attached.',
  ALTER COLUMN email_body SET NOT NULL;

ALTER TABLE templates
  DROP CONSTRAINT IF EXISTS templates_email_subject_length_chk,
  DROP CONSTRAINT IF EXISTS templates_email_body_length_chk,
  DROP CONSTRAINT IF EXISTS templates_email_subject_control_chk;

ALTER TABLE templates
  ADD CONSTRAINT templates_email_subject_length_chk
    CHECK (char_length(btrim(email_subject)) BETWEEN 1 AND 160),
  ADD CONSTRAINT templates_email_body_length_chk
    CHECK (char_length(btrim(email_body)) BETWEEN 1 AND 12000),
  ADD CONSTRAINT templates_email_subject_control_chk
    CHECK (email_subject !~ '[[:cntrl:]]');
