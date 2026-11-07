# Vercel real-job release

Deploy only the public employer-feed frontend and read-only `/api/jobs` function to the independently authorized `job-tracker-workspace` project. The private SQLite tracker, actual resumes and personalized workflow are excluded.

The production address is [job-tracker-workspace.vercel.app](https://job-tracker-workspace.vercel.app). The real-feed revision is a candidate until release approval and verified deployment; the previous live release was a fictional demonstration.

## Build and runtime

- **Framework:** Other (`framework: null`).
- **Install:** `node --version`; no runtime packages are required for the public feed.
- **Build:** `node scripts/build-demo.mjs`.
- **Static output:** `dist/public-demo`, exactly HTML, app/model JavaScript, two stylesheets, two local fonts and their license.
- **API:** `api/jobs.mjs` imports `src/live-feed.mjs`, which uses only `node:crypto` and `node:net`.
- **Function ceiling:** Thirty seconds, allowing the parallel twelve-second source deadlines to resolve as a partial response.
- **Secrets:** None required by the configured public employer GET endpoints.
- **Headers:** Same-origin connections, self-only scripts/styles/fonts, denied frames/forms/objects, nosniff and device-permission restrictions.

`.vercelignore` permits twelve exact CLI build-input/config files and rejects private data, private server/app modules, package manifests, validation scripts, fixtures, tests and local Vercel metadata. Git integration can access tracked public repo code; the explicit output and function tracing boundary must therefore also be verified. No filesystem or environment read is in the public function.

## Cache and operational limits

The service caches each checked snapshot in-process for five minutes and shares in-flight refreshes. Successful responses use a five-minute shared CDN cache with a short stale-revalidation window. Source check timestamps are not rewritten when cached. Failed sources retain only actual last-good data with stale labels; complete failure has a shorter cooldown.

Only GET and the canonical query-free endpoint are supported. Query variants return 400 before any employer request. Fixed provider hosts, refused redirects, timeouts, streamed-response limits, record caps and a four-MiB response ceiling bound individual work.

There is no cross-instance application rate limiter. Cold instances can still call the eight public sources, and anonymous traffic can consume Vercel usage/provider quotas. Account-level firewall, concurrency, spending and billing settings remain unchanged; adding those controls is a separate authorization decision.

## Project and approval boundary

Check `.vercel/project.json` and confirm only `job-tracker-workspace`. Never relink or modify another product's project or ACED resources. Keep tokens and local metadata out of Git and upload output.

The project is linked to `storyshaw2-hue/jobtracker`, production branch `main`. Runtime pushes/merges to `main` may publish automatically. Prepare unapproved changes on a feature branch; obtain approval for the current production revision before merging or deploying.

## Verification

1. Run syntax, unit/API tests and both builds. Inspect output and the function import closure.
2. Review the exact candidate for security and privacy; resolve blocking findings and disclose remaining warnings.
3. Verify the private preview's actual feed, filters, source links, workflow preservation, CSV, mobile layout and failure states.
4. After release approval, use the installed Vercel CLI in a fresh foreground call targeting the linked project. Wait for completion and independently inspect final Ready status.
5. Open the returned site in a fresh anonymous browser. Check actual `/api/jobs`, real source statuses, filters, employer link, CSV and response headers. Check private paths return 404 and assets match the approved candidate.

The public feed is not a paid multi-customer service: no accounts, durable public workflow, resume uploads, payment system or automated applications are included. Perplexity matching runs privately on demand through the separate Skill/workspace, not inside Vercel.
