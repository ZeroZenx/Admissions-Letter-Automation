CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_oid text UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('Admin', 'Admissions Supervisor', 'Counselor', 'Viewer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_file_name text NOT NULL,
  worksheet_name text NOT NULL DEFAULT 'Admissions',
  imported_by uuid REFERENCES users(id),
  imported_at timestamptz NOT NULL DEFAULT now(),
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'review',
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  term text,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  address_code text,
  address1 text,
  address2 text,
  address3 text,
  city text,
  country text,
  nation text,
  campus text NOT NULL,
  college text,
  degree text,
  major text,
  status text,
  program text NOT NULL,
  date_generated text,
  birth_date text,
  id_passport text,
  residency_code text,
  residency_description text,
  application_source text,
  spriden_user text,
  email text NOT NULL,
  email_code text,
  phone1 text,
  phone2 text,
  admission_status text NOT NULL,
  email_status text NOT NULL DEFAULT 'Not Sent',
  sent_date timestamptz,
  word_file_name text,
  pdf_file_name text,
  error_message text,
  processed_by_flow boolean NOT NULL DEFAULT false,
  template_type text NOT NULL,
  counselor_user_id uuid REFERENCES users(id),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(import_id, student_id, template_type)
);

CREATE INDEX IF NOT EXISTS applicants_filters_idx
  ON applicants(template_type, admission_status, email_status, campus, program);

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_type text NOT NULL UNIQUE,
  original_file_name text NOT NULL,
  storage_key text NOT NULL,
  placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  placeholder text NOT NULL,
  banner_field text NOT NULL,
  fallback_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, placeholder)
);

CREATE TABLE IF NOT EXISTS generated_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES templates(id),
  docx_storage_key text NOT NULL,
  pdf_storage_key text,
  status text NOT NULL DEFAULT 'docx_generated',
  generated_by uuid REFERENCES users(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  generated_letter_id uuid REFERENCES generated_letters(id),
  sent_by uuid REFERENCES users(id),
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  sent_at timestamptz,
  resend_reason text,
  graph_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  applicant_student_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
