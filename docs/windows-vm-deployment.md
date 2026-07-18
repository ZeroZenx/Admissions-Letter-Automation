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
APP_BASE_URL=https://admissions.example.edu
APP_STORAGE_DIR=C:/COSTAATT/AdmissionsLetterStorage
SOFFICE_PATH=C:/Program Files/LibreOffice/program/soffice.exe
APP_ENCRYPTION_KEY=PASTE_A_GENERATED_KEY_HERE
AUTH_MODE=development
NEXT_PUBLIC_AUTH_MODE=development
ALLOW_INSECURE_DEVELOPMENT_AUTH=true
NEXT_PUBLIC_ENTRA_REDIRECT_URI=https://admissions.example.edu
```

Generate the encryption key once in PowerShell, then paste the output into `.env.local`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep this key stable, restricted to the service account, and out of Git and tickets. It protects any shared sender password saved in Settings.

For production Entra sign-in, change `AUTH_MODE` and `NEXT_PUBLIC_AUTH_MODE` to `entra`, then set all `ENTRA_*` and `NEXT_PUBLIC_ENTRA_*` values listed in `.env.example`.

After sign-in, an Admin can choose the email sender in Settings. Microsoft 365 counselor mode uses delegated Graph `Mail.Send`. Shared email mode uses SMTP with an encrypted password; for Microsoft 365, the tenant must permit authenticated SMTP for that mailbox. Prefer Graph when COSTAATT policy disables password-based SMTP.
Remove `ALLOW_INSECURE_DEVELOPMENT_AUTH=true` (or set it to `false`) before exposing the app to staff. Production-mode development authentication fails closed unless this isolated-testing override is explicitly enabled.
In production, use the HTTPS hostname that staff will open, not `localhost`. In Microsoft Entra, register both the app origin, such as `https://admissions.example.edu`, and the `/login` URL, such as `https://admissions.example.edu/login`, as single-page application redirect URIs. Keep `APP_BASE_URL` and `NEXT_PUBLIC_ENTRA_REDIRECT_URI` set to that same public origin.

5. Create the storage directory:

```powershell
New-Item -ItemType Directory -Force C:\COSTAATT\AdmissionsLetterStorage
```

6. Apply the database schema and install the bundled COSTAATT templates:

```powershell
npm run db:setup
```

The command installs and activates all six supplied Word templates with their field mappings. It is safe to re-run after an update and will preserve administrator-uploaded replacements.

7. Validate the app:

```powershell
npm run validate
```

8. Start the app on port `6001`:

```powershell
npm run start:6001
```

Open:

```text
http://127.0.0.1:6001
```

The server listens on all VM network interfaces. From another staff computer, use the VM hostname or production HTTPS address. Allow inbound TCP `6001` in Windows Firewall only when connecting directly; when using IIS or another HTTPS reverse proxy, expose `443` and keep `6001` restricted to the VM/proxy.

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
Arguments: run start:6001
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
- App opens on the VM but not another computer: confirm staff are using the VM hostname or HTTPS address, Windows Firewall permits the intended port, and the reverse proxy forwards to `http://127.0.0.1:6001`.
- Pending email stuck: check Settings stale pending send timeout, then retry after the system marks the stale send failed.
- Excel upload rejected: export Banner as `.xlsx`; legacy `.xls` files are not accepted.
- PDF conversion fails: confirm `SOFFICE_PATH` points to `soffice.exe` and `/api/health` reports the PDF check as healthy.
- Shared sender cannot save or decrypt its password: confirm the Windows service has the same valid `APP_ENCRYPTION_KEY` used when the password was stored.
- SMTP test email fails: use the mailbox's full email address as the SMTP sign-in email, then confirm the password, host, port, TLS mode, firewall egress, and tenant SMTP AUTH policy.
- Storage check fails: confirm `APP_STORAGE_DIR` exists and the service account has write permission.
- Database check fails: confirm `DATABASE_URL`, PostgreSQL service status, firewall rules, and credentials.
