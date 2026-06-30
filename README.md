# COSTAATT Admissions Letter Automation

Internal Next.js application for importing Banner admissions exports, managing Word templates, generating applicant DOCX/PDF letters, and sending reviewed letters through Microsoft Graph.

## MVP Included

- Upload Banner Excel export and read the `Admissions` worksheet.
- Validate required Banner fields.
- Store imports, applicants, templates, field mappings, generated letters, and audit logs in PostgreSQL.
- Manage DOCX templates and detect placeholders from `«FIELD_NAME»`, `{{FIELD_NAME}}`, and Word content-control placeholder text.
- Activate or deactivate managed templates without deleting historical generated-letter references.
- Map detected placeholders to Banner fields.
- Generate completed DOCX files while preserving the original DOCX package formatting.
- Convert generated DOCX files to PDF through LibreOffice/`soffice` when available.
- Preview/download generated DOCX/PDF files and download a bulk ZIP.
- Microsoft Entra bearer-token verification for production API access.
- Role-guarded API routes for Admin, Admissions Supervisor, Counselor, and Viewer access.
- Microsoft Graph `/me/sendMail` route that sends from the authenticated counselor mailbox.
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

4. Run migrations and seed data:

```bash
npm run db:setup
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## Health Check

After deployment, verify runtime dependencies:

```bash
curl /api/health
```

The health check reports authentication mode/configuration, database connectivity, storage configuration, and PDF conversion configuration without exposing secrets.

## Microsoft Entra Setup

For production:

1. Register an app in Microsoft Entra ID.
2. Add the deployed site URL and `/login` URL as single-page application redirect URIs.
3. Expose an API scope such as `api://<client-id>/access_as_user`.
4. Assign app roles named `Admin`, `Admissions Supervisor`, `Counselor`, and `Viewer`.
5. Grant delegated Microsoft Graph permissions for `User.Read` and `Mail.Send`.
6. Set `AUTH_MODE=entra`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_API_AUDIENCE`, `NEXT_PUBLIC_ENTRA_TENANT_ID`, `NEXT_PUBLIC_ENTRA_CLIENT_ID`, `NEXT_PUBLIC_ENTRA_API_SCOPE`, and `NEXT_PUBLIC_GRAPH_SCOPES`.

The browser acquires one access token for this app's API and a separate delegated Graph token for email sending. The server validates the API token and uses the Graph token only for `/me/sendMail`.

## Production Checklist

See [docs/production-readiness.md](docs/production-readiness.md) for the deployment checklist, Entra configuration, document validation steps, release gate, and rollback notes.

## Notes

- Banner remains the source of truth. This app imports Banner data into a staging database only.
- Email sending is intentionally not automatic after import.
- Duplicate sends are blocked unless an authorized user supplies a resend reason.
- Email send history is visible in the Email Queue without exposing stored email bodies.
- Raw storage paths are never returned from download APIs; files are fetched by generated-letter id.
- Production Graph email sending requires a delegated Microsoft Graph bearer token with `Mail.Send`.
- Upload and email attachment size limits are enforced server-side.
- Security headers are applied by `middleware.ts`.
- Database integrity constraints and indexes are applied through `npm run db:setup`.
- Counselor ownership is enforced when `applicants.counselor_user_id` is configured.
- Template activation changes are restricted to Admin and Admissions Supervisor roles and audited.
- Default email content and PDF converter mode are persisted in `app_settings`.
