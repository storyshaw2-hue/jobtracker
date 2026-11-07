# Job Tracker Workspace

Real employer job feeds for any profession, plus a separate private, resume-grounded Perplexity research workflow. This is the independent [storyshaw2-hue/jobtracker repository](https://github.com/storyshaw2-hue/jobtracker), not ACED.

This branch replaces the earlier fictional public demonstration. The production address is [job-tracker-workspace.vercel.app](https://job-tracker-workspace.vercel.app), but this revision is a release candidate until approved and deployed; the old live version must not be mistaken for the new feed.

## Real employer discovery

The browser loads `/api/jobs`, a read-only server function that checks configured Greenhouse, Ashby and Lever employer boards. Sources are explicit in `src/live-feed.mjs`; the interface shows each successful check, failure, last-success timestamp and coverage limit. It is not a search of the entire web.

- **Real records only:** No generated, sample or test job fallback. New private workspaces also start empty.
- **Evidence:** Employer posting links, check times, stated locations and structured pay accompany each listing. Employer feed inclusion is evidence at that check time, not a guarantee a vacancy stays open.
- **Filters:** Department, workplace, annual USD minimum, title-derived seniority, job type, sector grouping, stated country, employer, travel cap, stated interview steps, application status, publication date and feed/history state.
- **Unknowns:** Missing facts remain unknown. Hybrid is not promoted to remote; hourly and non-USD pay do not pass an annual USD floor. No inferred hiring odds or interview speed.
- **Workflow:** Save roles, update stages, add notes/actions/dates and use cards, table or pipeline. Public workflow stays in the current tab; export CSV before closing or reloading. It is not a durable multi-user account system.
- **Refresh:** Preserve current tab workflow and retain tracked roles missing from a later feed for rechecking, not automatic closure.

The adapters follow the public [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html), [Ashby job posting API](https://developers.ashbyhq.com/docs/public-job-posting-api) and [Lever postings API](https://github.com/lever/postings-api/blob/master/README.md). The interface links to full employer postings instead of republishing complete descriptions.

## Run the real-feed site locally

Requires Node.js 20 or later.

```sh
npm ci
npm run build:demo
npm run start:feed
```

Open `http://127.0.0.1:5004`. The historical `build:demo` command and `dist/public-demo` path are retained for deployment compatibility; they now build the real-feed frontend, not a sample dataset. A static file server alone cannot supply `/api/jobs`.

No third-party API key is needed for the configured public GET endpoints. The server has a five-minute in-process cache and shared concurrent refresh; successful Vercel responses also use a five-minute CDN cache. Check timestamps remain visible, including cached/stale records. All-failure checks retry after a shorter cooldown. Unsupported query variants are rejected before upstream work.

Anonymous traffic can still consume hosting usage and provider quotas across cold instances. There is no cross-instance application rate limiter; no account-level security, spending or billing setting is changed by this code.

## Private Perplexity job agent

The supplied Copilot Studio package defines a research contract, not an executable connector runtime. Its equivalent on-demand workflow is the Job Tracker Agent Perplexity Skill, prepared separately for installation in the user's chosen Skill destination.

The agent validates the current profile and actual resume files, searches every configured source or records a failure, verifies exact employer requisitions, deduplicates stable IDs, applies hard filters and documents eight weighted fit components. Scores assess evidence-grounded fit, not the probability of an offer. A public feed refresh is not a private resume match.

1. Configure the private tracker's profile and resume descriptors.
2. Prepare its Perplexity refresh prompt and request JSON.
3. Give Perplexity that request and the actual resume documents. Fingerprints and filenames alone are not qualifications.
4. Validate the returned private snapshot:

   ```sh
   npm run validate:agent -- --help
   npm run validate:agent -- --snapshot /private/result.json --request /private/request.json
   ```

5. Use the authorized same-viewer revision-protected preview/import workflow and verify readback, or import the validated JSON manually if authenticated write access is unavailable. Current user edits and explicit blanks win by default; omitted tracked roles remain in history.

The current contract is in `docs/perplexity-agent-contract.md`. The Skill is not installed merely because its candidate was authored. No background schedule, live Perplexity API subscription, employer outreach or automatic application submission is created.

Reusable Skill source is in `skills/job-tracker-agent/`. New resume descriptors default to the neutral General track; a filename is never treated as evidence of qualifications.

## Private tracker and data boundary

```sh
npm run build
npm start
```

Open `http://127.0.0.1:5001`. The private app uses SQLite and starts empty without an existing private seed or saved workspace. Put a valid real snapshot in ignored `.data/seed.private.json` before first use, or import through the app. Existing saved workspaces are never replaced because a seed file changes.

Private profiles, actual resumes, personalized matches, notes, credentials, database files and QA output stay out of public Git and deployment bundles. Resume contents are supplied directly to Perplexity; the private app stores descriptors only. Test-only fictional fixtures remain for regression tests and are never a runtime fallback.

For a private Perplexity preview use `APP_MODE=perplexity`, `HOST=0.0.0.0`, `PORT=5001` behind its authenticated identity proxy. Never expose this mode unprotected. Standalone hosting requires HTTPS, `APP_MODE=standalone`, a configured username and unique password of at least 16 characters, persistent storage and backups. Local SQLite persistence is not independent cloud durability.

## Development and release

```sh
npm run check
npm test
npm run build
npm run build:demo
```

CI uses test-only synthetic fixtures and rejects tracked private records/secrets. The additive JSON-schema changes allow unknown pay/posting dates and explicit blank workflow dates without rewriting any existing data or SQL schema.

`vercel.json` serves only the built real-feed frontend and `api/jobs.mjs`; that function imports only the feed module and Node built-ins. CLI uploads use a deny-by-default source allowlist. Git builds can see tracked public code, so isolation also relies on the explicit output directory and narrow function import closure, not `.vercelignore` alone.

Use only the already authorized `job-tracker-workspace` Vercel project. Its GitHub production branch is `main`; merging runtime changes can publish immediately. Keep unapproved iterations on a feature branch and obtain release approval before replacing the public site. The earlier pplx.app publication is unchanged unless its replacement is separately authorized.

For an explicitly approved pplx.app backend update, `npm run build:feed-runtime` creates isolated `dist/public-feed-runtime` with only the public modules and assets. Never upload the whole working repository or its `.data` folder as that site's backend project.

See [Vercel release checks](docs/vercel.md), [browser acceptance flows](FLOWS.md) and [verification history](docs/verification.md). Carlito fonts use the included SIL Open Font License.
