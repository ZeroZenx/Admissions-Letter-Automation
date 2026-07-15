import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Docker runtime runs as non-root and checks application health", async () => {
  const dockerfile = await readFile("Dockerfile", "utf8");

  assert.match(dockerfile, /COPY --from=builder --chown=node:node \/app\/\.next/);
  assert.match(dockerfile, /chown -R node:node \/app\/storage/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK .*\/api\/health/);
});

test("docker compose exposes an app healthcheck", async () => {
  const compose = await readFile("docker-compose.yml", "utf8");

  assert.match(compose, /app:\n[\s\S]*healthcheck:/);
  assert.match(compose, /"6001:6001"/);
  assert.match(compose, /http:\/\/127\.0\.0\.1:6001\/api\/health/);
  assert.doesNotMatch(compose, /:3000/);
  assert.match(compose, /start_period: 30s/);
});

test("package scripts provide one-command validation and native port 6001 startup", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };

  assert.equal(packageJson.scripts.start, "next start -H 0.0.0.0 -p 6001");
  assert.equal(packageJson.scripts["start:6001"], "next start -H 0.0.0.0 -p 6001");
  assert.match(packageJson.scripts.validate, /npm run lint/);
  assert.match(packageJson.scripts.validate, /npm run typecheck/);
  assert.match(packageJson.scripts.validate, /npm test/);
  assert.match(packageJson.scripts.validate, /npm run build/);
  assert.match(packageJson.scripts.validate, /npm audit --omit=dev/);
  assert.match(packageJson.scripts["db:migrate"], /--env-file-if-exists=\.env\.local/);
  assert.match(packageJson.scripts.smoke, /--env-file-if-exists=\.env\.local/);
});

test("dashboard grids contain wide operational tables without page-level overflow", async () => {
  const styles = await readFile("app/globals.css", "utf8");

  assert.match(styles, /\.grid > \*,\s*\.panel,\s*\.panel-body \{\s*min-width: 0;/);
  assert.match(styles, /\.table-wrap \{\s*overflow: auto;/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.topbar > :first-child \{\s*flex: 1 0 100%;/);
});
