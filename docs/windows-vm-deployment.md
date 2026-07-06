# Windows VM Deployment Guide

Use this guide when installing the COSTAATT Admissions Letter Automation app on a Windows VM after pulling it from GitHub.

## Recommended prerequisites

- Windows Server 2022 or Windows 11 VM.
- Git for Windows.
- Node.js 22 LTS.
- PostgreSQL 16.
- LibreOffice, including Writer.
- A persistent storage folder for generated DOCX/PDF files, for example `C:\COSTAATT\AdmissionsLetterStorage`.

Optional container path:

- Docker Desktop or a Windows VM with Docker Engine support.

## Native Windows setup

Open PowerShell as the service/admin user that will run the app.

1. Clone the repository:

```powershell
git clone https://github.com/ZeroZenx/Admissions-Letter-Automation.git
cd .\Admissions-Letter-Automation
```

2. Install dependencies:

```powershell
npm ci
```

3. Create the PostgreSQL database:

```powershell
createdb costaatt_admissions
```

If `createdb` is not on PATH, use pgAdmin or run it from the PostgreSQL `bin` folder.

4. Create local environment settings:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

For a Windows VM, set paths with forward slashes or escaped backslashes. Example:

```ini
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/costaatt_admissions
APP_BASE_URL=http://localhost:6001
APP_STORAGE_DIR=C:/COSTAATT/AdmissionsLetterStorage
SOFFICE_PATH=C:/Program Files/LibreOffice/program/soffice.exe
AUTH_MODE=development
NEXT_PUBLIC_AUTH_MODE=development
NEXT_PUBLIC_ENTRA_REDIRECT_URI=http://localhost:6001
```

For production Entra sign-in, change `AUTH_MODE` and `NEXT_PUBLIC_AUTH_MODE` to `entra`, then set all `ENTRA_*` and `NEXT_PUBLIC_ENTRA_*` values listed in `.env.example`.

5. Create the storage directory:

```powershell
New-Item -ItemType Directory -Force C:\COSTAATT\AdmissionsLetterStorage
```

6. Apply database schema and seed data:

```powershell
npm run db:setup
```

7. Validate the app:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

8. Start the app on port `6001`:

```powershell
npm run start -- -H 127.0.0.1 -p 6001
```

Open:

```text
http://127.0.0.1:6001
```

Check runtime readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:6001/api/health
```

After first login, open Settings and confirm default email subject/body plus stale pending send timeout. Default stale timeout is 30 minutes; valid range is 5 to 1440 minutes.

## Running as a Windows service

For a durable VM installation, run the app under a Windows service manager such as NSSM, WinSW, or a managed IIS reverse proxy process.

Suggested service command:

```text
Program: C:\Program Files\nodejs\npm.cmd
Arguments: run start -- -H 127.0.0.1 -p 6001
Startup directory: C:\path\to\Admissions-Letter-Automation
```

Make sure the service account has read/write access to:

- The app directory.
- `APP_STORAGE_DIR`.
- The PostgreSQL database.
- The LibreOffice installation path.

## Optional Docker Desktop setup

From PowerShell:

```powershell
docker compose up --build
```

Then apply the schema from another terminal if the database volume is new:

```powershell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:5432/costaatt_admissions"
npm run db:setup
npm run smoke
```

The Compose stack exposes the app on:

```text
http://localhost:6001
```

## Troubleshooting

- Blank white page or `Cannot find module './331.js'`: stop the running Next.js process, run `npm run build`, then start the app again so HTML and JavaScript chunks match.
- Pending email stuck: check Settings stale pending send timeout, then retry after the system marks the stale send failed.
- Excel upload rejected: export Banner as `.xlsx`; legacy `.xls` files are not accepted.
- PDF conversion fails: confirm `SOFFICE_PATH` points to `soffice.exe` and `/api/health` reports the PDF check as healthy.
- Storage check fails: confirm `APP_STORAGE_DIR` exists and the service account has write permission.
- Database check fails: confirm `DATABASE_URL`, PostgreSQL service status, firewall rules, and credentials.
