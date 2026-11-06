# Vercel deployment

This repository contains a private tracker and a separate public sample demo. Vercel must deploy only the sample demo, never the private tracker or its SQLite data.

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

## Release checks

- **Before upload:** Run `npm run check`, `npm test` and `npm run build:demo`. Inspect the output and confirm that it contains only the demo's HTML, JavaScript, CSS, fonts and license.
- **Authorization:** Obtain approval for the project, workspace and current production release. Building or pushing code is not permission to update an existing publication.
- **Deployment:** Deploy the intended linked project in a foreground CLI call, wait for completion, then independently inspect its final deployment status.
- **Live verification:** Open the returned URL in a fresh browser context. Check the new filters, unknown-value behavior, workflow, actual CSV download, mobile layout and response headers.

The sample's changes live only in browser memory and reset on reload. No customer accounts, payments, permanent storage, actual job search or automated applications are included.
