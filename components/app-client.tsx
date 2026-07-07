"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileArchive,
  FileText,
  LayoutDashboard,
  Mail,
  Map,
  Settings,
  ShieldCheck,
  Upload
} from "lucide-react";
import { mappableLetterFields } from "@/lib/banner-fields";
import {
  authenticatedFetch,
  authenticatedGraphFetch,
  getClientAuthState,
  logout,
  type ClientAuthState,
  type ClientUserRole
} from "@/lib/client-auth";

type Applicant = {
  id: string;
  student_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  campus: string;
  program: string;
  admission_status: string;
  email_status: string;
  sent_date: string | null;
  word_file_name: string | null;
  pdf_file_name: string | null;
  error_message: string | null;
  processed_by_flow: boolean;
  template_type: string;
  validation_errors: string[];
};

type Template = {
  id: string;
  name: string;
  template_type: string;
  original_file_name: string;
  placeholders: Array<{ name: string; kind: string; occurrences: number }>;
  is_active: boolean;
  mappings: Array<{ placeholder: string; bannerField: string; fallbackValue: string | null }>;
};

type GeneratedLetter = {
  id: string;
  status: string;
  generated_at: string;
  pdf_ready: boolean;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  program: string;
  template_type: string;
  word_file_name: string | null;
  pdf_file_name: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  applicant_student_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
};

type ImportRecord = {
  id: string;
  uploaded_file_name: string;
  worksheet_name: string;
  imported_at: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  status: "review" | "imported" | "failed";
  errors: unknown;
  imported_by_name: string | null;
  imported_by_email: string | null;
};

type TemplatePreflight = {
  templateType: string;
  applicantCount: number;
  status: "ready" | "missing_template" | "inactive_template" | "missing_mappings";
  ready: boolean;
  placeholderCount: number;
  mappingCount: number;
  missingMappings: number;
  missingPlaceholderNames: string[];
};

type EmailLog = {
  id: string;
  generated_letter_id: string | null;
  applicant_id: string;
  recipient: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  sent_at: string | null;
  resend_reason: string | null;
  error_message: string | null;
  created_at: string;
  student_id: string;
  first_name: string;
  last_name: string;
  template_type: string;
};

type AppSettings = {
  email: {
    defaultSubject: string;
    defaultBody: string;
    stalePendingMinutes: number;
  };
  pdf: {
    converter: "libreoffice";
  };
};

type ApplicantFilters = {
  templateType: string;
  admissionStatus: string;
  emailStatus: string;
  campus: string;
  program: string;
};

type PageState = {
  limit: number;
  offset: number;
};

type PageKey = "applicants" | "generatedLetters" | "emailLogs" | "imports" | "auditLogs";

const sections = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "upload", label: "Upload Banner Export", icon: Upload },
  { id: "applicants", label: "Applicant Records", icon: Database },
  { id: "templates", label: "Template Management", icon: FileText },
  { id: "mappings", label: "Field Mapping", icon: Map },
  { id: "generate", label: "Generate Letters", icon: FileArchive },
  { id: "email", label: "Email Queue", icon: Mail },
  { id: "audit", label: "Audit Logs", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

const filterKeys: Array<keyof ApplicantFilters> = ["templateType", "admissionStatus", "emailStatus", "campus", "program"];

const initialPages: Record<PageKey, PageState> = {
  applicants: { limit: 500, offset: 0 },
  generatedLetters: { limit: 200, offset: 0 },
  emailLogs: { limit: 500, offset: 0 },
  imports: { limit: 8, offset: 0 },
  auditLogs: { limit: 500, offset: 0 }
};

const fallbackSettings: AppSettings = {
  email: {
    defaultSubject: "Your COSTAATT admissions letter",
    defaultBody: "Dear applicant,<br><br>Please find your COSTAATT admissions letter attached.",
    stalePendingMinutes: 30
  },
  pdf: {
    converter: "libreoffice"
  }
};

export function AppClient() {
  const [auth, setAuth] = useState<ClientAuthState>({ mode: "development", status: "loading" });
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("dashboard");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [generatedLetters, setGeneratedLetters] = useState<GeneratedLetter[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [pages, setPages] = useState(initialPages);
  const [settings, setSettings] = useState<AppSettings>(fallbackSettings);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({
    templateType: "",
    admissionStatus: "",
    emailStatus: "",
    campus: "",
    program: ""
  });
  const userRoles = auth.status === "authenticated" ? auth.roles ?? ["Viewer"] : [];
  const canManageWorkspace = hasAnyRole(userRoles, ["Admin", "Admissions Supervisor"]);
  const canOperateLetters = hasAnyRole(userRoles, ["Admin", "Admissions Supervisor", "Counselor"]);

  useEffect(() => {
    void getClientAuthState().then(setAuth).catch((error) => {
      setAuth({
        mode: "entra",
        status: "misconfigured",
        error: error instanceof Error ? error.message : "Authentication failed."
      });
    });
  }, []);

  const refresh = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      applyPageQuery(query, pages.applicants);
      const [applicantRes, templateRes, generatedRes, emailLogRes, importRes, auditRes] = await Promise.all([
        authenticatedFetch(`/api/applicants?${query.toString()}`),
        authenticatedFetch("/api/templates"),
        authenticatedFetch(`/api/generated-letters?${pageQuery(pages.generatedLetters)}`),
        authenticatedFetch(`/api/email-logs?${pageQuery(pages.emailLogs)}`),
        authenticatedFetch(`/api/imports?${pageQuery(pages.imports)}`),
        canManageWorkspace ? authenticatedFetch(`/api/audit-logs?${pageQuery(pages.auditLogs)}`) : Promise.resolve(null)
      ]);
      const failed = [applicantRes, templateRes, generatedRes, emailLogRes, importRes, auditRes].find((response) => response && !response.ok);
      if (failed) {
        const body = await readJson<{ error?: string }>(failed);
        setMessage(body.error ?? "Some dashboard data could not be loaded. Check database and authentication settings.");
      }
      if (applicantRes.ok) {
        const body = await applicantRes.json();
        setApplicants(body.applicants);
        setPages((current) => mergePage(current, "applicants", body.page));
      }
      if (templateRes.ok) setTemplates((await templateRes.json()).templates);
      if (generatedRes.ok) {
        const body = await generatedRes.json();
        setGeneratedLetters(body.generatedLetters);
        setPages((current) => mergePage(current, "generatedLetters", body.page));
      }
      if (emailLogRes.ok) {
        const body = await emailLogRes.json();
        setEmailLogs(body.emailLogs);
        setPages((current) => mergePage(current, "emailLogs", body.page));
      }
      if (importRes.ok) {
        const body = await importRes.json();
        setImports(body.imports);
        setPages((current) => mergePage(current, "imports", body.page));
      }
      if (auditRes?.ok) {
        const body = await auditRes.json();
        setAuditLogs(body.auditLogs);
        setPages((current) => mergePage(current, "auditLogs", body.page));
      }
    } catch (error) {
      setMessage(`Dashboard refresh failed: ${clientErrorMessage(error)}`);
    }
  }, [auth.status, canManageWorkspace, filters, pages.applicants, pages.auditLogs, pages.emailLogs, pages.generatedLetters, pages.imports]);

  const refreshSettings = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    if (!canOperateLetters) return;
    try {
      const response = await authenticatedFetch("/api/settings");
      const body = await readJson<{ settings?: AppSettings; error?: string }>(response);
      if (response.ok && body.settings) {
        setSettings(body.settings);
      } else if (!response.ok) {
        setMessage(body.error ?? "Settings could not be loaded.");
      }
    } catch (error) {
      setMessage(`Settings could not be loaded: ${clientErrorMessage(error)}`);
    }
  }, [auth.status, canOperateLetters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const metrics = useMemo(() => {
    const readyTemplates = templates.filter((template) => template.is_active).length;
    const invalid = applicants.filter((applicant) => applicant.validation_errors?.length).length;
    return {
      applicants: applicants.length,
      readyTemplates,
      generated: generatedLetters.length,
      invalid
    };
  }, [applicants, generatedLetters, templates]);
  const visibleSections = useMemo(
    () =>
      sections.filter((section) => {
        if (section.id === "upload" || section.id === "generate") return canOperateLetters;
        if (section.id === "templates" || section.id === "mappings" || section.id === "audit" || section.id === "settings") {
          return canManageWorkspace;
        }
        return true;
      }),
    [canManageWorkspace, canOperateLetters]
  );

  function updatePage(key: PageKey, page: PageState) {
    setPages((current) => ({ ...current, [key]: page }));
  }

  function updateFilters(nextFilters: ApplicantFilters) {
    setFilters(nextFilters);
    setPages((current) => ({ ...current, applicants: { ...current.applicants, offset: 0 } }));
  }

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (!visibleSections.some((section) => section.id === active)) setActive("dashboard");
  }, [active, auth.status, visibleSections]);

  async function uploadImport(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const autoGenerate = formData.get("autoGenerate") === "on";
      const autoSend = formData.get("autoSend") === "on";
      const response = await authenticatedFetch("/api/import", { method: "POST", body: formData });
      const body = await readJson<{
        validRows?: number;
        invalidRows?: number;
        validApplicantIds?: string[];
        preflight?: TemplatePreflight[];
        error?: string;
      }>(response);
      if (!response.ok) {
        setMessage(body.error ?? "Import failed.");
        await refresh();
        return;
      }

      let importedMessage = `Imported ${body.validRows} valid rows. ${body.invalidRows} need review.`;
      const blockedTemplates = body.preflight?.filter((item) => !item.ready) ?? [];
      if (blockedTemplates.length) {
        importedMessage = `${importedMessage} Automation preflight blocked ${blockedTemplates.map((item) => {
          const missing = item.missingPlaceholderNames?.length ? ` (${item.missingPlaceholderNames.join(", ")})` : "";
          return `${item.templateType}: ${item.status}${missing}`;
        }).join(", ")}.`;
      } else if ((autoGenerate || autoSend) && body.validApplicantIds?.length) {
        try {
          const bulkFetch = autoSend ? authenticatedGraphFetch : authenticatedFetch;
          const generationResponse = await bulkFetch("/api/generate-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicantIds: body.validApplicantIds,
              sendEmail: autoSend,
              subject: settings.email.defaultSubject,
              body: settings.email.defaultBody
            })
          });
          const generationBody = await readJson<{ results?: Array<{ ok: boolean; generated?: boolean; emailed?: boolean }>; error?: string }>(generationResponse);
          const failures = generationBody.results?.filter((result) => !result.ok).length ?? 0;
          const generated = generationBody.results?.filter((result) => result.generated).length ?? 0;
          const emailed = generationBody.results?.filter((result) => result.emailed).length ?? 0;
          importedMessage = generationResponse.ok
            ? `${importedMessage} Generated DOCX/PDF files for ${generated} records.${autoSend ? ` Sent ${emailed} emails.` : ""} ${failures} failed.`
            : `${importedMessage} Automatic generation failed: ${generationBody.error ?? "unknown error"}.`;
        } catch (error) {
          importedMessage = `${importedMessage} Automatic generation failed: ${clientErrorMessage(error)}.`;
        }
      }
      setMessage(importedMessage);
      await refresh();
    } catch (error) {
      setMessage(clientErrorMessage(error));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadTemplate(formData: FormData) {
    setBusy(true);
    setMessage("");
    const response = await authenticatedFetch("/api/templates", { method: "POST", body: formData });
    const body = await readJson<{ placeholders?: unknown[]; error?: string }>(response);
    setBusy(false);
    setMessage(response.ok ? `Template saved. Detected ${body.placeholders?.length ?? 0} placeholders.` : body.error ?? "Template upload failed.");
    await refresh();
  }

  async function updateTemplateStatus(template: Template, isActive: boolean) {
    setBusy(true);
    setMessage("");
    const response = await authenticatedFetch("/api/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: template.id, isActive })
    });
    const body = await readJson<{ error?: string }>(response);
    setBusy(false);
    setMessage(response.ok ? `${template.template_type} template ${isActive ? "activated" : "deactivated"}.` : body.error ?? "Template status could not be updated.");
    await refresh();
  }

  async function saveMappings(template: Template, formData: FormData) {
    const mappings = template.placeholders.map((placeholder) => ({
      placeholder: placeholder.name,
      bannerField: String(formData.get(placeholder.name) || placeholder.name),
      fallbackValue: String(formData.get(`${placeholder.name}:fallback`) || "")
    }));
    const response = await authenticatedFetch("/api/field-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: template.id, mappings })
    });
    setMessage(response.ok ? "Field mappings saved." : "Could not save field mappings.");
    await refresh();
  }

  async function generateSelected() {
    setBusy(true);
    const response = await authenticatedFetch("/api/generate-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantIds: selectedApplicants })
    });
    const body = await readJson<{ results?: Array<{ ok: boolean }>; error?: string }>(response);
    const failures = body.results?.filter((result: { ok: boolean }) => !result.ok).length ?? 0;
    setBusy(false);
    setMessage(
      response.ok ? `Generation finished for ${selectedApplicants.length} applicants. ${failures} failed.` : body.error ?? "Generation failed."
    );
    await refresh();
  }

  async function downloadLetter(letterId: string, type: "docx" | "pdf") {
    const response = await authenticatedFetch(`/api/download/${letterId}?type=${type}`);
    if (!response.ok) {
      const body = await readJson<{ error?: string }>(response);
      setMessage(body.error ?? `Could not download ${type.toUpperCase()} file.`);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = responseDownloadFileName(response, `${letterId}.${type}`);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function previewLetter(letterId: string) {
    const previewWindow = window.open("about:blank", "_blank");
    const response = await authenticatedFetch(`/api/download/${letterId}?type=pdf&disposition=inline`);
    if (!response.ok) {
      previewWindow?.close();
      const body = await readJson<{ error?: string }>(response);
      setMessage(body.error ?? "Could not preview PDF file.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.location.href = url;
    }
  }

  async function downloadZip(letterIds: string[]) {
    const response = await authenticatedFetch("/api/download-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generatedLetterIds: letterIds })
    });
    if (!response.ok) {
      const body = await readJson<{ error?: string }>(response);
      setMessage(body.error ?? "Could not download ZIP file.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "admissions-letters.zip";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadApplicantExport() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const response = await authenticatedFetch(`/api/applicants/export?${query.toString()}`);
    if (!response.ok) {
      const body = await readJson<{ error?: string }>(response);
      setMessage(body.error ?? "Could not export applicant status workbook.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "costaatt-admissions-status-export.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const title = visibleSections.find((section) => section.id === active)?.label ?? "Dashboard";
  const canUseWorkspace = auth.status === "authenticated";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <h1>COSTAATT Admissions Letters</h1>
          <p>Banner export to automated PDF letters</p>
        </div>
        <nav className="nav">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            return (
              <a
                href={`#${section.id}`}
                className={active === section.id ? "active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  setActive(section.id);
                }}
                key={section.id}
              >
                <Icon size={17} />
                {section.label}
              </a>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <h2>{title}</h2>
            <p>Import, generate, email, and track admissions letters from Banner source data.</p>
          </div>
          <span className="status ok">
            <ShieldCheck size={14} /> Automation ready
          </span>
          {auth.status === "authenticated" ? (
            <button className="button secondary" onClick={() => void logout()}>
              Sign out
            </button>
          ) : null}
        </header>
        <div className="content">
          {auth.status === "loading" ? <p className="notice">Checking authentication...</p> : null}
          {auth.status === "unauthenticated" ? (
            <p className="notice">
              You need to sign in before accessing admissions records. Open <a href="/login">Login</a>.
            </p>
          ) : null}
          {auth.status === "misconfigured" ? <p className="notice">{auth.error}</p> : null}
          {message ? <p className="notice">{message}</p> : null}
          {canUseWorkspace && active === "dashboard" && (
            <Dashboard
              metrics={metrics}
              applicants={applicants}
              templates={templates}
              imports={imports}
              importsPage={pages.imports}
              onImportsPage={(page) => updatePage("imports", page)}
            />
          )}
          {canUseWorkspace && canOperateLetters && active === "upload" && <UploadPage busy={busy} onUpload={uploadImport} />}
          {canUseWorkspace && active === "applicants" && (
            <ApplicantsPage
              applicants={applicants}
              filters={filters}
              page={pages.applicants}
              onPage={(page) => updatePage("applicants", page)}
              onFilters={updateFilters}
              selected={selectedApplicants}
              onSelected={setSelectedApplicants}
              canSelect={canOperateLetters}
              onExport={downloadApplicantExport}
            />
          )}
          {canUseWorkspace && canManageWorkspace && active === "templates" && (
            <TemplatesPage busy={busy} templates={templates} onUpload={uploadTemplate} onStatusChange={updateTemplateStatus} />
          )}
          {canUseWorkspace && canManageWorkspace && active === "mappings" && <MappingsPage templates={templates} onSave={saveMappings} />}
          {canUseWorkspace && canOperateLetters && active === "generate" && (
            <GeneratePage
              applicants={applicants}
              selected={selectedApplicants}
              onSelected={setSelectedApplicants}
              busy={busy}
              onGenerate={generateSelected}
              generatedLetters={generatedLetters}
              generatedPage={pages.generatedLetters}
              onGeneratedPage={(page) => updatePage("generatedLetters", page)}
              onDownload={downloadLetter}
              onPreview={previewLetter}
              onDownloadZip={downloadZip}
              canDownload={canOperateLetters}
            />
          )}
          {canUseWorkspace && active === "email" && (
            <EmailQueue
              generatedLetters={generatedLetters}
              emailLogs={emailLogs}
              emailLogsPage={pages.emailLogs}
              onEmailLogsPage={(page) => updatePage("emailLogs", page)}
              generatedPage={pages.generatedLetters}
              onGeneratedPage={(page) => updatePage("generatedLetters", page)}
              onDownload={downloadLetter}
              onPreview={previewLetter}
              onDownloadZip={downloadZip}
              settings={settings}
              onRefresh={refresh}
              canSend={canOperateLetters}
            />
          )}
          {canUseWorkspace && canManageWorkspace && active === "audit" && (
            <AuditPage auditLogs={auditLogs} page={pages.auditLogs} onPage={(page) => updatePage("auditLogs", page)} />
          )}
          {canUseWorkspace && canManageWorkspace && active === "settings" && (
            <SettingsPage settings={settings} onSettings={setSettings} onRefresh={refreshSettings} />
          )}
        </div>
      </main>
    </div>
  );
}

function hasAnyRole(userRoles: ClientUserRole[], allowedRoles: ClientUserRole[]) {
  return userRoles.some((role) => allowedRoles.includes(role));
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function pageQuery(page: PageState) {
  const query = new URLSearchParams();
  applyPageQuery(query, page);
  return query.toString();
}

function applyPageQuery(query: URLSearchParams, page: PageState) {
  query.set("limit", String(page.limit));
  query.set("offset", String(page.offset));
}

function mergePage(current: Record<PageKey, PageState>, key: PageKey, next?: PageState) {
  if (!next) return current;
  const currentPage = current[key];
  if (currentPage.limit === next.limit && currentPage.offset === next.offset) return current;
  return { ...current, [key]: next };
}

function clientErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Automation failed.";
}

function responseDownloadFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition") ?? response.headers.get("content-disposition") ?? "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return fallback;
    }
  }
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = disposition.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() || fallback;
}

function formatImportErrors(errors: unknown) {
  if (!Array.isArray(errors)) return "";
  return errors
    .slice(0, 3)
    .map((error) => {
      if (!error || typeof error !== "object") return "";
      const row = error as Record<string, unknown>;
      const rowNumber = typeof row.rowNumber === "number" || typeof row.rowNumber === "string" ? row.rowNumber : "unknown";
      const messages = Array.isArray(row.errors) ? row.errors.map(String).filter(Boolean) : [];
      return messages.length ? `Row ${rowNumber}: ${messages.join(", ")}` : "";
    })
    .filter(Boolean)
    .join(" | ");
}

function Dashboard({
  metrics,
  applicants,
  templates,
  imports,
  importsPage,
  onImportsPage
}: {
  metrics: Record<string, number>;
  applicants: Applicant[];
  templates: Template[];
  imports: ImportRecord[];
  importsPage: PageState;
  onImportsPage: (page: PageState) => void;
}) {
  return (
    <div className="grid">
      <div className="grid three">
        <Metric label="Imported Applicants" value={metrics.applicants} />
        <Metric label="Active Templates" value={metrics.readyTemplates} />
        <Metric label="Generated Letters" value={metrics.generated} />
        <Metric label="Rows Needing Review" value={metrics.invalid} />
      </div>
      <div className="grid two">
        <Panel title="Recent Applicant Records">
          <RecordsTable applicants={applicants.slice(0, 8)} compact />
        </Panel>
        <Panel title="Template Health">
          {templates.map((template) => (
            <p key={template.id}>
              <strong>{template.template_type}</strong>{" "}
              <span className={template.is_active ? "status ok" : "status error"}>
                {template.is_active ? "Active" : "Seed only"}
              </span>{" "}
              <span className="muted">{template.placeholders?.length ?? 0} placeholders</span>
            </p>
          ))}
        </Panel>
      </div>
      <ImportHistory imports={imports} page={importsPage} onPage={onImportsPage} />
    </div>
  );
}

function ImportHistory({ imports, page, onPage }: { imports: ImportRecord[]; page: PageState; onPage: (page: PageState) => void }) {
  return (
    <Panel title="Import Review">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Uploaded</th>
              <th>File</th>
              <th>Status</th>
              <th>Rows</th>
              <th>Imported By</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((record) => (
              <tr key={record.id}>
                <td>{new Date(record.imported_at).toLocaleString()}</td>
                <td>
                  {record.uploaded_file_name}
                  <div className="muted">{record.worksheet_name}</div>
                </td>
                <td>
                  <span className={record.status === "imported" ? "status ok" : "status error"}>{record.status}</span>
                </td>
                <td>
                  {record.valid_rows}/{record.total_rows} valid
                  <div className="muted">{record.invalid_rows} need review</div>
                </td>
                <td>{record.imported_by_name ?? record.imported_by_email ?? ""}</td>
                <td>{formatImportErrors(record.errors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} loadedCount={imports.length} onPage={onPage} />
    </Panel>
  );
}

function UploadPage({ busy, onUpload }: { busy: boolean; onUpload: (formData: FormData) => void }) {
  return (
    <Panel title="Upload Banner Export">
      <form action={onUpload}>
        <div className="field">
          <label>Admissions workbook</label>
          <input name="file" type="file" accept=".xlsx" required />
        </div>
        <input name="autoGenerate" type="hidden" value="on" />
        <input name="autoSend" type="hidden" value="on" />
        <div className="automation-summary">Full automation: import, generate DOCX/PDF, send email, update status workbook.</div>
        <button className="button" disabled={busy}>
          <Upload size={16} /> Upload Source of Truth and Run Automation
        </button>
      </form>
    </Panel>
  );
}

function ApplicantsPage({
  applicants,
  filters,
  page,
  onPage,
  onFilters,
  selected,
  onSelected,
  canSelect,
  onExport
}: {
  applicants: Applicant[];
  filters: ApplicantFilters;
  page: PageState;
  onPage: (page: PageState) => void;
  onFilters: (filters: ApplicantFilters) => void;
  selected: string[];
  onSelected: (ids: string[]) => void;
  canSelect: boolean;
  onExport: () => void;
}) {
  return (
    <Panel title="Applicant Records">
      <div className="filters">
        {filterKeys.map((key) => (
          <input
            key={key}
            placeholder={key}
            value={filters[key]}
            onChange={(event) => onFilters({ ...filters, [key]: event.target.value })}
          />
        ))}
        <button className="button secondary" onClick={onExport}>
          <Download size={16} /> Export Status
        </button>
      </div>
      <RecordsTable applicants={applicants} selected={canSelect ? selected : undefined} onSelected={canSelect ? onSelected : undefined} />
      <PaginationControls page={page} loadedCount={applicants.length} onPage={onPage} />
    </Panel>
  );
}

function TemplatesPage({
  busy,
  templates,
  onUpload,
  onStatusChange
}: {
  busy: boolean;
  templates: Template[];
  onUpload: (formData: FormData) => void;
  onStatusChange: (template: Template, isActive: boolean) => void;
}) {
  return (
    <div className="grid two">
      <Panel title="Upload Template">
        <form action={onUpload}>
          <div className="field">
            <label>Template name</label>
            <input name="name" required placeholder="Unconditional Offer" />
          </div>
          <div className="field">
            <label>TemplateType value</label>
            <input name="templateType" required placeholder="UOFFER" />
          </div>
          <div className="field">
            <label>DOCX file</label>
            <input name="file" type="file" accept=".docx" required />
          </div>
          <button className="button" disabled={busy}>
            <FileText size={16} /> Save Template
          </button>
        </form>
      </Panel>
      <Panel title="Managed Templates">
        {templates.map((template) => (
          <div key={template.id} style={{ marginBottom: 16 }}>
            <strong>{template.name}</strong>
            <p className="muted">
              {template.template_type} · {template.original_file_name}
            </p>
            <span className={template.is_active ? "status ok" : "status error"}>
              {template.is_active ? "Active" : "Inactive"}
            </span>
            <button
              className="button secondary"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => onStatusChange(template, !template.is_active)}
            >
              {template.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function MappingsPage({ templates, onSave }: { templates: Template[]; onSave: (template: Template, formData: FormData) => void }) {
  return (
    <div className="grid">
      {templates
        .filter((template) => template.is_active)
        .map((template) => {
          const mappingsByPlaceholder = new globalThis.Map(template.mappings.map((mapping) => [mapping.placeholder, mapping]));
          return (
            <Panel title={`${template.template_type} Field Mapping`} key={template.id}>
              <form action={(formData) => onSave(template, formData)}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Placeholder</th>
                        <th>Type</th>
                        <th>Banner Field</th>
                        <th>Fallback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.placeholders.map((placeholder) => {
                        const savedMapping = mappingsByPlaceholder.get(placeholder.name);
                        return (
                          <tr key={placeholder.name}>
                            <td>{placeholder.name}</td>
                            <td>{placeholder.kind}</td>
                            <td>
                              <select name={placeholder.name} defaultValue={savedMapping?.bannerField ?? defaultMappingField(placeholder.name)}>
                                {mappableLetterFields.map((field) => (
                                  <option key={field}>{field}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                name={`${placeholder.name}:fallback`}
                                placeholder="Optional fallback"
                                defaultValue={savedMapping?.fallbackValue ?? ""}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button className="button" style={{ marginTop: 14 }}>
                  Save Mappings
                </button>
              </form>
            </Panel>
          );
        })}
    </div>
  );
}

function defaultMappingField(placeholderName: string) {
  return mappableLetterFields.find((field) => field === placeholderName) ?? "StudentID";
}

function GeneratePage({
  applicants,
  selected,
  onSelected,
  busy,
  onGenerate,
  generatedLetters,
  generatedPage,
  onGeneratedPage,
  onDownload,
  onPreview,
  onDownloadZip,
  canDownload
}: {
  applicants: Applicant[];
  selected: string[];
  onSelected: (ids: string[]) => void;
  busy: boolean;
  onGenerate: () => void;
  generatedLetters: GeneratedLetter[];
  generatedPage: PageState;
  onGeneratedPage: (page: PageState) => void;
  onDownload: (letterId: string, type: "docx" | "pdf") => void;
  onPreview: (letterId: string) => void;
  onDownloadZip: (letterIds: string[]) => void;
  canDownload: boolean;
}) {
  return (
    <div className="grid">
      <Panel title="Generate Letters">
        <p className="muted">Select records, generate completed DOCX files, then convert to PDF before download.</p>
        <button className="button" disabled={busy || selected.length === 0} onClick={onGenerate}>
          <FileArchive size={16} /> Generate {selected.length || ""} Selected
        </button>
        <RecordsTable applicants={applicants} selected={selected} onSelected={onSelected} compact />
      </Panel>
      <GeneratedTable
        generatedLetters={generatedLetters}
        page={generatedPage}
        onPage={onGeneratedPage}
        onDownload={onDownload}
        onPreview={onPreview}
        onDownloadZip={onDownloadZip}
        canDownload={canDownload}
      />
    </div>
  );
}

function EmailQueue({
  generatedLetters,
  emailLogs,
  emailLogsPage,
  onEmailLogsPage,
  generatedPage,
  onGeneratedPage,
  onDownload,
  onPreview,
  onDownloadZip,
  settings,
  onRefresh,
  canSend
}: {
  generatedLetters: GeneratedLetter[];
  emailLogs: EmailLog[];
  emailLogsPage: PageState;
  onEmailLogsPage: (page: PageState) => void;
  generatedPage: PageState;
  onGeneratedPage: (page: PageState) => void;
  onDownload: (letterId: string, type: "docx" | "pdf") => void;
  onPreview: (letterId: string) => void;
  onDownloadZip: (letterIds: string[]) => void;
  settings: AppSettings;
  onRefresh: () => Promise<void>;
  canSend: boolean;
}) {
  const [generatedLetterId, setGeneratedLetterId] = useState(generatedLetters[0]?.id ?? "");
  const [subject, setSubject] = useState(settings.email.defaultSubject);
  const [body, setBody] = useState(settings.email.defaultBody);
  const [resendReason, setResendReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSubject(settings.email.defaultSubject);
    setBody(settings.email.defaultBody);
  }, [settings.email.defaultBody, settings.email.defaultSubject]);

  useEffect(() => {
    if (!generatedLetterId && generatedLetters[0]?.id) setGeneratedLetterId(generatedLetters[0].id);
  }, [generatedLetterId, generatedLetters]);

  async function sendEmail() {
    setBusy(true);
    setMessage("");
    const response = await authenticatedGraphFetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generatedLetterId,
        subject,
        body,
        resendReason: resendReason || undefined
      })
    });
    const result = await readJson<{ error?: string; sent?: boolean; warning?: string }>(response);
    setBusy(false);
    setMessage(response.ok && result.sent ? result.warning ?? "Email sent and logged." : result.error ?? "Email could not be sent.");
    if (response.ok) await onRefresh();
  }

  return (
    <div className="grid">
      {canSend ? (
        <Panel title="Email Queue">
          <p className="notice">Email uses Microsoft Graph and sends from the authenticated counselor mailbox.</p>
          {message ? <p className="notice">{message}</p> : null}
          <div className="grid two">
            <div className="field">
              <label>Generated letter</label>
              <select value={generatedLetterId} onChange={(event) => setGeneratedLetterId(event.target.value)}>
                {generatedLetters.map((letter) => (
                  <option key={letter.id} value={letter.id}>
                    {letter.student_id} · {letter.first_name} {letter.last_name} · {letter.template_type}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Subject</label>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </div>
            <div className="field">
              <label>Body</label>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} />
            </div>
            <div className="field">
              <label>Resend reason</label>
              <textarea
                value={resendReason}
                onChange={(event) => setResendReason(event.target.value)}
                rows={5}
                placeholder="Required only when sending a letter that was already sent"
              />
            </div>
          </div>
          <button className="button" disabled={busy || !generatedLetterId} onClick={sendEmail}>
            <Mail size={16} /> Send Selected PDF
          </button>
        </Panel>
      ) : null}
      <EmailLogTable emailLogs={emailLogs} page={emailLogsPage} onPage={onEmailLogsPage} />
      <GeneratedTable
        generatedLetters={generatedLetters}
        page={generatedPage}
        onPage={onGeneratedPage}
        onDownload={onDownload}
        onPreview={onPreview}
        onDownloadZip={onDownloadZip}
        canDownload={canSend}
      />
    </div>
  );
}

function EmailLogTable({ emailLogs, page, onPage }: { emailLogs: EmailLog[]; page: PageState; onPage: (page: PageState) => void }) {
  return (
    <Panel title="Recent Email Activity">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>StudentID</th>
              <th>Recipient</th>
              <th>Template</th>
              <th>Status</th>
              <th>Resend</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {emailLogs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.sent_at ?? log.created_at).toLocaleString()}</td>
                <td>{log.student_id}</td>
                <td>{log.recipient}</td>
                <td>{log.template_type}</td>
                <td>
                  <span className={log.status === "sent" ? "status ok" : "status"}>{log.status}</span>
                </td>
                <td>{log.resend_reason ?? ""}</td>
                <td>{log.error_message ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} loadedCount={emailLogs.length} onPage={onPage} />
    </Panel>
  );
}

function AuditPage({ auditLogs, page, onPage }: { auditLogs: AuditLog[]; page: PageState; onPage: (page: PageState) => void }) {
  return (
    <Panel title="Audit Logs">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Entity</th>
              <th>StudentID</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.action}</td>
                <td>
                  {log.actor_name ?? "System"}
                  {log.actor_email ? <div className="muted">{log.actor_email}</div> : null}
                </td>
                <td>{log.entity_type}</td>
                <td>{log.applicant_student_id}</td>
                <td>{JSON.stringify(log.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} loadedCount={auditLogs.length} onPage={onPage} />
    </Panel>
  );
}

function SettingsPage({
  settings,
  onSettings,
  onRefresh
}: {
  settings: AppSettings;
  onSettings: (settings: AppSettings) => void;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function saveSettings() {
    setBusy(true);
    setMessage("");
    const response = await authenticatedFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const body = await readJson<{ settings?: AppSettings; error?: string }>(response);
    setBusy(false);
    if (response.ok && body.settings) {
      onSettings(body.settings);
      setMessage("Settings saved.");
      await onRefresh();
    } else {
      setMessage(body.error ?? "Settings could not be saved.");
    }
  }

  return (
    <Panel title="Settings">
      {message ? <p className="notice">{message}</p> : null}
      <div className="grid two">
        <div>
          <h3>Authentication</h3>
          <p className="muted">Microsoft Entra ID variables are read from the environment. Role enforcement is active for protected APIs.</p>
        </div>
        <div>
          <h3>PDF Conversion</h3>
          <p className="muted">Configured converter: {draft.pdf.converter}. Set SOFFICE_PATH for LibreOffice headless conversion.</p>
        </div>
      </div>
      <div className="grid two" style={{ marginTop: 18 }}>
        <div className="field">
          <label>Default email subject</label>
          <input
            value={draft.email.defaultSubject}
            onChange={(event) =>
              setDraft({ ...draft, email: { ...draft.email, defaultSubject: event.target.value } })
            }
          />
        </div>
        <div className="field">
          <label>PDF converter</label>
          <select
            value={draft.pdf.converter}
            onChange={(event) => setDraft({ ...draft, pdf: { converter: event.target.value as "libreoffice" } })}
          >
            <option value="libreoffice">LibreOffice</option>
          </select>
        </div>
        <div className="field">
          <label>Default email body</label>
          <textarea
            value={draft.email.defaultBody}
            onChange={(event) => setDraft({ ...draft, email: { ...draft.email, defaultBody: event.target.value } })}
            rows={6}
          />
        </div>
        <div className="field">
          <label>Stale pending send timeout minutes</label>
          <input
            type="number"
            min={5}
            max={1440}
            value={draft.email.stalePendingMinutes}
            onChange={(event) =>
              setDraft({ ...draft, email: { ...draft.email, stalePendingMinutes: Number(event.target.value) } })
            }
          />
        </div>
      </div>
      <button className="button" disabled={busy} onClick={saveSettings}>
        Save Settings
      </button>
    </Panel>
  );
}

function RecordsTable({
  applicants,
  compact = false,
  selected,
  onSelected
}: {
  applicants: Applicant[];
  compact?: boolean;
  selected?: string[];
  onSelected?: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (!selected || !onSelected) return;
    onSelected(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {selected ? <th>Select</th> : null}
            <th>StudentID</th>
            <th>Name</th>
            <th>Program</th>
            {!compact ? <th>Campus</th> : null}
            <th>TemplateType</th>
            <th>AdmissionStatus</th>
            <th>EmailStatus</th>
            {!compact ? <th>SentDate</th> : null}
            {!compact ? <th>WordFileName</th> : null}
            {!compact ? <th>PDFFileName</th> : null}
            {!compact ? <th>ErrorMessage</th> : null}
            {!compact ? <th>ProcessedByFlow</th> : null}
            {!compact ? <th>Validation</th> : null}
          </tr>
        </thead>
        <tbody>
          {applicants.map((applicant) => (
            <tr key={applicant.id}>
              {selected ? (
                <td>
                  <input type="checkbox" checked={selected.includes(applicant.id)} onChange={() => toggle(applicant.id)} />
                </td>
              ) : null}
              <td>{applicant.student_id}</td>
              <td>
                {applicant.first_name} {applicant.middle_name} {applicant.last_name}
                {!compact ? <div className="muted">{applicant.email}</div> : null}
              </td>
              <td>{applicant.program}</td>
              {!compact ? <td>{applicant.campus}</td> : null}
              <td>{applicant.template_type}</td>
              <td>{applicant.admission_status}</td>
              <td>
                <span className="status">{applicant.email_status}</span>
              </td>
              {!compact ? <td>{applicant.sent_date ? new Date(applicant.sent_date).toLocaleString() : ""}</td> : null}
              {!compact ? <td>{applicant.word_file_name ?? ""}</td> : null}
              {!compact ? <td>{applicant.pdf_file_name ?? ""}</td> : null}
              {!compact ? <td>{applicant.error_message ?? ""}</td> : null}
              {!compact ? (
                <td>
                  <span className={applicant.processed_by_flow ? "status ok" : "status"}>
                    {applicant.processed_by_flow ? "Yes" : "No"}
                  </span>
                </td>
              ) : null}
              {!compact ? (
                <td>
                  {applicant.validation_errors?.length ? (
                    <span className="status error">{applicant.validation_errors.join(", ")}</span>
                  ) : (
                    <span className="status ok">Valid</span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeneratedTable({
  generatedLetters,
  page,
  onPage,
  onDownload,
  onPreview,
  onDownloadZip,
  canDownload
}: {
  generatedLetters: GeneratedLetter[];
  page: PageState;
  onPage: (page: PageState) => void;
  onDownload: (letterId: string, type: "docx" | "pdf") => void;
  onPreview: (letterId: string) => void;
  onDownloadZip: (letterIds: string[]) => void;
  canDownload: boolean;
}) {
  const downloadableIds = generatedLetters.map((letter) => letter.id);

  return (
    <Panel title="Generated Letters">
      {canDownload ? (
        <button className="button secondary" disabled={!downloadableIds.length} onClick={() => onDownloadZip(downloadableIds)}>
          <FileArchive size={16} /> Download ZIP
        </button>
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>StudentID</th>
              <th>Name</th>
              <th>TemplateType</th>
              <th>Files</th>
              <th>Status</th>
              <th>Generated</th>
              {canDownload ? <th>Downloads</th> : null}
            </tr>
          </thead>
          <tbody>
            {generatedLetters.map((letter) => (
              <tr key={letter.id}>
                <td>{letter.student_id}</td>
                <td>
                  {letter.first_name} {letter.last_name}
                  <div className="muted">{letter.email}</div>
                </td>
                <td>{letter.template_type}</td>
                <td>
                  <div>{letter.word_file_name ?? ""}</div>
                  <div className="muted">{letter.pdf_file_name ?? ""}</div>
                </td>
                <td>
                  <span className={letter.pdf_ready ? "status ok" : "status"}>{letter.status}</span>
                </td>
                <td>{new Date(letter.generated_at).toLocaleString()}</td>
                {canDownload ? (
                  <td>
                    <button className="button secondary" onClick={() => onDownload(letter.id, "docx")}>
                      DOCX
                    </button>{" "}
                    {letter.pdf_ready ? (
                      <>
                        <button className="button secondary" onClick={() => onPreview(letter.id)}>
                          <Eye size={16} /> Preview
                        </button>{" "}
                        <button className="button secondary" onClick={() => onDownload(letter.id, "pdf")}>
                          PDF
                        </button>
                      </>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} loadedCount={generatedLetters.length} onPage={onPage} />
    </Panel>
  );
}

function PaginationControls({
  page,
  loadedCount,
  onPage
}: {
  page: PageState;
  loadedCount: number;
  onPage: (page: PageState) => void;
}) {
  const start = loadedCount ? page.offset + 1 : 0;
  const end = page.offset + loadedCount;
  const canPrevious = page.offset > 0;
  const canNext = loadedCount === page.limit;

  return (
    <div className="pagination">
      <span className="muted">
        Rows {start}-{end}
      </span>
      <div className="pagination-actions">
        <button className="button secondary icon-button" disabled={!canPrevious} onClick={() => onPage({ ...page, offset: Math.max(0, page.offset - page.limit) })}>
          <ChevronLeft size={16} />
        </button>
        <button className="button secondary icon-button" disabled={!canNext} onClick={() => onPage({ ...page, offset: page.offset + page.limit })}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <section className="panel metric">
      <h3>{label}</h3>
      <strong>{value}</strong>
    </section>
  );
}
