INSERT INTO users (email, display_name, role)
VALUES ('admin@costaatt.edu.tt', 'Admissions Admin', 'Admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO templates (name, template_type, original_file_name, storage_key, placeholders, is_active)
VALUES
  ('Acknowledgement', 'ACKNOWLEDGEMENT', 'ACKNOWLEDGEMENT_Template.docx', 'seed/ACKNOWLEDGEMENT_Template.docx', '[]'::jsonb, false),
  ('Programme Admission Letter', 'PA', 'Admission_Letter_Template_PA_AllFields.docx', 'seed/Admission_Letter_Template_PA_AllFields.docx', '[]'::jsonb, false),
  ('Conditional Fulfilled No Gate', 'CFULFILLED_NOGATE', 'CFULFILLED_NOGATE_Template.docx', 'seed/CFULFILLED_NOGATE_Template.docx', '[]'::jsonb, false),
  ('Conditional Offer CSEC Part Time', 'CONDOFFER_CSEC_PT', 'CONDOFFER_CSEC_PT_Template.docx', 'seed/CONDOFFER_CSEC_PT_Template.docx', '[]'::jsonb, false),
  ('Conditional Offer Nursing', 'CONDOFFER_NURSING', 'CONDOFFER_NURSING_Template.docx', 'seed/CONDOFFER_NURSING_Template.docx', '[]'::jsonb, false),
  ('Unconditional Offer', 'UOFFER', 'UOFFER_Template.docx', 'seed/UOFFER_Template.docx', '[]'::jsonb, false)
ON CONFLICT (template_type) DO NOTHING;
