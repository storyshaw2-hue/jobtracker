import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clone, validateSnapshot, validateProfile, initialWorkspace, profileEquivalent,
  exportCsv, parseCsv, planImport, makeRequest, makePrompt, normalizeWorkflow, safeUrl
} from "../src/domain.mjs";

const demo = JSON.parse(readFileSync(new URL("../fixtures/demo.snapshot.json", import.meta.url), "utf8"));
const contract = readFileSync(new URL("../docs/perplexity-agent-contract.md", import.meta.url), "utf8");
const fresh = () => initialWorkspace(clone(demo));

test("seed is unchanged; current builder is Perplexity in a separately versioned profile", () => {
  const w = fresh();
  assert.deepEqual(w.snapshot, demo);
  assert.equal(w.userState.profile.projectPlatform, "Perplexity");
  assert.equal(w.userState.profile.version, "2");
  assert.equal(w.userState.profileDirty, true);
});
test("profile comparison ignores object-key ordering", () => {
  const p = fresh().userState.profile;
  const reordered = { ...p, weights: Object.fromEntries(Object.entries(p.weights).reverse()) };
  assert.equal(profileEquivalent(p, reordered), true);
});
test("weights and resume descriptors are validated", () => {
  const p = fresh().userState.profile;
  p.weights.track++;
  assert.throws(() => validateProfile(p), /total exactly 100/);
  p.weights.track--;
  p.resumes[0].text = "Raw resume must never be stored";
  assert.throws(() => validateProfile(p), /descriptors/);
});
test("duplicate IDs, unknown aliases, unsafe URLs and credential-bearing URLs fail", () => {
  const d = clone(demo);
  d.hidden[0].job_id = d.leads[0].job_id;
  assert.throws(() => validateSnapshot(d), /unique/);
  d.hidden[0].job_id = "unique-hidden";
  d.leads[0].resume = "missing";
  assert.throws(() => validateSnapshot(d), /unknown resume/);
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("https://user:password@example.com/jobs"), null);
});
test("new Perplexity complete runs need component and verification evidence", () => {
  const d = clone(demo); d.generator = "Perplexity"; d.run_status = "complete";
  assert.throws(() => validateSnapshot(d), /lacks verification/);
});
test("workflow preserves blanks and rejects impossible dates and statuses", () => {
  assert.deepEqual(normalizeWorkflow({ notes: "", appliedAt: "", favorite: false }), { notes: "", appliedAt: "", favorite: false });
  assert.throws(() => normalizeWorkflow({ nextActionDate: "2026-02-30" }), /valid YYYY/);
  assert.throws(() => normalizeWorkflow({ status: "Definitely hired" }), /status/);
});
test("formula-safe CSV round trips spaces, controls, quotes, newlines and explicit blanks", () => {
  const w = fresh();
  const note = ' \t=SUM(1,1)\n"quoted"';
  w.userState.jobs["demo-audit-1"] = { status: "Applied", favorite: true, notes: note, contact: "+123456", nextAction: "", nextActionDate: "", appliedAt: "2026-11-06" };
  const csv = exportCsv(w);
  assert.match(csv, /' \t=SUM/);
  const rows = parseCsv(csv);
  assert.equal(rows[0].notes, note);
  assert.equal(rows[0].contact, "+123456");
  const merged = planImport(fresh(), csv, "backup.csv").workspace;
  assert.deepEqual(merged.userState.jobs["demo-audit-1"], w.userState.jobs["demo-audit-1"]);
});
test("CSV duplicate IDs, malformed quotes and prototype keys are rejected", () => {
  assert.throws(() => parseCsv('job_id,notes\n"a,"unclosed'), /unclosed|Malformed/);
  assert.throws(() => planImport(fresh(), "job_id,status\na,Applied\na,Applied", "bad.csv"), /unique/);
  assert.throws(() => planImport(fresh(), "job_id,status\n__proto__,Applied", "bad.csv"), /safe/);
  assert.throws(() => planImport(fresh(), '{"jobs":{"__proto__":{"notes":"bad"}}}', "bad.json"), /Unsafe/);
});
test("import default preserves user values, including explicit blank fields", () => {
  const w = fresh();
  w.userState.jobs["demo-audit-1"] = { status: "Applied", notes: "" };
  const input = JSON.stringify({ jobs: { "demo-audit-1": { status: "Rejected", notes: "incoming", contact: "New contact" } } });
  const plan = planImport(w, input, "old.json");
  assert.equal(plan.summary.conflicts, 2);
  assert.deepEqual(plan.workspace.userState.jobs["demo-audit-1"], { status: "Applied", notes: "", contact: "New contact" });
  const replaced = planImport(w, input, "old.json", { overwrite: true });
  assert.equal(replaced.workspace.userState.jobs["demo-audit-1"].notes, "incoming");
});
test("a research import replaces results but retains tracked omitted jobs", () => {
  const w = fresh(); w.userState.jobs["demo-audit-1"] = { status: "Applied", notes: "Keep this application." };
  const d = clone(demo); d.leads.shift(); d.counts.All = 1;
  const plan = planImport(w, JSON.stringify(d), "results.json");
  assert.equal(plan.workspace.snapshot.leads.length, 1);
  assert.equal(plan.summary.retained, 1);
  assert.equal(plan.workspace.userState.retainedJobs["demo-audit-1"].company, demo.leads[0].company);
  assert.equal(plan.workspace.userState.jobs["demo-audit-1"].notes, "Keep this application.");
  assert.deepEqual(w.snapshot, demo);
});
test("explicit ID migrations preserve workflow under the new ID", () => {
  const w = fresh(); w.userState.jobs["demo-audit-1"] = { status: "Applied", notes: "Original note" };
  const d = clone(demo); d.leads[0].job_id = "replacement-audit";
  d.id_migrations = [{ old_job_id: "demo-audit-1", new_job_id: "replacement-audit", reason: "Requisition changed" }];
  const result = planImport(w, JSON.stringify(d), "new.json").workspace;
  assert.equal(result.userState.jobs["replacement-audit"].notes, "Original note");
  assert.equal(result.userState.jobs["demo-audit-1"].notes, "Original note");
});
test("migrating an already-retained job does not duplicate its pipeline record", () => {
  const w = fresh();
  w.userState.jobs["demo-audit-1"] = { status: "Applied", notes: "Keep the original note" };
  const omitted = clone(demo); omitted.leads.shift(); omitted.counts.All = 1;
  const retained = planImport(w, JSON.stringify(omitted), "omitted.json").workspace;
  assert.ok(retained.userState.retainedJobs["demo-audit-1"]);
  const returned = clone(demo); returned.leads[0].job_id = "replacement-audit";
  returned.id_migrations = [{ old_job_id: "demo-audit-1", new_job_id: "replacement-audit", reason: "Verified replacement" }];
  const migrated = planImport(retained, JSON.stringify(returned), "replacement.json").workspace;
  assert.equal(migrated.userState.retainedJobs["demo-audit-1"], undefined);
  assert.equal(migrated.userState.jobs["replacement-audit"].notes, "Keep the original note");
  assert.equal(migrated.userState.jobs["demo-audit-1"].notes, "Keep the original note");
});
test("Perplexity request includes full context/schema and no document body", () => {
  const w = fresh(), r = makeRequest(w, contract);
  assert.equal(r.provider, "Perplexity");
  assert.equal(r.schemaVersion, "2.0");
  assert.equal(r.resumeHandling.contentsIncluded, false);
  assert.deepEqual(r.priorSnapshot, demo);
  assert.equal(r.outputSchema.$id, "urn:job-workspace:snapshot");
  assert.match(makePrompt(w), /Microsoft Copilot Studio/);
  assert.match(makePrompt(w), /Do not fabricate/);
  assert.match(makePrompt(w), /actual resume documents/);
});
