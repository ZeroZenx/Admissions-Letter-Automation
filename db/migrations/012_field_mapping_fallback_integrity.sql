DO $$
DECLARE
  invalid_mappings integer;
BEGIN
  SELECT count(*)
    INTO invalid_mappings
    FROM field_mappings
   WHERE fallback_value IS NOT NULL
     AND char_length(fallback_value) > 2000;

  IF invalid_mappings > 0 THEN
    RAISE EXCEPTION 'field_mappings contains % fallback_value value(s) longer than 2000 characters. Shorten them before applying 012_field_mapping_fallback_integrity.sql.', invalid_mappings;
  END IF;
END $$;

ALTER TABLE field_mappings
  DROP CONSTRAINT IF EXISTS field_mappings_fallback_value_length_chk;

ALTER TABLE field_mappings
  ADD CONSTRAINT field_mappings_fallback_value_length_chk
  CHECK (fallback_value IS NULL OR char_length(fallback_value) <= 2000);
