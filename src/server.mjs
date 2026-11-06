import express from "express";
import Database from "better-sqlite3";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ValidationError, initialWorkspace, validateProfile, validateSnapshot, normalizeState,
  makeExport, makePrompt, planImport
} from "./domain.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contract = readFileSync(resolve(root, "docs/perplexity-agent-contract.md"), "utf8");
const sha = value => createHash("sha256").update(value).digest("hex");
const statusError = (status, message) => Object.assign(new Error(message), { status });

export function openStore(filename, seed) {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  // Read existing schema before any other SQL; never replace or reshape user tables.
  const existing = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all();
  if (existing.some(t => t.name === "workspaces")) {
    const columns = db.prepare("PRAGMA table_info(workspaces)").all().map(c => c.name);
    for (const name of ["workspace_key", "snapshot_json", "state_json", "revision", "updated_at"]) {
      if (!columns.includes(name)) throw new Error("Incompatible workspace schema. No data was modified.");
    }
  }
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS workspaces (
    workspace_key TEXT PRIMARY KEY,
    snapshot_json TEXT NOT NULL,
    state_json TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`);
  const get = db.prepare("SELECT snapshot_json, state_json, revision, updated_at FROM workspaces WHERE workspace_key = ?");
  const insert = db.prepare("INSERT OR IGNORE INTO workspaces (workspace_key, snapshot_json, state_json, revision, updated_at) VALUES (?, ?, ?, 0, ?)");
  const update = db.prepare("UPDATE workspaces SET snapshot_json = ?, state_json = ?, revision = revision + 1, updated_at = ? WHERE workspace_key = ? AND revision = ?");
  const initial = initialWorkspace(seed);
  function read(key) {
    insert.run(key, JSON.stringify(initial.snapshot), JSON.stringify(initial.userState), new Date().toISOString());
    const row = get.get(key);
    return { snapshot: JSON.parse(row.snapshot_json), userState: JSON.parse(row.state_json), revision: row.revision, updatedAt: row.updated_at };
  }
  function write(key, workspace, revision) {
    if (!Number.isInteger(revision) || revision < 0) throw statusError(422, "A valid workspace revision is required.");
    validateSnapshot(workspace.snapshot);
    const userState = normalizeState(workspace.userState, workspace.snapshot);
    read(key);
    const changed = update.run(JSON.stringify(workspace.snapshot), JSON.stringify(userState), new Date().toISOString(), key, revision);
    if (!changed.changes) throw statusError(409, "This workspace changed in another tab. Export your draft before loading the latest version.");
    return read(key);
  }
  return { db, read, write, close: () => db.close() };
}

export function createApplication({
  databasePath = resolve(root, process.env.DATABASE_PATH || ".data/workspaces.sqlite"),
  seed,
  mode = process.env.APP_MODE || "development",
  basicUser = process.env.APP_BASIC_USER || "owner",
  basicPassword = process.env.APP_BASIC_PASSWORD || ""
} = {}) {
  if (!["development", "perplexity", "standalone"].includes(mode)) throw new Error("Unsupported APP_MODE.");
  if (mode === "standalone" && basicPassword.length < 16) throw new Error("Standalone hosting requires APP_BASIC_PASSWORD with at least 16 characters.");
  if (!seed) {
    const selected = process.env.SEED_FILE ? resolve(root, process.env.SEED_FILE) : resolve(root, ".data/seed.private.json");
    const path = existsSync(selected) ? selected : resolve(root, "fixtures/demo.snapshot.json");
    seed = JSON.parse(readFileSync(path, "utf8"));
  }
  const storage = openStore(databasePath, seed);
  const app = express(), temporary = new Map();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Visitor-Id",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  function identify(req, res, next) {
    if (mode === "standalone") {
      let supplied = "";
      try {
        if (req.get("Authorization")?.startsWith("Basic ")) supplied = Buffer.from(req.get("Authorization").slice(6), "base64").toString("utf8");
      } catch { /* A malformed header is simply unauthenticated. */ }
      if (!timingSafeEqual(Buffer.from(sha(supplied)), Buffer.from(sha(`${basicUser}:${basicPassword}`)))) {
        res.set("WWW-Authenticate", 'Basic realm="Private Job Workspace", charset="UTF-8"');
        return res.status(401).json({ message: "Private workspace authentication is required." });
      }
      res.locals.workspaceKey = sha(`owner:${basicUser}`);
    } else {
      const visitor = req.get("X-Visitor-Id");
      if (mode === "perplexity" && (!visitor || visitor.length > 300)) {
        return res.status(401).json({ message: "Open the private Perplexity app to access your workspace." });
      }
      res.locals.workspaceKey = sha(`visitor:${visitor || "local-development"}`);
    }
    next();
  }
  if (mode === "standalone") app.use(identify);
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (mode === "standalone") return next();
    return identify(req, res, next);
  });
  app.use(express.json({ limit: "4mb" }));
  const expose = workspace => ({
    ...workspace,
    meta: {
      demo: workspace.snapshot.generator === "Demo",
      provider: "Perplexity",
      persistence: "Server-side SQLite; export backups before moving environments.",
      researchRefreshed: false
    }
  });
  const wrap = fn => (req, res, next) => {
    try { return fn(req, res); } catch (error) { next(error); }
  };
  function temporaryItem(key, item) {
    const now = Date.now();
    for (const [token, entry] of temporary) if (entry.expires <= now) temporary.delete(token);
    if (temporary.size >= 60) throw statusError(429, "Too many pending downloads/imports. Please retry shortly.");
    const token = randomBytes(24).toString("hex");
    temporary.set(token, { ...item, key, expires: now + 5 * 60 * 1000 });
    return token;
  }
  function readTemporary(req, type) {
    const item = temporary.get(req.params.token);
    if (!item || item.key !== req.res.locals.workspaceKey || item.entryType !== type || item.expires < Date.now()) {
      throw statusError(404, "This private download or import preview expired. Prepare it again.");
    }
    return item;
  }
  app.get("/api/workspace", wrap((req, res) => res.json(expose(storage.read(res.locals.workspaceKey)))));
  app.put("/api/workspace", wrap((req, res) => {
    const saved = storage.write(res.locals.workspaceKey, req.body, req.body.revision);
    res.json({ revision: saved.revision, updatedAt: saved.updatedAt });
  }));
  app.post("/api/profile/validate", wrap((req, res) => {
    validateProfile(req.body.profile);
    res.json({ valid: true });
  }));
  app.post("/api/refresh", wrap((req, res) => {
    const workspace = req.body.draft || storage.read(res.locals.workspaceKey);
    validateSnapshot(workspace.snapshot);
    workspace.userState = normalizeState(workspace.userState, workspace.snapshot);
    res.json({ prompt: makePrompt(workspace), descriptorCount: workspace.userState.profile.resumes.length });
  }));
  app.post("/api/exports", wrap((req, res) => {
    const workspace = req.body.draft || storage.read(res.locals.workspaceKey);
    validateSnapshot(workspace.snapshot);
    workspace.userState = normalizeState(workspace.userState, workspace.snapshot);
    const output = makeExport(req.body.kind, workspace, contract);
    const token = temporaryItem(res.locals.workspaceKey, { entryType: "download", ...output });
    res.json({ path: `/api/download/${token}`, filename: output.filename });
  }));
  app.get("/api/download/:token", wrap((req, res) => {
    const file = readTemporary(req, "download");
    res.set("Content-Type", file.type);
    res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.body);
  }));
  app.post("/api/import/preview", wrap((req, res) => {
    const current = storage.read(res.locals.workspaceKey);
    if (req.body.revision !== current.revision) throw statusError(409, "Saved data changed. Export any draft and load the latest workspace before importing.");
    const plan = planImport(current, req.body.text, req.body.filename || "", {
      overwrite: req.body.overwrite === true, importProfile: req.body.importProfile === true
    });
    const token = temporaryItem(res.locals.workspaceKey, { entryType: "import", workspace: plan.workspace, revision: current.revision });
    res.json({ token, ...plan.summary });
  }));
  app.post("/api/import/:token", wrap((req, res) => {
    const plan = readTemporary(req, "import");
    const saved = storage.write(res.locals.workspaceKey, plan.workspace, plan.revision);
    temporary.delete(req.params.token);
    res.json(expose(saved));
  }));
  app.use(express.static(resolve(root, process.env.PUBLIC_DIR || "public"), { dotfiles: "deny" }));
  app.use((error, _req, res, _next) => {
    const status = error.status || (error instanceof ValidationError ? 422 : 500);
    const message = error.type === "entity.too.large" ? "File exceeds the 4 MB limit." :
      error.type === "entity.parse.failed" ? "The request contains invalid JSON." :
      status < 500 ? error.message : "The workspace could not be saved. Your draft remains in the page.";
    res.status(status).json({ message });
  });
  return { app, storage };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.env.APP_MODE || "development";
  const host = process.env.HOST || "127.0.0.1";
  if (mode === "development" && !["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("Development mode binds only to loopback. Configure private-proxy or authenticated standalone hosting.");
  }
  const { app, storage } = createApplication();
  const server = app.listen(Number(process.env.PORT || 5001), host, () => console.log(`Job workspace ready (${mode}).`));
  const shutdown = () => server.close(() => { storage.close(); process.exit(0); });
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
