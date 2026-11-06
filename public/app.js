const rawApiBase = window.__API_BASE__ || "__PORT_5001__";
const API_BASE = rawApiBase.startsWith("__PORT_") ? "" : rawApiBase.replace(/\/$/, "");
const $ = id => document.getElementById(id);
const clone = x => JSON.parse(JSON.stringify(x));
const esc = x => String(x ?? "Not stated").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const canonical = x => JSON.stringify(sortObject(x));
function sortObject(x) { return Array.isArray(x) ? x.map(sortObject) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sortObject(x[k])])) : x; }
const STATUSES = ["Not applied", "Interested", "Applied", "Interviewing", "Offer", "Rejected", "Archived"];
const STAGES = ["Interested", "Applied", "Interviewing", "Offer", "Rejected"];
const WEIGHTS = { track: "Track alignment", remote: "Remote eligibility", seniority: "Seniority", duties: "Duties", qualifications: "Qualifications", salary: "Salary transparency", recency: "Recency", stability: "Stability evidence" };
let workspace, editEpoch = 0, savedEpoch = 0, saveTimer, inFlight, saveProblem;
let pendingResumes = [], pendingImport, importToken;
let controlSequence = 0;
const ui = { tab: "active", filter: "all", query: "", sort: "score", view: "cards", resume: "", selectedJobId: null };

async function apiRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(API_BASE + path, {
    method, credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let result;
  try { result = await response.json(); } catch { throw new Error("The server returned an unreadable response. Your draft is still on this page."); }
  if (!response.ok) throw Object.assign(new Error(result.message || "The request failed."), { status: response.status });
  return result;
}
function stampIds() {
  document.querySelectorAll("button,a,input,select,textarea,[role=status],[role=alert],h1").forEach((e, i) => {
    if (!e.dataset.testid) {
      const key = e.id || (e.dataset.field ? `field-${e.dataset.field}-${e.dataset.id}` :
        e.dataset.action ? `${e.dataset.action}-${e.dataset.id || e.closest("dialog")?.id || i}` :
        e.dataset.filter ? `filter-${e.dataset.filter}-${e.closest("section")?.id || "chips"}` :
        e.dataset.export ? `export-${e.dataset.export}-${e.closest("dialog,section")?.id || i}` :
        e.dataset.openJob ? `open-${e.closest('[role=tabpanel]')?.id || "workspace"}-${e.dataset.openJob}` : `control-${++controlSequence}`);
      e.dataset.testid = key;
    }
  });
}
function showDialog(id) { if (!$(id).open) $(id).showModal(); stampIds(); }
function toast(message) {
  $("toast").textContent = message; $("toast").classList.add("on");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $("toast").classList.remove("on"), 2600);
}
function safeUrl(value) {
  try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
const postingLink = (job, label = "Open posting") => safeUrl(job.url) ? `<a class="button" href="${esc(safeUrl(job.url))}" target="_blank" rel="noopener noreferrer" data-testid="posting-${esc(job.job_id)}">${esc(label)}</a>` : '<span class="small">No safe posting URL</span>';
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function age(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  return Math.round((Date.parse(`${today()}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
}
function freshness(job) {
  const date = (job.verified_at || job.verification || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || workspace.snapshot.generated;
  const days = age(date), stale = days === null || days < 0 || days > workspace.userState.profile.staleAfterDays;
  return { stale, text: days === null ? "Check date unknown" : days < 0 ? "Future check date needs review" : `Reported check ${days === 0 ? "today" : `${days} days ago`}${stale ? "; recheck" : ""}` };
}
function rows() {
  const d = workspace.snapshot;
  const result = [...d.leads.map(job => ({ job, section: "Active" })), ...d.hidden.map(job => ({ job, section: "Hidden" })), ...d.archived.map(job => ({ job, section: "Archived" }))];
  const known = new Set(result.map(x => x.job.job_id));
  for (const job of Object.values(workspace.userState.retainedJobs || {})) if (!known.has(job.job_id)) result.push({ job, section: "Retained history" });
  return result;
}
const jobById = id => rows().find(r => r.job.job_id === id)?.job;
const record = id => workspace.userState.jobs[id] || {};
function value(job, key) { const r = record(job.job_id); return own(r, key) ? r[key] : own(job.workflow, key) ? job.workflow[key] : job[key]; }
function status(job) { const s = value(job, "status"); return STATUSES.includes(s) ? s : "Not applied"; }
function isDue(job) { const d = value(job, "nextActionDate"); return !!d && d <= today() && !["Offer", "Rejected", "Archived"].includes(status(job)); }
const FILTERS = {
  all: () => true, apply: j => j.apply_first === "Yes", strong: j => j.fit === "Strong match",
  high: j => j.chance === "High", audit: j => j.category === "Audit / SOX", accounting: j => j.category === "Accounting",
  favorites: j => !!value(j, "favorite"), pipeline: j => !["Not applied", "Rejected", "Archived"].includes(status(j)), due: isDue
};
const LABELS = { all: "All leads", apply: "Apply first", strong: "Strong fit label", high: "High readiness label", audit: "Internal audit", accounting: "Accounting", favorites: "Saved", pipeline: "My pipeline", due: "Actions due" };
function matches(job) {
  const text = [job.company, job.role, job.job_id, job.duties, job.quals, job.gaps, job.improve, job.watch, job.research, job.resume, value(job, "notes"), value(job, "contact")].join(" ").toLowerCase();
  return (!ui.query || text.includes(ui.query)) && (!ui.resume || job.resume === ui.resume);
}
function sorted(items) {
  const rank = x => ({ High: 3, Medium: 2, Low: 1 }[x] || 0);
  const comparisons = {
    score: (a, b) => (b.job.score || 0) - (a.job.score || 0),
    chance: (a, b) => rank(b.job.chance) - rank(a.job.chance),
    urgency: (a, b) => rank(b.job.urgency) - rank(a.job.urgency),
    date: (a, b) => String(b.job.date_posted || "").localeCompare(String(a.job.date_posted || "")),
    pay: (a, b) => (b.job.pay_min || 0) - (a.job.pay_min || 0),
    company: (a, b) => a.job.company.localeCompare(b.job.company),
    nextAction: (a, b) => String(value(a.job, "nextActionDate") || "9999").localeCompare(String(value(b.job, "nextActionDate") || "9999"))
  };
  return [...items].sort((a, b) => comparisons[ui.sort](a, b) || a.job.company.localeCompare(b.job.company));
}
function visibleRows() {
  const base = ["favorites", "pipeline", "due"].includes(ui.filter) ? rows() : rows().filter(r => r.section === "Active");
  return sorted(base.filter(({ job }) => FILTERS[ui.filter](job) && matches(job)));
}
function saveIndicator(text, error = false) { $("saveStatus").textContent = text; $("saveStatus").style.color = error ? "var(--bad)" : ""; }
function showSaveProblem(error) {
  saveProblem = error; $("saveFailure").hidden = false; $("saveError").textContent = error.message;
  saveIndicator(error.status === 409 ? "Draft conflict" : "Not saved", true);
}
function changed() {
  editEpoch++; saveIndicator("Unsaved changes");
  clearTimeout(saveTimer); saveTimer = setTimeout(() => flush().catch(() => {}), 250);
}
async function flush({ retry = false } = {}) {
  clearTimeout(saveTimer);
  if (retry) saveProblem = null;
  if (saveProblem) throw saveProblem;
  while (editEpoch > savedEpoch) {
    if (inFlight) { await inFlight; continue; }
    const captureEpoch = editEpoch, draft = clone(workspace);
    saveIndicator("Saving…");
    inFlight = apiRequest("/api/workspace", { method: "PUT", body: draft })
      .then(result => {
        workspace.revision = result.revision; workspace.updatedAt = result.updatedAt; savedEpoch = captureEpoch;
        $("saveFailure").hidden = true;
        saveIndicator(savedEpoch === editEpoch ? "Saved to workspace" : "Saving…");
      })
      .catch(error => { showSaveProblem(error); throw error; })
      .finally(() => { inFlight = null; });
    await inFlight;
  }
}
async function loadWorkspace() {
  $("loadFailure").hidden = true; $("loadState").hidden = false; $("appContent").hidden = true;
  try {
    const next = await apiRequest("/api/workspace");
    workspace = next; editEpoch = savedEpoch = 0; saveProblem = null; inFlight = null;
    $("saveFailure").hidden = true; $("loadState").hidden = true; $("appContent").hidden = false;
    saveIndicator("Saved to workspace"); renderAll();
  } catch (error) {
    $("loadState").hidden = true; $("loadFailure").hidden = false; $("loadError").textContent = error.message;
    saveIndicator("Not connected", true);
  }
}
function renderHeader() {
  const d = workspace.snapshot, p = workspace.userState.profile;
  $("trackerTitle").textContent = p.name;
  $("summary").textContent = `${d.leads.length} dated leads, ${d.hidden.length} hidden by rules. Research snapshot ${d.generated}; not live availability.`;
  $("snapshotMeta").innerHTML = [
    `Snapshot <strong>${esc(d.generated)}</strong>`, `Profile <strong>v${esc(p.version)}</strong>`,
    `<strong>${esc(p.remotePolicy === "fully_remote" ? "Fully remote only" : p.remotePolicy.replaceAll("_", " "))}</strong>`,
    `Next-search floor <strong>${esc(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p.salaryFloor))}</strong>`,
    `<strong>${p.resumes.length}</strong> resume descriptors`
  ].map(x => `<span>${x}</span>`).join("");
  $("demoNotice").hidden = !workspace.meta?.demo;
  $("dirtyNotice").hidden = !workspace.userState.profileDirty;
  const days = age(d.generated);
  $("freshnessNote").textContent = days === null || days < 0 ? "The snapshot date needs review." : `Snapshot is ${days} days old${days > p.staleAfterDays ? "; current availability needs rechecking." : "."}`;
}
function renderKpis() {
  const all = rows().map(r => r.job), d = workspace.snapshot;
  const entries = [["All leads", d.leads.length, "all"], ["Apply first", d.leads.filter(FILTERS.apply).length, "apply"], ["Strong label", d.leads.filter(FILTERS.strong).length, "strong"], ["High readiness", d.leads.filter(FILTERS.high).length, "high"], ["My pipeline", all.filter(FILTERS.pipeline).length, "pipeline"], ["Actions due", all.filter(isDue).length, "due"]];
  $("kpis").innerHTML = entries.map(([label, count, key]) => `<button type="button" class="kpi ${ui.filter === key ? "on" : ""}" data-filter="${key}" aria-pressed="${ui.filter === key}"><span>${label}</span><b>${count}</b></button>`).join("");
}
function renderFilters() {
  $("chips").innerHTML = ["audit", "accounting", "favorites"].map(key => `<button type="button" data-filter="${key}" class="chip ${ui.filter === key ? "on" : ""}" aria-pressed="${ui.filter === key}">${LABELS[key]}</button>`).join("");
  const aliases = [...new Set(rows().map(r => r.job.resume).filter(Boolean))];
  $("resumeFilter").innerHTML = '<option value="">All resumes</option>' + aliases.map(a => `<option value="${esc(a)}"${a === ui.resume ? " selected" : ""}>${esc(a)}</option>`).join("");
  $("sort").value = ui.sort; $("search").value = ui.query; $("viewToggle").textContent = ui.view === "cards" ? "Table view" : "Card view";
  $("filterOptionsBtn").textContent = `Filters & views${ui.resume || ["audit", "accounting", "favorites"].includes(ui.filter) ? " · active" : ""}`;
}
function statusSelect(job) {
  return `<select data-field="status" data-id="${esc(job.job_id)}" aria-label="Application status for ${esc(job.company)}">${STATUSES.map(s => `<option${status(job) === s ? " selected" : ""}>${s}</option>`).join("")}</select>`;
}
function fact(label, text) { return `<div class="fact"><b>${esc(label)}</b><div>${esc(text)}</div></div>`; }
function workflowField(job, key, label, type = "text") {
  const id = `workflow-${key}-${job.job_id}`, v = value(job, key) || "";
  return `<div class="field ${key === "notes" ? "span2" : ""}"><label for="${esc(id)}">${label}</label>${type === "textarea" ?
    `<textarea id="${esc(id)}" data-field="${key}" data-id="${esc(job.job_id)}" maxlength="20000">${esc(v)}</textarea>` :
    `<input id="${esc(id)}" type="${type}" data-field="${key}" data-id="${esc(job.job_id)}" value="${esc(v)}" maxlength="2000">`}</div>`;
}
function card({ job: j, section }, index = 0) {
  const id = esc(j.job_id), legacy = workspace.snapshot.generator !== "Perplexity", fr = freshness(j), hidden = section !== "Active";
  const reqs = (j.checklist || []).map(c => `<tr><td>${esc(c[0] === "R" ? "Required" : "Preferred")}</td><td>${esc(c[1])}</td><td class="state-${esc(String(c[2]).replace(/[^a-z]/gi, ""))}">${esc(c[2])}</td><td>${esc(c[3] || "")}</td></tr>`).join("");
  const fields = [
    fact("Workplace / state restrictions", j.workplace), fact("Travel", j.travel), fact("Resume used for this snapshot", j.resume),
    fact("Published pay, check its period", j.pay), fact("Qualifications", j.quals), fact("Duties", j.duties),
    fact("Gaps to address", j.gaps), fact("Application angle", j.improve), fact("Watch for", j.watch),
    fact("Imported verification note", j.verification), fact("Source / stable job ID", `${j.source || "Not stated"} / ${j.job_id}`),
    ...(hidden ? [fact(section === "Retained history" ? "Retained history" : "Section / exclusion", j.hidden_because || j.reason || "Kept because it has application workflow; not proof of current availability.")] : [])
  ].join("");
  const evidence = (j.source_evidence || []).filter(e => safeUrl(e.url)).map(e => `<a href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener noreferrer">${esc(e.source || "Posting evidence")}</a>`).join(" · ");
  return `<details class="job" id="job-${id}" data-job-id="${id}"><summary><div class="jobhead"><span class="rank">${String(j.row || index + 1).padStart(2, "0")}</span><div>
    <div class="title">${esc(j.role)} <span class="company">/ ${esc(j.company)}</span></div>
    <div class="meta">${esc(j.pay || "Pay not stated")} · Posted ${esc(j.date_posted || "date unknown")} · <span class="${fr.stale ? "stale" : "fresh"}">${esc(fr.text)}</span></div>
    <div class="pillrow">${hidden ? `<span class="pill warn">${esc(section)}</span>` : `<span class="pill ${j.fit === "Strong match" ? "strong" : ""}">${esc(legacy ? "Imported fit" : "Fit")} ${esc(j.score)} / 100 · ${esc(j.fit)}</span><span class="pill">Readiness: ${esc(j.chance || "Unverified")}</span><span class="pill">Priority: ${esc(j.urgency || "Unverified")}</span>`}<span class="pill">${esc(j.category || "Not assigned")}</span><span class="pill">${esc(j.resume || "No resume assignment")}</span></div>
    </div><div class="jobactions"><button type="button" class="favorite ${value(j, "favorite") ? "on" : ""}" data-action="favorite" data-id="${id}" aria-pressed="${!!value(j, "favorite")}" aria-label="${value(j, "favorite") ? "Unsave" : "Save"} ${esc(j.company)}">${value(j, "favorite") ? "Saved" : "Save job"}</button>${statusSelect(j)}${postingLink(j)}</div></div></summary>
    <div class="details"><div class="grid">${fields}</div>${evidence ? `<div class="subpanel">${evidence}</div>` : ""}
    ${!hidden ? `<div class="subpanel"><h3>${legacy ? "Imported scoring explanation" : "Scoring evidence"}</h3><p>${esc((j.score_reasons || []).join(" · ") || "No component explanation was supplied.")}</p><p class="small">These are ${legacy ? "legacy" : "agent-reported"} fit/readiness labels, not an interview or offer probability.</p></div><div class="subpanel"><h3>Required and preferred qualification evidence</h3>${reqs ? `<div class="tablewrap"><table class="checklist"><thead><tr><th>Type</th><th>Requirement</th><th>Assessment</th><th>Recorded evidence</th></tr></thead><tbody>${reqs}</tbody></table></div>` : '<p class="small">A requirement checklist was not supplied.</p>'}</div><div class="subpanel"><h3>Imported priority signals, not a process guarantee</h3><p>${esc((j.urgency_evidence || []).join(" · ") || "No current role-specific interview duration has been verified by this app.")}</p><p class="small">Reported applicants: ${esc(j.applicants || "not stated")}. Reposts: ${esc(j.reposts || "not stated")}. Check original evidence before relying on these values.</p></div>` : ""}
    <div class="subpanel"><h3>Application workspace</h3><div class="workflow">${workflowField(j, "nextAction", "Next action")}${workflowField(j, "nextActionDate", "Due date", "date")}${workflowField(j, "contact", "Recruiter / contact")}${workflowField(j, "appliedAt", "Applied date", "date")}${workflowField(j, "notes", "Notes", "textarea")}</div><div class="inlineactions"><button type="button" data-action="copy-brief" data-id="${id}">Copy application brief</button><button type="button" data-action="copy-link" data-id="${id}">Copy posting URL</button></div></div></div></details>`;
}
function table(items) {
  return `<div class="tablewrap"><table class="datatable"><thead><tr>${["Company / role", "Fit", "Readiness", "Resume", "Pay", "Posted", "Status", "Next action", "Actions"].map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${items.map(({ job: j }) => `<tr><td><strong>${esc(j.company)}</strong><div>${esc(j.role)}</div></td><td>${esc(j.score ?? "n.a.")} / ${esc(j.fit || "Not scored")}</td><td>${esc(j.chance || "Unverified")}</td><td>${esc(j.resume || "Not assigned")}</td><td>${esc(j.pay || "Not stated")}</td><td>${esc(j.date_posted || "Not stated")}</td><td>${esc(status(j))}</td><td>${esc(value(j, "nextActionDate") || "Not set")}</td><td><button type="button" data-open-job="${esc(j.job_id)}">Details</button> ${postingLink(j, "Posting")}</td></tr>`).join("")}</tbody></table></div><p class="small">The table scrolls horizontally on narrow screens. Switch to cards to edit workflow.</p>`;
}
function renderActive() {
  const selected = ui.selectedJobId && rows().find(r => r.job.job_id === ui.selectedJobId && r.section !== "Active");
  const items = selected ? [selected] : visibleRows();
  $("resultCount").textContent = selected ? `${selected.section}: selected tracked job` :
    `${items.length} ${items.length === 1 ? "result" : "results"}${["favorites", "pipeline", "due"].includes(ui.filter) ? " across research and retained history" : ` of ${workspace.snapshot.leads.length} snapshot leads`}`;
  $("scoreWarning").textContent = workspace.userState.profileDirty ? "Imported scores use the earlier profile. Refresh required." : "Fit is an assessment, not hiring odds.";
  $("activeContent").innerHTML = items.length ? ui.view === "cards" ? `<div class="cards">${items.map(card).join("")}</div>` : table(items) : '<div class="empty"><p>No jobs match these filters.</p><p>Clear filters or review the hidden section. Profile changes require a verified refresh before results move between sections.</p><button type="button" data-action="clear">Clear filters</button></div>';
}
function renderPipeline() {
  const all = rows(), groups = STAGES.map(s => {
    const items = all.filter(r => status(r.job) === s && matches(r.job));
    return `<section class="column"><h2>${s} / ${items.length}</h2>${items.length ? items.map(({ job: j, section }) => `<div class="mini"><button type="button" data-open-job="${esc(j.job_id)}">${esc(j.company)} / ${esc(j.role)}</button><p class="small">${esc(section)} · ${esc(j.resume || "No assigned resume")}</p><p class="small ${isDue(j) ? "due" : ""}">${esc(value(j, "nextAction") || "No next action")}${value(j, "nextActionDate") ? ` / ${esc(value(j, "nextActionDate"))}` : ""}</p></div>`).join("") : '<p class="small">No tracked jobs at this stage.</p>'}</section>`;
  });
  $("pipelineContent").innerHTML = '<p class="source-note">Includes tracked hidden jobs and retained history. A missing search result never erases an application.</p><div class="board">' + groups.join("") + "</div>";
}
function renderHidden() {
  const items = sorted(rows().filter(r => r.section === "Hidden" && matches(r.job)));
  $("hiddenContent").innerHTML = `<div class="box"><h2>${items.length} hidden candidates</h2><p class="muted">Original exclusions are preserved. Editing parameters does not silently promote candidates or recheck their eligibility.</p></div><div class="cards">${items.map(card).join("")}</div>`;
}
function renderArchived() {
  const items = rows().filter(r => (r.section === "Archived" || status(r.job) === "Archived") && matches(r.job));
  $("archivedContent").innerHTML = items.length ? `<p class="source-note">User-archived workflow is not the same as an employer-confirmed closure. Source reasons are retained separately.</p><div class="cards">${items.map(card).join("")}</div>` : '<div class="empty"><p>No source-archived or user-archived jobs are recorded.</p><p>A listing should be marked closed only after its original URL is rechecked.</p></div>';
}
function renderResearch() {
  $("researchContent").innerHTML = `<div class="box"><h2>Imported research notes</h2><p class="source-note">These notes belong to the dated snapshot, not a new search performed by the app.</p><ul>${workspace.snapshot.research.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
}
function renderMethod() {
  const sources = workspace.snapshot.sources;
  const sections = [["searched", "Sources recorded as searched"], ["unavailable", "Recorded source failures"], ["groups", "Recorded queries"], ["rubric", "Imported scoring rubric"], ["labels", "Imported fit thresholds"], ["chance", "Original readiness rules, not calibrated odds"], ["urgency", "Original priority rules, not verified speed"], ["filters", "Filters at generation"]];
  $("methodContent").innerHTML = '<div class="box"><h2>Evidence boundaries</h2><p>Perplexity is the current refresh handoff. The app does not independently verify listings or execute a search in the background. Imported scores and old hiring signals remain historical until refreshed with current evidence.</p><p>Do not interpret readiness categories as an 80% offer probability. Do not infer a short interview-to-offer process from application-response anecdotes.</p></div>' +
    sections.map(([key, label]) => `<div class="box"><h3>${label}</h3><ul>${(sources[key] || []).map(t => `<li>${esc(t)}</li>`).join("") || "<li>No entries recorded.</li>"}</ul></div>`).join("");
}
function renderCurrent() {
  const opened = [...document.querySelectorAll("details.job[open]")].map(e => e.id);
  for (const tab of ["active", "pipeline", "hidden", "archived", "research", "method"]) {
    if (tab !== ui.tab) $(`${tab}Content`).replaceChildren();
  }
  ({ active: renderActive, pipeline: renderPipeline, hidden: renderHidden, archived: renderArchived, research: renderResearch, method: renderMethod })[ui.tab]();
  opened.forEach(id => { const e = document.getElementById(id); if (e) e.open = true; });
  stampIds();
}
function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab]").forEach(e => { const on = e.dataset.tab === tab; e.setAttribute("aria-selected", String(on)); e.tabIndex = on ? 0 : -1; $(e.getAttribute("aria-controls")).hidden = !on; });
  renderCurrent();
}
function renderAll() { renderHeader(); renderKpis(); renderFilters(); setTab(ui.tab); stampIds(); }
function clearFilters() { ui.filter = "all"; ui.query = ""; ui.resume = ""; ui.sort = "score"; ui.selectedJobId = null; setTab("active"); renderAll(); }
function updateJob(id, key, next) {
  const job = jobById(id); if (!job) return;
  const r = workspace.userState.jobs[id] ||= {};
  r[key] = next;
  if (key === "status" && next === "Applied" && !value(job, "appliedAt")) {
    r.appliedAt = today();
    const input = document.getElementById(`workflow-appliedAt-${id}`); if (input) input.value = r.appliedAt;
  }
  changed(); renderKpis(); stampIds();
}
function fillSettings() {
  const p = workspace.userState.profile;
  const ids = { profileName: "name", location: "location", remotePolicy: "remotePolicy", salaryFloor: "salaryFloor", maxTravel: "maxTravelPercent", postedDays: "postedWithinDays", minScore: "minimumScore", staleDays: "staleAfterDays", experienceContext: "experienceContext" };
  for (const [id, key] of Object.entries(ids)) $(id).value = p[key] ?? "";
  $("targetTitles").value = p.targetTitles.join("\n"); $("sources").value = p.sources.join("\n"); $("projectPlatform").value = "Perplexity";
  $("weights").innerHTML = Object.entries(WEIGHTS).map(([key, label]) => `<div class="field"><label for="w-${key}">${label}</label><input id="w-${key}" type="number" data-weight="${key}" min="0" max="100" step="1" required value="${p.weights[key]}"></div>`).join("");
  pendingResumes = clone(p.resumes); $("profileError").hidden = true; renderResumeList(); weightTotal(); stampIds();
}
function renderResumeList() {
  $("resumeList").innerHTML = pendingResumes.map((r, i) => `<div class="resume"><div class="resume-file small">${esc(r.fileName || "Legacy descriptor; actual file not included")}${r.sha256 ? `<br>SHA-256 ${esc(r.sha256)}` : " / fingerprint not recorded"}</div><div class="field"><label for="resume-alias-${i}">Resume alias</label><input id="resume-alias-${i}" data-resume-alias="${i}" value="${esc(r.alias)}" maxlength="160" required></div><div class="field"><label for="resume-track-${i}">Track</label><select id="resume-track-${i}" data-resume-track="${i}">${["Accounting", "Audit / SOX", "General"].map(t => `<option${r.track === t ? " selected" : ""}>${t}</option>`).join("")}</select></div><button type="button" data-remove-resume="${i}">Remove descriptor</button></div>`).join("") || '<p class="small">No descriptors. Add files here and supply the actual documents directly to Perplexity.</p>';
  stampIds();
}
function weightTotal() {
  const total = [...document.querySelectorAll("[data-weight]")].reduce((n, e) => n + Number(e.value), 0);
  $("weightTotal").textContent = `Total: ${total} / 100${total === 100 ? "" : "; adjust before saving"}`;
  $("weightTotal").style.color = total === 100 ? "var(--accent)" : "var(--bad)";
  return total;
}
async function addResumeFiles(files) {
  $("saveProfile").disabled = true;
  try {
    for (const f of files) {
      if (!/\.(pdf|docx?|txt|md)$/i.test(f.name) || f.size > 25_000_000) throw new Error("Use supported resume documents under 25 MB each.");
      if (!crypto.subtle) throw new Error("Fingerprinting requires a secure browser context. Add the documents directly to Perplexity instead.");
      const hash = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
      const sha256 = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
      if (pendingResumes.some(r => r.sha256 === sha256)) continue;
      const track = /audit|sox|control/i.test(f.name) ? "Audit / SOX" : /consult|enablement/i.test(f.name) ? "General" : "Accounting";
      const legacyIndex = pendingResumes.findIndex(r => !r.fileName && r.track === track);
      let alias = legacyIndex >= 0 ? pendingResumes[legacyIndex].alias : f.name.replace(/\.[^.]+$/, "");
      if (legacyIndex < 0 && pendingResumes.some(r => r.alias === alias)) alias += ` (${pendingResumes.length + 1})`;
      const descriptor = { id: `resume-${sha256.slice(0, 16)}`, alias, fileName: f.name, size: f.size, mimeType: f.type || "application/octet-stream", lastModified: new Date(f.lastModified).toISOString(), sha256, track, contentStored: false };
      if (legacyIndex >= 0) pendingResumes[legacyIndex] = descriptor; else pendingResumes.push(descriptor);
    }
    renderResumeList(); $("profileError").hidden = true;
  } catch (error) { $("profileError").textContent = error.message; $("profileError").hidden = false; }
  finally { $("saveProfile").disabled = false; $("resumeFiles").value = ""; }
}
async function saveSettings(event) {
  event.preventDefault();
  if (weightTotal() !== 100) { $("profileError").textContent = "The eight scoring weights must total exactly 100."; $("profileError").hidden = false; return; }
  const current = workspace.userState.profile;
  const lines = id => $(id).value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const next = {
    ...clone(current), name: $("profileName").value.trim(), location: $("location").value.trim(), remotePolicy: $("remotePolicy").value,
    salaryFloor: Number($("salaryFloor").value), maxTravelPercent: Number($("maxTravel").value), postedWithinDays: Number($("postedDays").value),
    minimumScore: Number($("minScore").value), staleAfterDays: Number($("staleDays").value), targetTitles: lines("targetTitles"), sources: lines("sources"),
    projectPlatform: "Perplexity", experienceContext: $("experienceContext").value.trim(),
    weights: Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, Number($(`w-${k}`).value)])), resumes: clone(pendingResumes)
  };
  if (canonical(next) === canonical(current)) { $("settingsDialog").close(); toast("Profile unchanged; version preserved."); return; }
  next.version = String((parseInt(current.version) || 1) + 1);
  $("saveProfile").disabled = true;
  try {
    await apiRequest("/api/profile/validate", { method: "POST", body: { profile: next } });
    workspace.userState.profile = next; workspace.userState.profileDirty = true; workspace.userState.profileUpdatedAt = new Date().toISOString();
    changed(); await flush(); $("settingsDialog").close(); renderAll(); toast("Profile saved. Historical scores are unchanged.");
  } catch (error) { $("profileError").textContent = error.message; $("profileError").hidden = false; }
  finally { $("saveProfile").disabled = false; }
}
async function prepareRefresh() {
  if (!workspace) return;
  $("refreshPrompt").value = "Preparing your current draft…"; $("refreshCopyStatus").textContent = ""; showDialog("refreshDialog");
  try {
    const result = await apiRequest("/api/refresh", { method: "POST", body: { draft: clone(workspace) } });
    $("refreshPrompt").value = result.prompt;
    $("refreshResumes").textContent = `${result.descriptorCount} descriptors are listed. Attach the actual corresponding resume documents directly to Perplexity; filenames and hashes do not prove qualifications.`;
  } catch (error) { $("refreshPrompt").value = error.message; $("refreshCopyStatus").textContent = "Request preparation failed. Retry after checking the workspace connection."; }
}
async function copyFrom(textareaId, statusId) {
  const text = $(textareaId).value;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text); $(statusId).textContent = "Copied.";
  } catch {
    $(textareaId).focus(); $(textareaId).select(); $(statusId).textContent = "Clipboard access is blocked here. Text is selected; press Ctrl/Cmd+C.";
  }
}
function showCopy(text) { $("copyText").value = text; $("copyStatus").textContent = "Copy or select the text and press Ctrl/Cmd+C."; showDialog("copyDialog"); }
async function exportAction(kind) {
  if (!workspace) return;
  $("exportStatus").textContent = "Preparing private download…";
  try {
    const output = await apiRequest("/api/exports", { method: "POST", body: { kind, draft: clone(workspace) } });
    const a = document.createElement("a");
    a.href = API_BASE + output.path; a.download = output.filename; a.rel = "noopener noreferrer"; a.dataset.testid = "prepared-download";
    document.querySelectorAll(".download-ready").forEach(e => e.remove());
    const ready = document.createElement("p"); ready.className = "download-ready small";
    ready.append("If the download does not start, ");
    const fallback = a.cloneNode(true); fallback.textContent = `download ${output.filename}`;
    fallback.dataset.testid = "download-fallback"; ready.append(fallback, ". This private link expires shortly.");
    (document.querySelector("dialog[open] .dialogbody") || $("appContent")).append(ready);
    document.body.append(a); a.click(); a.remove();
    $("exportStatus").textContent = "Download prepared. Keep exported notes and contacts private."; toast("Private export prepared.");
  } catch (error) { $("exportStatus").textContent = error.message; toast(`Export failed: ${error.message}`); }
}
async function previewImport() {
  if (!pendingImport) return;
  importToken = null; $("confirmImport").disabled = true; $("importError").hidden = true; $("importPlan").textContent = "Validating without changing saved data…";
  try {
    await flush();
    const plan = await apiRequest("/api/import/preview", {
      method: "POST", body: { ...pendingImport, revision: workspace.revision, overwrite: $("overwriteWorkflow").checked, importProfile: $("importProfile").checked }
    });
    importToken = plan.token;
    $("importPlan").innerHTML = `<h3>${esc(plan.kind)}</h3><p>${plan.leads} leads / ${plan.hidden} hidden / ${plan.archived} source-archived.</p><p>${plan.retained} tracked omitted records retained. ${plan.conflicts} conflicting workflow fields ${plan.overwrite ? "will use imported values" : "will keep current values"}.</p>${plan.warnings.map(w => `<p class="stale">${esc(w)}</p>`).join("")}<p class="small">Nothing changes until you apply this validated import.</p>`;
    $("confirmImport").disabled = false;
  } catch (error) { $("importPlan").textContent = "Import was not applied."; $("importError").textContent = error.message; $("importError").hidden = false; }
}
async function importFile(file) {
  if (file.size > 4_000_000) { toast("Import is limited to 4 MB."); return; }
  pendingImport = { filename: file.name, text: await file.text() };
  $("importFilename").textContent = file.name; $("overwriteWorkflow").checked = false; $("importProfile").checked = false;
  showDialog("importDialog"); await previewImport();
}
async function confirmImport() {
  if (!importToken) return;
  $("confirmImport").disabled = true;
  try {
    workspace = await apiRequest(`/api/import/${importToken}`, { method: "POST", body: {} });
    editEpoch = savedEpoch = 0; saveProblem = null; pendingImport = null; importToken = null;
    $("importDialog").close(); saveIndicator("Saved to workspace"); clearFilters(); toast("Import applied; current workflow preserved.");
  } catch (error) { $("importError").textContent = error.message; $("importError").hidden = false; }
}
function openJob(id) {
  const item = rows().find(r => r.job.job_id === id);
  ui.filter = "all"; ui.query = ""; ui.resume = ""; ui.view = "cards";
  ui.selectedJobId = item && item.section !== "Active" ? id : null;
  setTab("active"); renderAll();
  const element = document.getElementById(`job-${id}`);
  if (element) { element.open = true; element.scrollIntoView({ block: "start" }); element.querySelector("summary").focus(); }
  stampIds();
}

document.addEventListener("click", event => {
  const el = event.target.closest("button,a"); if (!el) return;
  if (el.dataset.filter) { ui.filter = el.dataset.filter; ui.selectedJobId = null; setTab("active"); renderAll(); return; }
  if (el.dataset.tab) { ui.selectedJobId = null; setTab(el.dataset.tab); return; }
  if (el.dataset.close) { $(el.dataset.close).close(); return; }
  if (el.dataset.export) { exportAction(el.dataset.export); return; }
  if (el.hasAttribute("data-open-refresh")) { prepareRefresh(); return; }
  if (el.dataset.openJob) { event.preventDefault(); openJob(el.dataset.openJob); return; }
  if (el.hasAttribute("data-remove-resume")) { pendingResumes.splice(Number(el.dataset.removeResume), 1); renderResumeList(); return; }
  if (el.dataset.action) {
    event.preventDefault();
    if (el.dataset.action === "clear") { clearFilters(); return; }
    const job = jobById(el.dataset.id); if (!job) return;
    if (el.dataset.action === "favorite") { updateJob(job.job_id, "favorite", !value(job, "favorite")); renderAll(); }
    else if (el.dataset.action === "copy-link") showCopy(safeUrl(job.url) || "No safe posting URL.");
    else if (el.dataset.action === "copy-brief") showCopy([
      `${job.company} / ${job.role}`, `Imported fit: ${job.fit || "Not scored"} (${job.score ?? "n.a."}/100); not an offer probability.`,
      `Resume: ${job.resume || "Not assigned"}`, `Gaps: ${job.gaps || "Not stated"}`, `Application angle: ${job.improve || "Not stated"}`,
      `Watch: ${job.watch || "Not stated"}`, `Posting: ${safeUrl(job.url) || "Not stated"}`
    ].join("\n\n"));
  }
});
document.addEventListener("change", event => {
  const e = event.target;
  if (e.dataset.field) { updateJob(e.dataset.id, e.dataset.field, e.value); if (e.dataset.field === "status") renderCurrent(); }
  if (e.hasAttribute("data-resume-alias")) pendingResumes[Number(e.dataset.resumeAlias)].alias = e.value.trim();
  if (e.hasAttribute("data-resume-track")) pendingResumes[Number(e.dataset.resumeTrack)].track = e.value;
  if (e.hasAttribute("data-weight")) weightTotal();
});
document.addEventListener("input", event => {
  const e = event.target;
  if (e.dataset.field && e.dataset.field !== "status") updateJob(e.dataset.id, e.dataset.field, e.value);
  if (e.hasAttribute("data-weight")) weightTotal();
  if (e.hasAttribute("data-resume-alias")) pendingResumes[Number(e.dataset.resumeAlias)].alias = e.value.trim();
});
document.addEventListener("keydown", event => {
  if (!event.target.dataset.tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll("[data-tab]")], index = tabs.indexOf(event.target);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
    (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  setTab(tabs[next].dataset.tab); tabs[next].focus();
});
$("search").addEventListener("input", e => { ui.query = e.target.value.toLowerCase(); ui.selectedJobId = null; renderCurrent(); });
$("sort").addEventListener("change", e => { ui.sort = e.target.value; renderCurrent(); });
$("resumeFilter").addEventListener("change", e => { ui.resume = e.target.value; ui.selectedJobId = null; renderCurrent(); });
$("viewToggle").onclick = () => { ui.view = ui.view === "cards" ? "table" : "cards"; setTab("active"); renderAll(); };
$("filterOptionsBtn").onclick = () => {
  const next = $("filterOptionsBtn").getAttribute("aria-expanded") !== "true";
  $("filterOptionsBtn").setAttribute("aria-expanded", String(next));
  document.querySelector(".toolbar").classList.toggle("expanded", next);
};
$("clearFilters").onclick = clearFilters;
$("settingsBtn").onclick = () => { fillSettings(); showDialog("settingsDialog"); };
$("settingsForm").addEventListener("submit", saveSettings);
$("resetProfile").onclick = fillSettings;
$("resumeFiles").onchange = e => addResumeFiles(e.target.files);
$("refreshBtn").onclick = prepareRefresh;
$("copyRefresh").onclick = () => copyFrom("refreshPrompt", "refreshCopyStatus");
$("exportMenuBtn").onclick = () => { $("exportStatus").textContent = ""; showDialog("exportDialog"); };
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = e => { const file = e.target.files[0]; if (file) importFile(file).catch(error => toast(error.message)); e.target.value = ""; };
$("overwriteWorkflow").onchange = previewImport;
$("importProfile").onchange = previewImport;
$("confirmImport").onclick = confirmImport;
$("copyAgain").onclick = () => copyFrom("copyText", "copyStatus");
$("selectCopy").onclick = () => { $("copyText").focus(); $("copyText").select(); $("copyStatus").textContent = "Text selected. Press Ctrl/Cmd+C."; };
$("retryLoad").onclick = loadWorkspace;
$("retrySave").onclick = () => flush({ retry: true }).catch(() => {});
$("reloadBtn").onclick = () => { if (workspace && editEpoch > savedEpoch) showDialog("reloadDialog"); else loadWorkspace(); };
$("confirmReload").onclick = () => { $("reloadDialog").close(); loadWorkspace(); };
stampIds();
loadWorkspace();
