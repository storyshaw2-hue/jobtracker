import {
  freshJobs,
  selectJobs,
  sampleCsv,
  STAGES,
  FILTER_FIELDS,
  FILTER_DEFAULTS,
} from "./model.js";
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let jobs = freshJobs(),
  state = {
    ...FILTER_DEFAULTS,
    sort: "company",
    view: "cards",
    tab: "jobs",
  },
  downloadUrl;
const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
function card(j, index) {
  const facts = [
    ["Experience / job type", `${j.level} · ${j.employment}`],
    ["Sample industry", j.industry],
    ["Sample location scope", j.region],
    [
      "Business travel",
      Number.isFinite(j.travelPercent)
        ? `${j.travelPercent}% or less (sample)`
        : "Not specified",
    ],
    [
      "Interview process",
      Number.isFinite(j.interviewSteps)
        ? `${j.interviewSteps} steps (sample, not a timing guarantee)`
        : "Not specified",
    ],
  ];
  return `
    <details class="job demo-card ${j.priority ? "priority-job" : ""}" id="demo-${j.id}" data-testid="card-${j.id}">
      <summary data-testid="expand-${j.id}">
        ${j.priority ? '<span class="priority-badge">REVIEW FIRST · SAMPLE</span>' : ""}
        <div class="jobhead">
          <span class="rank">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <div class="title">${esc(j.company)} <span class="company">· ${esc(j.role)}</span></div>
            <div class="pillrow"><span class="pill">${esc(j.career)}</span><span class="pill">${esc(j.workplace)}</span><span class="pill strong">Fictional sample</span><span class="pill">${esc(j.resume)}</span></div>
            <div class="meta">Illustrative annual base: ${money(j.min)} to ${money(j.max)}</div>
            <div class="meta">${esc(j.level)} · ${esc(j.employment)} · ${esc(j.industry)}</div>
            <div class="meta">${esc(j.location)} · Not a live posting</div>
          </div>
          <div class="jobactions">
            <button type="button" data-favorite="${j.id}" aria-pressed="${j.favorite}" aria-label="${j.favorite ? "Unsave" : "Save"} ${esc(j.company)}" data-testid="favorite-${j.id}">${j.favorite ? "Saved job" : "Save job"}</button>
            <select data-stage="${j.id}" aria-label="Sample application stage for ${esc(j.company)}" data-testid="stage-${j.id}">${STAGES.map((s) => `<option${s === j.stage ? " selected" : ""}>${s}</option>`).join("")}</select>
            <button type="button" data-detail="${j.id}" data-testid="details-${j.id}">Sample details</button>
          </div>
        </div>
      </summary>
      <div class="details">
        <div class="grid">
          <div class="fact"><b>Sample duties</b><div>${esc(j.duties)}</div></div>
          <div class="fact"><b>Workplace / travel</b><div>${esc(j.workplace)} · ${esc(j.travel)}</div></div>
          <div class="fact"><b>Evidence boundary</b><div>${esc(j.gap)}</div></div>
        </div>
        <section class="subpanel"><h2>Illustrative filter values</h2><div class="grid">${facts.map(([label, value]) => `<div class="fact"><b>${esc(label)}</b><div>${esc(value)}</div></div>`).join("")}</div></section>
        <div class="subpanel"><h2>Illustrative requirements</h2><ul>${j.requirements.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><p class="small">No real resume has been assessed. These are not interview or offer probabilities.</p></div>
        <div class="subpanel">
          <h2>Sample application workspace</h2>
          <div class="workflow">
            <div class="field"><label for="action-${j.id}">Sample next action</label><input id="action-${j.id}" data-field="nextAction" data-id="${j.id}" maxlength="1500" value="${esc(j.nextAction)}" data-testid="action-${j.id}"></div>
            <div class="field"><label for="notes-${j.id}">Sample notes only</label><textarea id="notes-${j.id}" data-field="notes" data-id="${j.id}" maxlength="5000" placeholder="Do not enter personal information." data-testid="notes-${j.id}">${esc(j.notes)}</textarea></div>
          </div>
        </div>
      </div>
    </details>`;
}
function activeFilters(counts) {
  const active = [];
  if (state.query.trim())
    active.push({ key: "query", label: `Search: ${state.query.trim()}` });
  for (const field of FILTER_FIELDS) {
    if (String(state[field.key]) === (field.default ?? "")) continue;
    const label = field.options.find(
      ([value]) => value === String(state[field.key]),
    )?.[1];
    if (label)
      active.push({ key: field.key, label: `${field.label}: ${label}` });
  }
  if (state.filter !== "all") {
    active.push({
      key: "filter",
      label: `Shortcut: ${counts.find((c) => c[2] === state.filter)?.[0]}`,
    });
  }
  return active;
}
function syncControls() {
  $("demoSearch").value = state.query;
  for (const field of FILTER_FIELDS)
    $(field.key).value = String(state[field.key]);
}
function updateDisclosureLabel() {
  const extra = FILTER_FIELDS.slice(3).filter(
    (field) => String(state[field.key]) !== (field.default ?? ""),
  ).length;
  const open = !$("demoAdvancedFilters").hidden;
  $("demoMoreFilters").textContent =
    `${open ? "Hide extra filters" : "More filters"}${extra ? ` · ${extra} active` : ""}`;
}
function setExtraFilters(open) {
  $("demoAdvancedFilters").hidden = !open;
  $("demoMoreFilters").setAttribute("aria-expanded", String(open));
  updateDisclosureLabel();
}
function render() {
  const open = [...document.querySelectorAll("details[open]")].map((e) => e.id),
    items = selectJobs(jobs, state);
  const counts = [
    ["All roles", jobs.length, "all"],
    ["Remote", jobs.filter((j) => j.workplace === "Remote").length, "remote"],
    ["Review first", jobs.filter((j) => j.priority).length, "priority"],
    [
      "Active applications",
      jobs.filter((j) => ["Applied", "Interviewing", "Offer"].includes(j.stage))
        .length,
      "pipeline",
    ],
    ["Saved jobs", jobs.filter((j) => j.favorite).length, "favorite"],
    [
      "Interviewing",
      jobs.filter((j) => j.stage === "Interviewing").length,
      "interviewing",
    ],
  ];
  $("demoKpis").innerHTML = counts
    .map(
      ([label, count, key]) =>
        `<button type="button" class="kpi ${state.filter === key ? "on" : ""}" data-filter="${key}" aria-pressed="${state.filter === key}" data-testid="filter-${key}"><b>${count}</b><span>${label}</span></button>`,
    )
    .join("");
  $("demoResultCount").textContent =
    `${items.length} of ${jobs.length} sample roles`;
  const active = activeFilters(counts);
  $("filterSummary").textContent = active.length
    ? `${active.length} active filter${active.length === 1 ? "" : "s"}. All conditions must match.`
    : "All career fields and workplaces";
  $("demoActiveFilters").innerHTML = active
    .map(
      ({ key, label }) =>
        `<button type="button" class="demo-filter-chip" data-remove-filter="${key}" aria-label="Remove ${esc(label)}" data-testid="remove-filter-${key}">${esc(label)} <span class="demo-chip-clear">Clear</span></button>`,
    )
    .join("");
  $("demoOptionsBtn").textContent =
    `Filters & views${active.length ? ` (${active.length})` : ""}`;
  updateDisclosureLabel();
  $("demoJobs").innerHTML = items.length
    ? state.view === "cards"
      ? `<div class="cards">${items.map(card).join("")}</div>`
      : `<div class="tablewrap"><table class="datatable demo-table"><thead><tr><th>Company / role</th><th>Career</th><th>Workplace</th><th>Illustrative pay</th><th>Stage</th><th>Details</th></tr></thead><tbody>${items.map((j) => `<tr><td><strong>${esc(j.company)}</strong><div>${esc(j.role)}</div></td><td>${esc(j.career)}</td><td>${esc(j.workplace)}</td><td>${money(j.min)} to ${money(j.max)}</td><td>${esc(j.stage)}</td><td><button type="button" data-open="${j.id}" data-testid="table-open-${j.id}">Details</button></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty demo-empty"><p>No sample roles match.</p><p>Try another career field or clear filters.</p><button type="button" data-clear data-testid="empty-clear">Clear filters</button></div>';
  if (state.tab === "pipeline")
    $("demoPipeline").innerHTML =
      `<p class="source-note">Fictional stages and activities. Current filters apply to this pipeline.</p><div class="demo-pipeline">${[
        "Applied",
        "Interviewing",
        "Offer",
        "Rejected",
      ]
        .map(
          (stage) =>
            `<section class="column"><h2>${stage} / ${items.filter((j) => j.stage === stage).length}</h2>${
              items
                .filter((j) => j.stage === stage)
                .map(
                  (j) =>
                    `<div class="mini"><button type="button" data-open="${j.id}" data-testid="pipeline-open-${j.id}">${esc(j.company)} · ${esc(j.role)}</button><p class="small">${esc(j.nextAction || "No sample action")}</p></div>`,
                )
                .join("") || '<p class="small">No samples at this stage.</p>'
            }</section>`,
        )
        .join("")}</div>`;
  else $("demoPipeline").replaceChildren();
  open.forEach((id) => {
    const d = document.getElementById(id);
    if (d) d.open = true;
  });
  $("demoView").textContent =
    state.view === "cards" ? "Table view" : "Card view";
  document.querySelectorAll("[data-tab]").forEach((b) => {
    const on = b.dataset.tab === state.tab;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  $("jobsPanel").hidden = state.tab !== "jobs";
  $("demoPipelinePanel").hidden = state.tab !== "pipeline";
}
function clear() {
  state = {
    ...state,
    ...FILTER_DEFAULTS,
    sort: "company",
    tab: "jobs",
  };
  syncControls();
  $("demoSort").value = "company";
  render();
}
function openJob(id) {
  clear();
  state.view = "cards";
  render();
  const d = $("demo-" + id);
  if (d) {
    d.open = true;
    d.scrollIntoView({ block: "start", behavior: "auto" });
  }
}
function feedback() {
  $("demoFeedback").textContent =
    "Sample edit updated in this page only. Export to keep it; reload resets the demo.";
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button,a");
  if (!b) return;
  if (b.dataset.close) {
    $(b.dataset.close).close();
    return;
  }
  if (b.dataset.filter) {
    state.filter = b.dataset.filter;
    state.tab = "jobs";
    render();
    return;
  }
  if (b.dataset.tab) {
    state.tab = b.dataset.tab;
    render();
    return;
  }
  if (Object.hasOwn(FILTER_DEFAULTS, b.dataset.removeFilter)) {
    const key = b.dataset.removeFilter;
    state[key] = FILTER_DEFAULTS[key];
    syncControls();
    render();
    return;
  }
  if (b.hasAttribute("data-clear")) {
    clear();
    return;
  }
  if (b.dataset.open) {
    openJob(b.dataset.open);
    return;
  }
  if (b.dataset.favorite) {
    e.preventDefault();
    const j = jobs.find((j) => j.id === b.dataset.favorite);
    j.favorite = !j.favorite;
    render();
    feedback();
    return;
  }
  if (b.dataset.detail) {
    e.preventDefault();
    const d = $("demo-" + b.dataset.detail);
    d.open = !d.open;
    return;
  }
});
document.addEventListener("change", (e) => {
  const id = e.target.dataset.stage;
  if (!id) return;
  const j = jobs.find((j) => j.id === id);
  if (STAGES.includes(e.target.value)) {
    j.stage = e.target.value;
    render();
    feedback();
  }
});
document.addEventListener("input", (e) => {
  const { field, id } = e.target.dataset;
  if (!["notes", "nextAction"].includes(field)) return;
  const j = jobs.find((j) => j.id === id);
  if (j) {
    j[field] = e.target.value;
    feedback();
  }
});
$("demoSearch").oninput = (e) => {
  state.query = e.target.value;
  render();
};
for (const field of FILTER_FIELDS) {
  const control = $(field.key);
  control.innerHTML = [[field.default ?? "", field.all], ...field.options]
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}">${esc(label)}</option>`,
    )
    .join("");
  control.onchange = (e) => {
    state[field.key] = e.target.value;
    render();
  };
}
$("demoMoreFilters").onclick = () =>
  setExtraFilters($("demoAdvancedFilters").hidden);
$("demoSort").onchange = (e) => {
  state.sort = e.target.value;
  render();
};
$("demoView").onclick = () => {
  state.view = state.view === "cards" ? "table" : "cards";
  state.tab = "jobs";
  render();
};
$("demoOptionsBtn").onclick = () => {
  const open = $("demoOptionsBtn").getAttribute("aria-expanded") !== "true";
  $("demoOptionsBtn").setAttribute("aria-expanded", String(open));
  document.querySelector(".toolbar").classList.toggle("expanded", open);
  if (window.matchMedia("(max-width:700px)").matches) setExtraFilters(open);
};
$("clearDemoFilters").onclick = clear;
$("guideBtn").onclick = () => $("guideDialog").showModal();
$("resetBtn").onclick = () => $("demoResetDialog").showModal();
$("confirmDemoReset").onclick = () => {
  jobs = freshJobs();
  clear();
  $("demoResetDialog").close();
  $("demoFeedback").textContent =
    "Sample workspace reset. Nothing was changed in a private tracker.";
};
$("exportBtn").onclick = () => {
  const csv = sampleCsv(jobs);
  $("demoCsv").value = csv;
  $("demoCopyStatus").textContent =
    "Use Download CSV, or copy the text if your browser blocks downloads.";
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  $("downloadDemoCsv").href = downloadUrl;
  $("demoExportDialog").showModal();
};
$("copyDemoCsv").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("demoCsv").value);
    $("demoCopyStatus").textContent = "CSV copied.";
  } catch {
    $("demoCsv").focus();
    $("demoCsv").select();
    $("demoCopyStatus").textContent =
      "Clipboard access was blocked. The text is selected; copy it manually.";
  }
};
$("selectDemoCsv").onclick = () => {
  $("demoCsv").focus();
  $("demoCsv").select();
  $("demoCopyStatus").textContent =
    "CSV selected. Copy it with your browser or keyboard.";
};
document.addEventListener("keydown", (e) => {
  if (
    !e.target.dataset.tab ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
  )
    return;
  e.preventDefault();
  const tabs = [...document.querySelectorAll("[data-tab]")],
    i = tabs.indexOf(e.target),
    next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (i + (e.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
  state.tab = tabs[next].dataset.tab;
  render();
  tabs[next].focus();
});
render();
