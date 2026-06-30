# COSTAATT Admissions Letter Automation

Internal Next.js application for importing Banner admissions exports, managing Word templates, generating applicant DOCX/PDF letters, and sending reviewed letters through Microsoft Graph.

## MVP Included

- Upload Banner Excel export and read the `Admissions` worksheet.
- Validate required Banner fields.
- Store imports, applicants, templates, field mappings, generated letters, and audit logs in PostgreSQL.
- Manage DOCX templates and detect placeholders from `«FIELD_NAME»`, `{{FIELD_NAME}}`, and Word content-control placeholder text.
- Map detected placeholders to Banner fields.
- Generate completed DOCX files while preserving the original DOCX package formatting.
- Convert generated DOCX files to PDF through LibreOffice/`soffice` when available.
- Preview/download generated DOCX/PDF files and download a bulk ZIP.
- Microsoft Entra bearer-token verification for production API access.
- Role-guarded API routes for Admin, Admissions Supervisor, Counselor, and Viewer access.
- Microsoft Graph `/me/sendMail` route that sends from the authenticated counselor mailbox.
- Duplicate-send prevention unless a resend reason is supplied.

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

For local development, keep `AUTH_MODE=development`. Production deployments should use `AUTH_MODE=entra` and set `ENTRA_TENANT_ID` and `ENTRA_CLIENT_ID`.

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

## Validation

Run the full local gate before pushing changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

GitHub Actions runs the same gate on pushes and pull requests.

## Notes

- Banner remains the source of truth. This app imports Banner data into a staging database only.
- Email sending is intentionally not automatic after import.
- Duplicate sends are blocked unless an authorized user supplies a resend reason.
- Raw storage paths are never returned from download APIs; files are fetched by generated-letter id.
- Production Graph email sending requires a delegated Microsoft Graph bearer token with `Mail.Send`.
