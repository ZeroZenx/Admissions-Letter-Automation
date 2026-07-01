DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*)
    INTO invalid_count
    FROM field_mappings
   WHERE banner_field NOT IN (
      'StudentID',
      'Term',
      'FirstName',
      'MiddleName',
      'LastName',
      'AddressCode',
      'Address1',
      'Address2',
      'Address3',
      'City',
      'Country',
      'Nation',
      'Campus',
      'College',
      'Degree',
      'Major',
      'Status',
      'Program',
      'DateGenerated',
      'BirthDate',
      'IDPassport',
      'ResidencyCode',
      'ResidencyDescription',
      'ApplicationSource',
      'SpridenUser',
      'Email',
      'EmailCode',
      'Phone1',
      'Phone2',
      'AdmissionStatus',
      'EmailStatus',
      'SentDate',
      'WordFileName',
      'PDFFileName',
      'ErrorMessage',
      'ProcessedByFlow',
      'TemplateType',
      'FullName',
      'Today'
    );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'field_mappings contains % invalid banner_field value(s). Fix or remove those mappings before applying 005_field_mapping_integrity.sql.', invalid_count;
  END IF;
END $$;

ALTER TABLE field_mappings
  DROP CONSTRAINT IF EXISTS field_mappings_banner_field_chk;

ALTER TABLE field_mappings
  ADD CONSTRAINT field_mappings_banner_field_chk
  CHECK (banner_field IN (
    'StudentID',
    'Term',
    'FirstName',
    'MiddleName',
    'LastName',
    'AddressCode',
    'Address1',
    'Address2',
    'Address3',
    'City',
    'Country',
    'Nation',
    'Campus',
    'College',
    'Degree',
    'Major',
    'Status',
    'Program',
    'DateGenerated',
    'BirthDate',
    'IDPassport',
    'ResidencyCode',
    'ResidencyDescription',
    'ApplicationSource',
    'SpridenUser',
    'Email',
    'EmailCode',
    'Phone1',
    'Phone2',
    'AdmissionStatus',
    'EmailStatus',
    'SentDate',
    'WordFileName',
    'PDFFileName',
    'ErrorMessage',
    'ProcessedByFlow',
    'TemplateType',
    'FullName',
    'Today'
  ));
