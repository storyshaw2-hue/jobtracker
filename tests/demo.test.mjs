import test from "node:test";
import assert from "node:assert/strict";
import {
  freshJobs,
  selectJobs,
  sampleCsv,
  SAMPLE_JOBS,
  FILTER_FIELDS,
  FILTER_DEFAULTS,
} from "../public-demo/model.js";
test("public demo spans professions and clones only fictional data", () => {
  const a = freshJobs(),
    b = freshJobs();
  assert.equal(a.length, 6);
  assert.equal(new Set(a.map((j) => j.career)).size, 6);
  a[0].notes = "temporary";
  assert.equal(b[0].notes, "");
  assert.equal(SAMPLE_JOBS[0].notes, "");
  assert.ok(
    a.every((j) => j.id.startsWith("sample-") && j.company.endsWith("Example")),
  );
});
test("public demo filters career, workplace, salary, workflow and free text", () => {
  const a = freshJobs();
  assert.equal(selectJobs(a, { career: "Design" }).length, 1);
  assert.equal(selectJobs(a, { workplace: "Remote" }).length, 3);
  assert.equal(selectJobs(a, { payFloor: 110000 }).length, 1);
  assert.equal(selectJobs(a, { filter: "pipeline" }).length, 2);
  assert.equal(selectJobs(a, { filter: "favorite" }).length, 2);
  assert.equal(
    selectJobs(a, { career: "Design", workplace: "Remote" }).length,
    0,
  );
  a[2].notes = "needle-demo";
  assert.equal(selectJobs(a, { query: "needle-demo" })[0].id, a[2].id);
});
test("public demo sorts consistently without claiming a match score", () => {
  const a = freshJobs();
  assert.equal(selectJobs(a, { sort: "pay" })[0].min, 110000);
  assert.equal(selectJobs(a)[0].company, "Aster Example");
  assert.ok(a.every((j) => !("score" in j) && !("chance" in j)));
});
test("public demo CSV quotes multiline content and escapes formulas", () => {
  const a = freshJobs();
  a[0].notes = ' \t=SUM(1,2)\n"quoted"';
  const csv = sampleCsv(a);
  assert.ok(csv.startsWith("\ufeff"));
  assert.ok(csv.includes('"\' \t=SUM(1,2)\n""quoted"""'));
  assert.ok(csv.includes("Fictional sample; not a live posting"));
  assert.ok(csv.includes("sample-accounting"));
  assert.ok(csv.includes('"illustrative_interview_steps"'));
  assert.ok(csv.includes('"Not specified"'));
});
test("expanded filter definitions have explicit defaults and unique choices", () => {
  assert.equal(FILTER_FIELDS.length, 10);
  assert.equal(new Set(FILTER_FIELDS.map((f) => f.key)).size, 10);
  for (const field of FILTER_FIELDS) {
    assert.equal(FILTER_DEFAULTS[field.key], field.default ?? "");
    assert.equal(
      new Set(field.options.map(([value]) => value)).size,
      field.options.length,
    );
  }
  assert.equal(selectJobs(freshJobs(), FILTER_DEFAULTS).length, 6);
});
test("experience, employment, industry, location and status filters are exact", () => {
  const jobs = freshJobs();
  for (const [key, count] of [
    ["level", 3],
    ["employment", 3],
    ["industry", 4],
    ["region", 3],
  ]) {
    const values = new Set(jobs.map((j) => j[key]));
    assert.equal(values.size, count);
    for (const value of values) {
      assert.deepEqual(
        selectJobs(jobs, { [key]: value }).map((j) => j.id),
        jobs
          .filter((j) => j[key] === value)
          .sort((a, b) => a.company.localeCompare(b.company))
          .map((j) => j.id),
      );
    }
  }
  assert.equal(selectJobs(jobs, { stage: "Applied" })[0].id, "sample-design");
  assert.equal(
    selectJobs(jobs, { stage: "Interviewing" })[0].id,
    "sample-customer-success",
  );
  assert.equal(selectJobs(jobs, { stage: "Rejected" }).length, 0);
  jobs[0].stage = "Offer";
  assert.equal(selectJobs(jobs, { stage: "Offer" })[0].id, jobs[0].id);
});
test("business travel limits include zero and exclude unknown values", () => {
  const jobs = freshJobs();
  assert.equal(selectJobs(jobs, { travelCap: "0" }).length, 2);
  assert.equal(selectJobs(jobs, { travelCap: "10" }).length, 4);
  assert.equal(selectJobs(jobs, { travelCap: "25" }).length, 5);
  assert.equal(
    selectJobs(jobs, { travelCap: "unknown" })[0].id,
    "sample-accounting",
  );
  jobs[0].travelPercent = undefined;
  assert.equal(selectJobs(jobs, { travelCap: "0" }).length, 1);
});
test("interview-step limits never turn unknown data into a short process", () => {
  const jobs = freshJobs();
  assert.equal(selectJobs(jobs, { interviewCap: "2" }).length, 2);
  assert.equal(selectJobs(jobs, { interviewCap: "3" }).length, 4);
  assert.equal(selectJobs(jobs, { interviewCap: "4" }).length, 5);
  assert.equal(
    selectJobs(jobs, { interviewCap: "unknown" })[0].id,
    "sample-customer-success",
  );
  assert.equal(
    selectJobs(jobs, { workplace: "Remote", interviewCap: "2" })[0].id,
    "sample-marketing",
  );
});
test("all screening conditions compose with AND logic", () => {
  const jobs = freshJobs();
  assert.deepEqual(
    selectJobs(jobs, {
      query: "analytics",
      workplace: "Remote",
      payFloor: 70000,
      level: "Mid-level",
      employment: "Contract",
      industry: "Media & entertainment",
      region: "US Central / Eastern",
      travelCap: "10",
      interviewCap: "2",
      stage: "Saved",
    }).map((j) => j.id),
    ["sample-marketing"],
  );
  assert.equal(
    selectJobs(jobs, { filter: "pipeline", stage: "Saved" }).length,
    0,
  );
  assert.equal(
    selectJobs(jobs, { level: "Senior", employment: "Part-time" }).length,
    0,
  );
});
test("search includes new screening values and requirements", () => {
  const jobs = freshJobs();
  assert.equal(selectJobs(jobs, { query: "ILLINOIS" }).length, 3);
  assert.equal(
    selectJobs(jobs, { query: "media & entertainment" })[0].id,
    "sample-marketing",
  );
  assert.equal(
    selectJobs(jobs, { query: "version control" })[0].id,
    "sample-engineering",
  );
});
