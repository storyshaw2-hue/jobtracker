# Job Tracker

A job-search workspace with a private personal tracker, an explicit Perplexity refresh handoff and a separate profession-neutral demonstration. This is the independent `storyshaw2-hue/jobtracker` project, not the ACED repository.

Try the [Job Tracker Workspace sample demo on Vercel](https://job-tracker-workspace.vercel.app). It uses fictional roles, resets edits on reload and does not expose private tracker records.

## Privacy boundary

This repository is public, but the working tracker and real data are private. Only synthetic demonstration records are committed. Real research snapshots, application notes, actual resumes, credentials, database files and QA output are excluded from Git and from the static build.

The app uses server-side SQLite, not browser storage. Export a portable backup before moving environments or rebuilding on another host. A persistent local database is not an independently managed cloud database.

## Run locally

Requires Node.js 20 or later and npm.

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:5001`. The default is a loopback-only development server with clearly labeled fictional data.

To start with real data, place a valid research snapshot at `.data/seed.private.json` before the first run, or import it through the app. Never force-add that file to Git. Existing saved workspaces are not replaced when a seed file changes.

## Perplexity workflow

- **Search profile & resumes:** Configure eligibility, the posted annual salary floor, titles, sources and scoring weights. The current project-building platform is Perplexity, replacing the user's prior Copilot Studio attribution; employer technology requirements are not rewritten.
- **Resume descriptors:** Choose files to calculate SHA-256 fingerprints locally. Actual document contents are not uploaded to this app or stored. Supply the actual files directly to Perplexity.
- **Prepare Perplexity refresh:** Copy the provided instructions and download the request JSON. The request includes prior source URLs, workflow, the output contract and schema.
- **Import results / backup:** Preview the returned JSON, review conflicts and confirm the import. Current workflow wins by default; tracked omitted jobs remain in history.

No Copilot Studio connector was present in the input package. This is a file-based Perplexity handoff, not an automatic search, API subscription, background automation or application-submission service.

## Improvements

- Fixed dark interface with compact Calibri-first/Carlito typography.
- Private server-side persistence, clear save/error state and stale-write protection.
- Actual research-snapshot imports, portable backups and legacy workflow/CSV imports.
- Explicit import preview and conflict controls, stable-ID migration and retained history.
- Formula-safe CSV that restores exact multiline and formula-leading values on reimport.
- Resume fingerprinting with descriptor-only storage and duplicate-file handling.
- Dated evidence warnings and a clear distinction between fit/readiness labels and hiring probabilities.
- Browser-safe in-page copy fallbacks and authenticated attachment downloads.

Imported research keeps its original dates and scores. This software upgrade does not recheck listings, silently rescore them or substantiate an 80% offer probability.

## Hosting

### Private Perplexity preview

Run the backend behind the authenticated private proxy with `APP_MODE=perplexity`, `HOST=0.0.0.0` and `PORT=5001`. Deploy only `dist/public`; its backend placeholder is rewritten by Perplexity.

That mode trusts the platform-supplied visitor identity. Never expose it on an unprotected public server.

### Standalone private hosting

Use the Node server with HTTPS in front of it, `APP_MODE=standalone`, `HOST=0.0.0.0`, a configured `APP_BASIC_USER`, and a unique `APP_BASIC_PASSWORD` of at least 16 characters. Mount `.data` on persistent storage and maintain backups. The server refuses weak or missing authentication in standalone mode.

The private static UI alone is not a functional deployment: it requires the backend. This SQLite version is not intended for static GitHub Pages or stateless Vercel hosting without a separate durable backend. The separate fictional-data demo can be hosted statically, as described below.

## Development

```sh
npm run dev
npm run check
npm test
npm run build
```

Schemas live in `schemas/`; refresh instructions are in `docs/perplexity-agent-contract.md`. `FLOWS.md` documents browser acceptance coverage. CI uses only fictional fixtures and never uploads private data.

Carlito font files are distributed under the included SIL Open Font License.

## Profession-neutral demonstration

`public-demo/` is a separate static, fictional-data demonstration for people across professions. It borrows the supplied reference's navy header, separate summary tiles, company-first numbered cards and badges, while preserving compact dark-mode typography.

The demo includes career, workplace and minimum-salary filters plus seven additional filters: experience level, job type, industry, sample location scope, business travel, sample interview steps and application status. Filters combine with AND logic across cards, table and pipeline; each active filter has a removable chip. Unknown travel or interview values do not qualify for numeric limits, and sample interview steps do not predict turnaround or hiring outcomes.

```sh
npm run build:demo
serve dist/public-demo -l 5003 --no-clipboard
```

Only `dist/public-demo` is the published sample bundle. It contains no private seed, database, actual resume, personal notes, backend, account system or billing. Sample edits live in page memory, reset on reload and can be exported as escaped CSV. This is not a production multi-customer service.

The expanded demo was deployed at [job-tracker-workspace.vercel.app](https://job-tracker-workspace.vercel.app) on November 6, 2026, and checked on the live origin in a fresh browser context. The earlier [pplx.app demo](https://job-tracker-workspace.pplx.app) remains unchanged; the private tracker remains a separate authenticated preview, and no custom domain was purchased.

Building or editing the demo does not publish a new revision. Future publication requires fresh approval for the changed version.

### Vercel setup

`vercel.json` builds only the static demo using Node's built-in modules and serves `dist/public-demo`. No package installation, private server, database or environment secrets are needed. `.vercelignore` is deny-by-default and allows only the exact static build inputs, while local project associations stay out of Git.

Use a separate project named `job-tracker-workspace`, not another product's existing project. The deployment and verification checklist is in [docs/vercel.md](docs/vercel.md).

The Vercel project is linked to this repository with `main` configured as its production branch, so pushes may trigger publication. Keep unapproved runtime changes on feature branches and treat a runtime push to `main` as a production release.
