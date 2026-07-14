# Production Readiness Checklist

Use this checklist before enabling COSTAATT staff access.

## Infrastructure

- PostgreSQL 16 or compatible managed PostgreSQL is provisioned.
- `DATABASE_URL` points to the production database over TLS where supported.
- Persistent storage is configured for generated DOCX/PDF files.
- LibreOffice is installed and `SOFFICE_PATH` points to the headless executable, or a replacement converter is implemented behind `lib/pdf-converter.ts`.
- Windows VM deployments follow [windows-vm-deployment.md](windows-vm-deployment.md), including Windows storage paths, LibreOffice `soffice.exe`, and service account permissions.
- `/api/health` returns `ok: true`, confirms database access and database schema readiness, confirms generated-file storage is writable, and confirms the PDF converter executable responds.
- `/api/health` includes a passing `clientAuth` check with `Mail.Send` in the reported Graph scopes.
- Container deployments run the application as a non-root user and report healthy through the `/api/health` Docker healthcheck.

## Microsoft Entra

- App registration exists in COSTAATT tenant.
- Single-page application redirect URIs include both the production origin and the production `/login` URL.
- API scope is exposed, for example `api://<client-id>/access_as_user`.
- App roles exist: `Admin`, `Admissions Supervisor`, `Counselor`, `Viewer`.
- Users or groups are assigned to roles.
- Delegated Microsoft Graph permissions include `User.Read` and `Mail.Send`.
- Admin consent is granted.

## Application Configuration

- `AUTH_MODE=entra`
- `ENTRA_TENANT_ID` is set.
- `ENTRA_CLIENT_ID` is set.
- `ENTRA_API_AUDIENCE` matches the exposed API audience.
- `NEXT_PUBLIC_AUTH_MODE=entra`
- `NEXT_PUBLIC_ENTRA_TENANT_ID` is set.
- `NEXT_PUBLIC_ENTRA_CLIENT_ID` is set.
- `NEXT_PUBLIC_ENTRA_REDIRECT_URI` is set and matches the deployed origin used by staff, for example `https://admissions.example.edu`.
- `NEXT_PUBLIC_ENTRA_API_SCOPE` matches the exposed API scope.
- `NEXT_PUBLIC_GRAPH_SCOPES=User.Read Mail.Send`
- `APP_STORAGE_DIR` points to persistent storage.
- Configure default email subject/body in the Settings page after deployment.
- Configure the stale pending send timeout in Settings. Default is 30 minutes; allowed range is 5 to 1440 minutes.

## Security Controls

- Security headers are applied by `middleware.ts`, including CSP, frame blocking, content-type sniffing protection, referrer policy, HSTS, and permissions policy.
- The framework powered-by header is disabled.
- Banner Excel uploads are limited to 10 MB.
- DOCX template uploads are limited to 15 MB.
- PDF email attachments are limited to 10 MB.
- Bulk generation requests are limited to 2,000 applicant IDs.
- ZIP download requests are limited to 200 generated-letter IDs.
- Applicant status exports are limited to 10,000 rows.
- Dashboard list APIs enforce bounded `limit` and `offset` pagination.
- Email HTML is sanitized before sending and logging.
- Email Queue exposes recent send history, status, resend reasons, and errors without returning stored email bodies.
- Default email subject and body are only exposed to letter operators and settings managers.
- Audit log details are sanitized before being returned to the browser.
- Health and download APIs do not expose raw storage paths.
- Health failure details are redacted before being returned to the browser.
- Unexpected server errors return a generic response while server logs keep the detailed exception.
- Individual and ZIP generated-letter downloads are audited by generated-letter ID.
- Database constraints enforce known import, applicant email, generated letter, and email log statuses.
- Partial unique indexes block duplicate original email sends, including regenerated letters for the same applicant, while allowing authorized resends with a reason.
- Settings changes are restricted to Admin and Admissions Supervisor roles and are audited.
- Template activation changes are restricted to Admin and Admissions Supervisor roles and are audited.
- Template mapping fallback values are only exposed to Admin and Admissions Supervisor roles.

## Data And Document Validation

- Run `npm run db:setup` once per environment.
- Upload each production DOCX template and verify detected placeholders.
- Deactivate obsolete seed or retired templates and confirm they are not available for new field mappings or generation.
- Map every detected placeholder to a Banner field or fallback.
- Confirm field mapping updates reject placeholder names that were not detected in the selected template.
- Confirm re-uploading a template removes mappings for placeholders no longer present in the DOCX.
- Upload a current Banner export and confirm invalid rows are clearly shown.
- Confirm duplicate `StudentID` plus `TemplateType` rows in a Banner export are flagged as row-level errors and are not silently imported.
- Confirm malformed `Email` values in a Banner export are flagged as row-level errors before automation starts.
- Confirm malformed `DateGenerated`, `BirthDate`, or `SentDate` values are flagged as row-level errors before import insertion.
- Confirm the dashboard Import Review panel shows uploaded file, worksheet, status, valid/invalid row counts, uploader, and row-level errors.
- Confirm imported applicant records show `EmailStatus`, `SentDate`, `WordFileName`, `PDFFileName`, `ErrorMessage`, `ProcessedByFlow`, and `TemplateType`.
- Confirm one-click upload runs full automation for valid rows: import, DOCX/PDF generation, Microsoft Graph email send, and applicant status updates.
- Confirm upload automation is blocked with a clear preflight message when a required `TemplateType` is missing, inactive, or has unmapped placeholders.
- Confirm one-click upload is blocked with a clear preflight message when valid rows exceed the applicant batch limit.
- Confirm manual selected-letter generation is blocked with a clear message when selected rows exceed the applicant batch limit.
- Confirm missing stored template files block generation with a clear re-upload message and applicant `ErrorMessage`.
- Confirm generation failures write applicant `ErrorMessage` values and failed generated-letter statuses.
- Confirm missing generated DOCX files block PDF conversion with a clear regenerate message and failed generated-letter status.
- Confirm the upload send option uses the authenticated Microsoft Graph mailbox, updates email status/sent dates, and records row-level errors.
- Confirm email attempts move applicant status through queued/sending/sent or failed without marking Graph-accepted mail as failed because of later audit issues.
- Confirm missing generated PDF files block email sending with a clear applicant `ErrorMessage` and audit entry.
- Confirm stale pending email sends older than the configured timeout are marked failed, audited, and reflected on the applicant row before retry.
- Confirm each batch automation run creates a `batch.generated` audit entry with requested, generated, emailed, and failed counts.
- If counselor ownership is used, set `applicants.counselor_user_id`; counselors can access unassigned applicants and applicants assigned to their user record, while Admin and Admissions Supervisor roles can access all records.
- Generate sample letters for each `TemplateType`.
- Open generated DOCX and PDF files and confirm logos, tables, headers, footers, signatures, and formatting are preserved.
- Download generated letters individually and as a ZIP, then confirm corresponding audit events are created.
- Send a test email from a counselor account to a controlled test mailbox.
- Confirm duplicate-send prevention blocks a second send without a resend reason.
- Confirm the Email Queue recent activity table records sent, failed, and resent attempts for the correct counselor scope.

## Release Gate

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
docker build --tag costaatt-admissions-letter-automation:ci .
```

For container verification:

```bash
docker compose up --build
npm run smoke
```

## Rollback

- Keep the previous deployment artifact available.
- Database migrations should be reviewed before production execution.
- Back up the database before schema changes.
- Preserve generated file storage during rollback.
