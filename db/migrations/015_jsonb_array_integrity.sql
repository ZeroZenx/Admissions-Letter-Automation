UPDATE imports
   SET errors = '[]'::jsonb
 WHERE jsonb_typeof(errors) <> 'array';

UPDATE applicants
   SET validation_errors = '[]'::jsonb
 WHERE jsonb_typeof(validation_errors) <> 'array';

UPDATE templates
   SET placeholders = '[]'::jsonb
 WHERE jsonb_typeof(placeholders) <> 'array';

ALTER TABLE imports
  DROP CONSTRAINT IF EXISTS imports_errors_array_chk;

ALTER TABLE imports
  ADD CONSTRAINT imports_errors_array_chk
  CHECK (jsonb_typeof(errors) = 'array');

ALTER TABLE applicants
  DROP CONSTRAINT IF EXISTS applicants_validation_errors_array_chk;

ALTER TABLE applicants
  ADD CONSTRAINT applicants_validation_errors_array_chk
  CHECK (jsonb_typeof(validation_errors) = 'array');

ALTER TABLE templates
  DROP CONSTRAINT IF EXISTS templates_placeholders_array_chk;

ALTER TABLE templates
  ADD CONSTRAINT templates_placeholders_array_chk
  CHECK (jsonb_typeof(placeholders) = 'array');
