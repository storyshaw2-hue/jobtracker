# Verification

## Automated checks

`npm run check`, `npm test`, `npm run build` and `npm run build:demo` pass. The 23 automated tests cover authentication, identity isolation, revision conflicts, authenticated attachments, nonmutating import previews, validation, profile versions, scoring evidence, exact CSV round trips, workflow preservation, stable-ID migration and fictional public-demo data/filter/export behavior.

CI runs the same checks against fictional fixtures. It also rejects private-data directories, databases, real document files and environment secrets in tracked files.

## Browser coverage

The upgraded app was exercised in Chromium at 1440px desktop, 375px mobile and a short desktop height. The original uploaded app was opened before modification.

- **Browse:** All quick filters, both imported resume tracks, search and empty-state recovery, seven sorts, card/table switching and all six sections.
- **Workflow:** Favorites, application stages, Chicago-local applied dates, exact multiline notes, actions, contacts, dates and reload persistence.
- **Profile:** No-op version preservation, invalid weights, changed-profile versioning, locally calculated resume fingerprints, duplicate-file handling, alias edits, removal and reset.
- **Handoff:** Perplexity instructions, selectable clipboard fallback, complete request schema and descriptor-only resume handling.
- **Imports:** Rejected duplicate IDs, nonmutating previews, actual CSV reimport, current-versus-imported conflict policies, research replacement, retained omitted applications and portable-backup/profile restoration.
- **Recovery:** Failed saves retain drafts; draft export and retry work. Concurrent changes produce a conflict rather than overwrite. Cancel/load-latest and failed-load/retry paths were exercised.
- **Downloads:** Backup JSON, request JSON and CSV were downloaded through real browser controls. Downloaded CSV restored exact quoted, multiline and formula-leading notes.
- **Responsive access:** Mobile filter disclosure, horizontal shortcut/tab strips, reachable notes and dialogs, and a desktop/mobile/desktop round trip.
- **Visual and DOM checks:** No page-width overflow or duplicate element/test IDs. Visible small-text contrast measured at least 7.22:1 in the tested populated desktop state. Computed type sizes were 12–13.333px, approximately 9–10pt, using the Calibri-first/Carlito stack.

An opaque-origin iframe harness also passed loading, filters, Perplexity request preparation, native attachment download and a real source-link click. The intentionally insecure local harness reports the secure-context fingerprinting limitation rather than losing data or pretending a file was fingerprinted.

Native Chromium downloads do not retain Playwright-injected identity headers on retries. Local attachment QA therefore used a loopback-only gateway that injected the isolated QA identity server-side, matching the private platform proxy's authentication model. The gateway and all real-data QA artifacts are ignored by Git.

## Hosted preview

The deployed app was opened through the platform-issued private proxy in fresh browser contexts. Backend loading/reloading, filters, the current Perplexity profile, request preparation, native request/CSV downloads, a real source-link click and mobile layout passed.

The hosted HTTPS app was also checked inside a sandboxed opaque-origin iframe. Local resume fingerprinting, filters, request preparation and native backup/request downloads passed with no page errors in the settled parent/child harness. The hosted fingerprint check used a synthetic file and was canceled without saving its descriptor.

Hosted checks did not alter the viewer's saved profile or application workflow. Save/import mutations were tested only under a separately identified local QA workspace.

The canonical Perplexity viewer showed an anti-automation interstitial in headless Chromium, so the app was tested through the deployment tool's issued private-preview URL instead. This is distinct from independently automating the surrounding Perplexity viewer interface.

## Boundaries

The implementation preserves the original private seed's records, source text, scores and research dates. This verification is not a new job search or a claim that any imported posting is still available.

Real snapshots, resumes, contacts, notes, databases and screenshots are not part of the public repository or static deployment. Testing used isolated QA identities, and temporary QA changes were restored without altering another viewer's workflow.

SQLite persistence survives server restarts in this environment, not migration to another host by itself. Export a portable backup before changing environments.

## Reference-led visual revision

The newly supplied standalone HTML was opened before editing. Its patch repeats the earlier upgrade and contains private records and stale integration instructions, so it was not applied wholesale to the public repository.

The revised interface uses the reference's navy header, separate shortcut tiles, numbered company-first cards, pill badges and priority corner labels. Dark mode and approximately 9–10pt Calibri-first typography remain in place. Source records, scores, research dates, profile metadata and server-side workflow semantics were not rewritten by the visual change.

The private app's filters, resume tracks, seven sorts, cards/table, details, all sections, profile no-op/validation, save/reload, exports and Perplexity handoff were rechecked under an isolated QA identity. Temporary QA workflow edits were restored.

The separate public-demo candidate covers six fictional professions. Browser checks exercised all quick filters, career/workplace/pay/text filtering, empty recovery, sorting, cards/table, details, favorites, stage changes, pipeline, sample notes/actions, reset/cancel, reload-reset behavior, CSV download/copy fallback and the real GitHub link. No data-bearing network requests were observed.

An independent pre-publication security review found no BLOCK or WARN findings in the static-only candidate. This does not authorize publication or certify a future commercial service; public release still needs user approval.

The revised desktop states had no duplicate element/test IDs or text-contrast failures; the measured minimum was 6.09:1. Both versions were checked at 375px and a short desktop height, with visible dialogs and accessible sample notes. An opaque demo harness passed filtering and Blob CSV download with the platform's permissive asset-CORS behavior mirrored locally; this is not a claim that a public site has already been published or tested.
