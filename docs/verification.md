# Verification

## Automated checks

`npm run check`, `npm test` and `npm run build` pass. The 19 automated tests cover authentication, identity isolation, revision conflicts, authenticated attachments, nonmutating import previews, validation, profile versions, scoring evidence, exact CSV round trips, workflow preservation and stable-ID migration.

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

## Boundaries

The implementation preserves the original private seed's records, source text, scores and research dates. This verification is not a new job search or a claim that any imported posting is still available.

Real snapshots, resumes, contacts, notes, databases and screenshots are not part of the public repository or static deployment. Testing used isolated QA identities, and temporary QA changes were restored without altering another viewer's workflow.

SQLite persistence survives server restarts in this environment, not migration to another host by itself. Export a portable backup before changing environments.
