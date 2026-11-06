import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";

export const STATUSES = ["Not applied", "Interested", "Applied", "Interviewing", "Offer", "Rejected", "Archived"];
export const WORKFLOW_FIELDS = ["status", "favorite", "nextAction", "nextActionDate", "contact", "appliedAt", "notes"];
export const WEIGHT_KEYS = ["track", "remote", "seniority", "duties", "qualifications", "salary", "recency", "stability"];
export const PLATFORM_CONTEXT = "My project and workflow building now uses Perplexity rather than Microsoft Copilot Studio. Treat this as a user-confirmed platform correction, not evidence of unlisted features, credentials or equivalent employer-required Microsoft experience.";
export const clone = value => JSON.parse(JSON.stringify(value));
export const allJobs = snapshot => [...snapshot.leads, ...snapshot.hidden, ...snapshot.archived];
export const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);
const schema = JSON.parse(readFileSync(new URL("../schemas/job-tracker-data.schema.json", import.meta.url), "utf8"));
const requestSchema = JSON.parse(readFileSync(new URL("../schemas/job-tracker-refresh-request.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false, ownProperties: true });
addFormats(ajv);
const snapshotCheck = ajv.compile(schema);
const profileCheck = ajv.compile({ ...schema.$defs.profile, $defs: schema.$defs });
const requestCheck = ajv.compile(requestSchema);

export class ValidationError extends Error {
  constructor(message) { super(message); this.status = 422; }
}
function demand(condition, message) {
  if (!condition) throw new ValidationError(message);
}
function schemaError(label, validator) {
  return `${label}: ${(validator.errors || []).slice(0, 4).map(e => `${e.instancePath || "/"} ${e.message}`).join("; ")}`;
}
function inspectKeys(value, depth = 0) {
  demand(depth < 35, "Import nesting is too deep.");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    demand(!forbiddenKeys.has(key), "Unsafe object key in imported data.");
    demand(!/^(?:resumeContents?|resumeText|rawResume|fileContents?|fileData|api[_-]?key|access[_-]?token|password|secret|authorization)$/i.test(key), "Raw documents or credentials are not accepted.");
    inspectKeys(child, depth + 1);
  }
}
export function safeUrl(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
export function dateValid(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function validateProfile(profile) {
  inspectKeys(profile);
  demand(profileCheck(profile), schemaError("Invalid profile", profileCheck));
  demand(profile.name.length <= 160 && profile.location.length <= 300, "Profile text is too long.");
  demand(WEIGHT_KEYS.every(k => Number.isFinite(profile.weights[k])), "All eight scoring weights are required.");
  demand(Object.keys(profile.weights).length === 8 && WEIGHT_KEYS.reduce((n, k) => n + profile.weights[k], 0) === 100, "The eight scoring weights must total exactly 100.");
  demand(profile.targetTitles.length <= 50 && profile.sources.length <= 30, "Too many titles or sources.");
  demand(profile.resumes.length <= 30, "Too many resume descriptors.");
  const aliases = new Set(), resumeIds = new Set();
  const descriptorKeys = new Set(["id", "alias", "track", "contentStored", "fileName", "size", "mimeType", "lastModified", "sha256"]);
  for (const r of profile.resumes) {
    demand(r.alias.trim() && !aliases.has(r.alias) && !resumeIds.has(r.id), "Resume aliases and IDs must be nonempty and unique.");
    demand(Object.keys(r).every(k => descriptorKeys.has(k)) && r.contentStored === false, "Only resume descriptors are accepted, never document contents.");
    aliases.add(r.alias); resumeIds.add(r.id);
  }
  demand(!profile.experienceContext || profile.experienceContext.length <= 4000, "Project context is limited to 4,000 characters.");
  return profile;
}
export function validateSnapshot(snapshot) {
  inspectKeys(snapshot);
  demand(snapshotCheck(snapshot), schemaError("Invalid snapshot", snapshotCheck));
  validateProfile(snapshot.profile);
  const jobs = allJobs(snapshot);
  demand(jobs.length <= 1500, "A snapshot is limited to 1,500 records.");
  const ids = new Set();
  for (const j of jobs) {
    demand(!forbiddenKeys.has(j.job_id) && !ids.has(j.job_id), "Every record must have a unique, safe stable job ID.");
    ids.add(j.job_id);
    if (j.url && j.url !== "Not stated") demand(safeUrl(j.url), `Unsafe posting URL for ${j.job_id}.`);
  }
  const aliases = new Set(snapshot.profile.resumes.map(r => r.alias));
  demand(snapshot.leads.every(j => aliases.has(j.resume)), "A lead references an unknown resume alias.");
  demand(snapshot.counts.All === snapshot.leads.length, "counts.All must equal the number of leads.");
  if (snapshot.generator === "Perplexity" && snapshot.run_status === "complete") {
    for (const j of snapshot.leads) {
      demand(j.verified_at && j.verification_status && j.score_components?.length === 8 && j.checklist?.length, `Complete Perplexity result ${j.job_id} lacks verification, components or checklist.`);
      const names = new Set(j.score_components.map(c => c.component));
      demand(WEIGHT_KEYS.every(k => names.has(k)) && names.size === 8, `Score components do not cover all weights for ${j.job_id}.`);
      const total = j.score_components.reduce((n, c) => {
        demand(c.points_awarded >= 0 && c.points_awarded <= c.points_possible && c.points_possible === snapshot.profile.weights[c.component], "Invalid score component.");
        return n + c.points_awarded;
      }, 0);
      const expected = Number.isFinite(j.score_cap) ? Math.min(total, j.score_cap) : total;
      demand(Math.abs(expected - j.score) < 0.01, `Score does not reconcile for ${j.job_id}.`);
    }
  }
  return snapshot;
}
export function normalizeWorkflow(input = {}) {
  demand(input && typeof input === "object" && !Array.isArray(input), "Workflow must be an object.");
  demand(Object.keys(input).every(k => WORKFLOW_FIELDS.includes(k)), "Unsupported workflow field.");
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "status") demand(STATUSES.includes(v), "Unsupported application status.");
    else if (k === "favorite") demand(typeof v === "boolean", "Saved-job flag must be true or false.");
    else if (k === "nextActionDate" || k === "appliedAt") demand(v === "" || v === null || dateValid(v), "Use a valid YYYY-MM-DD date or leave it blank.");
    else demand(typeof v === "string" && v.length <= (k === "notes" ? 20000 : 2000), "Workflow text exceeds its limit.");
    out[k] = v === null ? "" : v;
  }
  return out;
}
export function normalizeState(input, snapshot) {
  inspectKeys(input);
  const state = {
    profile: clone(input.profile || snapshot.profile),
    jobs: {},
    profileDirty: !!input.profileDirty,
    profileUpdatedAt: input.profileUpdatedAt || null,
    retainedJobs: clone(input.retainedJobs || {})
  };
  state.profile.projectPlatform = "Perplexity";
  state.profile.experienceContext ||= PLATFORM_CONTEXT;
  validateProfile(state.profile);
  demand(input.jobs && typeof input.jobs === "object" && !Array.isArray(input.jobs), "Workflow jobs must be an object.");
  demand(Object.keys(input.jobs).length <= 4000, "Too many workflow records.");
  for (const [id, fields] of Object.entries(input.jobs)) {
    demand(id && !forbiddenKeys.has(id), "Unsafe workflow ID.");
    state.jobs[id] = normalizeWorkflow(fields);
  }
  for (const [id, job] of Object.entries(state.retainedJobs)) {
    demand(job && job.job_id === id && job.company && job.role, "Invalid retained job history.");
    if (job.url && job.url !== "Not stated") demand(safeUrl(job.url), "Unsafe retained posting URL.");
  }
  return state;
}
export function initialWorkspace(seed) {
  validateSnapshot(seed);
  const profile = clone(seed.profile);
  const changed = profile.projectPlatform !== "Perplexity";
  profile.projectPlatform = "Perplexity";
  profile.experienceContext ||= PLATFORM_CONTEXT;
  if (changed) profile.version = String((parseInt(profile.version) || 1) + 1);
  return {
    snapshot: clone(seed),
    userState: { profile, jobs: {}, retainedJobs: {}, profileDirty: changed, profileUpdatedAt: changed ? new Date().toISOString() : null },
    revision: 0
  };
}
export function profileEquivalent(a, b) {
  const normalize = p => Array.isArray(p) ? p.map(normalize) : p && typeof p === "object" ?
    Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalize(v)])) : p;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
export function hasWorkflow(record = {}) {
  return Object.entries(record).some(([k, v]) => k === "status" ? v !== "Not applied" : k === "favorite" ? v === true : !!v);
}
export function collectRows(workspace) {
  const rows = [
    ...workspace.snapshot.leads.map(job => ({ section: "Active", job })),
    ...workspace.snapshot.hidden.map(job => ({ section: "Hidden", job })),
    ...workspace.snapshot.archived.map(job => ({ section: "Archived", job }))
  ];
  const known = new Set(rows.map(x => x.job.job_id));
  for (const job of Object.values(workspace.userState.retainedJobs || {})) {
    if (!known.has(job.job_id)) rows.push({ section: "Retained history", job });
  }
  return rows;
}
export const CSV_COLUMNS = ["section", "job_id", "company", "role", "category", "fit", "score", "chance", "urgency", "resume", "pay", "pay_min", "date_posted", "workplace", "travel", "gaps", "improve", "status", "favorite", "nextAction", "nextActionDate", "contact", "appliedAt", "notes", "verification", "url", "hidden_because", "csv_format_version", "formula_escaped_fields"];
const formulaLike = value => /^[\s\u0000-\u001f]*[=+\-@]/.test(value);
const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
export function exportCsv(workspace) {
  const rows = collectRows(workspace).map(({ section, job }) => {
    const record = workspace.userState.jobs[job.job_id] || {};
    const escaped = [];
    const cells = CSV_COLUMNS.map(k => {
      let v = k === "section" ? section : k === "csv_format_version" ? "3" : k === "formula_escaped_fields" ? "" :
        WORKFLOW_FIELDS.includes(k) && hasOwn(record, k) ? record[k] : job[k];
      if (Array.isArray(v)) v = v.join(" | ");
      let s = String(v ?? "");
      if (formulaLike(s)) { escaped.push(k); s = `'${s}`; }
      return s;
    });
    cells[CSV_COLUMNS.indexOf("formula_escaped_fields")] = escaped.join("|");
    return cells.map(csvCell).join(",");
  });
  return "\uFEFF" + [CSV_COLUMNS.map(csvCell).join(","), ...rows].join("\r\n");
}
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = []; let row = [], cell = "", quoted = false, afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else cell += c;
    } else if (c === '"' && cell === "" && !afterQuote) quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; afterQuote = false; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row);
      row = []; cell = ""; afterQuote = false;
    } else {
      demand(!afterQuote, "Malformed CSV after a closing quote.");
      cell += c;
    }
  }
  demand(!quoted, "CSV contains an unclosed quote.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift() || [];
  demand(header.includes("job_id") && new Set(header).size === header.length, "CSV needs a unique job_id header.");
  return rows.map(r => {
    demand(r.length === header.length, "CSV row width does not match its header.");
    const result = Object.fromEntries(header.map((h, i) => [h, r[i]]));
    if (result.csv_format_version === "3") {
      for (const key of (result.formula_escaped_fields || "").split("|").filter(Boolean)) {
        demand(header.includes(key), "Invalid escaped-field marker.");
        if (result[key].startsWith("'") && formulaLike(result[key].slice(1))) result[key] = result[key].slice(1);
      }
    }
    return result;
  });
}
export function planImport(current, text, filename, { overwrite = false, importProfile = false } = {}) {
  demand(typeof text === "string" && text.length <= 4_000_000, "Import exceeds the size limit.");
  const next = clone(current); let incomingSnapshot, incomingState, kind, warnings = [];
  if (/\.csv$/i.test(filename)) {
    const jobs = {}; const seen = new Set();
    for (const row of parseCsv(text)) {
      demand(row.job_id && !forbiddenKeys.has(row.job_id) && !seen.has(row.job_id), "CSV stable IDs must be nonempty, safe and unique.");
      seen.add(row.job_id);
      const fields = {};
      for (const k of WORKFLOW_FIELDS) if (hasOwn(row, k)) {
        if (k === "favorite") {
          demand(["", "true", "false"].includes(row[k]), "Invalid saved-job flag in CSV.");
          if (row[k] !== "") fields[k] = row[k] === "true";
        } else if (k !== "status" || row[k] !== "") fields[k] = row[k];
      }
      jobs[row.job_id] = normalizeWorkflow(fields);
    }
    incomingState = { jobs }; kind = "CSV workflow";
  } else {
    let data;
    try { data = JSON.parse(text); } catch { throw new ValidationError("The file is not valid JSON."); }
    inspectKeys(data);
    if (data.schema_version && data.leads) { incomingSnapshot = data; kind = "Research snapshot"; }
    else if (data.snapshot && data.userState) { incomingSnapshot = data.snapshot; incomingState = data.userState; kind = "Portable backup"; }
    else if ((data.userState || data).jobs) { incomingState = data.userState || data; kind = "Legacy workflow"; }
    else throw new ValidationError("Choose a result snapshot, portable backup, workflow JSON or CSV, not a refresh request.");
  }
  let conflicts = 0, preserved = 0;
  if (incomingSnapshot) {
    validateSnapshot(incomingSnapshot);
    const newIds = new Set(allJobs(incomingSnapshot).map(j => j.job_id));
    const migrations = incomingSnapshot.id_migrations || [];
    const migratedIds = new Set();
    for (const m of migrations) {
      demand(m.old_job_id !== m.new_job_id && newIds.has(m.new_job_id), "Invalid ID migration target.");
      if (current.userState.jobs[m.old_job_id]) {
        next.userState.jobs[m.new_job_id] = { ...clone(current.userState.jobs[m.old_job_id]), ...(next.userState.jobs[m.new_job_id] || {}) };
        delete next.userState.retainedJobs[m.old_job_id];
        migratedIds.add(m.old_job_id);
      }
    }
    for (const { job } of collectRows(current)) {
      if (!newIds.has(job.job_id) && !migratedIds.has(job.job_id) && hasWorkflow(next.userState.jobs[job.job_id])) {
        next.userState.retainedJobs[job.job_id] = clone(job);
        preserved++;
      }
    }
    next.snapshot = clone(incomingSnapshot);
    if (incomingSnapshot.generator !== "Perplexity") warnings.push("Imported legacy research: labels and scores are not newly verified.");
    if (incomingSnapshot.run_status === "partial") warnings.push("The imported run is partial; review its source failures.");
  }
  if (incomingState) {
    const normalized = normalizeState({ ...incomingState, profile: incomingState.profile || next.userState.profile, jobs: incomingState.jobs || {} }, next.snapshot);
    for (const [id, fields] of Object.entries(normalized.jobs)) {
      const existing = next.userState.jobs[id] || {};
      for (const [k, v] of Object.entries(fields)) if (hasOwn(existing, k) && existing[k] !== v) conflicts++;
      next.userState.jobs[id] = overwrite ? { ...existing, ...fields } : { ...fields, ...existing };
    }
    next.userState.retainedJobs = { ...normalized.retainedJobs, ...next.userState.retainedJobs };
    if (importProfile && incomingState.profile) {
      next.userState.profile = clone(normalized.profile);
      next.userState.profileUpdatedAt = new Date().toISOString();
    }
  }
  if (importProfile && incomingSnapshot && !incomingState?.profile) {
    next.userState.profile = clone(incomingSnapshot.profile);
    next.userState.profile.projectPlatform = "Perplexity";
    next.userState.profile.experienceContext ||= PLATFORM_CONTEXT;
    next.userState.profileUpdatedAt = new Date().toISOString();
  }
  next.userState.profileDirty = !profileEquivalent(next.userState.profile, next.snapshot.profile);
  normalizeState(next.userState, next.snapshot);
  return { workspace: next, summary: { kind, leads: next.snapshot.leads.length, hidden: next.snapshot.hidden.length, archived: next.snapshot.archived.length, conflicts, retained: preserved, overwrite, warnings } };
}
export function makeRequest(workspace, contract) {
  const state = workspace.userState, d = workspace.snapshot;
  const request = {
    schemaVersion: "2.0", provider: "Perplexity", action: "refresh_job_tracker", requestedAt: new Date().toISOString(),
    basedOnSnapshot: { generated: d.generated, activeCount: d.leads.length, hiddenCount: d.hidden.length },
    profile: clone(state.profile),
    resumeHandling: { descriptors: clone(state.profile.resumes), instruction: "Actual files must be supplied directly to Perplexity. Verify fingerprints when present. Do not infer qualifications from descriptors or reuse evidence across resumes.", contentsIncluded: false },
    priorWorkflow: Object.entries(state.jobs).map(([jobId, fields]) => ({ jobId, ...fields })),
    priorSnapshot: clone(d),
    retainedHistory: clone(state.retainedJobs || {}),
    agentRequirements: {
      searchAllConfiguredSources: true, preferEmployerPosting: true, verifyDirectUrlAndAvailability: true,
      deduplicateBy: ["canonical employer URL", "source plus immutable job ID", "normalized company, title and location"],
      preserveWorkflowByJobId: true, archiveOnlyAfterRecheck: true, recordExclusionReason: true,
      separateEmployerPayFromEstimate: true, scoreAgainstAssignedResume: true, returnStructuredChecklist: true,
      neverSilentlyRescoreOldSnapshot: true, doNotInventOfferProbabilities: true, noAutomaticApplications: true
    },
    outputContract: contract,
    outputSchema: clone(schema)
  };
  demand(requestCheck(request), schemaError("Invalid refresh request", requestCheck));
  return request;
}
export function makePrompt(workspace) {
  const p = workspace.userState.profile;
  return [
    "Refresh my private job tracker using the attached request JSON and the actual resume documents I attach to this Perplexity conversation.",
    `Current profile: ${p.name}, version ${p.version}. Location: ${p.location}. Posted annual base floor: USD ${p.salaryFloor}. Workplace: ${p.remotePolicy}; maximum stated travel ${p.maxTravelPercent}%.`,
    `Current project-building platform: Perplexity. ${p.experienceContext || PLATFORM_CONTEXT}`,
    "Use Perplexity's available research and file tools. No Microsoft Copilot Studio connector, Power Automate flow or API key is assumed or requested.",
    "Read the full outputContract and outputSchema inside the request. Search configured sources, inspect employer postings, record dated evidence and source failures, and never treat an unavailable source as zero results.",
    "The imported snapshot is historical. Recheck original URLs before archiving anything; preserve unknown or blocked availability rather than calling it closed.",
    "Do not fabricate qualifications, score components, salary periods, state eligibility, applicant counts, hiring urgency, interview speed or an 80% offer probability. Legacy readiness labels are not calibrated probabilities.",
    "Use only the actual attached resume assigned to each role. Descriptors and fingerprints are not resume contents; report missing files before scoring.",
    "Preserve my statuses, favorites, notes, contacts and dates by stable job_id, including tracked jobs omitted from new results. Document ID migrations explicitly.",
    "Return one complete JSON research snapshot matching outputSchema with generator set to Perplexity. Do not return an HTML file, submit applications, contact employers or publish my data.",
    "I will preview and import the returned JSON in the tracker. Changing profile parameters alone must not rescore historical results."
  ].join("\n\n");
}
export function makeExport(kind, workspace, contract) {
  if (kind === "csv") return { body: exportCsv(workspace), type: "text/csv; charset=utf-8", filename: "job-tracker-workflow.csv" };
  const value = kind === "request" ? makeRequest(workspace, contract) :
    kind === "state" ? { schemaVersion: "3.0", provider: "Perplexity", exportedAt: new Date().toISOString(), snapshot: workspace.snapshot, userState: workspace.userState } : null;
  demand(value, "Unknown export format.");
  return { body: JSON.stringify(value, null, 2), type: "application/json; charset=utf-8", filename: kind === "request" ? "perplexity-job-tracker-request.json" : "job-tracker-backup.json" };
}
