"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Database,
  FileArchive,
  FileText,
  LayoutDashboard,
  Mail,
  Map,
  Settings,
  ShieldCheck,
  Upload
} from "lucide-react";
import { bannerFields } from "@/lib/banner-fields";

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
  mappings: Array<{ placeholder: string; bannerField: string }>;
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
};

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  applicant_student_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type ApplicantFilters = {
  templateType: string;
  admissionStatus: string;
  emailStatus: string;
  campus: string;
  program: string;
};

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

export function AppClient() {
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("dashboard");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [generatedLetters, setGeneratedLetters] = useState<GeneratedLetter[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
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

  const refresh = useCallback(async () => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const [applicantRes, templateRes, generatedRes, auditRes] = await Promise.all([
      fetch(`/api/applicants?${query.toString()}`),
      fetch("/api/templates"),
      fetch("/api/generated-letters"),
      fetch("/api/audit-logs")
    ]);
    if (applicantRes.ok) setApplicants((await applicantRes.json()).applicants);
    if (templateRes.ok) setTemplates((await templateRes.json()).templates);
    if (generatedRes.ok) setGeneratedLetters((await generatedRes.json()).generatedLetters);
    if (auditRes.ok) setAuditLogs((await auditRes.json()).auditLogs);
  }, [filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  async function uploadImport(formData: FormData) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/import", { method: "POST", body: formData });
    const body = await response.json();
    setBusy(false);
    setMessage(response.ok ? `Imported ${body.validRows} valid rows. ${body.invalidRows} need review.` : body.error);
    await refresh();
  }

  async function uploadTemplate(formData: FormData) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/templates", { method: "POST", body: formData });
    const body = await response.json();
    setBusy(false);
    setMessage(response.ok ? `Template saved. Detected ${body.placeholders.length} placeholders.` : body.error);
    await refresh();
  }

  async function saveMappings(template: Template, formData: FormData) {
    const mappings = template.placeholders.map((placeholder) => ({
      placeholder: placeholder.name,
      bannerField: String(formData.get(placeholder.name) || placeholder.name),
      fallbackValue: String(formData.get(`${placeholder.name}:fallback`) || "")
    }));
    const response = await fetch("/api/field-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: template.id, mappings })
    });
    setMessage(response.ok ? "Field mappings saved." : "Could not save field mappings.");
    await refresh();
  }

  async function generateSelected() {
    setBusy(true);
    const response = await fetch("/api/generate-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantIds: selectedApplicants })
    });
    const body = await response.json();
    const failures = body.results?.filter((result: { ok: boolean }) => !result.ok).length ?? 0;
    setBusy(false);
    setMessage(`Generation finished for ${selectedApplicants.length} applicants. ${failures} failed.`);
    await refresh();
  }

  const title = sections.find((section) => section.id === active)?.label ?? "Dashboard";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <h1>COSTAATT Admissions Letters</h1>
          <p>Banner export to reviewed PDF letters</p>
        </div>
        <nav className="nav">
          {sections.map((section) => {
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
            <p>Review, generate, and download admissions letters before any email is sent.</p>
          </div>
          <span className="status ok">
            <ShieldCheck size={14} /> Review required
          </span>
        </header>
        <div className="content">
          {message ? <p className="notice">{message}</p> : null}
          {active === "dashboard" && <Dashboard metrics={metrics} applicants={applicants} templates={templates} />}
          {active === "upload" && <UploadPage busy={busy} onUpload={uploadImport} />}
          {active === "applicants" && (
            <ApplicantsPage
              applicants={applicants}
              filters={filters}
              onFilters={setFilters}
              selected={selectedApplicants}
              onSelected={setSelectedApplicants}
            />
          )}
          {active === "templates" && <TemplatesPage busy={busy} templates={templates} onUpload={uploadTemplate} />}
          {active === "mappings" && <MappingsPage templates={templates} onSave={saveMappings} />}
          {active === "generate" && (
            <GeneratePage
              applicants={applicants}
              selected={selectedApplicants}
              onSelected={setSelectedApplicants}
              busy={busy}
              onGenerate={generateSelected}
              generatedLetters={generatedLetters}
            />
          )}
          {active === "email" && <EmailQueue generatedLetters={generatedLetters} />}
          {active === "audit" && <AuditPage auditLogs={auditLogs} />}
          {active === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ metrics, applicants, templates }: { metrics: Record<string, number>; applicants: Applicant[]; templates: Template[] }) {
  return (
    <div className="grid">
      <div className="grid three">
        <Metric label="Imported Applicants" value={metrics.applicants} />
        <Metric label="Active Templates" value={metrics.readyTemplates} />
        <Metric label="Generated Letters" value={metrics.generated} />
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
    </div>
  );
}

function UploadPage({ busy, onUpload }: { busy: boolean; onUpload: (formData: FormData) => void }) {
  return (
    <Panel title="Upload Banner Export">
      <form action={onUpload}>
        <div className="field">
          <label>Admissions workbook</label>
          <input name="file" type="file" accept=".xlsx,.xls" required />
        </div>
        <button className="button" disabled={busy}>
          <Upload size={16} /> Import Admissions Worksheet
        </button>
      </form>
    </Panel>
  );
}

function ApplicantsPage({
  applicants,
  filters,
  onFilters,
  selected,
  onSelected
}: {
  applicants: Applicant[];
  filters: ApplicantFilters;
  onFilters: (filters: ApplicantFilters) => void;
  selected: string[];
  onSelected: (ids: string[]) => void;
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
      </div>
      <RecordsTable applicants={applicants} selected={selected} onSelected={onSelected} />
    </Panel>
  );
}

function TemplatesPage({
  busy,
  templates,
  onUpload
}: {
  busy: boolean;
  templates: Template[];
  onUpload: (formData: FormData) => void;
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
        .map((template) => (
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
                    {template.placeholders.map((placeholder) => (
                      <tr key={placeholder.name}>
                        <td>{placeholder.name}</td>
                        <td>{placeholder.kind}</td>
                        <td>
                          <select name={placeholder.name} defaultValue={placeholder.name}>
                            {bannerFields.map((field) => (
                              <option key={field}>{field}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input name={`${placeholder.name}:fallback`} placeholder="Optional fallback" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="button" style={{ marginTop: 14 }}>
                Save Mappings
              </button>
            </form>
          </Panel>
        ))}
    </div>
  );
}

function GeneratePage({
  applicants,
  selected,
  onSelected,
  busy,
  onGenerate,
  generatedLetters
}: {
  applicants: Applicant[];
  selected: string[];
  onSelected: (ids: string[]) => void;
  busy: boolean;
  onGenerate: () => void;
  generatedLetters: GeneratedLetter[];
}) {
  return (
    <div className="grid">
      <Panel title="Generate Letters">
        <p className="muted">Select reviewed records, generate completed DOCX files, then convert to PDF before download.</p>
        <button className="button" disabled={busy || selected.length === 0} onClick={onGenerate}>
          <FileArchive size={16} /> Generate {selected.length || ""} Selected
        </button>
        <RecordsTable applicants={applicants} selected={selected} onSelected={onSelected} compact />
      </Panel>
      <GeneratedTable generatedLetters={generatedLetters} />
    </div>
  );
}

function EmailQueue({ generatedLetters }: { generatedLetters: GeneratedLetter[] }) {
  return (
    <Panel title="Email Queue">
      <p className="notice">Microsoft Graph sending is milestone 2. The queue is read-only until Entra ID and Mail.Send are configured.</p>
      <GeneratedTable generatedLetters={generatedLetters} />
    </Panel>
  );
}

function AuditPage({ auditLogs }: { auditLogs: AuditLog[] }) {
  return (
    <Panel title="Audit Logs">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
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
                <td>{log.entity_type}</td>
                <td>{log.applicant_student_id}</td>
                <td>{JSON.stringify(log.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SettingsPage() {
  return (
    <Panel title="Settings">
      <div className="grid two">
        <div>
          <h3>Authentication</h3>
          <p className="muted">Microsoft Entra ID variables are read from the environment. Role enforcement is schema-ready for milestone 3.</p>
        </div>
        <div>
          <h3>PDF Conversion</h3>
          <p className="muted">Set SOFFICE_PATH to LibreOffice headless conversion for local development.</p>
        </div>
      </div>
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

function GeneratedTable({ generatedLetters }: { generatedLetters: GeneratedLetter[] }) {
  return (
    <Panel title="Generated PDFs">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>StudentID</th>
              <th>Name</th>
              <th>TemplateType</th>
              <th>Status</th>
              <th>Generated</th>
              <th>Downloads</th>
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
                  <span className={letter.pdf_ready ? "status ok" : "status"}>{letter.status}</span>
                </td>
                <td>{new Date(letter.generated_at).toLocaleString()}</td>
                <td>
                  <a className="button secondary" href={`/api/download/${letter.id}?type=docx`}>
                    DOCX
                  </a>{" "}
                  {letter.pdf_ready ? (
                    <a className="button secondary" href={`/api/download/${letter.id}?type=pdf`}>
                      PDF
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
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
