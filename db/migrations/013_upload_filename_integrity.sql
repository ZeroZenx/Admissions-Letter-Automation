DO $$
DECLARE
  invalid_imports integer;
  invalid_templates integer;
BEGIN
  SELECT count(*)
    INTO invalid_imports
    FROM imports
   WHERE uploaded_file_name !~ '^[^[:cntrl:]/\\]{1,255}$';

  IF invalid_imports > 0 THEN
    RAISE EXCEPTION 'imports contains % invalid uploaded_file_name value(s). File names must be 255 characters or fewer and cannot contain path separators or control characters before applying 013_upload_filename_integrity.sql.', invalid_imports;
  END IF;

  SELECT count(*)
    INTO invalid_templates
    FROM templates
   WHERE original_file_name !~ '^[^[:cntrl:]/\\]{1,255}$';

  IF invalid_templates > 0 THEN
    RAISE EXCEPTION 'templates contains % invalid original_file_name value(s). File names must be 255 characters or fewer and cannot contain path separators or control characters before applying 013_upload_filename_integrity.sql.', invalid_templates;
  END IF;
END $$;

ALTER TABLE imports
  DROP CONSTRAINT IF EXISTS imports_uploaded_file_name_safe_chk;

ALTER TABLE imports
  ADD CONSTRAINT imports_uploaded_file_name_safe_chk
  CHECK (uploaded_file_name ~ '^[^[:cntrl:]/\\]{1,255}$');

ALTER TABLE templates
  DROP CONSTRAINT IF EXISTS templates_original_file_name_safe_chk;

ALTER TABLE templates
  ADD CONSTRAINT templates_original_file_name_safe_chk
  CHECK (original_file_name ~ '^[^[:cntrl:]/\\]{1,255}$');
