import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApplication } from "../src/server.mjs";

const seed = JSON.parse(readFileSync(new URL("../fixtures/demo.snapshot.json", import.meta.url), "utf8"));
async function harness(fn) {
  const { app, storage } = createApplication({ databasePath: ":memory:", seed, mode: "perplexity" });
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, options = {}, visitor = "test-owner") => fetch(base + path, {
    ...options, headers: { ...(visitor ? { "X-Visitor-Id": visitor } : {}), ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
  });
  try { await fn(call, storage); } finally { await new Promise(resolve => server.close(resolve)); storage.close(); }
}
test("private identity is required; health and CORS do not expose data", () => harness(async call => {
  assert.equal((await call("/api/workspace", {}, null)).status, 401);
  assert.equal((await call("/health", {}, null)).status, 200);
  const option = await call("/api/workspace", { method: "OPTIONS", headers: { Origin: "null" } }, null);
  assert.equal(option.status, 204);
  assert.equal(option.headers.get("access-control-allow-origin"), "*");
}));
test("save/reload is exact, isolated and protected against stale revisions", () => harness(async call => {
  const w = await (await call("/api/workspace")).json();
  w.userState.jobs["demo-audit-1"] = { notes: '=No execution\n"quoted"', status: "Applied", appliedAt: "2026-11-06" };
  assert.equal((await call("/api/workspace", { method: "PUT", body: JSON.stringify(w) })).status, 200);
  const saved = await (await call("/api/workspace")).json();
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.userState.jobs["demo-audit-1"], w.userState.jobs["demo-audit-1"]);
  assert.equal((await call("/api/workspace", { method: "PUT", body: JSON.stringify(w) })).status, 409);
  const other = await (await call("/api/workspace", {}, "other-owner")).json();
  assert.deepEqual(other.userState.jobs, {});
}));
test("downloads are actual attachments and bound to their preparing identity", () => harness(async call => {
  for (const kind of ["state", "request", "csv"]) {
    const prepared = await (await call("/api/exports", { method: "POST", body: JSON.stringify({ kind }) })).json();
    assert.match(prepared.path, /^\/api\/download\//);
    assert.equal((await call(prepared.path, {}, "other-owner")).status, 404);
    assert.equal((await call(prepared.path, {}, null)).status, 401);
    const file = await call(prepared.path);
    assert.equal(file.status, 200);
    assert.match(file.headers.get("content-disposition"), /^attachment;/);
    const body = await file.text();
    if (kind === "request") {
      const r = JSON.parse(body);
      assert.equal(r.provider, "Perplexity");
      assert.equal(r.resumeHandling.contentsIncluded, false);
      assert.ok(r.outputSchema && r.priorSnapshot);
    }
  }
}));
test("imports validate and preview without applying, then apply atomically", () => harness(async call => {
  const before = await (await call("/api/workspace")).json();
  const text = JSON.stringify({ jobs: { "demo-audit-1": { notes: "Imported safely", status: "Interested" } } });
  const preview = await (await call("/api/import/preview", { method: "POST", body: JSON.stringify({ text, filename: "backup.json", revision: before.revision }) })).json();
  assert.ok(preview.token);
  const unmodified = await (await call("/api/workspace")).json();
  assert.deepEqual(unmodified.userState.jobs, {});
  assert.equal(unmodified.revision, 0);
  assert.equal((await call(`/api/import/${preview.token}`, { method: "POST", body: "{}" }, "other-owner")).status, 404);
  const applied = await (await call(`/api/import/${preview.token}`, { method: "POST", body: "{}" })).json();
  assert.equal(applied.userState.jobs["demo-audit-1"].notes, "Imported safely");
  assert.equal(applied.revision, 1);
  assert.equal((await call(`/api/import/${preview.token}`, { method: "POST", body: "{}" })).status, 404);
}));
test("failed validation never changes the saved workspace", () => harness(async call => {
  const before = await (await call("/api/workspace")).json();
  const bad = structuredClone(before); bad.userState.profile.weights.track = 99;
  assert.equal((await call("/api/workspace", { method: "PUT", body: JSON.stringify(bad) })).status, 422);
  assert.equal((await call("/api/import/preview", { method: "POST", body: JSON.stringify({ text: "invalid JSON", filename: "bad.json", revision: 0 }) })).status, 422);
  const after = await (await call("/api/workspace")).json();
  assert.deepEqual(after.userState, before.userState);
  assert.equal(after.revision, 0);
}));
test("standalone hosting refuses an absent or weak password", () => {
  assert.throws(() => createApplication({ databasePath: ":memory:", seed, mode: "standalone" }), /at least 16/);
});
