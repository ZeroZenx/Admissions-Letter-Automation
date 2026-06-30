# Production Readiness Checklist

Use this checklist before enabling COSTAATT staff access.

## Infrastructure

- PostgreSQL 16 or compatible managed PostgreSQL is provisioned.
- `DATABASE_URL` points to the production database over TLS where supported.
- Persistent storage is configured for generated DOCX/PDF files.
- LibreOffice is installed and `SOFFICE_PATH` points to the headless executable, or a replacement converter is implemented behind `lib/pdf-converter.ts`.
- `/api/health` returns `ok: true`.

## Microsoft Entra

- App registration exists in COSTAATT tenant.
- Redirect URI includes the production origin and `/login`.
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
- `NEXT_PUBLIC_ENTRA_REDIRECT_URI` matches the deployed origin.
- `NEXT_PUBLIC_ENTRA_API_SCOPE` matches the exposed API scope.
- `NEXT_PUBLIC_GRAPH_SCOPES=User.Read Mail.Send`
- `APP_STORAGE_DIR` points to persistent storage.

## Security Controls

- Security headers are applied by `middleware.ts`, including CSP, frame blocking, content-type sniffing protection, referrer policy, and permissions policy.
- Banner Excel uploads are limited to 10 MB.
- DOCX template uploads are limited to 15 MB.
- PDF email attachments are limited to 10 MB.
- Email HTML is sanitized before sending and logging.
- Download APIs require authenticated access and do not expose raw storage paths.

## Data And Document Validation

- Run `npm run db:setup` once per environment.
- Upload each production DOCX template and verify detected placeholders.
- Map every detected placeholder to a Banner field or fallback.
- Upload a current Banner export and confirm invalid rows are clearly shown.
- Generate sample letters for each `TemplateType`.
- Open generated DOCX and PDF files and confirm logos, tables, headers, footers, signatures, and formatting are preserved.
- Send a test email from a counselor account to a controlled test mailbox.
- Confirm duplicate-send prevention blocks a second send without a resend reason.

## Release Gate

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
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
