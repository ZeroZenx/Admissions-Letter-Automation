# COSTAATT Admissions Letter Automation

Internal Next.js application for importing Banner admissions exports, managing Word templates, generating applicant DOCX/PDF letters, and sending admissions letters through Microsoft Graph or a configured shared SMTP mailbox.

## MVP Included

- Upload Banner `.xlsx` Excel export and read the `Admissions` worksheet.
- Validate required Banner fields.
- Show Banner operational fields including `EmailStatus`, `SentDate`, `WordFileName`, `PDFFileName`, `ErrorMessage`, `ProcessedByFlow`, and `TemplateType`.
- Review import history with uploaded filename, worksheet, status, row counts, uploader, and row-level validation errors.
- Store imports, applicants, templates, field mappings, generated letters, and audit logs in PostgreSQL.
- Manage DOCX templates and detect placeholders from `«FIELD_NAME»`, `{{FIELD_NAME}}`, and Word content-control placeholder text.
- Template placeholders that normalize to Banner or derived letter fields are auto-mapped on upload.
- The six supplied COSTAATT production templates are bundled, mapped, activated, and copied to persistent storage by `npm run db:setup`.
- Activate or deactivate managed templates without deleting historical generated-letter references.
- Map detected placeholders to Banner fields.
- Generate completed DOCX files while preserving the original DOCX package formatting.
- Convert generated DOCX files to PDF through LibreOffice/`soffice` when available.
- Optionally generate DOCX/PDF files automatically for valid rows immediately after upload.
- One-click upload prepares all valid rows: import, select the stored template, generate DOCX/PDF files, update operational fields, and preselect the letters in Email Queue. Upload never sends email automatically.
- Upload automation preflights required `TemplateType` templates and exact placeholder mappings before generating letters.
- One-click upload blocks oversized generation batches before calling automation.
- Manual selected-letter generation uses the same applicant batch limit before calling automation.
- Preview/download generated DOCX/PDF files and download a bulk ZIP.
- Audit individual and bulk generated-letter downloads by generated-letter ID.
- Audit batch automation summaries with requested, generated, emailed, and failed counts.
- Microsoft Entra bearer-token verification for production API access.
- Role-guarded API routes for Admin, Admissions Supervisor, Counselor, and Viewer access.
- Microsoft Graph `/me/sendMail` route that sends from the authenticated counselor mailbox.
- Admin-managed shared SMTP sender option with AES-256-GCM encrypted password storage and a test email sent back to the configured mailbox.
- Archive, restore, and Admin-only permanent clearing of completed import batches and their stored files.
- Recent email activity view with recipient, status, resend reason, sent time, and errors.
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

For local development, keep `AUTH_MODE=development`. Production deployments should use `AUTH_MODE=entra` and set `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_API_AUDIENCE`, and the matching `NEXT_PUBLIC_ENTRA_*` values.

Generate `APP_ENCRYPTION_KEY` once on the deployment machine before configuring a shared SMTP password. Keep the key stable and out of Git; losing or changing it makes the stored password unreadable.

Production builds reject development authentication unless `ALLOW_INSECURE_DEVELOPMENT_AUTH=true` is deliberately set for an isolated test environment. Never use that override on a staff-accessible deployment.

4. Run migrations and seed data:

```bash
npm run db:setup
```

This also installs the bundled Word templates and their field mappings. Re-running setup refreshes managed bundled copies but preserves templates uploaded by an administrator.

5. Start the app:

```bash
npm run dev -- -p 6001
```

Open [http://localhost:6001](http://localhost:6001).

## Docker Setup

For a production-like local stack with PostgreSQL:

```bash
docker compose up --build
```

In another terminal, apply the database schema:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/costaatt_admissions npm run db:setup
npm run smoke
```

The Compose stack exposes the app at [http://localhost:6001](http://localhost:6001).

## Windows VM Setup

For installation on a Windows VM, see [docs/windows-vm-deployment.md](docs/windows-vm-deployment.md). It covers GitHub clone, Node.js, PostgreSQL, LibreOffice, `.env.local`, Windows paths, port `6001`, service setup, and Docker Desktop as an optional path.

## Validation

Run the full local gate before pushing changes:

```bash
npm run validate
```

GitHub Actions runs the same gate on pushes and pull requests.

## Health Check

After deployment, verify runtime dependencies:

```bash
curl /api/health
```

The health check reports server authentication, selected email-sender readiness, browser Entra/Graph scope readiness, database connectivity and schema readiness, storage configuration, and PDF conversion configuration without exposing secrets.

## Microsoft Entra Setup

For production:

1. Register an app in Microsoft Entra ID.
2. Add the deployed site URL and `/login` URL as single-page application redirect URIs.
3. Expose an API scope such as `api://<client-id>/access_as_user`.
4. Assign app roles named `Admin`, `Admissions Supervisor`, `Counselor`, and `Viewer`.
5. Grant delegated Microsoft Graph permissions for `User.Read` and `Mail.Send` when using the signed-in counselor sender. `Mail.Send` is not required for the shared SMTP option.
6. Set `AUTH_MODE=entra`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_API_AUDIENCE`, `NEXT_PUBLIC_ENTRA_TENANT_ID`, `NEXT_PUBLIC_ENTRA_CLIENT_ID`, `NEXT_PUBLIC_ENTRA_API_SCOPE`, and `NEXT_PUBLIC_GRAPH_SCOPES`.

When Graph sending is selected, the browser acquires one access token for this app's API and a separate delegated Graph token for `/me/sendMail`. For shared SMTP, an Admin enters the sender address, server, username, and password in Settings; the password is encrypted before it is stored and is never returned to the browser.

## Production Checklist

See [docs/production-readiness.md](docs/production-readiness.md) for the deployment checklist, Entra configuration, document validation steps, release gate, and rollback notes.

## Notes

- Banner remains the source of truth. This app imports Banner data into a staging database only.
- A fresh deployment includes active mappings for `ACKNOWLEDGEMENT`, `DFTEMPLATE`, `CFULFILLED_NOGATE`, `CONDOFFER_CSEC_PT`, `CONDOFFER_NURSING`, and `UOFFER`.
- Admissions staff can review source-truth email status, sent date, generated file names, error message, processing flag, and selected template per applicant.
- Generation failures are written back to applicant error fields and generated-letter failure status.
- Email sending runs only as a deliberate multi-select batch from the Email Queue. Uploaded or manually generated letters are carried into the Email Queue selection but are never sent automatically.
- Duplicate sends are blocked unless an authorized user supplies a resend reason.
- Pending email sends older than the configured stale-send timeout are marked failed before staff can retry.
- Email send history is visible in the Email Queue without exposing stored email bodies.
- Raw storage paths are never returned from download APIs; files are fetched by generated-letter id.
- ZIP downloads reject missing generated-letter IDs instead of returning partial archives.
- Production Graph email sending requires a delegated Microsoft Graph bearer token with `Mail.Send`; shared SMTP requires a valid `APP_ENCRYPTION_KEY` and mailbox credentials.
- Archived import batches are hidden from active records, generated letters, email history, exports, and processing until restored. Permanent clear is Admin-only and requires prior archival.
- Upload, email attachment, bulk generation, and ZIP download size limits are enforced server-side.
- Dashboard list APIs enforce bounded `limit` and `offset` pagination.
- Applicant status exports are row-limited server-side and require filters when the match set is too large.
- Security headers are applied by `middleware.ts`.
- Database integrity constraints and indexes are applied through `npm run db:setup`.
- Query-performance indexes cover import review, automation preflight, generated letters, and email activity.
- Counselor ownership is enforced when `applicants.counselor_user_id` is configured.
- Template activation changes are restricted to Admin and Admissions Supervisor roles and audited.
- Default email content, stale pending send timeout, and PDF converter mode are persisted in `app_settings`.
