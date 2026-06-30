# COSTAATT Admissions Letter Automation

Internal Next.js application for importing Banner admissions exports, managing Word templates, generating applicant DOCX/PDF letters, and preparing the later Microsoft Graph email workflow.

## MVP Included

- Upload Banner Excel export and read the `Admissions` worksheet.
- Validate required Banner fields.
- Store imports, applicants, templates, field mappings, generated letters, and audit logs in PostgreSQL.
- Manage DOCX templates and detect placeholders from `«FIELD_NAME»`, `{{FIELD_NAME}}`, and Word content-control placeholder text.
- Map detected placeholders to Banner fields.
- Generate completed DOCX files while preserving the original DOCX package formatting.
- Convert generated DOCX files to PDF through LibreOffice/`soffice` when available.
- Preview/download generated DOCX/PDF files and download a bulk ZIP.
- Stubbed Graph email API route for milestone 2 integration.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local PostgreSQL database:

```bash
createdb costaatt_admissions
```

3. Copy environment variables:

```bash
cp .env.example .env.local
```

4. Run migrations and seed data:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql
psql "$DATABASE_URL" -f db/seeds/001_template_types.sql
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- Banner remains the source of truth. This app imports Banner data into a staging database only.
- Email sending is intentionally not automatic after import.
- Duplicate sends are blocked in the planned Graph email implementation unless an authorized resend reason is supplied.
- Raw storage paths are never returned from download APIs; files are fetched by generated-letter id.
