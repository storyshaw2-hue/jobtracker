import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, "dist/public");
await mkdir(output, { recursive: true });
// Only authored static assets are shipped. Private snapshots and databases are not.
await rm(output, { recursive: true, force: true });
await cp(resolve(root, "public"), output, { recursive: true });
console.log("Built static UI in dist/public. No private data was bundled.");
