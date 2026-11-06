# Vercel deployment

This repository contains a private tracker and a separate public sample demo. Vercel must deploy only the sample demo, never the private tracker or its SQLite data.

The approved sample is live at [job-tracker-workspace.vercel.app](https://job-tracker-workspace.vercel.app). It was deployed and checked in a fresh browser context on November 6, 2026.

## Build settings

- **Framework:** Other (`framework: null`).
- **Install command:** `node --version`, because the demo needs no packages.
- **Build command:** `node scripts/build-demo.mjs`.
- **Output directory:** `dist/public-demo`.
- **Environment variables:** None needed for this sample.

The root `vercel.json` contains these settings and security headers. `.vercelignore` permits only ten static build-input files during CLI uploads; the build produces eight public assets.

## Project boundary

Use the independently authorized `job-tracker-workspace` project. Check `.vercel/project.json` before deploying and confirm both the project and workspace association; do not reuse another product's project or overwrite an unrelated local link.

Local `.vercel` metadata is ignored by Git and by deployment uploads. Do not commit tokens, project credentials, `.data`, actual resumes, application notes, databases or the private server.

The project is linked to `storyshaw2-hue/jobtracker` with `main` as its production branch. Pushes may trigger publication, so keep unapproved runtime changes on feature branches; do not treat a push to `main` as a preview-only action.

## Release checks

- **Before upload:** Run `npm run check`, `npm test` and `npm run build:demo`. Inspect the output and confirm that it contains only the demo's HTML, JavaScript, CSS, fonts and license.
- **Authorization:** Obtain approval for the project, workspace and current production release. Building or pushing code is not permission to update an existing publication.
- **Deployment:** Deploy the intended linked project in a foreground CLI call, wait for completion, then independently inspect its final deployment status.
- **Live verification:** Open the returned URL in a fresh browser context. Check the new filters, unknown-value behavior, workflow, actual CSV download, mobile layout and response headers.

The sample's changes live only in browser memory and reset on reload. No customer accounts, payments, permanent storage, actual job search or automated applications are included.

## Verified release

- **Project:** `job-tracker-workspace`, independently created rather than reusing another product's project.
- **Runtime revision:** `d7d3b5b`.
- **Deployment:** `dpl_38uayPEirWwnjrzyEPmWJWvsABR8`, production, independently inspected as Ready.
- **Public address:** [job-tracker-workspace.vercel.app](https://job-tracker-workspace.vercel.app), checked without a signed-in Vercel session.
- **Coverage:** All 38 non-default filter choices, combinations, chips, quick filters, table/cards, filtered pipeline, sample edits, resets and actual CSV download passed on the live origin.
- **Boundary:** Actual CSP, nosniff and frame-denial headers were verified. Private seed, local Vercel metadata, private server, package manifest and private health API paths returned 404.
- **Version integrity:** All eight public assets matched the reviewed local bundle byte-for-byte. Documentation-only commits do not change those served assets.

The earlier pplx.app publication and the personal tracker were not republished by this Vercel release. Future runtime changes still require approval before another production deployment.
