import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Vercel builds only the dependency-free fictional-data demo", () => {
  const config = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, "node scripts/build-demo.mjs");
  assert.equal(config.installCommand, "node --version");
  assert.equal(config.outputDirectory, "dist/public-demo");
  assert.equal(config.functions, undefined);
  assert.equal(config.rewrites, undefined);
  const headers = Object.fromEntries(
    config.headers[0].headers.map((h) => [h.key, h.value]),
  );
  assert.match(headers["Content-Security-Policy"], /connect-src 'none'/);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
});
