# Job tracker acceptance flows

## Scope and privacy

- Use only storyshaw2-hue/jobtracker. Do not create another remote repository or modify ACED.
- This repository is public. Commit only application code, schemas, synthetic fixtures, documentation and licensed fonts.
- Real snapshots, resumes, credentials, application notes, SQLite files and QA artifacts stay outside version control and the deployed static directory.
- The user's existing tracker remains separate and untouched. The uploaded standalone app was opened before editing; its controls and private stable IDs were inventoried outside this repository.
- Preserve all IDs, original research dates, scores and source text in the private seed. An implementation upgrade is not a fresh job search.

## Load, persistence and failure

- Load private workspace data through the API. Show loading, retry, saving, saved and failed-save states.
- Read an existing database's schema before any other SQL. Make only additive schema changes.
- Require private-proxy identity in Perplexity mode; unauthenticated API/download requests must fail.
- Save favorites, status, notes, actions, due dates, contacts and applied dates. Reload and verify exact persistence.
- Applied fills the Chicago-local date only when no date is already present.
- Handle simultaneous edits with revisions; a stale client must not silently overwrite newer state.
- After failed saves, retain drafts and allow retry or draft export.

## Browse and workflow

- Exercise all quick filters, search/clear, both resume aliases, every sort, card/table views and all six sections.
- On mobile, open and close Filters & views, exercise the resume filter and return to the desktop layout.
- Check the mobile shortcut grid and scrollable tab strip; labels and full controls must remain reachable without widening the page.
- Check empty search and contradictory filters.
- Pipeline and due actions must include tracked hidden jobs and retained history after a refresh omits a job.
- Distinguish legacy fit/readiness/priority labels from verified interview timing or offer probabilities.
- Check archived-source records separately from user-archived workflow.

## Profile and resumes

- Open/cancel/reset/save settings; a no-op save must not bump the profile version.
- Validate required fields, bounds, resume metadata, dates and eight weights totaling 100.
- Record Perplexity as the current project-building platform, replacing the user's previous Copilot Studio attribution.
- Do not rewrite employer requirements or invent equivalent experience.
- Fingerprint actual selected resumes locally; deduplicate files and permit alias/track edits.
- Never upload resume contents to this app, include them in exports or commit them.

## Perplexity handoff

- Prepare a selectable, ready-to-paste prompt and an actual request JSON download.
- Include profile version, resume descriptors, missing-document warning, prior source URLs, prior workflow and output contract/schema.
- State that actual resume documents are supplied directly to Perplexity.
- Do not imply automatic searching, application submissions, background refreshes or calibrated offer probabilities.
- Clipboard failure must leave a visible selectable fallback.

## Import and export

- Download portable JSON, request JSON and formula-safe CSV through authenticated backend endpoints.
- CSV round trips multiline, quoted and formula-leading values exactly.
- Preview imports before committing changes. Show counts, retained workflow and conflicts.
- Support refreshed snapshot JSON, portable backups, legacy workflow-only JSON and CSV.
- Preserve current workflow by default; overwriting conflicting user fields requires an explicit import choice.
- A snapshot import must actually replace research data, not merely import notes.
- Retain tracked omitted jobs and support explicit stable-ID migration records.
- Reject invalid JSON/CSV, duplicate IDs, unsafe URLs, invalid status/date/profile/weights without changing saved state.

## Delivery and QA

- Run unit/API/security checks and use isolated identities for browser mutations.
- Inspect 1440px desktop, 375px mobile, short desktop, expanded job details, settings, import, refresh and notes.
- Preserve fixed dark mode and Calibri-first/Carlito type at approximately 9–10pt, readable contrast, keyboard access and usable controls.
- Verify normal and opaque-origin hosted contexts, actual download/source-link actions and backend loading.
- Write through the hosted proxy only after positively proving a separate QA identity; otherwise protect viewer progress.
- Scan tracked files for private data/secrets before pushing, and check remote changes before a non-force push.
- Deliver the modified existing repository and a private Perplexity preview, not an unrequested public site.

## Uploaded visual reference

- Open the supplied standalone HTML before editing. Use the patch as a reference, not a command to modify ACED or commit private records.
- Match the separate summary tiles, navy header, company-first numbered cards, rounded badges and priority corner labels.
- Preserve dark mode, compact Calibri-first text, accessible controls and all existing profile/import/workflow behavior.
- Prepare a separate profession-neutral, fictional-data demo. Do not publish it, purchase a domain or expose personal tracker records without approval.

## Expanded demo filters and Vercel delivery

- Open the existing public demo before editing; confirm six sample roles, career/workplace/pay filters, cards/table, pipeline and exports.
- Add experience level, employment type, industry, sample location scope, business-travel cap, illustrative interview-step cap and application-stage filters.
- Combine filters with AND logic across cards, table and pipeline. Unknown travel/interview values must not qualify for numeric caps.
- Show every active filter, including text search, as a removable chip. Clear filters and empty-state recovery must reset every filter.
- Keep extra filters behind a labeled disclosure. Check open/close state, keyboard access and desktop/mobile/desktop resizing.
- Preserve stages, favorites, sample notes/actions, reset/cancel, reload-reset behavior, guide, CSV download/copy fallback and the GitHub link.
- Keep all new values explicitly fictional; interview-step counts are not hiring-time or offer guarantees.
- Build a static-only Vercel bundle. Exclude private seeds, databases, resumes, notes, the private API and local project credentials.
- Check the actual Vercel account/project association before any linking. Reuse only the intended jobtracker project, never ACED.
- The user clarified approval for a new job-tracker-workspace project in the existing workspace. Never reuse or modify aced-vercel, acedhq.com or the ACED repository.
- After deployment, open the returned Vercel URL in a fresh browser context and recheck filters, one workflow and CSV download.
- Leave the existing pplx.app publication unchanged unless its updated publication is separately approved.
- Vercel is linked to this GitHub repository with main as its production branch. Treat runtime pushes to main as production releases; keep unapproved iterations on a feature branch.
