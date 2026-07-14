DO $$
DECLARE
  invalid_templates integer;
BEGIN
  SELECT count(*)
    INTO invalid_templates
    FROM templates
   WHERE name !~ '^[^[:cntrl:]]{1,160}$';

  IF invalid_templates > 0 THEN
    RAISE EXCEPTION 'templates contains % invalid name value(s). Names must be 160 characters or fewer and cannot contain control characters before applying 011_template_name_integrity.sql.', invalid_templates;
  END IF;
END $$;

ALTER TABLE templates
  DROP CONSTRAINT IF EXISTS templates_name_safe_chk;

ALTER TABLE templates
  ADD CONSTRAINT templates_name_safe_chk
  CHECK (name ~ '^[^[:cntrl:]]{1,160}$');
