DO $$
DECLARE
  invalid_templates integer;
  invalid_applicants integer;
BEGIN
  SELECT count(*)
    INTO invalid_templates
    FROM templates
   WHERE template_type !~ '^[A-Z0-9_-]{1,80}$';

  IF invalid_templates > 0 THEN
    RAISE EXCEPTION 'templates contains % invalid template_type value(s). Normalize to uppercase letters, numbers, underscores, or hyphens before applying 007_template_type_integrity.sql.', invalid_templates;
  END IF;

  SELECT count(*)
    INTO invalid_applicants
    FROM applicants
   WHERE template_type !~ '^[A-Z0-9_-]{1,80}$';

  IF invalid_applicants > 0 THEN
    RAISE EXCEPTION 'applicants contains % invalid template_type value(s). Normalize to uppercase letters, numbers, underscores, or hyphens before applying 007_template_type_integrity.sql.', invalid_applicants;
  END IF;
END $$;

ALTER TABLE templates
  DROP CONSTRAINT IF EXISTS templates_template_type_code_chk;

ALTER TABLE templates
  ADD CONSTRAINT templates_template_type_code_chk
  CHECK (template_type ~ '^[A-Z0-9_-]{1,80}$');

ALTER TABLE applicants
  DROP CONSTRAINT IF EXISTS applicants_template_type_code_chk;

ALTER TABLE applicants
  ADD CONSTRAINT applicants_template_type_code_chk
  CHECK (template_type ~ '^[A-Z0-9_-]{1,80}$');
