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
  assert.match(compose, /"6001:3000"/);
  assert.match(compose, /http:\/\/127\.0\.0\.1:3000\/api\/health/);
  assert.match(compose, /start_period: 30s/);
});
