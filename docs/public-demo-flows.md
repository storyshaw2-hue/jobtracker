# Public real-job workspace flows

The historical `public-demo` paths now contain real employer-feed discovery. Test fixtures are excluded, and new private workspaces start empty; this is not an accounting-only product.

## Load and evidence

- Load actual employer data through `/api/jobs`; show loading, real counts, last-check time and source coverage.
- Open Sources: inspect successful-empty, successful-populated, failed and stale cases distinctly. Unknown counts are not zero.
- Click an employer posting and a source-feed link. Verify actual destinations, not just href attributes.
- Missing salary/currency, country eligibility, travel, interview counts and publication dates remain unknown. Do not substitute fetch time for posting time.

## Browse and filter

- Exercise every dynamic non-default choice, then clear it. Combine department, remote workplace, annual USD floor and additional facets with AND logic.
- Check unknown values, contradictory filters, empty recovery and removable chips, including escaped search text.
- Exercise all six shortcuts, four sorts, previous/next pagination, cards/table and filtered pipeline.
- Open details, inspect source evidence and employer excerpt, and verify no resume-match claim.
- Test desktop, 375px mobile, short desktop, keyboard tabs, filter disclosure and desktop/mobile/desktop transitions.

## Workflow and refresh

- Save/unsave a job; update stage, dates, next action and multiline notes. Applied auto-fills a date only if empty.
- Refresh: preserve exact workflow. Retain a missing tracked role; mark stale sources and exclude them from successfully-checked-only filtering.
- A missing source response never creates sample jobs or marks a vacancy closed.
- Open reset, cancel it and verify preservation, then confirm reset and verify only tab workflow cleared.
- Open guide, GitHub link and export dialog; verify their content and actions.
- Download real CSV, check source metadata and formula-leading values, exercise copy/selection fallback.
- Reload and verify the disclosed tab-only reset. No public workflow is persisted or sent to the jobs API.

## Release gate

Use the same private preview asset. Public replacement requires current-revision approval. Keep private data, credentials, private server endpoints and unrelated ACED resources outside this release.
